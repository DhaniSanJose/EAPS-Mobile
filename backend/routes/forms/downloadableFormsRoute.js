const express = require("express");
const puppeteer = require("puppeteer");

const { insertAuditLogAdmission, insertAuditLogEnrollment } = require("../../utils/auditLogger");

const router = express.Router();

// ─── Shared audit helpers (same pattern as facultyRoute.js) ────────────────
const formatEnrollmentAuditActorRole = (role) => {
  const safeRole = String(role || "registrar").trim();
  if (!safeRole) return "Registrar";

  return safeRole
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const getEnrollmentAuditActor = (req) => ({
  actorId:
    req.body?.audit_actor_id ||
    req.headers["x-audit-actor-id"] ||
    req.headers["x-employee-id"] ||
    "unknown",
  actorRole:
    req.body?.audit_actor_role ||
    req.headers["x-audit-actor-role"] ||
    "registrar",
});

const buildPersonPrintName = (
  { last_name, first_name },
  fallback = "Unknown Applicant",
) => {
  const lastName = String(last_name || "").trim();
  const firstName = String(first_name || "").trim();
  if (lastName) return `${lastName}, ${firstName}`.trim();
  return firstName || fallback;
};

const insertPdfExportAudit = async (
  req,
  { documentLabel, legacyAction, legacyMessage },
) => {
  try {
    const { actorId, actorRole } = getEnrollmentAuditActor(req);
    const roleLabel = formatEnrollmentAuditActorRole(actorRole);
    const printAction = String(req.body?.audit_print_action || "").trim();
    const applicantNumber = String(req.body?.applicant_number || "").trim();
    const studentNumber = String(
      req.body?.student_number || req.body?.applicant_number || "",
    ).trim();
    const label = String(
      req.body?.document_label || documentLabel || "document",
    ).trim();

    if (printAction === "PRINTING_APPLICANT_DOCS") {
      const applicantName = buildPersonPrintName(req.body || {}, "Unknown Applicant");

      await insertAuditLogAdmission({
        actorId,
        role: actorRole,
        action: "PRINTING_APPLICANT_DOCS",
        severity: "INFO",
        message: `${roleLabel} (${actorId}) printed ${label} for applicant ${applicantName} (${applicantNumber || "N/A"}).`,
      });
      return;
    }

    if (printAction === "PRINTING_STUDENT_DOCS") {
      const studentName = buildPersonPrintName(req.body || {}, "Unknown Student");

      await insertAuditLogEnrollment({
        actorId,
        role: actorRole,
        action: "PRINTING_STUDENT_DOCS",
        severity: "INFO",
        message: `${roleLabel} (${actorId}) printed ${label} for student ${studentName} (${studentNumber || "N/A"}).`,
      });
      return;
    }

    if (printAction === "DOWNLOAD_EXAM_PDF") {
      const applicantName = buildPersonPrintName(req.body || {}, "Unknown Applicant");

      await insertAuditLogAdmission({
        actorId,
        role: actorRole,
        action: "DOWNLOAD_EXAM_PDF",
        severity: "INFO",
        message: `${roleLabel} (${actorId}) downloaded ${label} PDF for applicant ${applicantName} (${applicantNumber || "N/A"}).`,
      });
      return;
    }

    await insertAuditLogAdmission({
      actorId,
      role: actorRole,
      action: legacyAction,
      severity: "INFO",
      message: legacyMessage({
        roleLabel,
        actorId,
        applicant_number: applicantNumber,
      }),
    });
  } catch (auditErr) {
    console.error(`${legacyAction || documentLabel} PDF audit log failed:`, auditErr);
  }
};

// ─── Shared Puppeteer launch config ─────────────────────────────────────────
const launchBrowser = () =>
  puppeteer.launch({
    headless: true,
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

const buildOutputFilename = (prefix, { last_name, first_name, applicant_number }) => {
  const safeLastName = String(last_name || "Applicant").trim().replace(/\s+/g, "_");
  const safeFirstName = String(first_name || "").trim().replace(/\s+/g, "_");
  const applicantSuffix = applicant_number ? `_${applicant_number}` : "";
  return `${prefix}_${safeLastName}${safeFirstName ? "_" + safeFirstName : ""}${applicantSuffix}.pdf`;
};

const waitForImages = (page) =>
  page.evaluate(async () => {
    const images = Array.from(document.images);
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }),
    );
  });

// ─── 1. Admission Form (Process) ────────────────────────────────────────────
router.post("/generate-admission-form-pdf", async (req, res) => {
  let browser;

  try {
    const { html, applicant_number, last_name, first_name } = req.body;

    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "No HTML received" });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();

    // Match the print window's real page proportions (A4 in mm at high-res),
    // not the COR route's 816px pattern — that mismatch is what caused the
    // blank second page.
    await page.setViewport({
      width: 794,   // 210mm @ 96dpi
      height: 1123, // 297mm @ 96dpi
      deviceScaleFactor: 2,
    });

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("requestfailed", (request) =>
      console.log("REQUEST FAILED:", request.url(), request.failure()?.errorText),
    );

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "media") {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Wrap the admission form HTML with the SAME print CSS used by the
    // Print button in AdminAdmissionFormProcess.jsx (@page A4, the 0.88
    // scale, .print-container, etc.) so Puppeteer lays it out identically
    // to what the browser's own print preview shows.
    const wrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      margin: 0;
      padding: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 210mm;
      height: 297mm;
      background: #ffffff;
      font-family: Arial, sans-serif;
      overflow: hidden;
    }

    @page {
      size: A4;
      margin: 0;
    }

    @media print {
      button { display: none !important; }
    }

    .print-container {
      width: 100%;
      height: auto;
      padding: 10px 20px;
     transform: scale(0.836);
      /* no transform-origin override — match the working print window's default (50% 50%) */
    }

    .student-table {
      margin-top: -90px !important;
    }

    button {
      display: none;
    }

    .dataField {
      margin-top: 2px !important;
    }

    svg.MuiSvgIcon-root {
      margin-top: -53px;
      width: 70px !important;
      height: 70px !important;
    }

    table {
      border-collapse: collapse;
    }

    img {
      max-width: 100%;
    }

    [style*="background-color"],
    [style*="backgroundColor"] {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${html}
  </div>
</body>
</html>
    `.trim();

    await page.setContent(wrappedHtml, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    await waitForImages(page);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      // Matches @page { size: 8.5in 11in; margin: 0.25in; } from the
      // component's own embedded print styles.
      margin: { top: "0.25in", bottom: "0.25in", left: "0.25in", right: "0.25in" },
    });


    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty");
    }

    const fileName = buildOutputFilename("Admission_Form_Process", req.body);

    await insertPdfExportAudit(req, {
      documentLabel: "Admission Form (Process)",
      legacyAction: "ADMISSION_FORM_PROCESS_PDF_EXPORT",
      legacyMessage: ({ roleLabel, actorId, applicant_number }) =>
        `${roleLabel} (${actorId}) exported Admission Form (Process) PDF${applicant_number ? ` for Applicant (${applicant_number})` : ""}.`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("Admission Form PDF ERROR:", err);
    return res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
      stack: err.stack,
    });
  } finally {
    if (browser) await browser.close();
  }
});

// ─── 2. Office of the Registrar ─────────────────────────────────────────────
router.post("/generate-registrar-form-pdf", async (req, res) => {
  let browser;

  try {
    const { html, applicant_number, last_name, first_name } = req.body;

    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "No HTML received" });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 2,
    });

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("requestfailed", (request) =>
      console.log("REQUEST FAILED:", request.url(), request.failure()?.errorText),
    );

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "media") {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Mirrors printDiv()'s CSS in OfficeOfTheRegistrar.jsx EXACTLY.
    // Note: no transform/scale on .print-container for this form —
    // don't add one, or spacing will drift from the real print preview.
    const wrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 210mm;
      height: 297mm;
      font-family: Arial;
      background: #ffffff;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 1;
      padding: 0;
    }

    .print-container {
      width: 100%;
      height: auto;
      padding: 10px;
    }

    button {
      display: none;
    }

    .student-table {
      margin-top: -10px !important;
    }

    svg.MuiSvgIcon-root {
      width: 24px !important;
      height: 24px !important;
    }

    table {
      border-collapse: collapse;
    }

    img {
      max-width: 100%;
    }

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${html}
  </div>
</body>
</html>
    `.trim();

    await page.setContent(wrappedHtml, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    await waitForImages(page);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: false,
      // Matches @page { size: 8.5in 11in; margin: 0.25in; } from the
      // component's own embedded print styles.
      margin: { top: "0.25in", bottom: "0.25in", left: "0.25in", right: "0.25in" },
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty");
    }

    const fileName = buildOutputFilename("Office_Of_The_Registrar", req.body);

    await insertPdfExportAudit(req, {
      documentLabel: "Office of the Registrar Form",
      legacyAction: "REGISTRAR_FORM_PDF_EXPORT",
      legacyMessage: ({ roleLabel, actorId, applicant_number }) =>
        `${roleLabel} (${actorId}) exported Office of the Registrar PDF${applicant_number ? ` for Applicant (${applicant_number})` : ""}.`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("Registrar Form PDF ERROR:", err);
    return res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
      stack: err.stack,
    });
  } finally {
    if (browser) await browser.close();
  }
});

// ─── 3. Personal Data Form ──────────────────────────────────────────────────
router.post("/generate-personal-data-form-pdf", async (req, res) => {
  let browser;

  try {
    const { html, applicant_number, last_name, first_name } = req.body;

    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "No HTML received" });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setViewport({
      width: 794,   // 210mm @ 96dpi
      height: 1123, // 297mm @ 96dpi
      deviceScaleFactor: 2,
    });

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("requestfailed", (request) =>
      console.log("REQUEST FAILED:", request.url(), request.failure()?.errorText),
    );

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "media") {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Wrap using the SAME print CSS as printDiv() in PersonalDataForm.jsx
    // (scale 0.90, top-left origin, 110%/100% container — this form's
    // print rules are DIFFERENT from the Admission Form's, don't reuse
    // that route's CSS block here).
    const wrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 210mm;
      height: 297mm;
      font-family: Arial;
      overflow: hidden;
      background: #ffffff;
    }

    .print-container {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      zoom: 0.90;
    }

    .student-table {
      margin-top: 15px !important;
    }

    input[type="checkbox"] {
      width: 12px;
      height: 12px;
      transform: scale(1);
      margin: 2px;
    }

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    button {
      display: none;
    }

    /* Custom checkbox checkmark rendering — must be present here too,
       since Puppeteer parses this as a fresh document, not inheriting
       the <style> blocks the React component injected inline. */
    .custom-checkbox {
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      display: inline-block;
      position: relative;
      border: 1px solid black;
      background-color: white;
    }
    .custom-checkbox:checked::after {
      content: '✓';
      position: absolute;
      top: -2px;
      left: 3px;
      font-size: 16px;
      color: black;
    }

    table {
      border-collapse: collapse;
    }

    img {
      max-width: 100%;
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${html}
  </div>
</body>
</html>
    `.trim();

    await page.setContent(wrappedHtml, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    await waitForImages(page);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: false,
      // Matches @page { size: 8.5in 11in; margin: 0.25in; } from the
      // component's own embedded print styles.
      margin: { top: "0.25in", bottom: "0.25in", left: "0.25in", right: "0.25in" },
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty");
    }

    const fileName = buildOutputFilename("Personal_Data_Form", req.body);

    await insertPdfExportAudit(req, {
      documentLabel: "Personal Data Form",
      legacyAction: "PERSONAL_DATA_FORM_PDF_EXPORT",
      legacyMessage: ({ roleLabel, actorId, applicant_number }) =>
        `${roleLabel} (${actorId}) exported Personal Data Form PDF${applicant_number ? ` for Applicant (${applicant_number})` : ""}.`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("Personal Data Form PDF ERROR:", err);
    return res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
      stack: err.stack,
    });
  } finally {
    if (browser) await browser.close();
  }
});


// ─── 4. ECAT Application Form ───────────────────────────────────────────────
router.post("/generate-ecat-form-pdf", async (req, res) => {
  let browser;

  try {
    const { html, applicant_number, last_name, first_name } = req.body;

    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "No HTML received" });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 2,
    });

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("requestfailed", (request) =>
      console.log("REQUEST FAILED:", request.url(), request.failure()?.errorText),
    );

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "media") {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Mirrors printDiv()'s CSS in ECATApplicationForm.jsx EXACTLY, including
    // the negative body margin / .student-table offset trick. That offset is
    // designed to counteract the browser's own @page margin reservation —
    // since Puppeteer's page.pdf() margin option reserves space the same
    // way, we keep the same offset here and set the PDF margin to 10mm
    // (matching @page) rather than 0, or the offset math won't line up.
    const wrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    html, body {
      margin: 0;
      margin-top: -80px;
      padding: 0;
      font-family: Arial;
      width: auto;
      height: auto;
      overflow: visible;
      background: #ffffff;
    }

    .print-container {
      width: 100%;
      box-sizing: border-box;
    }

    .student-table {
      margin-top: 170px !important;
    }

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    button {
      display: none;
    }

    table {
      border-collapse: collapse;
    }

    img {
      max-width: 100%;
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${html}
  </div>
</body>
</html>
    `.trim();

    await page.setContent(wrappedHtml, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    await waitForImages(page);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      // Matches the @page { margin: 10mm 10mm 10mm 10mm; } rule from
      // printDiv() — needed for the -100px / 170px offset trick to
      // resolve to the same visual position as the real print preview.
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty");
    }

    const fileName = buildOutputFilename("ECAT_Application_Form", req.body);

    await insertPdfExportAudit(req, {
      documentLabel: "ECAT Application Form",
      legacyAction: "ECAT_FORM_PDF_EXPORT",
      legacyMessage: ({ roleLabel, actorId, applicant_number }) =>
        `${roleLabel} (${actorId}) exported ECAT Application Form PDF${applicant_number ? ` for Applicant (${applicant_number})` : ""}.`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("ECAT Form PDF ERROR:", err);
    return res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
      stack: err.stack,
    });
  } finally {
    if (browser) await browser.close();
  }
});
// ─── 5. Admission Services (Client Satisfaction Measurement form) ─────────
router.post("/generate-admission-services-pdf", async (req, res) => {
  let browser;

  try {
    const { html } = req.body;

    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "No HTML received" });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setViewport({
      width: 794,   // 210mm @ 96dpi
      height: 1123, // 297mm @ 96dpi
      deviceScaleFactor: 2,
    });

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("requestfailed", (request) =>
      console.log("REQUEST FAILED:", request.url(), request.failure()?.errorText),
    );

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "media") {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Mirrors printDiv()'s CSS in AdmissionServices.jsx EXACTLY, including
    // the "50xpx" typo on svg.MuiSvgIcon-root — that's an invalid CSS value,
    // so the browser (and Chromium here, identically) silently drops just
    // that one declaration and keeps width: 50px. Reproducing it verbatim
    // keeps the icon sizing pixel-identical to the real print preview;
    // "fixing" the typo here would make the PDF diverge from print.
    const wrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 210mm;
      height: 297mm;
      font-family: Arial;
      overflow: hidden;
      background: #ffffff;
    }

    .print-container {
      width: 115%;
      height: 100%;
      box-sizing: border-box;
      transform: scale(0.85);
      transform-origin: top left;
      margin-left: 10px;
    }

    input[type="checkbox"] {
      width: 12px;
      height: 12px;
      transform: scale(1);
      margin: 2px;
    }

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    button {
      display: none;
    }

    /* FIX ICON SIZE ON PRINT — kept verbatim from printDiv(), see comment above */
    svg.MuiSvgIcon-root {
      width: 50px !important;
      height: 50xpx !important;
    }

    table {
      border-collapse: collapse;
    }

    img {
      max-width: 100%;
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${html}
  </div>
</body>
</html>
    `.trim();

    await page.setContent(wrappedHtml, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    await waitForImages(page);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      // Matches @page { size: 8.5in 11in; margin: 0.25in; } from the
      // component's own embedded print styles.
      margin: { top: "0.25in", bottom: "0.25in", left: "0in", right: "0in" },
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty");
    }

    // No applicant-specific data is printed on this form (it's a blank
    // CSM template), so the filename is date-stamped rather than named
    // after a person.
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `Admission_Services_CSM_Form_${timestamp}.pdf`;

    await insertPdfExportAudit(req, {
      documentLabel: "Application/Student Satisfactory Survey",
      legacyAction: "ADMISSION_SERVICES_CSM_PDF_EXPORT",
      legacyMessage: ({ roleLabel, actorId }) =>
        `${roleLabel} (${actorId}) exported the Admission Services CSM form PDF.`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("Admission Services PDF ERROR:", err);
    return res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
      stack: err.stack,
    });
  } finally {
    if (browser) await browser.close();
  }
});

// ─── 6. Exam Permit ─────────────────────────────────────────────────────────
router.post("/generate-exam-permit-pdf", async (req, res) => {
  let browser;

  try {
    const { html, applicant_number, last_name, first_name } = req.body;

    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "No HTML received" });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();

    // Letter size (8.5in x 11in), not A4 — this form's own @page rule and
    // container width (width: "8.5in" in ExamPermit.jsx) are both sized
    // for Letter, unlike the other admission/registrar forms.
    await page.setViewport({
      width: 816,  // 8.5in @ 96dpi
      height: 1056, // 11in @ 96dpi
      deviceScaleFactor: 2,
    });

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("requestfailed", (request) =>
      console.log("REQUEST FAILED:", request.url(), request.failure()?.errorText),
    );

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "media") {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Mirrors the <style> block embedded directly in ExamPermit.jsx
    // (it doesn't use a separate printDiv()/window.open() flow like the
    // other forms — its print CSS lives inline in the component itself).
    // No transform/scale here — this form isn't scaled down like the
    // others, it renders at native size within the Letter page.
    const wrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 8.5in;
      background: #ffffff;
      font-family: Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    button {
      display: none;
    }

    table {
      border-collapse: collapse;
    }

    img {
      max-width: 100%;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>
    `.trim();

    await page.setContent(wrappedHtml, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    // Wait for logo, profile picture, and QR code to finish rendering
    await waitForImages(page);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: false,
      // Matches @page { size: 8.5in 11in; margin: 0.25in; } from the
      // component's own embedded print styles.
      margin: { top: "0.25in", bottom: "0.25in", left: "0.25in", right: "0.25in" },
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty");
    }

    const fileName = buildOutputFilename("Exam_Permit", req.body);

    await insertPdfExportAudit(req, {
      documentLabel: "Examination Permit",
      legacyAction: "EXAM_PERMIT_PDF_EXPORT",
      legacyMessage: ({ roleLabel, actorId, applicant_number }) =>
        `${roleLabel} (${actorId}) exported Exam Permit PDF${applicant_number ? ` for Applicant (${applicant_number})` : ""}.`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("Exam Permit PDF ERROR:", err);
    return res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
      stack: err.stack,
    });
  } finally {
    if (browser) await browser.close();
  }
});


// ─────────────────────────────────────────────────────────────────────────
// ADD THESE TWO ROUTES to your existing router file (the one with
// /generate-admission-form-pdf, /generate-exam-permit-pdf, etc).
// Paste them in above `module.exports = router;`.
// They reuse launchBrowser(), waitForImages(), and insertPdfExportAudit()
// which are already defined in that file — no new imports needed.
// ─────────────────────────────────────────────────────────────────────────

// ─── 7. Entrance Examination Scores ─────────────────────────────────────────
router.post("/generate-exam-scores-pdf", async (req, res) => {
  let browser;

  try {
    const { html } = req.body;

    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "No HTML received" });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();

    // Portrait A4 @ 96dpi, matches the @page { size: A4 portrait; margin: 8mm; }
    // rule from the original printDiv() window.
    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 2,
    });

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("requestfailed", (request) =>
      console.log("REQUEST FAILED:", request.url(), request.failure()?.errorText),
    );

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "media") {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Mirrors the <style> block from printDiv() in the Exam Scores component
    // exactly (corner labels, table-wrapper, header-content, etc). The
    // `html` payload here is just the .print-container's inner markup —
    // the client no longer sends the onload="window.print()" wrapper since
    // we're not opening a browser print dialog anymore.
    const wrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: A4 portrait; margin: 8mm; }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial;
      background: #ffffff;
    }

    .print-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding-left: 10px;
      padding-right: 10px;
    }

    .print-header {
      position: relative;
      width: 100%;
      margin-top: 10px;
    }

    .header-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
    }

    .header-content img {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      margin-top: 50px;
    }

    .header-text {
      text-align: center;
      margin-top: 50px;
    }

    .print-corner-label {
      position: absolute;
      top: 0;
      font-size: 12px;
      font-weight: bold;
    }

    .print-corner-label.left {
      left: 0;
      text-align: left;
    }

    .print-corner-label.right {
      right: 0;
      text-align: right;
    }

    .table-wrapper {
      width: 100%;
      margin-top: 20px;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      border: 1.5px solid black;
      table-layout: fixed;
    }

    th, td {
      border: 1.5px solid black;
      padding: 4px 3px;
      font-size: 9px;
      text-align: center;
      word-wrap: break-word;
      white-space: normal;
    }

    th {
      background-color: lightgray;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    td.applicant-name {
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${html}
  </div>
</body>
</html>
    `.trim();

    await page.setContent(wrappedHtml, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    await waitForImages(page);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" },
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty");
    }

    // Not tied to a single applicant, so date-stamp the filename like the
    // Admission Services CSM route does.
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `Entrance_Exam_Scores_${timestamp}.pdf`;

    await insertPdfExportAudit(req, {
      documentLabel: "Entrance Examination Scores",
      legacyAction: "EXAM_SCORES_PDF_EXPORT",
      legacyMessage: ({ roleLabel, actorId }) =>
        `${roleLabel} (${actorId}) exported the Entrance Examination Scores PDF.`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("Exam Scores PDF ERROR:", err);
    return res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
      stack: err.stack,
    });
  } finally {
    if (browser) await browser.close();
  }
});

// ─── 8. Applicant List ──────────────────────────────────────────────────────
router.post("/generate-applicant-list-pdf", async (req, res) => {
  let browser;

  try {
    const { html } = req.body;

    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "No HTML received" });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();

    // Portrait A4 @ 96dpi, matches @page { size: A4 portrait; margin: 8mm; }
    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 2,
    });

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("requestfailed", (request) =>
      console.log("REQUEST FAILED:", request.url(), request.failure()?.errorText),
    );

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "media") {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Mirrors the corner-label header style used by the Entrance Examination
    // Scores printDiv() (Department left / Program right, centered logo +
    // school name block), now applied to the Applicant List export as well.
    const wrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: A4 portrait; margin: 8mm; }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial;
      background: #ffffff;
    }

    .print-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding-left: 10px;
      padding-right: 10px;
    }

    .print-header {
      position: relative;
      width: 100%;
      margin-top: 10px;
    }

    .header-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
    }

    .header-content img {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      margin-top: 50px;
    }

    .header-text {
      text-align: center;
      margin-top: 50px;
    }

    .print-corner-label {
      position: absolute;
      top: 0;
      font-size: 12px;
      font-weight: bold;
    }

    .print-corner-label.left {
      left: 0;
      text-align: left;
    }

    .print-corner-label.right {
      right: 0;
      text-align: right;
    }

    .table-wrapper {
      width: 100%;
      margin-top: 20px;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      border: 1.5px solid black;
      table-layout: fixed;
    }

    th, td {
      border: 1.5px solid black;
      padding: 4px 3px;
      font-size: 9px;
      text-align: center;
      word-wrap: break-word;
      white-space: normal;
    }

    th {
      background-color: lightgray;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    td.applicant-name {
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${html}
  </div>
</body>
</html>
    `.trim();

    await page.setContent(wrappedHtml, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    await waitForImages(page);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: false,
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" },
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty");
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `Applicant_List_${timestamp}.pdf`;

    await insertPdfExportAudit(req, {
      documentLabel: "Applicant List",
      legacyAction: "APPLICANT_LIST_PDF_EXPORT",
      legacyMessage: ({ roleLabel, actorId }) =>
        `${roleLabel} (${actorId}) exported the Applicant List PDF.`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("Applicant List PDF ERROR:", err);
    return res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
      stack: err.stack,
    });
  } finally {
    if (browser) await browser.close();
  }
});


router.post("/generate-schedule-applicant-list-pdf", async (req, res) => {
  let browser;

  try {
    const { html, title, fileNamePrefix } = req.body;

    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "No HTML received" });
    }
    if (!title || typeof title !== "string") {
      return res.status(400).json({ message: "No title received" });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();

    // Portrait A4 @ 96dpi, matches @page { size: A4 portrait; margin: 8mm; }
    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 2,
    });

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("requestfailed", (request) =>
      console.log("REQUEST FAILED:", request.url(), request.failure()?.errorText),
    );

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "media") {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Same corner-label header style used by the Entrance Examination Scores /
    // Applicant List export (Department|College left / Program right, centered
    // logo + school name block), reused here for Proctor / Interviewer /
    // Evaluator applicant list exports.
    const wrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial;
      background: #ffffff;
    }

    .print-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding-left: 10px;
      padding-right: 10px;
    }

    .print-header {
      position: relative;
      width: 100%;
  
    }

    .header-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
    }

    .header-content img {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
  
    }

    .header-text {
      text-align: center;
     
    }


    .info-row {
      margin-top: 16px;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .info-row-line {
      display: flex;
      justify-content: space-between;
      width: 100%;
      font-size: 12px;
    }

    .table-wrapper {
      width: 100%;
      margin-top: 20px;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      border: 1.5px solid black;
      table-layout: fixed;
    }

    th, td {
      border: 1.5px solid black;
      padding: 4px 3px;
      font-size: 9px;
      text-align: center;
      word-wrap: break-word;
      white-space: normal;
    }

    th {
      background-color: lightgray;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    td.applicant-name {
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${html}
  </div>
</body>
</html>
    `.trim();

    await page.setContent(wrappedHtml, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    await waitForImages(page);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: false,
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" },
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty");
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const prefix = fileNamePrefix || title.replace(/[^a-z0-9]+/gi, "_");
    const fileName = `${prefix}_${timestamp}.pdf`;

    await insertPdfExportAudit(req, {
      documentLabel: title,
      legacyAction: "SCHEDULE_APPLICANT_LIST_PDF_EXPORT",
      legacyMessage: ({ roleLabel, actorId }) =>
        `${roleLabel} (${actorId}) exported the ${title} PDF.`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("Schedule Applicant List PDF ERROR:", err);
    return res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
      stack: err.stack,
    });
  } finally {
    if (browser) await browser.close();
  }
});

router.post("/generate-qualifying-interview-score-pdf", async (req, res) => {
  let browser;

  try {
    const { html } = req.body;

    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "No HTML received" });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();

    // Portrait A4 @ 96dpi, matches @page { size: A4 portrait; margin: 8mm; }
    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 2,
    });

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("requestfailed", (request) =>
      console.log("REQUEST FAILED:", request.url(), request.failure()?.errorText),
    );

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "media") {
        request.abort();
      } else {
        request.continue();
      }
    });

    const wrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: A4 portrait; margin: 8mm; }
 
    * { box-sizing: border-box; }
 
    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial;
      background: #ffffff;
    }
 
    .print-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding-left: 10px;
      padding-right: 10px;
    }
 
    .print-header {
      position: relative;
      width: 100%;
      margin-top: 10px;
    }
 
    .header-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
    }
 
    .header-content img {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      margin-top: 50px;
    }
 
    .header-text {
      text-align: center;
      margin-top: 50px;
    }
 
    .print-corner-label {
      position: absolute;
      top: 0;
      font-size: 12px;
      font-weight: bold;
    }
 
    .print-corner-label.left {
      left: 0;
      text-align: left;
    }
 
    .print-corner-label.right {
      right: 0;
      text-align: right;
    }
 
    .table-wrapper {
      width: 100%;
      margin-top: 20px;
    }
 
    table {
      border-collapse: collapse;
      width: 100%;
      border: 1.5px solid black;
      table-layout: fixed;
    }
 
    th, td {
      border: 1.5px solid black;
      padding: 4px 3px;
      font-size: 9px;
      text-align: center;
      word-wrap: break-word;
      white-space: normal;
    }
 
    th {
      background-color: lightgray;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
 
    td.applicant-name {
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${html}
  </div>
</body>
</html>
    `.trim();

    await page.setContent(wrappedHtml, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    await waitForImages(page);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: false,
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" },
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty");
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `Qualifying_Interview_Score_${timestamp}.pdf`;

    await insertPdfExportAudit(req, {
      documentLabel: "Qualifying / Interview Score",
      legacyAction: "QUALIFYING_INTERVIEW_SCORE_PDF_EXPORT",
      legacyMessage: ({ roleLabel, actorId }) =>
        `${roleLabel} (${actorId}) exported the Qualifying / Interview Score PDF.`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("Qualifying/Interview Score PDF ERROR:", err);
    return res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
      stack: err.stack,
    });
  } finally {
    if (browser) await browser.close();
  }
});

// ─── 9. Student List (College Enrollment) ──────────────────────────────────
// ─── 9. Student List (College Enrollment) ──────────────────────────────────
router.post("/generate-student-list-pdf", async (req, res) => {
  let browser;

  try {
    const { html } = req.body;

    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "No HTML received" });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();

    // Portrait A4 @ 96dpi, matches @page { size: A4 portrait; margin: 8mm; }
    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 2,
    });

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("requestfailed", (request) =>
      console.log("REQUEST FAILED:", request.url(), request.failure()?.errorText),
    );

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "media") {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Mirrors the corner-label header style used by the Applicant List /
    // Entrance Examination Scores export (Department left / Program right,
    // centered logo + school name block), applied to the Student List.
    const wrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: A4 portrait; margin: 8mm; }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial;
      background: #ffffff;
    }

    .print-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding-left: 10px;
      padding-right: 10px;
    }

    .print-header {
      position: relative;
      width: 100%;
      margin-top: 10px;
    }

    .header-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
    }

    .header-content img {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      margin-top: 50px;
    }

    .header-text {
      text-align: center;
      margin-top: 50px;
    }

    .print-corner-label {
      position: absolute;
      top: 0;
      font-size: 12px;
      font-weight: bold;
    }

    .print-corner-label.left {
      left: 0;
      text-align: left;
    }

    .print-corner-label.right {
      right: 0;
      text-align: right;
    }

    .table-wrapper {
      width: 100%;
      margin-top: 20px;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      border: 1.5px solid black;
      table-layout: fixed;
    }

    th, td {
      border: 1.5px solid black;
      padding: 4px 3px;
      font-size: 9px;
      text-align: center;
      word-wrap: break-word;
      white-space: normal;
    }

    th {
      background-color: lightgray;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    td.student-name {
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${html}
  </div>
</body>
</html>
    `.trim();

    await page.setContent(wrappedHtml, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    await waitForImages(page);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: false,
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" },
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty");
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `Student_List_${timestamp}.pdf`;

    await insertPdfExportAudit(req, {
      documentLabel: "Student List",
      legacyAction: "STUDENT_LIST_PDF_EXPORT",
      legacyMessage: ({ roleLabel, actorId }) =>
        `${roleLabel} (${actorId}) exported the Student List PDF.`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("Student List PDF ERROR:", err);
    return res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
      stack: err.stack,
    });
  } finally {
    if (browser) await browser.close();
  }
});


router.post("/generate-report-of-grades-pdf", async (req, res) => {
  let browser;

  try {
    const { html, student_number, last_name, first_name } = req.body;

    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "No HTML received" });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setViewport({
      width: 794,   // 210mm @ 96dpi
      height: 1123, // 297mm @ 96dpi
      deviceScaleFactor: 2,
    });

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("requestfailed", (request) =>
      console.log("REQUEST FAILED:", request.url(), request.failure()?.errorText),
    );

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "media") {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Mirrors the on-screen scaling math from ReportOfGrade.jsx EXACTLY:
    // the report is authored at a fixed design width of 1280px
    // (REPORT_DESIGN_WIDTH) and shrunk with a CSS transform so it fits an
    // A4 sheet with EXACTLY 1.5rem of margin on the left/right/top
    // (PRINT_MARGIN_REM). Same geometry, reproduced server-side:
    //   a4WidthPx      = 210mm * (96/25.4)             ≈ 793.7px
    //   printMarginPx  = 1.5rem * 16px                  = 24px
    //   contentWidthPx = a4WidthPx - printMarginPx * 2  ≈ 745.7px
    //   scale          = contentWidthPx / 1280          ≈ 0.5825
    const REPORT_DESIGN_WIDTH = 1280;
    const PRINT_MARGIN_REM = 1.5;
    const PX_PER_REM = 16;
    const PX_PER_MM = 96 / 25.4;
    const A4_WIDTH_MM = 210;
    const printMarginPx = PRINT_MARGIN_REM * PX_PER_REM;
    const a4WidthPx = A4_WIDTH_MM * PX_PER_MM;
    const printContentWidthPx = a4WidthPx - printMarginPx * 2;
    const PRINT_SCALE = printContentWidthPx / REPORT_DESIGN_WIDTH;

    const wrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 210mm;
      background: #ffffff;
      font-family: "Poppins", Arial, sans-serif;
    }

    .rog-page {
      margin-top: ${PRINT_MARGIN_REM}rem;
      margin-left: ${PRINT_MARGIN_REM}rem;
    }

    .rog-content {
      width: ${REPORT_DESIGN_WIDTH}px;
      transform: scale(${PRINT_SCALE});
      transform-origin: top left;
    }

    table {
      border-collapse: collapse;
    }

    img {
      max-width: 100%;
    }

    button {
      display: none;
    }
  </style>
</head>
<body>
  <div class="rog-page">
    <div class="rog-content">
      ${html}
    </div>
  </div>
</body>
</html>
    `.trim();

    await page.setContent(wrappedHtml, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    await waitForImages(page);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty");
    }

    const safeLastName = String(last_name || "Student").trim().replace(/\s+/g, "_");
    const safeFirstName = String(first_name || "").trim().replace(/\s+/g, "_");
    const numberSuffix = student_number ? `_${student_number}` : "";
    const fileName = `Report_Of_Grades_${safeLastName}${safeFirstName ? "_" + safeFirstName : ""}${numberSuffix}.pdf`;

    await insertPdfExportAudit(req, {
      documentLabel: "Report of Grades",
      legacyAction: "REPORT_OF_GRADES_PDF_EXPORT",
      legacyMessage: ({ roleLabel, actorId }) =>
        `${roleLabel} (${actorId}) exported Report of Grades PDF${student_number ? ` for Student (${student_number})` : ""}.`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("Report of Grades PDF ERROR:", err);
    return res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
      stack: err.stack,
    });
  } finally {
    if (browser) await browser.close();
  }
});

// ─── 11. Transcript of Records (Registrar) ─────────────────────────────────
router.post("/generate-tor-pdf", async (req, res) => {
  let browser;

  try {
    const { html, student_number, last_name, first_name } = req.body;

    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "No HTML received" });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();

    // TOR uses Philippine "long" bond paper: 8.5in x 13in
    // (215.9mm x 330.2mm), NOT 8.5in x 14in (legal/folio). Matches the
    // .page-card min-width/min-height in TOR.jsx's on-screen CSS and the
    // @page { size: 215.9mm 330.2mm; } print rule.
    await page.setViewport({
      width: 816,   // 215.9mm @ 96dpi
      height: 1248, // 330.2mm @ 96dpi
      deviceScaleFactor: 2,
    });

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("requestfailed", (request) =>
      console.log("REQUEST FAILED:", request.url(), request.failure()?.errorText),
    );

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "media") {
        request.abort();
      } else {
        request.continue();
      }
    });

    const wrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page {
      size: 215.9mm 330.2mm;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: Arial, sans-serif;
    }

    .tor-page {
      width: 215.9mm;
      height: 330.2mm;
      padding: 10mm 12mm;
      overflow: hidden;
      position: relative;
    }

    .tor-page:not(:last-of-type) {
      page-break-after: always;
      break-after: page;
    }

    /*
     * buildTorPageHtml() lays out content at ~80rem (1280px @ 16px root)
     * because it was authored for the on-screen "page-card" preview.
     * The actual PDF page is only 215.9mm (~816px) wide, so without
     * scaling, everything past ~64% of the width gets clipped by
     * .tor-page's overflow:hidden — that's the missing-data bug.
     *
     * zoom (not transform) shrinks BOTH the visual size AND each
     * element's contribution to layout flow, so the header/info/table/
     * footer blocks still stack correctly at the smaller size.
     *
     * 725px available width / 1280px natural width ≈ 0.566
     * Nudge this up/down slightly if text wraps oddly or margins look off.
     */
    .tor-page > * {
      zoom: 0.566;
    }

    table {
      border-collapse: collapse;
    }

    img {
      max-width: 100%;
    }

    button {
      display: none;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>
    `.trim();

    await page.setContent(wrappedHtml, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    await waitForImages(page);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pdfBuffer = await page.pdf({
      width: "215.9mm",
      height: "330.2mm",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty");
    }

    const safeLastName = String(last_name || "Student").trim().replace(/\s+/g, "_");
    const safeFirstName = String(first_name || "").trim().replace(/\s+/g, "_");
    const numberSuffix = student_number ? `_${student_number}` : "";
    const fileName = `TOR_${safeLastName}${safeFirstName ? "_" + safeFirstName : ""}${numberSuffix}.pdf`;

    await insertPdfExportAudit(req, {
      documentLabel: "Transcript of Records",
      legacyAction: "TOR_PDF_EXPORT",
      legacyMessage: ({ roleLabel, actorId }) =>
        `${roleLabel} (${actorId}) exported Transcript of Records PDF${student_number ? ` for Student (${student_number})` : ""}.`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("TOR PDF ERROR:", err);
    return res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
      stack: err.stack,
    });
  } finally {
    if (browser) await browser.close();
  }
});

// ─── Class List (Registrar Class Roster) ───────────────────────────────────
router.post("/generate-class-list-pdf", async (req, res) => {
  let browser;

  try {
    const { html } = req.body;

    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "No HTML received" });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();

    // Portrait A4 @ 96dpi, matches @page { size: A4 portrait; margin: 8mm; }
    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 2,
    });

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("requestfailed", (request) =>
      console.log("REQUEST FAILED:", request.url(), request.failure()?.errorText),
    );

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "media") {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Same corner-label header style used by the Applicant List / Entrance
    // Examination Scores exports (Department left / Program right, centered
    // logo + school name block), applied to the registrar Class List.
    const wrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: A4 portrait; margin: 8mm; }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial;
      background: #ffffff;
    }

    .print-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding-left: 10px;
      padding-right: 10px;
    }

    .print-header {
      position: relative;
      width: 100%;
      margin-top: 10px;
    }

    .header-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
    }

    .header-content img {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      margin-top: 50px;
    }

    .header-text {
      text-align: center;
      margin-top: 50px;
    }

    .print-corner-label {
      position: absolute;
      top: 0;
      font-size: 12px;
      font-weight: bold;
    }

    .print-corner-label.left {
      left: 0;
      text-align: left;
    }

    .print-corner-label.right {
      right: 0;
      text-align: right;
    }

    .table-wrapper {
      width: 100%;
      margin-top: 20px;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      border: 1.5px solid black;
      table-layout: fixed;
    }

    th, td {
      border: 1.5px solid black;
      padding: 4px 3px;
      font-size: 9px;
      text-align: center;
      word-wrap: break-word;
      white-space: normal;
    }

    th {
      background-color: lightgray;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    td.student-name {
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${html}
  </div>
</body>
</html>
    `.trim();

    await page.setContent(wrappedHtml, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    await waitForImages(page);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: false,
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" },
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty");
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `Class_List_${timestamp}.pdf`;

    await insertPdfExportAudit(req, {
      documentLabel: "Class List",
      legacyAction: "CLASS_LIST_PDF_EXPORT",
      legacyMessage: ({ roleLabel, actorId }) =>
        `${roleLabel} (${actorId}) exported the Class List PDF.`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("Class List PDF ERROR:", err);
    return res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
      stack: err.stack,
    });
  } finally {
    if (browser) await browser.close();
  }
});

router.post("/generate-medical-certificate-pdf", async (req, res) => {
  let browser;

  try {
    const { html, student_number, last_name, first_name } = req.body;

    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "No HTML received" });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setViewport({
      width: 794,   // 210mm @ 96dpi
      height: 1123, // 297mm @ 96dpi
      deviceScaleFactor: 2,
    });

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("requestfailed", (request) =>
      console.log("REQUEST FAILED:", request.url(), request.failure()?.errorText),
    );

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "media") {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Mirrors printDiv()'s CSS in MedicalCertificate.jsx EXACTLY —
    // the 110% width + scale(0.90) top-left trick, NOT the Personal
    // Data Form's zoom variant. Don't swap these, the offsets differ.
    const wrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial;
      width: auto;
      height: auto;
      overflow: visible;
      background: #ffffff;
    }

    .print-container {
      width: 100%;
      box-sizing: border-box;
    }

    .student-table {
      margin-top: 0 !important;
    }

    input[type="checkbox"] {
      width: 12px;
      height: 12px;
      transform: scale(1);
      margin: 2px;
    }

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    button { display: none; }
    table { border-collapse: collapse; }
    img { max-width: 100%; }
  </style>
</head>
<body>
  <div class="print-container">
    ${html}
  </div>
</body>
</html>
`.trim();

    await page.setContent(wrappedHtml, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    await waitForImages(page);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "0.25in", bottom: "0.25in", left: "0.25in", right: "0.25in" },
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty");
    }

    const safeLastName = String(last_name || "Student").trim().replace(/\s+/g, "_");
    const safeFirstName = String(first_name || "").trim().replace(/\s+/g, "_");
    const numberSuffix = student_number ? `_${student_number}` : "";
    const fileName = `Medical_Certificate_${safeLastName}${safeFirstName ? "_" + safeFirstName : ""}${numberSuffix}.pdf`;

    await insertPdfExportAudit(req, {
      documentLabel: "Medical Certificate",
      legacyAction: "MEDICAL_CERTIFICATE_PDF_EXPORT",
      legacyMessage: ({ roleLabel, actorId }) =>
        `${roleLabel} (${actorId}) exported Medical Certificate PDF${student_number ? ` for Student (${student_number})` : ""}.`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("Medical Certificate PDF ERROR:", err);
    return res.status(500).json({
      message: "PDF generation failed",
      error: err.message,
      stack: err.stack,
    });
  } finally {
    if (browser) await browser.close();
  }
});

router.post("/generate-health-record-pdf", async (req, res) => {
  let browser;
  try {
    const { html, student_number, last_name, first_name } = req.body;
    if (!html || typeof html !== "string") {
      return res.status(400).json({ message: "No HTML received" });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.resourceType() === "media") request.abort();
      else request.continue();
    });

    const wrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial;
      width: auto;
      height: auto;
      overflow: visible;
      background: #ffffff;
    }
    .print-container { width: 100%; box-sizing: border-box; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    button { display: none; }
    table { border-collapse: collapse; }
    img { max-width: 100%; }
  </style>
</head>
<body>
  <div class="print-container">${html}</div>
</body>
</html>`.trim();

    await page.setContent(wrappedHtml, { waitUntil: "networkidle0", timeout: 60000 });
    await waitForImages(page);
    await new Promise((r) => setTimeout(r, 400));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "2mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });

    if (!pdfBuffer?.length) throw new Error("Generated PDF buffer is empty");

    const safeLastName = String(last_name || "Student").trim().replace(/\s+/g, "_");
    const safeFirstName = String(first_name || "").trim().replace(/\s+/g, "_");
    const numberSuffix = student_number ? `_${student_number}` : "";
    const fileName = `Health_Record_${safeLastName}${safeFirstName ? "_" + safeFirstName : ""}${numberSuffix}.pdf`;

    await insertPdfExportAudit(req, {
      documentLabel: "Student Health Record",
      legacyAction: "HEALTH_RECORD_PDF_EXPORT",
      legacyMessage: ({ roleLabel, actorId }) =>
        `${roleLabel} (${actorId}) exported Health Record PDF${student_number ? ` for Student (${student_number})` : ""}.`,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (err) {
    console.error("Health Record PDF ERROR:", err);
    return res.status(500).json({ message: "PDF generation failed", error: err.message, stack: err.stack });
  } finally {
    if (browser) await browser.close();
  }
});

module.exports = router;
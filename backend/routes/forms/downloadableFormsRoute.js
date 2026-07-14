const express = require("express");
const puppeteer = require("puppeteer");

const { insertAuditLogAdmission } = require("../../utils/auditLogger");

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
      transform: scale(0.88);
      /* no transform-origin override — match the working print window's default (50% 50%) */
    }

    .student-table {
      margin-top: -70px !important;
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

    const fileName = buildOutputFilename("Admission_Form_Process", req.body);

    try {
      const { actorId, actorRole } = getEnrollmentAuditActor(req);
      const roleLabel = formatEnrollmentAuditActorRole(actorRole);
      await insertAuditLogAdmission({
        actorId,
        role: actorRole,
        action: "ADMISSION_FORM_PROCESS_PDF_EXPORT",
        severity: "INFO",
        message: `${roleLabel} (${actorId}) exported Admission Form (Process) PDF${applicant_number ? ` for Applicant (${applicant_number})` : ""}.`,
      });
    } catch (auditErr) {
      console.error("Admission Form PDF audit log failed:", auditErr);
    }

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

    try {
      const { actorId, actorRole } = getEnrollmentAuditActor(req);
      const roleLabel = formatEnrollmentAuditActorRole(actorRole);
      await insertAuditLogAdmission({
        actorId,
        role: actorRole,
        action: "REGISTRAR_FORM_PDF_EXPORT",
        severity: "INFO",
        message: `${roleLabel} (${actorId}) exported Office of the Registrar PDF${applicant_number ? ` for Applicant (${applicant_number})` : ""}.`,
      });
    } catch (auditErr) {
      console.error("Registrar Form PDF audit log failed:", auditErr);
    }

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
+    height: 100%;
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

    try {
      const { actorId, actorRole } = getEnrollmentAuditActor(req);
      const roleLabel = formatEnrollmentAuditActorRole(actorRole);
      await insertAuditLogAdmission({
        actorId,
        role: actorRole,
        action: "PERSONAL_DATA_FORM_PDF_EXPORT",
        severity: "INFO",
        message: `${roleLabel} (${actorId}) exported Personal Data Form PDF${applicant_number ? ` for Applicant (${applicant_number})` : ""}.`,
      });
    } catch (auditErr) {
      console.error("Personal Data Form PDF audit log failed:", auditErr);
    }

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

    try {
      const { actorId, actorRole } = getEnrollmentAuditActor(req);
      const roleLabel = formatEnrollmentAuditActorRole(actorRole);
      await insertAuditLogAdmission({
        actorId,
        role: actorRole,
        action: "ECAT_FORM_PDF_EXPORT",
        severity: "INFO",
        message: `${roleLabel} (${actorId}) exported ECAT Application Form PDF${applicant_number ? ` for Applicant (${applicant_number})` : ""}.`,
      });
    } catch (auditErr) {
      console.error("ECAT Form PDF audit log failed:", auditErr);
    }

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

    try {
      const { actorId, actorRole } = getEnrollmentAuditActor(req);
      const roleLabel = formatEnrollmentAuditActorRole(actorRole);
      await insertAuditLogAdmission({
        actorId,
        role: actorRole,
        action: "ADMISSION_SERVICES_CSM_PDF_EXPORT",
        severity: "INFO",
        message: `${roleLabel} (${actorId}) exported the Admission Services CSM form PDF.`,
      });
    } catch (auditErr) {
      console.error("Admission Services PDF audit log failed:", auditErr);
    }

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

    try {
      const { actorId, actorRole } = getEnrollmentAuditActor(req);
      const roleLabel = formatEnrollmentAuditActorRole(actorRole);
      await insertAuditLogAdmission({
        actorId,
        role: actorRole,
        action: "EXAM_PERMIT_PDF_EXPORT",
        severity: "INFO",
        message: `${roleLabel} (${actorId}) exported Exam Permit PDF${applicant_number ? ` for Applicant (${applicant_number})` : ""}.`,
      });
    } catch (auditErr) {
      console.error("Exam Permit PDF audit log failed:", auditErr);
    }

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

module.exports = router;
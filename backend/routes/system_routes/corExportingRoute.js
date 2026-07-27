const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("puppeteer");
const { db, db3 } = require("../database/database");
const { mergePdfBuffers } = require("../../utils/pdfMerge");

const router = express.Router();
const exportJobs = new Map();
const exportDir = path.join(os.tmpdir(), "earist-cor-exports");

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

const sanitizeFileName = (value) =>
  String(value || "cor")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim() || "cor";

const getFrontendOrigin = (req) =>
  req.body.frontend_origin ||
  req.headers.origin ||
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

const getBrowserExecutablePath = () => {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
};

const updateJob = (job, patch) => {
  Object.assign(job, patch, { updated_at: new Date().toISOString() });
};

const COR_EXPORT_CONCURRENCY = Math.max(
  1,
  Math.min(4, Number(process.env.COR_EXPORT_CONCURRENCY || 2)),
);

let browserPromise = null;
const pagePool = []; // array of { page, busy, origin, bootstrapped }

const launchBrowser = () =>
  puppeteer.launch({
    headless: "new",
    ...(getBrowserExecutablePath()
      ? { executablePath: getBrowserExecutablePath() }
      : {}),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

const getBrowser = async () => {
  if (!browserPromise) {
    browserPromise = launchBrowser()
      .then((browser) => {
        browser.on("disconnected", () => {
          // Browser crashed / was closed externally.
          // Clear state so the next request relaunches it lazily.
          browserPromise = null;
          pagePool.length = 0;
        });
        return browser;
      })
      .catch((err) => {
        browserPromise = null; // allow retry on next call
        throw err;
      });
  }
  return browserPromise;
};

const bootstrapPage = async (page, origin) => {
  const url = new URL("/cor_export_render", origin);
  url.searchParams.set("fast", "1");

  await page.goto(url.toString(), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await page.waitForFunction(
    () =>
      typeof window.__loadCorForExport === "function" &&
      window.__COR_EXPORT_BOOTSTRAPPED === true,
    { timeout: 30000, polling: 50 },
  );

  await page.addStyleTag({
    content:
      "@page { size: A4; margin: 0; } html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }",
  });
};

const acquirePage = async (origin) => {
  const browser = await getBrowser();

  for (;;) {
    const free = pagePool.find(
      (entry) => !entry.busy && entry.origin === origin && entry.bootstrapped,
    );
    if (free) {
      free.busy = true;
      return free;
    }

    if (pagePool.length < COR_EXPORT_CONCURRENCY) {
      const entry = { page: null, busy: true, origin, bootstrapped: false };
      pagePool.push(entry);
      try {
        const page = await browser.newPage();
        await page.setViewport({
          width: 1240,
          height: 1754,
          deviceScaleFactor: 1,
        });
        await bootstrapPage(page, origin);
        entry.page = page;
        entry.bootstrapped = true;
        return entry;
      } catch (err) {
        // Bootstrap failed — remove the broken slot so the pool can retry.
        const idx = pagePool.indexOf(entry);
        if (idx !== -1) pagePool.splice(idx, 1);
        throw err;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

const releasePage = (entry) => {
  entry.busy = false;
};

const discardPage = async (entry) => {
  const idx = pagePool.indexOf(entry);
  if (idx !== -1) pagePool.splice(idx, 1);
  if (entry.page) {
    await entry.page.close().catch(() => {});
  }
};

const waitForCorReady = async (page, studentNumber, timeoutMs = 45000) => {
  await page.waitForFunction(
    (expectedStudentNumber) => {
      if (window.__COR_READY !== true) return false;
      if (window.__COR_ENROLLED_READY !== true) return false;

      const root = document.getElementById("server-cor-export");
      if (!root) return false;

      const filledValues = Array.from(
        root.querySelectorAll("input, textarea, select"),
      )
        .map((element) =>
          String(element.value || element.getAttribute("value") || "").trim(),
        )
        .filter(Boolean);

      return (
        filledValues.includes(String(expectedStudentNumber)) ||
        filledValues.length >= 4
      );
    },
    { timeout: timeoutMs, polling: 50 },
    studentNumber,
  );
};

const renderCorPdf = async (page, student) => {
  const studentNumber = student.student_number;
  const payload = {
    student_number: studentNumber,
    person_id: student.person_id || "",
    preload: student.preload || null,
  };

  await page.evaluate(async (nextPayload) => {
    window.__COR_READY = false;
    window.__COR_FIT_COMPLETE = false;
    window.__COR_FITS_A4 = false;
    window.__COR_ENROLLED_READY = false;
    await window.__loadCorForExport(nextPayload);
  }, payload);

  await waitForCorReady(page, studentNumber);

  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );

  const pdf = await page.pdf({
    width: "210mm",
    height: "297mm",
    printBackground: true,
    displayHeaderFooter: false,
    preferCSSPageSize: true,
    margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
  });

  return {
    name: `${sanitizeFileName(studentNumber)}_Certificate_Of_Registration.pdf`,
    data: Buffer.from(pdf),
  };
};

const runCorExportJob = async (job) => {
  const files = new Array(job.students.length);
  let completed = 0;

  try {
    updateJob(job, { status: "running", message: "Rendering..." });

    const workerCount = Math.min(COR_EXPORT_CONCURRENCY, job.students.length);

    const workers = Array.from({ length: workerCount }, async (_, workerIndex) => {
      for (let i = workerIndex; i < job.students.length; i += workerCount) {
        const student = job.students[i];
        updateJob(job, {
          current: completed,
          progress: Math.round((completed / job.total) * 90),
          message: `Rendering COR ${completed + 1}/${job.total}: ${student.student_number}`,
        });

        const entry = await acquirePage(job.frontend_origin);
        try {
          files[i] = await renderCorPdf(entry.page, student);
          releasePage(entry);
        } catch (err) {
          await discardPage(entry);
          throw err;
        }

        completed += 1;
        updateJob(job, {
          current: completed,
          progress: Math.round((completed / job.total) * 90),
          message: `Generated ${completed}/${job.total}`,
        });
      }
    });

    await Promise.all(workers);

    const orderedBuffers = files.filter(Boolean).map((file) => file.data);

    if (orderedBuffers.length === 0) {
      throw new Error("No CORs were generated for this export.");
    }

    updateJob(job, { message: "Finalizing PDF...", progress: 95 });

    const finalPdf =
      orderedBuffers.length === 1
        ? orderedBuffers[0]
        : mergePdfBuffers(orderedBuffers);

    fs.writeFileSync(job.file_path, finalPdf);

    updateJob(job, {
      status: "done",
      progress: 100,
      current: job.total,
      message: "Ready to download",
    });
  } catch (error) {
    console.error("Server COR export failed:", error);
    updateJob(job, {
      status: "error",
      error: error.message || "Server COR export failed",
      message: "Export failed",
    });
  }
};

router.get("/get_student_number", async (req, res) => {
  try {
    const [rows] = await db3.query(`
        SELECT DISTINCT
            sts.student_number,
            pt.person_id,
            sts.year_level_id,
            pt.campus,
            ct.curriculum_id,
            sy.id AS active_school_year_id,
            sy.year_id,
            sy.semester_id
        FROM student_status_table sts
            JOIN student_numbering_table snt ON sts.student_number = snt.student_number
            JOIN person_table pt ON snt.person_id = pt.person_id
            JOIN curriculum_table ct ON sts.active_curriculum = ct.curriculum_id
            JOIN dprtmnt_curriculum_table dct ON ct.curriculum_id = dct.curriculum_id
            JOIN dprtmnt_table dt ON dct.dprtmnt_id = dt.dprtmnt_id
            JOIN active_school_year_table sy ON sts.active_school_year_id = sy.id
        WHERE enrolled_status = 1;
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching data" });
  }
});

router.post("/cor-export/jobs", async (req, res) => {
  const students = Array.isArray(req.body.students) ? req.body.students : [];
  const filteredStudents = students
    .filter((student) => student?.student_number)
    .map((student) => ({
      student_number: String(student.student_number),
      person_id: student.person_id ? String(student.person_id) : "",
      preload: student.preload || null,
    }));

  if (filteredStudents.length === 0) {
    return res.status(400).json({ message: "No students selected for export" });
  }

  const id = crypto.randomUUID();
  const fileName = `${sanitizeFileName(req.body.file_name || `cor_export_${id}`)}.pdf`;
  const job = {
    id,
    status: "queued",
    total: filteredStudents.length,
    current: 0,
    progress: 0,
    message: "Queued",
    error: "",
    file_name: fileName,
    file_path: path.join(exportDir, fileName),
    frontend_origin: getFrontendOrigin(req),
    students: filteredStudents,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  exportJobs.set(id, job);
  setImmediate(() => runCorExportJob(job));

  res.status(202).json({ job_id: id });
});

router.get("/cor-export/jobs/:jobId", (req, res) => {
  const job = exportJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ message: "Export job not found" });

  res.json({
    job_id: job.id,
    status: job.status,
    total: job.total,
    current: job.current,
    progress: job.progress,
    message: job.message,
    error: job.error,
    file_name: job.file_name,
  });
});

router.get("/cor-export/jobs/:jobId/preload/:studentNumber", (req, res) => {
  const job = exportJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ message: "Export job not found" });

  const student = job.students.find(
    (item) => item.student_number === req.params.studentNumber,
  );
  if (!student) return res.status(404).json({ message: "Student not found" });

  res.json({ preload: student.preload || null });
});

router.get("/cor-export/jobs/:jobId/download", (req, res) => {
  const job = exportJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ message: "Export job not found" });
  if (job.status !== "done" || !fs.existsSync(job.file_path)) {
    return res.status(409).json({ message: "Export job is not ready" });
  }

  res.download(job.file_path, job.file_name, (error) => {
    if (error) {
      console.error("COR export download failed:", error);
      return;
    }

    exportJobs.delete(job.id);
    fs.unlink(job.file_path, (unlinkError) => {
      if (unlinkError && unlinkError.code !== "ENOENT") {
        console.error("Failed to delete COR export PDF:", unlinkError);
      }
    });
  });
});

const closeCorExportBrowser = async () => {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch (err) {
    console.error("Failed to close COR export browser:", err);
  } finally {
    browserPromise = null;
    pagePool.length = 0;
  }
};

module.exports = router;
module.exports.closeCorExportBrowser = closeCorExportBrowser;
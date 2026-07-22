const nodemailer = require("nodemailer");
const {
  insertAuditLogAdmission,
  insertAuditLogEnrollment,
} = require("./auditLogger");
const { logStudentHistoryFromActor } = require("./studentHistoryLogger");

const getConfiguredSenderAccounts = () =>
  [
    { user: process.env.EMAIL_USER1, pass: process.env.EMAIL_PASS1 },
    { user: process.env.EMAIL_USER2, pass: process.env.EMAIL_PASS2 },
    { user: process.env.EMAIL_USER3, pass: process.env.EMAIL_PASS3 },
    { user: process.env.EMAIL_USER4, pass: process.env.EMAIL_PASS4 },
    { user: process.env.EMAIL_USER5, pass: process.env.EMAIL_PASS5 },
    { user: process.env.EMAIL_USER6, pass: process.env.EMAIL_PASS6 },
    { user: process.env.EMAIL_USER7, pass: process.env.EMAIL_PASS7 },
    { user: process.env.EMAIL_USER8, pass: process.env.EMAIL_PASS8 },
    { user: process.env.EMAIL_USER9, pass: process.env.EMAIL_PASS9 },
    { user: process.env.EMAIL_USER10, pass: process.env.EMAIL_PASS10 },

  ].filter((account) => account.user && account.pass);

const normalizeSenderEmail = (senderEmail) =>
  String(senderEmail || "")
    .trim()
    .toLowerCase();

const getSenderAccountForEmail = (senderEmail) => {
  const normalizedSenderEmail = normalizeSenderEmail(senderEmail);

  return getConfiguredSenderAccounts().find(
    (account) => normalizeSenderEmail(account.user) === normalizedSenderEmail,
  );
};

const formatAuditActorRole = (role) => {
  const safeRole = String(role || "registrar").trim();
  if (!safeRole) return "Registrar";

  return safeRole
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

module.exports = function registerSocketHandlers({
  app,
  io,
  db,
  db3,
  transporter,
  bcrypt,
  webtoken,
  fs,
  path,
  QRCode,
  applicantDocsDir,
  getGradeConversions,
  getStoredNumericGrade,
  profileUpload,
  upload,
  baseDir,
}) {
  const __dirname = baseDir;

  const getEntranceExamScheduleLabel = async (scheduleId) => {
    if (!scheduleId) return "No schedule";

    const [rows] = await db.query(
      `SELECT schedule_id, day_description, building_description, room_description, start_time, end_time
       FROM entrance_exam_schedule
       WHERE schedule_id = ?
       LIMIT 1`,
      [scheduleId],
    );

    const schedule = rows?.[0];
    if (!schedule) return `Schedule ${scheduleId}`;

    return `Schedule ${schedule.schedule_id} (${schedule.day_description}, ${schedule.building_description || "N/A"} ${schedule.room_description || ""}, ${schedule.start_time || ""}-${schedule.end_time || ""})`;
  };

  const getInterviewScheduleLabel = async (scheduleId) => {
    if (!scheduleId) return "No schedule";

    const [rows] = await db.query(
      `SELECT schedule_id, day_description, building_description, room_description, start_time, end_time
       FROM interview_exam_schedule
       WHERE schedule_id = ?
       LIMIT 1`,
      [scheduleId],
    );

    const schedule = rows?.[0];
    if (!schedule) return `Schedule ${scheduleId}`;

    return `Schedule ${schedule.schedule_id} (${schedule.day_description}, ${schedule.building_description || "N/A"} ${schedule.room_description || ""}, ${schedule.start_time || ""}-${schedule.end_time || ""})`;
  };

  const getVerifyScheduleLabel = async (scheduleId) => {
    if (!scheduleId) return "No schedule";

    const [rows] = await db.query(
      `
      SELECT schedule_id, schedule_date, building_description, room_description, start_time, end_time
      FROM verify_document_schedule
      WHERE schedule_id = ?
      LIMIT 1
      `,
      [scheduleId],
    );

    const schedule = rows?.[0];
    if (!schedule) return `Schedule ${scheduleId}`;

    return `Schedule ${schedule.schedule_id} (${schedule.schedule_date}, ${schedule.building_description || "N/A"} ${schedule.room_description || ""}, ${schedule.start_time || ""}-${schedule.end_time || ""})`;
  };

  const applicantOnlineDocsDir = path.join(
    __dirname,
    "uploads",
    "ApplicantOnlineDocuments",
  );
  const studentOnlineDocsDir = path.join(
    __dirname,
    "uploads",
    "StudentOnlineDocuments",
  );

  const buildStudentRequirementFilename = (
    applicantNumber,
    studentNumber,
    filePath,
    shortLabelFallback = "Unknown",
  ) => {
    const sourceFilename = path.basename(String(filePath || ""));
    if (!sourceFilename) return "";

    const applicantPrefix = applicantNumber
      ? `${String(applicantNumber).trim()}_`
      : "";
    if (applicantPrefix && sourceFilename.startsWith(applicantPrefix)) {
      return `${studentNumber}_${sourceFilename.slice(applicantPrefix.length)}`;
    }

    const ext = path.extname(sourceFilename);
    const yearMatch = sourceFilename.match(/_(\d{4})[^/\\]*$/);
    const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear());

    return `${studentNumber}_${shortLabelFallback}_${year}${ext}`;
  };

  const copyRequirementFileForEnrollment = async ({
    sourceFilename,
    targetFilename,
    applicantNumber,
    studentNumber,
    shortLabelFallback = "Unknown",
  }) => {
    if (!sourceFilename) {
      return { copied: false, filePath: "" };
    }

    const normalizedSource = path.basename(String(sourceFilename));
    const normalizedTarget =
      targetFilename ||
      buildStudentRequirementFilename(
        applicantNumber,
        studentNumber,
        normalizedSource,
        shortLabelFallback,
      );

    if (!normalizedTarget) {
      return { copied: false, filePath: normalizedSource };
    }

    if (!fs.existsSync(studentOnlineDocsDir)) {
      fs.mkdirSync(studentOnlineDocsDir, { recursive: true });
    }

    const sourcePath = path.join(applicantOnlineDocsDir, normalizedSource);
    const targetPath = path.join(studentOnlineDocsDir, normalizedTarget);

    if (!fs.existsSync(sourcePath)) {
      console.warn(
        `[assign-student-number] requirement file not found: ${sourcePath}`,
      );
      return { copied: false, filePath: normalizedTarget };
    }

    fs.copyFileSync(sourcePath, targetPath);
    return { copied: true, filePath: normalizedTarget };
  };






  io.on("connection", (socket) => {

    // ---------------------- Forgot Password: Applicant ----------------------
    socket.on("forgot-password-applicant", async (data) => {
      const { applicant_number, email, birthdate } = data;

      const insertForgotPasswordAuditLog = async ({ outcome }) => {
        await insertAuditLogEnrollment({
          actorId: applicant_number || email || "unknown",
          role: "applicant",
          action: "FORGOT_PASSWORD",
          outcome,
          severity: outcome === "SUCCESS" ? "INFO" : "WARN",
          message:
            outcome === "SUCCESS"
              ? "The applicant successfully reset their password through forgot password"
              : "The applicant failed to reset their password through forgot password",
        });
      };

      try {
        // =========================
        // GET SCHOOL SHORT TERM
        // =========================
        const [company] = await db.query(
          "SELECT short_term FROM company_settings WHERE id = 1",
        );

        const shortTerm = company?.[0]?.short_term || "Institution";

        // =========================
        // VALIDATE APPLICANT
        // =========================
        const [rows] = await db.query(
          `SELECT ua.email, p.birthOfDate
       FROM user_accounts ua
       JOIN person_table p ON ua.person_id = p.person_id
       JOIN applicant_numbering_table a ON p.person_id = a.person_id
       WHERE ua.email = ?
         AND a.applicant_number = ?
         AND p.birthOfDate = ?`,
          [email, applicant_number, birthdate],
        );

        // Applicant not found
        if (rows.length === 0) {
          await insertForgotPasswordAuditLog({ outcome: "FAILED" });

          return socket.emit("password-reset-result-applicant", {
            success: false,
            message: `${shortTerm} applicant account not found. Check your credentials.`,
          });
        }

        // =========================
        // GENERATE TEMP PASSWORD
        // =========================
        const generateTempPassword = () => {
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

          return Array.from({ length: 8 }, () =>
            chars.charAt(Math.floor(Math.random() * chars.length)),
          ).join("");
        };

        const tempPassword = generateTempPassword();

        // =========================
        // HASH PASSWORD
        // =========================
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // =========================
        // UPDATE PASSWORD
        // =========================
        await db.query(
          "UPDATE user_accounts SET password = ? WHERE email = ?",
          [hashedPassword, email],
        );

        // =========================
        // CREATE EMAIL TRANSPORTER
        // =========================
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        // =========================
        // SEND EMAIL
        // =========================
        const info = await transporter.sendMail({
          from: `"${shortTerm} - Information System" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: `${shortTerm} Applicant Password Reset`,
          text: `
Hello Applicant,

Your ${shortTerm} applicant account password has been successfully reset.

Your new temporary password is:

${tempPassword}

Please log in immediately and change your password for security purposes.

Thank you,
${shortTerm} Information System
      `,
        });
        // =========================
        // AUDIT LOG
        // =========================
        await insertForgotPasswordAuditLog({ outcome: "SUCCESS" });

        // =========================
        // SUCCESS RESPONSE
        // =========================
        socket.emit("password-reset-result-applicant", {
          success: true,
          message: `Password has been reset successfully. The user has been notified via email.`,
        });
      } catch (error) {
        console.error("Forgot Password Applicant Error:", error);

        await insertForgotPasswordAuditLog({ outcome: "FAILED" });

        socket.emit("password-reset-result-applicant", {
          success: false,
          message: "Server error while resetting password.",
        });
      }
    });
    // ---------------- Registrar: Reset Password ----------------
    // FORGOT PASSWORD (handles student, registrar, faculty)

    app.get("/api/exam/:personId", async (req, res) => {
      try {
        const { personId } = req.params;

        const [rows] = await db.query(
          `SELECT
        er.id AS exam_result_id,
        er.person_id,
        s.id AS subject_id,
        s.name AS subject,
        erd.score,
        s.max_score,
        er.total_score,
        er.percentage,
        er.final_rating,
        er.status,
        DATE_FORMAT(er.date_created, '%Y-%m-%d') AS date_created

      FROM exam_results er
      JOIN exam_result_details erd ON er.id = erd.exam_result_id
      JOIN subjects s ON erd.subject_id = s.id

      WHERE er.person_id = ?
      ORDER BY er.id, s.id`,
          [personId],
        );

        res.json(rows);
      } catch (err) {
        console.error("GET exam error:", err);
        res.status(500).json({ error: "Database error" });
      }
    });

    // Get person by applicant_number
    // Get person by applicant_number
    app.get("/api/person-by-applicant/:applicant_number", async (req, res) => {
      const { applicant_number } = req.params;

      try {
        const [rows] = await db.execute(
          `SELECT p.*, a.applicant_number, er.final_rating
       FROM person_table p
       JOIN applicant_numbering_table a
         ON p.person_id = a.person_id
       LEFT JOIN exam_results er ON p.person_id = er.person_id
       WHERE a.applicant_number = ? `,
          [applicant_number],
        );

        if (rows.length === 0) {
          return res.status(404).json({ error: "Applicant not found" });
        }

        res.json(rows[0]);
      } catch (err) {
        console.error("Error fetching person by applicant_number:", err);
        res.status(500).json({ error: "Server error" });
      }
    });




    app.get("/api/applicant-schedule/:applicantNumber", async (req, res) => {
      try {
        const { applicantNumber } = req.params;

        const [rows] = await db.query(
          `SELECT
          s.schedule_id,
          s.day_description,
          s.building_description,
          s.room_description,
          s.start_time,
          s.end_time,
          s.proctor,
          s.room_quota,
          s.created_at,
          ea.email_sent   --  include email_sent
       FROM entrance_exam_schedule s
       INNER JOIN exam_applicants ea
         ON ea.schedule_id = s.schedule_id
       WHERE ea.applicant_id = ?
         AND COALESCE(ea.email_sent, 0) = 1`,
          [applicantNumber],
        );

        if (rows.length === 0) {
          return res
            .status(404)
            .json({ error: "No schedule found for this applicant." });
        }

        res.json(rows[0]);
      } catch (err) {
        console.error("Error fetching applicant schedule:", err.message);
        res.status(500).json({ error: "Failed to fetch applicant schedule" });
      }
    });

    // Get applicants assigned to a proctor

    // Get applicants assigned to a proctor
    app.get("/api/proctor-applicants/:proctor_name", async (req, res) => {
      const { proctor_name } = req.params;
      try {
        const [rows] = await db.query(
          `
      SELECT
        ea.applicant_id,
        an.applicant_number,
        pt.first_name,
        pt.middle_name,
        pt.last_name,
        pt.program,
        ees.day_description,
        ees.room_description,
        ees.building_description,
        ees.start_time,
        ees.end_time,
        ees.proctor
      FROM exam_applicants ea
      JOIN applicant_numbering_table an ON ea.applicant_id = an.applicant_number
      JOIN person_table pt ON an.person_id = pt.person_id
      JOIN entrance_exam_schedule ees ON ea.schedule_id = ees.schedule_id
      WHERE ees.proctor = ?
        AND COALESCE(ea.email_sent, 0) = 1
    `,
          [proctor_name],
        );
        res.json(rows);
      } catch (err) {
        console.error(" Error fetching proctor applicants:", err);
        res
          .status(500)
          .json({ error: "Failed to fetch applicants for proctor" });
      }
    });

    // Search proctor by name and return their assigned applicants
    app.get("/api/proctor-applicants", async (req, res) => {
      const { query } = req.query;

      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }

      try {
        // Find schedules where this proctor is assigned
        const [schedules] = await db.query(
          `SELECT schedule_id, day_description, room_description, building_description, start_time, end_time, proctor
FROM entrance_exam_schedule
WHERE proctor LIKE ?
`,
          [`%${query}%`],
        );

        if (schedules.length === 0) {
          return res
            .status(404)
            .json({ message: "Proctor not found in schedules" });
        }

        // For each schedule, get assigned applicants with email_sent
        const results = [];
        for (const sched of schedules) {
          const [applicants] = await db.query(
            `SELECT ea.applicant_id, ea.email_sent,
                an.applicant_number,
                p.last_name, p.first_name, p.middle_name, p.program
         FROM exam_applicants ea
         JOIN applicant_numbering_table an ON ea.applicant_id = an.applicant_number
         JOIN person_table p ON an.person_id = p.person_id
         WHERE ea.schedule_id = ?
           AND COALESCE(ea.email_sent, 0) = 1`,
            [sched.schedule_id],
          );

          results.push({
            schedule: sched,
            applicants,
          });
        }

        res.json(results);
      } catch (err) {
        console.error(" Error fetching proctor applicants:", err);
        res
          .status(500)
          .json({ error: "Failed to fetch applicants for proctor" });
      }
    });

    // ==================== INTERVIEW ROUTES ====================
    // ==============================
    // INTERVIEW ROUTES
    // ==============================

    // 1. Get interview by applicant_number
    app.get("/api/interview/:applicant_number", async (req, res) => {
      const { applicant_number } = req.params;

      try {
        const [rows] = await db.query(
          `
      SELECT
        a.applicant_number,
        a.person_id,
        ps.qualifying_result      AS qualifying_exam_score,
        ps.interview_result       AS qualifying_interview_score,
        ps.exam_result            AS total_ave
      FROM applicant_numbering_table a
      LEFT JOIN person_status_table ps ON ps.person_id = a.person_id
      WHERE a.applicant_number = ?
      `,
          [applicant_number],
        );

        if (!rows.length) return res.json(null);

        const row = rows[0];
        res.json({
          applicant_number: row.applicant_number,
          person_id: row.person_id,
          qualifying_exam_score: row.qualifying_exam_score ?? 0,
          qualifying_interview_score: row.qualifying_interview_score ?? 0,
          total_ave: row.total_ave ?? 0,
        });
      } catch (err) {
        console.error(" Error fetching interview:", err);
        res.status(500).json({ message: "Server error" });
      }
    });

    // 2) PUT update (must exist)
    //   Update single Qualifying/Interview scores

    // ---------------------------------------------------------
    // 2) SAVE or UPDATE (UPSERT) using person_status_table
    //    Payload: { applicant_number, qualifying_exam_score, qualifying_interview_score }
    //    Mapping -> qualifying_result, interview_result, exam_result
    // ---------------------------------------------------------
    app.post("/api/interview", async (req, res) => {
      try {
        const {
          applicant_number,
          qualifying_exam_score,
          qualifying_interview_score,
        } = req.body;
        // 1  Find person_id of applicant
        const [rows] = await db.query(
          "SELECT person_id FROM applicant_numbering_table WHERE applicant_number = ?",
          [applicant_number],
        );
        if (rows.length === 0) {
          return res.status(400).json({ error: "Applicant number not found" });
        }
        const person_id = rows[0].person_id;

        // 2  Compute new scores
        const qExam = Number(qualifying_exam_score) || 0;
        const qInterview = Number(qualifying_interview_score) || 0;
        const totalAve = (qExam + qInterview) / 2;

        // 3  Insert or update (Upsert)
        await db.query(
          `INSERT INTO person_status_table (person_id, qualifying_result, interview_result, exam_result)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         qualifying_result = VALUES(qualifying_result),
         interview_result = VALUES(interview_result),
         exam_result = VALUES(exam_result)`,
          [person_id, qExam, qInterview, totalAve],
        );

        // 4  Return success
        res.json({
          success: true,
          message: "Interview and exam scores saved successfully!",
        });
      } catch (err) {
        console.error(" Error saving interview/exam scores:", err);
        res.status(500).json({ error: "Failed to save interview/exam scores" });
      }
    });

    // ---------------------- Assign Student Number ----------------------


    const generateStudentNumber = async (person_data) => {
      const [[yearRow]] = await db3.query(
        `SELECT yt.year_description AS yr
     FROM active_school_year_table asy
     JOIN year_table yt ON asy.year_id = yt.year_id
     WHERE asy.astatus = 1
     LIMIT 1`,
      );
      const yy = String(yearRow?.yr || new Date().getFullYear()).slice(-2);

      const [[deptRow]] = await db3.query(
        `SELECT dt.dept_number, dt.components AS dept_components
 FROM dprtmnt_curriculum_table dct
 JOIN dprtmnt_table dt ON dct.dprtmnt_id = dt.dprtmnt_id
 WHERE dct.curriculum_id = ?
 LIMIT 1`,
        [person_data.program],
      );

      if (!deptRow?.dept_number) {
        throw new Error(
          `No dept_number configured for curriculum_id=${person_data.program}. ` +
          `Open the Student Number Configuration panel and assign a number to the relevant department.`,
        );
      }
      const deptNum = deptRow.dept_number;

      // ── Branch is derived from dprtmnt_table.components, NOT person_data.campus ──
      // components: 1 = Manila, 2 = Cavite. The department is authoritative here:
      // e.g. dept 12 "Earist (Cavite Branch)" and dept 13 "Graduate School ... (Cavite Branch)"
      // are Cavite regardless of what campus the applicant happened to select on the form.
      const deptComponents = deptRow.dept_components;

      const [[companyRow]] = await db.query(
        'SELECT branches FROM company_settings WHERE id = 1',
      );
      const branchList = JSON.parse(companyRow?.branches || '[]');

      const targetBranchName = Number(deptComponents) === 2 ? 'Cavite' : 'Manila';
      const branch = branchList.find(
        (b) => String(b.branch || '').trim().toLowerCase() === targetBranchName.toLowerCase(),
      );

      if (!branch?.letter_code) {
        throw new Error(
          `No letter_code configured for branch "${targetBranchName}" (derived from department components=${deptComponents}, dept_number=${deptNum}). ` +
          `Open the Student Number Configuration panel → Branch letters.`,
        );
      }
      const letter = branch.letter_code.toUpperCase();


      // ── Fixed atomic sequence ────────────────────────────────────────────────
      // Use a SELECT after upsert to always get the correct next_seq value,
      // avoiding the LAST_INSERT_ID() confusion between INSERT and UPDATE paths.
      const conn = await db3.getConnection();
      let seq;
      try {
        await conn.query(
          `INSERT INTO student_number_sequence (school_year, dept_number, next_seq)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE next_seq = next_seq + 1`,
          [yy, deptNum],
        );

        const [[seqRow]] = await conn.query(
          `SELECT next_seq FROM student_number_sequence
       WHERE school_year = ? AND dept_number = ?`,
          [yy, deptNum],
        );

        seq = String(seqRow.next_seq).padStart(5, '0');
      } finally {
        conn.release();
      }

      return `${yy}${deptNum}-${seq}${letter}`;
    };




    socket.on("assign-student-number", async (payload) => {
      const conn = await db3.getConnection();
      try {
        const person_id =
          typeof payload === "object" && payload !== null
            ? payload.person_id
            : payload;
        const auditActorId =
          typeof payload === "object" && payload !== null
            ? payload.audit_actor_id || "unknown"
            : "unknown";
        const auditActorRole =
          typeof payload === "object" && payload !== null
            ? payload.audit_actor_role || "registrar"
            : "registrar";

        // ── Fetch person from ADMISSION db ──────────────────────────────────────
        const [rows] = await db.query(
          `SELECT * FROM person_table AS pt WHERE person_id = ?`,
          [person_id],
        );

        if (rows.length === 0) {
          conn.release();
          return socket.emit("assign-student-number-result", {
            success: false,
            message: "Person not found.",
          });
        }

        const person_data = rows[0];
        const { emailAddress, first_name, middle_name, last_name } = person_data;

        // ── Generate student number ──────────────────────────────────────────────
        let student_number;
        try {
          student_number = await generateStudentNumber(person_data);
        } catch (genErr) {
          console.error("[assign-student-number] generateStudentNumber failed:", genErr.message);
          conn.release();
          return socket.emit("assign-student-number-result", {
            success: false,
            message: genErr.message,
          });
        }

        const tempPassword = Math.random().toString(36).slice(-8).toUpperCase();
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        let studentProfileImg = person_data.profile_img;

        // ── Copy applicant 1×1 photo to Student1by1 folder ──────────────────────
        if (person_data.profile_img) {
          try {
            const applicantDir = path.join(__dirname, "uploads", "Applicant1by1");
            const studentDir = path.join(__dirname, "uploads", "Student1by1");
            const uploadRootDir = path.join(__dirname, "uploads");

            if (!fs.existsSync(studentDir)) fs.mkdirSync(studentDir, { recursive: true });

            const applicantPath = path.join(applicantDir, person_data.profile_img);
            const uploadRootPath = path.join(uploadRootDir, person_data.profile_img);
            const sourcePath = fs.existsSync(applicantPath)
              ? applicantPath
              : fs.existsSync(uploadRootPath)
                ? uploadRootPath
                : null;

            if (sourcePath) {
              const ext = path.extname(person_data.profile_img) || ".jpg";
              studentProfileImg = `${student_number}_profile_image${ext}`;
              fs.copyFileSync(sourcePath, path.join(studentDir, studentProfileImg));
            } else {
              console.warn(`[assign-student-number] profile image not found for person_id=${person_id}`);
            }
          } catch (imgErr) {
            console.error(`[assign-student-number] failed to copy profile image for person_id=${person_id}`, imgErr);
          }
        }

        // ── Get uploaded requirements from ADMISSION db ──────────────────────────
        const [requirements] = await db.query(
          `SELECT * FROM requirement_uploads WHERE person_id = ?`,
          [person_id],
        );

        const [[applicantNumberRow]] = await db.query(
          `SELECT applicant_number FROM applicant_numbering_table WHERE person_id = ? LIMIT 1`,
          [person_id],
        );
        const applicantNumber = applicantNumberRow?.applicant_number || null;

        const requirementShortLabels = new Map();
        if (requirements.length) {
          const requirementIds = [
            ...new Set(
              requirements
                .map((req) => req.requirements_id)
                .filter((id) => id !== null && id !== undefined),
            ),
          ];
          if (requirementIds.length) {
            const [requirementRows] = await db.query(
              `SELECT id, short_label FROM requirements_table WHERE id IN (?)`,
              [requirementIds],
            );
            for (const row of requirementRows) {
              requirementShortLabels.set(row.id, row.short_label || "Unknown");
            }
          }
        }

        // ── BEGIN TRANSACTION in ENROLLMENT db ───────────────────────────────────
        await conn.beginTransaction();

        // ── Build values array matching the 148 columns (skipping person_id) ────
        // Column order matches your schema exactly: col 2 → col 149
        const personValues = [
          student_number,                       // 2  student_number
          studentProfileImg,                    // 3  profile_img
          person_data.campus,                   // 4  campus
          person_data.academicProgram,          // 5  academicProgram
          person_data.classifiedAs,             // 6  classifiedAs
          person_data.applyingAs,               // 7  applyingAs
          person_data.program,                  // 8  program
          person_data.program2,                 // 9  program2
          person_data.program3,                 // 10 program3
          person_data.yearLevel,                // 11 yearLevel
          person_data.last_name,                // 12 last_name
          person_data.first_name,               // 13 first_name
          person_data.middle_name,              // 14 middle_name
          person_data.extension,                // 15 extension
          person_data.nickname,                 // 16 nickname
          person_data.height,                   // 17 height
          person_data.weight,                   // 18 weight
          person_data.lrnNumber,                // 19 lrnNumber
          person_data.nolrnNumber,              // 20 nolrnNumber
          person_data.gender,                   // 21 gender
          person_data.pwdMember,                // 22 pwdMember
          person_data.pwdType,                  // 23 pwdType
          person_data.pwdId,                    // 24 pwdId
          person_data.birthOfDate,              // 25 birthOfDate
          person_data.age,                      // 26 age
          person_data.birthPlace,               // 27 birthPlace
          person_data.languageDialectSpoken,    // 28 languageDialectSpoken
          person_data.citizenship,              // 29 citizenship
          person_data.religion,                 // 30 religion
          person_data.civilStatus,              // 31 civilStatus
          person_data.tribeEthnicGroup,         // 32 tribeEthnicGroup
          person_data.cellphoneNumber,          // 33 cellphoneNumber
          person_data.emailAddress,             // 34 emailAddress
          person_data.presentStreet,            // 35 presentStreet
          person_data.presentBarangay,          // 36 presentBarangay
          person_data.presentZipCode,           // 37 presentZipCode
          person_data.presentRegion,            // 38 presentRegion
          person_data.presentProvince,          // 39 presentProvince
          person_data.presentMunicipality,      // 40 presentMunicipality
          person_data.presentDswdHouseholdNumber, // 41 presentDswdHouseholdNumber
          person_data.sameAsPresentAddress,     // 42 sameAsPresentAddress
          person_data.permanentStreet,          // 43 permanentStreet
          person_data.permanentBarangay,        // 44 permanentBarangay
          person_data.permanentZipCode,         // 45 permanentZipCode
          person_data.permanentRegion,          // 46 permanentRegion
          person_data.permanentProvince,        // 47 permanentProvince
          person_data.permanentMunicipality,    // 48 permanentMunicipality
          person_data.permanentDswdHouseholdNumber, // 49 permanentDswdHouseholdNumber
          person_data.solo_parent,              // 50 solo_parent
          person_data.father_deceased,          // 51 father_deceased
          person_data.father_family_name,       // 52 father_family_name
          person_data.father_given_name,        // 53 father_given_name
          person_data.father_middle_name,       // 54 father_middle_name
          person_data.father_ext,               // 55 father_ext
          person_data.father_nickname,          // 56 father_nickname
          person_data.father_education,         // 57 father_education
          person_data.father_education_level,   // 58 father_education_level
          person_data.father_last_school,       // 59 father_last_school
          person_data.father_course,            // 60 father_course
          person_data.father_year_graduated,    // 61 father_year_graduated
          person_data.father_school_address,    // 62 father_school_address
          person_data.father_contact,           // 63 father_contact
          person_data.father_occupation,        // 64 father_occupation
          person_data.father_employer,          // 65 father_employer
          person_data.father_income,            // 66 father_income
          person_data.father_email,             // 67 father_email
          person_data.mother_deceased,          // 68 mother_deceased
          person_data.mother_family_name,       // 69 mother_family_name
          person_data.mother_given_name,        // 70 mother_given_name
          person_data.mother_middle_name,       // 71 mother_middle_name
          person_data.mother_ext,               // 72 mother_ext
          person_data.mother_nickname,          // 73 mother_nickname
          person_data.mother_education,         // 74 mother_education
          person_data.mother_education_level,   // 75 mother_education_level
          person_data.mother_last_school,       // 76 mother_last_school
          person_data.mother_course,            // 77 mother_course
          person_data.mother_year_graduated,    // 78 mother_year_graduated
          person_data.mother_school_address,    // 79 mother_school_address
          person_data.mother_contact,           // 80 mother_contact
          person_data.mother_occupation,        // 81 mother_occupation
          person_data.mother_employer,          // 82 mother_employer
          person_data.mother_income,            // 83 mother_income
          person_data.mother_email,             // 84 mother_email
          person_data.guardian,                 // 85 guardian
          person_data.guardian_family_name,     // 86 guardian_family_name
          person_data.guardian_given_name,      // 87 guardian_given_name
          person_data.guardian_middle_name,     // 88 guardian_middle_name
          person_data.guardian_ext,             // 89 guardian_ext
          person_data.guardian_nickname,        // 90 guardian_nickname
          person_data.guardian_address,         // 91 guardian_address
          person_data.guardian_contact,         // 92 guardian_contact
          person_data.guardian_email,           // 93 guardian_email
          person_data.annual_income,            // 94 annual_income
          person_data.schoolLevel,              // 95 schoolLevel
          person_data.schoolLastAttended,       // 96 schoolLastAttended
          person_data.schoolAddress,            // 97 schoolAddress
          person_data.courseProgram,            // 98 courseProgram
          person_data.honor,                    // 99 honor
          person_data.generalAverage,           // 100 generalAverage
          person_data.yearGraduated,            // 101 yearGraduated
          person_data.schoolLevel1,             // 102 schoolLevel1
          person_data.schoolLastAttended1,      // 103 schoolLastAttended1
          person_data.schoolAddress1,           // 104 schoolAddress1
          person_data.courseProgram1,           // 105 courseProgram1
          person_data.honor1,                   // 106 honor1
          person_data.generalAverage1,          // 107 generalAverage1
          person_data.yearGraduated1,           // 108 yearGraduated1
          person_data.strand,                   // 109 strand
          person_data.cough,                    // 110 cough
          person_data.colds,                    // 111 colds
          person_data.fever,                    // 112 fever
          person_data.asthma,                   // 113 asthma
          person_data.faintingSpells,           // 114 faintingSpells
          person_data.heartDisease,             // 115 heartDisease
          person_data.tuberculosis,             // 116 tuberculosis
          person_data.frequentHeadaches,        // 117 frequentHeadaches
          person_data.hernia,                   // 118 hernia
          person_data.chronicCough,             // 119 chronicCough
          person_data.headNeckInjury,           // 120 headNeckInjury
          person_data.hiv,                      // 121 hiv
          person_data.highBloodPressure,        // 122 highBloodPressure
          person_data.diabetesMellitus,         // 123 diabetesMellitus
          person_data.allergies,                // 124 allergies
          person_data.cancer,                   // 125 cancer
          person_data.smokingCigarette,         // 126 smokingCigarette
          person_data.alcoholDrinking,          // 127 alcoholDrinking
          person_data.hospitalized,             // 128 hospitalized
          person_data.hospitalizationDetails,   // 129 hospitalizationDetails
          person_data.medications,              // 130 medications
          person_data.hadCovid,                 // 131 hadCovid
          person_data.covidDate,                // 132 covidDate
          person_data.vaccine1Brand,            // 133 vaccine1Brand
          person_data.vaccine1Date,             // 134 vaccine1Date
          person_data.vaccine2Brand,            // 135 vaccine2Brand
          person_data.vaccine2Date,             // 136 vaccine2Date
          person_data.booster1Brand,            // 137 booster1Brand
          person_data.booster1Date,             // 138 booster1Date
          person_data.booster2Brand,            // 139 booster2Brand
          person_data.booster2Date,             // 140 booster2Date
          person_data.chestXray,                // 141 chestXray
          person_data.cbc,                      // 142 cbc
          person_data.urinalysis,               // 143 urinalysis
          person_data.otherworkups,             // 144 otherworkups
          person_data.symptomsToday,            // 145 symptomsToday
          person_data.remarks,                  // 146 remarks
          person_data.termsOfAgreement,         // 147 termsOfAgreement
          person_data.created_at,               // 148 created_at
          person_data.current_step,             // 149 current_step
        ];

        const placeholders = personValues.map(() => "?").join(", ");

        const [personInsertResult] = await conn.query(
          `INSERT INTO person_table (
        student_number, profile_img, campus, academicProgram, classifiedAs,
        applyingAs, program, program2, program3, yearLevel, last_name, first_name,
        middle_name, extension, nickname, height, weight, lrnNumber, nolrnNumber,
        gender, pwdMember, pwdType, pwdId, birthOfDate, age, birthPlace,
        languageDialectSpoken, citizenship, religion, civilStatus, tribeEthnicGroup,
        cellphoneNumber, emailAddress, presentStreet, presentBarangay, presentZipCode,
        presentRegion, presentProvince, presentMunicipality, presentDswdHouseholdNumber,
        sameAsPresentAddress, permanentStreet, permanentBarangay, permanentZipCode,
        permanentRegion, permanentProvince, permanentMunicipality,
        permanentDswdHouseholdNumber, solo_parent, father_deceased, father_family_name,
        father_given_name, father_middle_name, father_ext, father_nickname,
        father_education, father_education_level, father_last_school, father_course,
        father_year_graduated, father_school_address, father_contact, father_occupation,
        father_employer, father_income, father_email, mother_deceased, mother_family_name,
        mother_given_name, mother_middle_name, mother_ext, mother_nickname,
        mother_education, mother_education_level, mother_last_school, mother_course,
        mother_year_graduated, mother_school_address, mother_contact, mother_occupation,
        mother_employer, mother_income, mother_email, guardian, guardian_family_name,
        guardian_given_name, guardian_middle_name, guardian_ext, guardian_nickname,
        guardian_address, guardian_contact, guardian_email, annual_income, schoolLevel,
        schoolLastAttended, schoolAddress, courseProgram, honor, generalAverage,
        yearGraduated, schoolLevel1, schoolLastAttended1, schoolAddress1, courseProgram1,
        honor1, generalAverage1, yearGraduated1, strand, cough, colds, fever, asthma,
        faintingSpells, heartDisease, tuberculosis, frequentHeadaches, hernia,
        chronicCough, headNeckInjury, hiv, highBloodPressure, diabetesMellitus,
        allergies, cancer, smokingCigarette, alcoholDrinking, hospitalized,
        hospitalizationDetails, medications, hadCovid, covidDate, vaccine1Brand,
        vaccine1Date, vaccine2Brand, vaccine2Date, booster1Brand, booster1Date,
        booster2Brand, booster2Date, chestXray, cbc, urinalysis, otherworkups,
        symptomsToday, remarks, termsOfAgreement, created_at, current_step
      ) VALUES (${placeholders})`,
          personValues,
        );

        // ── Real person_id from MySQL auto-increment ─────────────────────────────
        const personIdForStudent = personInsertResult.insertId;

        // ── Insert into student_numbering_table ──────────────────────────────────
        await conn.query(
          `INSERT INTO student_numbering_table (student_number, person_id) VALUES (?, ?)`,
          [student_number, personIdForStudent],
        );

        // ── Insert into person_status_table ──────────────────────────────────────
        await conn.query(
          `INSERT INTO person_status_table
        (person_id, exam_status, requirements, residency, student_registration_status, exam_result, hs_ave)
       VALUES (?, 0, 0, 0, 0, 0, 0)`,
          [personIdForStudent],
        );

        // ── Insert into student_status_table ─────────────────────────────────────
        await conn.query(
          `INSERT INTO student_status_table
        (student_number, active_curriculum, enrolled_status, year_level_id, active_school_year_id, control_status)
       VALUES (?, ?, 0, 0, 0, 0)`,
          [student_number, person_data.program],
        );

        // ── Copy requirements to ENROLLMENT db ───────────────────────────────────
        for (const req of requirements) {
          const shortLabel = requirementShortLabels.get(req.requirements_id) || "Unknown";
          const targetFilename = buildStudentRequirementFilename(
            applicantNumber,
            student_number,
            req.file_path,
            shortLabel,
          );
          const { filePath: enrollmentFilePath } = await copyRequirementFileForEnrollment({
            sourceFilename: req.file_path,
            targetFilename,
            applicantNumber,
            studentNumber: student_number,
            shortLabelFallback: shortLabel,
          });

          await conn.query(
            `INSERT INTO requirement_uploads
          (requirements_id, person_id, submitted_documents, file_path, original_name,
           remarks, status, document_status, registrar_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              req.requirements_id,
              personIdForStudent,
              req.submitted_documents,
              enrollmentFilePath || targetFilename || req.file_path,
              req.original_name,
              req.remarks,
              req.status,
              req.document_status,
              req.registrar_status,
              req.created_at,
            ],
          );
        }

        // ── Mark student registration complete ───────────────────────────────────
        await conn.query(
          `UPDATE person_status_table SET student_registration_status = 1 WHERE person_id = ?`,
          [personIdForStudent],
        );

        // ── Insert or update login credentials in ENROLLMENT user_accounts ───────
        // ── Insert or update login credentials in ENROLLMENT user_accounts ───────
        const [existingUser] = await conn.query(
          `SELECT id FROM user_accounts WHERE person_id = ?`,
          [personIdForStudent],
        );

        if (existingUser.length === 0) {
          await conn.query(
            `INSERT INTO user_accounts (person_id, email, password, role, status, force_password_change)
 VALUES (?, ?, ?, 'student', 1, 1)`,
            [personIdForStudent, person_data.emailAddress, hashedPassword],
          );
        } else {
          await conn.query(
            `UPDATE user_accounts SET email = ?, password = ?, role = 'student', status = 1, force_password_change = 1
 WHERE person_id = ?`,
            [person_data.emailAddress, hashedPassword, personIdForStudent],
          );
        }

        // ── Commit transaction ───────────────────────────────────────────────────
        await conn.commit();
        conn.release();

        // ── Generate QR code ─────────────────────────────────────────────────────
        const qrData = `${process.env.DB_HOST_LOCAL}:5173/student_qr_information/${student_number}`;
        const qrFilename = `${student_number}_qrcode.png`;
        const qrPath = path.join(__dirname, "./uploads/QrCodeGenerated", qrFilename);

        await QRCode.toFile(qrPath, qrData, {
          color: { dark: "#000", light: "#FFF" },
          width: 300,
        });

        // ── Audit log ────────────────────────────────────────────────────────────
        const roleLabel = formatAuditActorRole(auditActorRole);
        const studentName = [last_name, first_name, middle_name].filter(Boolean).join(", ");

        await insertAuditLogEnrollment({
          actorId: auditActorId,
          role: auditActorRole,
          action: "STUDENT_NUMBER_ASSIGN",
          severity: "INFO",
          message: `${roleLabel} (${auditActorId}) assigned student number ${student_number} to ${studentName || `person_id ${person_id}`}.`,
        });

        await logStudentHistoryFromActor({
          actorId: auditActorId,
          studentNumber: student_number,
          action: "assign_student_number",
          details: {
            student_name: [first_name, middle_name, last_name].filter(Boolean).join(" "),
            generated_number: student_number,
          },
        });

        // ── Send welcome email ───────────────────────────────────────────────────
        const [[company]] = await db.query(
          "SELECT company_name, short_term FROM company_settings WHERE id = 1",
        );
        const companyName = company?.company_name || "Enrollment Office";
        const companyShort = company?.short_term || "";

        const mailer = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        let emailSent = false;
        let emailErrorMessage = "";

        try {
          if (!emailAddress) throw new Error("Student email address is empty.");
          await mailer.sendMail({
            from: `"${companyShort} Enrollment Office" <${process.env.EMAIL_USER}>`,
            to: emailAddress,
            subject: `Welcome to ${companyName} - Acceptance Confirmation`,
            text: `
Hi, ${first_name} ${middle_name || ""} ${last_name},

Congratulations! You are now officially accepted and part of the ${companyName} community.

Please visit your respective college offices to tag your schedule to your account and obtain your class schedule.

Your Student Number is: ${student_number}
Your Email Address is: ${emailAddress}
Your temporary password is: ${tempPassword}

You may change your password and keep it secure.

Click the link below to log in:
    https://ap.earist.edu.ph/login

    
        `.trim(),
          });
          emailSent = true;
        } catch (emailError) {
          emailErrorMessage = emailError?.response || emailError?.message || "Failed to send email.";
          console.error("[assign-student-number] Email send failed:", emailError);
        }

        // ── Deactivate the applicant account in ADMISSION ────────────────────────
        await db.query(
          `UPDATE user_accounts SET status = 0 WHERE person_id = ?`,
          [person_id],
        );

        // ── Emit result ──────────────────────────────────────────────────────────
        socket.emit("assign-student-number-result", {
          success: true,
          student_number,
          email_sent: emailSent,
          temp_password: tempPassword,
          student_data: {
            person_id: personIdForStudent + 1,
            student_number,
            first_name,
            middle_name,
            last_name,
            email: emailAddress,
            profile_img: studentProfileImg,
            program: person_data.program,
            campus: person_data.campus,
          },
          message: emailSent
            ? "Student number assigned and email sent successfully."
            : `Student number assigned, but email was not sent. ${emailErrorMessage}`,
        });

      } catch (error) {
        try { await conn.rollback(); } catch (_) { }
        conn.release();

        console.error("Error in assign-student-number:", error);
        socket.emit("assign-student-number-result", {
          success: false,
          message: error.message || "Internal server error.",
        });
      }
    });


  });

  app.get('/api/admin/dept-numbers', async (req, res) => {
    try {
      const [rows] = await db3.query(
        `SELECT dprtmnt_id, dprtmnt_name, dprtmnt_code, dept_number, components
       FROM dprtmnt_table
       ORDER BY dprtmnt_id ASC`
      );
      res.json(rows);
    } catch (err) {
      console.error('[admin/dept-numbers GET]', err);
      res.status(500).json({ error: err.message });
    }
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // PUT /api/admin/dept-numbers
  // Body: { departments: [{ dprtmnt_id, dept_number }, …] }
  // Bulk-updates dept_number for every department in the array.
  // ─────────────────────────────────────────────────────────────────────────────
  app.put('/api/admin/dept-numbers', async (req, res) => {
    const { departments } = req.body;

    if (!Array.isArray(departments) || departments.length === 0) {
      return res.status(400).json({ error: 'departments array is required' });
    }

    const nums = departments.map(d => d.dept_number).filter(n => n !== null && n !== undefined);
    const seen = new Set();
    for (const n of nums) {
      if (seen.has(n)) return res.status(400).json({ error: `Duplicate dept_number: ${n}` });
      seen.add(n);
    }

    // Default missing/null components to Manila (1) — matches the frontend's
    // display fallback (`d.components ?? 1`) so what gets saved matches what
    // the registrar saw on screen. Only reject values that are genuinely wrong.
    const normalizedDepartments = departments.map((d) => ({
      ...d,
      components: d.components === null || d.components === undefined
        ? 1
        : Number(d.components),
    }));

    const invalidComponents = normalizedDepartments.filter(
      (d) => ![1, 2].includes(d.components),
    );
    if (invalidComponents.length > 0) {
      return res.status(400).json({
        error: `Invalid components value for dprtmnt_id(s): ${invalidComponents.map(d => d.dprtmnt_id).join(', ')}. Must be 1 (Manila) or 2 (Cavite).`,
      });
    }

    try {
      for (const dept of normalizedDepartments) {
        await db3.query(
          'UPDATE dprtmnt_table SET dept_number = ?, components = ? WHERE dprtmnt_id = ?',
          [dept.dept_number ?? null, dept.components, dept.dprtmnt_id]
        );
      }
      res.json({ success: true, updated: normalizedDepartments.length });
    } catch (err) {
      console.error('[admin/dept-numbers PUT]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/admin/branch-letters
  // Returns the branches array from company_settings (already JSON-parsed).
  // ─────────────────────────────────────────────────────────────────────────────
  app.get('/api/admin/branch-letters', async (req, res) => {
    try {
      const [[row]] = await db.query(
        'SELECT branches FROM company_settings WHERE id = 1'
      );
      const branches = JSON.parse(row?.branches || '[]');
      res.json(branches);
    } catch (err) {
      console.error('[admin/branch-letters GET]', err);
      res.status(500).json({ error: err.message });
    }
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // PUT /api/admin/branch-letters
  // Body: { branches: [{ id, letter_code }, …] }
  // Merges letter_code into the existing branches JSON without touching other fields.
  // ─────────────────────────────────────────────────────────────────────────────
  app.put('/api/admin/branch-letters', async (req, res) => {
    const { branches: incoming } = req.body;

    if (!Array.isArray(incoming)) {
      return res.status(400).json({ error: 'branches array is required' });
    }

    // Validate: each letter_code must be a single uppercase letter
    for (const b of incoming) {
      if (b.letter_code && !/^[A-Za-z]$/.test(b.letter_code)) {
        return res.status(400).json({ error: `Invalid letter_code "${b.letter_code}" for branch id=${b.id}. Must be a single letter.` });
      }
    }

    try {
      const [[row]] = await db.query(
        'SELECT branches FROM company_settings WHERE id = 1'
      );
      const existing = JSON.parse(row?.branches || '[]');

      const updated = existing.map(branch => {
        const found = incoming.find(n => n.id === branch.id);
        if (!found) return branch;
        return { ...branch, letter_code: found.letter_code.toUpperCase() };
      });

      await db.query(
        'UPDATE company_settings SET branches = ? WHERE id = 1',
        [JSON.stringify(updated)]
      );

      res.json({ success: true });
    } catch (err) {
      console.error('[admin/branch-letters PUT]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------- Email Sender (same message format as student/faculty/applicant) ----------------
  async function sendResetEmail(to, tempPassword, shortTerm) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: `"${shortTerm} - Information System" <${process.env.EMAIL_USER}>`,
        to,
        subject: "Your Password has Reset",
        text: `Your new temporary password is: ${tempPassword}\n\nPlease change it after logging in.`,
      });

    } catch (emailErr) {
      console.error("Email send error:", emailErr);
    }
  }

  app.get("/api/day_list", async (req, res) => {
    try {
      const [results] = await db.query(
        "SELECT DISTINCT day_description FROM entrance_exam_schedule ORDER BY FIELD(day_description, 'Monday','Tuesday','Wednesday','Thursday','Friday')",
      );
      res.json(results);
    } catch (err) {
      console.error("Error fetching days:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.get("/api/interview/applicants-with-number", async (req, res) => {
    try {
      const [rows] = await db.query(`
      SELECT
        p.person_id,
        a.applicant_number,
        p.last_name,
        p.first_name,
        p.middle_name,
        p.extension,
        p.program,
        p.emailAddress,
        p.campus,
        ia.schedule_id,
        ia.email_sent
      FROM interview_applicants ia
      LEFT JOIN applicant_numbering_table a
        ON ia.applicant_id = a.applicant_number
      LEFT JOIN person_table p
        ON a.person_id = p.person_id
      ORDER BY p.last_name, p.first_name
    `);
      res.json(rows);
    } catch (err) {
      console.error(" Error fetching interview applicants:", err);
      res.status(500).json({ error: "Failed to fetch interview applicants" });
    }
  });

  app.get("/api/interview/not-emailed-applicants", async (req, res) => {
    try {
      // ✅ subjects (dynamic)
      const [subjects] = await db.query(`
      SELECT id, name, max_score
      FROM subjects
      WHERE is_active = 1
      ORDER BY id ASC
    `);

      // ✅ main applicant data
      const [rows] = await db.query(`
      SELECT DISTINCT
        p.person_id,
        p.applyingAs,
        p.last_name,
        p.first_name,
        p.middle_name,
        p.extension,
        p.emailAddress,
        p.program,
        p.campus,
        p.generalAverage1,
        p.created_at,

        a.applicant_number,
        SUBSTRING(a.applicant_number, 5, 1) AS middle_code,

        ia.schedule_id,
        ia.email_sent,

        -- schedule details
        ies.day_description,
        ies.room_description,
        ies.start_time,
        ies.end_time,
        ies.interviewer,

        -- interview status
        ps.interview_status,

        -- exam results (NO hardcoded subjects anymore)
        er.id AS exam_result_id,
        er.total_score,
        er.percentage,
        er.final_rating,
        er.status

      FROM interview_applicants ia

      LEFT JOIN applicant_numbering_table a
        ON ia.applicant_id = a.applicant_number

      LEFT JOIN person_table p
        ON a.person_id = p.person_id

      LEFT JOIN interview_exam_schedule ies
        ON ia.schedule_id = ies.schedule_id

      LEFT JOIN person_status_table ps
        ON ps.person_id = p.person_id

      LEFT JOIN exam_results er
        ON p.person_id = er.person_id

      LEFT JOIN exam_applicants ea
        ON a.applicant_number = ea.applicant_id

      WHERE (ia.email_sent = 0 OR ia.email_sent IS NULL)

      ORDER BY p.last_name ASC, p.first_name ASC
    `);

      // ✅ exam details (per subject)
      const [details] = await db.query(`
      SELECT exam_result_id, subject_id, score
      FROM exam_result_details
    `);

      // ✅ merge dynamic subject scores into each applicant
      const formatted = rows.map((row) => {
        const scores = {};

        // initialize all subjects
        subjects.forEach((sub) => {
          scores[sub.id] = 0;
        });

        // fill actual scores
        details
          .filter((d) => d.exam_result_id === row.exam_result_id)
          .forEach((d) => {
            scores[d.subject_id] = Number(d.score);
          });

        // compute total
        const total = Object.values(scores).reduce((sum, v) => sum + v, 0);

        const maxTotal = subjects.reduce(
          (sum, s) => sum + Number(s.max_score || 0),
          0,
        );

        const percentage =
          row.percentage ?? (maxTotal > 0 ? (total / maxTotal) * 100 : 0);

        const final_rating =
          row.final_rating ??
          (subjects.length > 0 ? total / subjects.length : 0);

        return {
          ...row,

          // keep old-style compatibility if frontend still expects it
          total_score: row.total_score ?? total,
          percentage,
          final_rating,

          // NEW dynamic structure
          scores,
        };
      });

      res.json({
        subjects,
        data: formatted,
      });
    } catch (err) {
      console.error("Error fetching interview applicants:", err);
      res.status(500).json({ error: "Failed to fetch interview applicants" });
    }
  });

  app.put("/api/exam/remove_applicant", async (req, res) => {
    try {
      const { applicant_id, audit_actor_id, audit_actor_role } = req.body;

      if (!applicant_id) {
        return res.status(400).json({ message: "Missing applicant_id" });
      }

      const [[assignedBefore]] = await db.query(
        `SELECT
           ea.schedule_id,
           ant.applicant_number,
           pt.first_name,
           pt.middle_name,
           pt.last_name
         FROM exam_applicants ea
         LEFT JOIN applicant_numbering_table ant ON ant.applicant_number = ea.applicant_id
         LEFT JOIN person_table pt ON pt.person_id = ant.person_id
         WHERE ea.applicant_id = ?
         LIMIT 1`,
        [applicant_id],
      );

      // 1  Reset exam_applicants table
      await db.query(
        `UPDATE exam_applicants
       SET schedule_id = NULL, email_sent = 0
       WHERE applicant_id = ?`,
        [applicant_id],
      );

      // 2  Reset person_status_table exam_status
      await db.query(
        `UPDATE person_status_table
       SET exam_status = NULL
       WHERE applicant_id = ?`,
        [applicant_id],
      );

      if (assignedBefore?.schedule_id) {
        const safeActor = audit_actor_id || "unknown";
        const roleLabel = formatAuditActorRole(audit_actor_role);
        const scheduleLabel = await getEntranceExamScheduleLabel(
          assignedBefore.schedule_id,
        );
        const applicantName = [
          assignedBefore.last_name,
          assignedBefore.first_name,
          assignedBefore.middle_name,
        ]
          .filter(Boolean)
          .join(", ");

        await insertAuditLogAdmission({
          actorId: safeActor,
          role: audit_actor_role || "registrar",
          action: "ENTRANCE_EXAM_PROCTOR_REMOVE",
          severity: "INFO",
          message: `${roleLabel} (${safeActor}) removed Applicant (${applicant_id}${applicantName ? ` - ${applicantName}` : ""}) from proctor entrance examination list for ${scheduleLabel}.`,
        });
      }

      res.json({
        message: "Applicant removed from exam schedule successfully.",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/interview/remove_applicant", async (req, res) => {
    try {
      const { applicant_id } = req.body;

      if (!applicant_id) {
        return res.status(400).json({ message: "Missing applicant_id" });
      }

      // 1  Reset interview_applicants table
      await db.query(
        `UPDATE interview_applicants
       SET schedule_id = NULL, email_sent = 0, action = 0
       WHERE applicant_id = ?`,
        [applicant_id],
      );

      res.json({
        message: "Applicant interview schedule removed successfully.",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ================== INTERVIEW SOCKET EVENTS ==================
  io.on("connection", (socket) => {

    // Assign applicants (single, 40, custom  all handled here)
    socket.on(
      "update_interview_schedule",
      async ({ schedule_id, applicant_numbers }) => {
        try {
          if (
            !Array.isArray(applicant_numbers) ||
            applicant_numbers.length === 0
          ) {
            socket.emit("update_schedule_result", {
              success: false,
              error: "No applicants provided.",
            });
            return;
          }

          //   1. Get schedule info (quota)
          const [[schedule]] = await db.query(
            `SELECT room_quota FROM interview_exam_schedule WHERE schedule_id = ?`,
            [schedule_id],
          );

          if (!schedule) {
            socket.emit("update_schedule_result", {
              success: false,
              error: "Schedule not found.",
            });
            return;
          }

          //   2. Get current occupancy
          const [[{ current_count }]] = await db.query(
            `SELECT COUNT(*) AS current_count FROM interview_applicants WHERE schedule_id = ?`,
            [schedule_id],
          );

          const availableSlots = schedule.room_quota - current_count;
          if (availableSlots <= 0) {
            socket.emit("update_schedule_result", {
              success: false,
              error: `Schedule is already full (${schedule.room_quota} applicants).`,
            });
            return;
          }

          //   3. Trim applicant_numbers if more than available slots
          const toAssign = applicant_numbers.slice(0, availableSlots);

          //  4. Update only those applicants
          const [results] = await db.query(
            `UPDATE interview_applicants
         SET schedule_id = ?, action = 1
         WHERE applicant_id IN (?)`,
            [schedule_id, toAssign],
          );

          socket.emit("update_schedule_result", {
            success: true,
            assigned: toAssign,
            updated: results.affectedRows,
            skipped: applicant_numbers.length - toAssign.length,
          });

          // Refresh schedule data for connected clients.
          io.emit("schedule_updated", { schedule_id });
        } catch (err) {
          console.error(" Error updating interview schedule:", err);
          socket.emit("update_schedule_result", {
            success: false,
            error: "Failed to update interview schedule.",
          });
        }
      },
    );

    // Unassign ALL
    socket.on("unassign_all_from_interview", async ({ schedule_id }) => {
      try {
        await db.query(
          `UPDATE interview_applicants
         SET schedule_id = NULL, action = 0
         WHERE schedule_id = ?`,
          [schedule_id],
        );
        socket.emit("unassign_all_result", {
          success: true,
          message: "All applicants unassigned.",
        });
        io.emit("schedule_updated", { schedule_id });
      } catch (err) {
        console.error(" Error unassigning all interview applicants:", err);
        socket.emit("unassign_all_result", {
          success: false,
          error: "Failed to unassign all applicants.",
        });
      }
    });

    function formatTime(timeStr) {
      if (!timeStr) return "";
      const [hours, minutes] = timeStr.split(":"); // ignore seconds
      let h = parseInt(hours, 10);
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12; // convert 0 -> 12
      return `${h}:${minutes} ${ampm}`;
    }

    //  Handle sending interview schedule emails
    //  Handle sending interview schedule emails
    socket.on(
      "send_interview_emails",
      async ({
        schedule_id,
        applicant_numbers,
        subject: finalSubject,
        senderName,
        message,
        user_person_id,
        audit_actor_id,
        audit_actor_role,
        department_id,  // ADD THIS
        program_id,     // ADD THIS
      }) => {
        try {
          const [rows] = await db.query(
            `SELECT
            ia.schedule_id,
            s.day_description,
            s.building_description,
            s.room_description,
            s.start_time,
            s.end_time,
            an.applicant_number,
            p.person_id,
            p.first_name,
            p.middle_name,
            p.last_name,
            p.emailAddress,
            dt.dprtmnt_name
          FROM interview_applicants ia
          JOIN interview_exam_schedule s 
            ON ia.schedule_id = s.schedule_id
          JOIN applicant_numbering_table an 
            ON ia.applicant_id = an.applicant_number
          JOIN person_table p 
            ON an.person_id = p.person_id
          JOIN enrollment.dprtmnt_curriculum_table dct 
            ON p.program = dct.curriculum_id
          JOIN enrollment.dprtmnt_table dt 
            ON dct.dprtmnt_id = dt.dprtmnt_id
          WHERE ia.schedule_id = ?
          AND an.applicant_number IN (?)`,
            [schedule_id, applicant_numbers],
          );

          if (rows.length === 0) {
            return socket.emit("send_schedule_emails_result", {
              success: false,
              error: "No applicants found for this interview schedule.",
            });
          }

          const [[company]] = await db.query(
            "SELECT short_term FROM company_settings WHERE id = 1",
          );

          const shortTerm = company?.short_term || "EARIST";

          const finalSubjectComputed =
            finalSubject || rows[0]?.dprtmnt_name || "Interview Schedule";

          const [actorRows] = await db3.query(
            `SELECT
            email AS actor_email,
            role,
            employee_id,
            last_name,
            first_name,
            middle_name
          FROM user_accounts
          WHERE person_id = ?
          LIMIT 1`,
            [user_person_id],
          );

          const actor = actorRows[0] || null;

          // UPDATED QUERY - filter by department_id and program_id
          // NEW — joins email_template_programs to get dprtmnt_id and program_id
          const [userEmail] = await db.query(
            `SELECT et.sender_name
   FROM email_template_employees ete
   INNER JOIN email_templates et ON ete.template_id = et.template_id
   INNER JOIN email_template_programs etp ON etp.template_id = et.template_id
   WHERE ete.employee_id = ?
     AND etp.dprtmnt_id = ?
     AND etp.program_id = ?
     AND et.is_active = 1
   ORDER BY et.updated_at DESC
   LIMIT 1`,
            [actor?.employee_id || null, department_id, program_id],
          );

          if (userEmail.length === 0) {
            throw new Error("User not assigned to a matching college email for this program.");
          }

          const senderEmail = userEmail[0].sender_name;
          const senderAccount = getSenderAccountForEmail(senderEmail);

          if (!senderAccount) {
            throw new Error(
              "Email sender account does not match a configured backend .env account.",
            );
          }

          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: senderAccount,
          });

          const sent = [];
          const failed = [];

          function formatTime(timeStr) {
            if (!timeStr) return "";
            const [hours, minutes] = timeStr.split(":");
            let h = parseInt(hours, 10);
            const ampm = h >= 12 ? "PM" : "AM";
            h = h % 12 || 12;
            return `${h}:${minutes} ${ampm}`;
          }

          for (const row of rows) {
            if (!row.emailAddress) {
              failed.push(row.applicant_number);
              continue;
            }

            const formattedStart = formatTime(row.start_time);
            const formattedEnd = formatTime(row.end_time);

            const personalizedMsg = message
              .replace(/{first_name}/g, row.first_name || "")
              .replace(/{middle_name}/g, row.middle_name || "")
              .replace(/{last_name}/g, row.last_name || "")
              .replace(/{applicant_number}/g, row.applicant_number)
              .replace(/{day}/g, row.day_description)
              .replace(/{room}/g, row.room_description)
              .replace(/{start_time}/g, formattedStart)
              .replace(/{end_time}/g, formattedEnd);

            const mailOptions = {
              from: `${shortTerm} - ${row.dprtmnt_name} <${senderAccount.user}>`,
              to: row.emailAddress,
              subject: finalSubjectComputed,
              text: personalizedMsg,
            };

            await transporter.sendMail(mailOptions);

            try {
              await db.query(
                "UPDATE interview_applicants SET email_sent = 1 WHERE applicant_id = ?",
                [row.applicant_number],
              );
              sent.push(row.applicant_number);
            } catch (err) {
              console.error(`Failed to send interview email to ${row.emailAddress}:`, err.message);
              await db.query(
                "UPDATE interview_applicants SET email_sent = 0 WHERE applicant_id = ?",
                [row.applicant_number],
              );
              failed.push(row.applicant_number);
            }
          }

          const safeActor = audit_actor_id || actor?.employee_id || user_person_id || "unknown";
          const roleLabel = formatAuditActorRole(audit_actor_role || actor?.role);
          const scheduleLabel = await getInterviewScheduleLabel(schedule_id);
          const sentList = sent.length > 0 ? sent.join(", ") : "None";
          const failedNote = failed.length > 0 ? ` Failed applicant(s): ${failed.join(", ")}.` : "";

          await insertAuditLogEnrollment({
            actorId: safeActor,
            role: audit_actor_role || actor?.role || "registrar",
            action: "QUALIFYING_INTERVIEW_SCHEDULE_EMAIL",
            severity: sent.length > 0 ? "INFO" : "WARNING",
            message: `${roleLabel} (${safeActor}) sent qualifying/interview schedule email to ${sent.length} applicant(s) for ${scheduleLabel}. Applicant(s): ${sentList}.${failedNote}`,
          });

          socket.emit("send_schedule_emails_result", {
            success: true,
            sent,
            failed,
            message: `Interview emails processed: Sent=${sent.length}, Failed=${failed.length}`,
          });

          io.emit("schedule_updated", { schedule_id });
        } catch (err) {
          console.error("Error in send_interview_emails:", err);
          socket.emit("send_schedule_emails_result", {
            success: false,
            error: err.message || "Server error sending interview emails.",
          });
        }
      },
    );
  });

  // ================== INSERT EXAM SCHEDULE ==================
  app.get("/api/exam_schedules", async (req, res) => {
    try {
      const [rows] = await db.query(`
      SELECT
        s.schedule_id,
        s.branch,
        s.day_description,
        s.building_description,
        s.room_description,
        s.start_time,
        s.end_time,
        s.proctor,
        s.room_quota,
        COUNT(ea.applicant_id) AS assigned_count
      FROM entrance_exam_schedule s
      LEFT JOIN exam_applicants ea ON s.schedule_id = ea.schedule_id
      GROUP BY s.schedule_id
      ORDER BY s.schedule_id DESC
    `);
      res.json(rows);
    } catch (err) {
      console.error("Error fetching schedules:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  io.on("connection", (socket) => {
    // ENTRANCE EXAM
    socket.on(
      "update_schedule",
      async ({
        schedule_id,
        applicant_numbers,
        audit_actor_id,
        audit_actor_role,
      }) => {
        try {
          if (
            !schedule_id ||
            !applicant_numbers ||
            applicant_numbers.length === 0
          ) {
            return socket.emit("update_schedule_result", {
              success: false,
              error: "Schedule ID and applicants required.",
            });
          }

          //  Get room quota
          const [[scheduleInfo]] = await db.query(
            `SELECT room_quota FROM entrance_exam_schedule WHERE schedule_id = ?`,
            [schedule_id],
          );
          if (!scheduleInfo) {
            return socket.emit("update_schedule_result", {
              success: false,
              error: "Schedule not found.",
            });
          }
          const roomQuota = scheduleInfo.room_quota;

          //  Count how many are already assigned
          const [[{ currentCount }]] = await db.query(
            `SELECT COUNT(*) AS currentCount FROM exam_applicants WHERE schedule_id = ?`,
            [schedule_id],
          );

          // If total would exceed quota, reject
          if (currentCount + applicant_numbers.length > roomQuota) {
            return socket.emit("update_schedule_result", {
              success: false,
              error: `Room quota exceeded! Capacity: ${roomQuota}, Currently Assigned: ${currentCount}, Trying to add: ${applicant_numbers.length}.`,
            });
          }

          const assigned = [];
          const updated = [];
          const skipped = [];

          for (const applicant_number of applicant_numbers) {
            const [check] = await db.query(
              `SELECT * FROM exam_applicants WHERE applicant_id = ?`,
              [applicant_number],
            );

            if (check.length > 0) {
              if (check[0].schedule_id === schedule_id) {
                skipped.push(applicant_number); // already in this schedule
              } else {
                await db.query(
                  `UPDATE exam_applicants SET schedule_id = ?, email_sent = 0 WHERE applicant_id = ?`,
                  [schedule_id, applicant_number],
                );
                updated.push(applicant_number);
              }
            } else {
              await db.query(
                `INSERT INTO exam_applicants (applicant_id, schedule_id, email_sent) VALUES (?, ?, 0)`,
                [applicant_number, schedule_id],
              );
              assigned.push(applicant_number);
            }
          }

          const changedApplicants = [...assigned, ...updated];
          if (changedApplicants.length > 0) {
            const safeActor = audit_actor_id || "unknown";
            const roleLabel = formatAuditActorRole(audit_actor_role);
            const scheduleLabel =
              await getEntranceExamScheduleLabel(schedule_id);

            await insertAuditLogAdmission({
              actorId: safeActor,
              role: audit_actor_role || "registrar",
              action: "ENTRANCE_EXAM_SCHEDULE_ASSIGN",
              severity: "INFO",
              message: `${roleLabel} (${safeActor}) assigned ${changedApplicants.length} applicant(s) to entrance examination ${scheduleLabel}. Applicant(s): ${changedApplicants.join(", ")}.`,
            });
          }

          socket.emit("update_schedule_result", {
            success: true,
            assigned,
            updated,
            skipped,
          });
        } catch (error) {
          console.error(" Error assigning schedule:", error);
          socket.emit("update_schedule_result", {
            success: false,
            error: "Failed to assign schedule.",
          });
        }
      },
    );

    // INTERVIEW EXAM
    socket.on(
      "update_schedule_for_interview",
      async ({
        schedule_id,
        applicant_numbers,
        audit_actor_id,
        audit_actor_role,
      }) => {
        try {
          if (
            !schedule_id ||
            !applicant_numbers ||
            applicant_numbers.length === 0
          ) {
            return socket.emit("update_schedule_result", {
              success: false,
              error: "Schedule ID and applicants required.",
            });
          }

          //  Get room quota
          const [[scheduleInfo]] = await db.query(
            `SELECT room_quota FROM interview_exam_schedule WHERE schedule_id = ?`,
            [schedule_id],
          );
          if (!scheduleInfo) {
            return socket.emit("update_schedule_result", {
              success: false,
              error: "Schedule not found.",
            });
          }
          const roomQuota = scheduleInfo.room_quota;

          //  Count how many are already assigned
          const [[{ currentCount }]] = await db.query(
            `SELECT COUNT(*) AS currentCount FROM interview_applicants WHERE schedule_id = ?`,
            [schedule_id],
          );

          // If total would exceed quota, reject
          if (currentCount + applicant_numbers.length > roomQuota) {
            return socket.emit("update_schedule_result", {
              success: false,
              error: `Room quota exceeded! Capacity: ${roomQuota}, Currently Assigned: ${currentCount}, Trying to add: ${applicant_numbers.length}.`,
            });
          }

          const assigned = [];
          const updated = [];
          const skipped = [];

          for (const applicant_number of applicant_numbers) {
            const [check] = await db.query(
              `SELECT * FROM interview_applicants WHERE applicant_id = ?`,
              [applicant_number],
            );

            if (check.length > 0) {
              if (check[0].schedule_id === schedule_id) {
                skipped.push(applicant_number); // already in this schedule
              } else {
                await db.query(
                  `UPDATE interview_applicants SET schedule_id = ?, action = 1 WHERE applicant_id = ?`,
                  [schedule_id, applicant_number],
                );
                updated.push(applicant_number);
              }
            } else {
              await db.query(
                `INSERT INTO interview_applicants (applicant_id, schedule_id, action, email_sent, status) VALUES (?, ?, 1, 0, 0)`,
                [applicant_number, schedule_id],
              );
              assigned.push(applicant_number);
            }
          }
          const changedApplicants = [...assigned, ...updated];
          if (changedApplicants.length > 0) {
            const safeActor = audit_actor_id || "unknown";
            const roleLabel = formatAuditActorRole(audit_actor_role);
            const scheduleLabel = await getInterviewScheduleLabel(schedule_id);

            await insertAuditLogEnrollment({
              actorId: safeActor,
              role: audit_actor_role || "registrar",
              action: "QUALIFYING_INTERVIEW_SCHEDULE_ASSIGN",
              severity: "INFO",
              message: `${roleLabel} (${safeActor}) assigned ${changedApplicants.length} applicant(s) to qualifying/interview ${scheduleLabel}. Applicant(s): ${changedApplicants.join(", ")}.`,
            });
          }

          socket.emit("update_schedule_result", {
            success: true,
            assigned,
            updated,
            skipped,
          });
        } catch (error) {
          console.error(" Error assigning schedule:", error);
          socket.emit("update_schedule_result", {
            success: false,
            error: "Failed to assign schedule.",
          });
        }
      },
    );

    function formatTime(timeStr) {
      if (!timeStr) return "";
      const [hours, minutes] = timeStr.split(":"); // ignore seconds
      let h = parseInt(hours, 10);
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12; // convert 0 -> 12
      return `${h}:${minutes} ${ampm}`;
    }

    socket.on("send_schedule_emails", async (data) => {
      try {
        const {
          schedule_id,
          user_person_id,
          subject,
          message,
          audit_actor_id,
          audit_actor_role,
        } = data;

        /* ================================
           1  Get Actor Info
        ================================= */
        const [actorRows] = await db3.query(
          `SELECT email, role, employee_id, last_name, first_name, middle_name
       FROM user_accounts
       WHERE person_id = ? LIMIT 1`,
          [user_person_id],
        );

        let actorEmail = "earistmis@gmail.com";
        let actorName = "SYSTEM";

        if (actorRows.length > 0) {
          const u = actorRows[0];
          actorEmail = u.email || actorEmail;

          actorName =
            `${(u.role || "").toUpperCase()} (${u.employee_id || ""}) -
      ${u.last_name || ""}, ${u.first_name || ""} ${u.middle_name || ""}`.trim();
        }

        /* ================================
           2  Office Name
        ================================= */
        const [[office]] = await db.query(
          "SELECT short_term FROM company_settings WHERE id = 1",
        );

        const shortTerm = office?.short_term || "EARIST";
        const officeName = `${shortTerm} - Admission Office`;

        /* ================================
           3  Get Applicants
            FIXED JOIN HERE
        ================================= */
        const [rows] = await db.query(
          `
        SELECT
          ea.schedule_id,

          s.day_description AS day,
          s.room_description AS room,
          s.start_time,
          s.end_time,

          an.applicant_number,

          p.person_id,
          p.first_name,
          p.last_name,
          p.emailAddress

        FROM exam_applicants ea

        JOIN entrance_exam_schedule s
          ON ea.schedule_id = s.schedule_id

        JOIN applicant_numbering_table an
          ON ea.applicant_id = an.applicant_number   --  CORRECT

        JOIN person_table p
          ON an.person_id = p.person_id

        WHERE ea.schedule_id = ?
        AND (ea.email_sent IS NULL OR ea.email_sent = 0)
        `,
          [schedule_id],
        );

        if (rows.length === 0) {
          return socket.emit("send_schedule_emails_result", {
            success: false,
            error: "No applicants found for this schedule.",
          });
        }

        /* ================================
           4  Helpers
        ================================= */
        const sent = [];
        const failed = [];
        const skipped = [];

        const formatTime = (timeStr) => {
          if (!timeStr) return "";
          const [h, m] = timeStr.split(":");
          let hour = parseInt(h);
          const ampm = hour >= 12 ? "PM" : "AM";
          hour = hour % 12 || 12;
          return `${hour}:${m} ${ampm}`;
        };

        const applyTemplate = (template, row) => {
          return template
            .replace(/{first_name}/g, row.first_name || "")
            .replace(/{last_name}/g, row.last_name || "")
            .replace(/{applicant_number}/g, row.applicant_number || "")
            .replace(/{day}/g, row.day || "")
            .replace(/{room}/g, row.room || "")
            .replace(/{start_time}/g, formatTime(row.start_time))
            .replace(/{end_time}/g, formatTime(row.end_time))
            .replace(/{office}/g, officeName);
        };

        /* ================================
           5  Send Email
        ================================= */
        const sendEmail = async (row) => {
          if (!row.emailAddress) {
            skipped.push(row.applicant_number);
            return;
          }

          const finalMessage = applyTemplate(message, row);

          const mailOptions = {
            from: `"${officeName}" <${process.env.EMAIL_USER}>`,
            to: row.emailAddress,
            subject: subject || "Entrance Exam Schedule",
            text: finalMessage,
          };

          try {
            await transporter.sendMail(mailOptions);

            await db.query(
              `UPDATE exam_applicants
           SET email_sent = 1
           WHERE applicant_id = ?
           AND schedule_id = ?`,
              [row.applicant_number, row.schedule_id],
            );

            await db.query(
              `UPDATE person_status_table
           SET exam_status = 1
           WHERE person_id = ?`,
              [row.person_id],
            );

            sent.push(row.applicant_number);
          } catch (err) {
            console.error(" Email failed:", err.message);
            failed.push(row.applicant_number);
          }
        };

        /* ================================
           6  Batch Sending
        ================================= */
        const batchSize = 5;
        const delayMs = 1000;

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          await Promise.all(batch.map(sendEmail));

          if (i + batchSize < rows.length) {
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }

        const safeActor =
          audit_actor_id ||
          actorRows?.[0]?.employee_id ||
          user_person_id ||
          "unknown";
        const roleLabel = formatAuditActorRole(
          audit_actor_role || actorRows?.[0]?.role,
        );
        const scheduleLabel = await getEntranceExamScheduleLabel(schedule_id);
        const sentList = sent.length > 0 ? sent.join(", ") : "None";
        const failedNote =
          failed.length > 0
            ? ` Failed applicant(s): ${failed.join(", ")}.`
            : "";
        const skippedNote =
          skipped.length > 0
            ? ` Skipped applicant(s): ${skipped.join(", ")}.`
            : "";

        await insertAuditLogAdmission({
          actorId: safeActor,
          role: audit_actor_role || actorRows?.[0]?.role || "registrar",
          action: "ENTRANCE_EXAM_SCHEDULE_EMAIL",
          severity: sent.length > 0 ? "INFO" : "WARNING",
          message: `${roleLabel} (${safeActor}) sent entrance examination schedule email to ${sent.length} applicant(s) for ${scheduleLabel}. Applicant(s): ${sentList}.${failedNote}${skippedNote}`,
        });

        /* ================================
           7  Result
        ================================= */
        socket.emit("send_schedule_emails_result", {
          success: true,
          sent,
          failed,
          skipped,
          message: `Sent=${sent.length}, Failed=${failed.length}, Skipped=${skipped.length}`,
        });

        io.emit("schedule_updated", { schedule_id });
      } catch (err) {
        console.error("send_schedule_emails ERROR:", err);

        socket.emit("send_schedule_emails_result", {
          success: false,
          error: "Server error sending emails.",
        });
      }
    });
  });

  // Get current number of applicants assigned to a schedule
  app.get("/api/exam-schedule-count/:schedule_id", async (req, res) => {
    const { schedule_id } = req.params;
    try {
      const [rows] = await db.query(
        `SELECT COUNT(*) AS count
       FROM exam_applicants
       WHERE schedule_id = ?`,
        [schedule_id],
      );
      res.json({ count: rows[0].count });
    } catch (err) {
      console.error("Error fetching schedule count:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  //READ ENROLLED USERS (UPDATED!)
  app.get("/api/enrolled_users", async (req, res) => {
    try {
      const query = "SELECT * FROM user_accounts";

      const [result] = await db3.query(query);
      res.status(200).send(result);
    } catch (error) {
      res.status(500).send({ message: "Error Fetching data from the server" });
    }
  });

  // ------------------------- DEPARTMENT PANEL -------------------------------- //

  // -------------------------------- CURRICULUM PANEL ------------------------------------ //

  app.put("/api/update_program_units/:id", async (req, res) => {
    const { id } = req.params;
    const { lec_unit, lab_unit, course_unit } = req.body;

    try {
      const [result] = await db3.query(
        `UPDATE program_tagging_table SET
        lec_unit = ?,
        lab_unit = ?,
        course_unit = ?
       WHERE program_tagging_id = ?`,
        [lec_unit, lab_unit, course_unit, id],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Tagging not found" });
      }

      res.json({ message: "Program units updated" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Update failed" });
    }
  });

  app.get("/api/get_courses_by_curriculum/:curriculum_id", async (req, res) => {
    const { curriculum_id } = req.params;

    const query = `
    SELECT c.*
    FROM program_tagging_table pt
    INNER JOIN course_table c ON pt.course_id = c.course_id
    WHERE pt.curriculum_id = ?
  `;

    try {
      const [result] = await db3.query(query, [curriculum_id]);
      res.status(200).json(result);
    } catch (err) {
      console.error("Database error:", err);
      res.status(500).json({
        error: "Failed to retrieve courses",
        details: err.message,
      });
    }
  });

  // COURSE TAGGING LIST (UPDATED!)
  app.get("/api/get_course", async (req, res) => {
    const getCourseQuery = `
    SELECT
      yl.*, st.*, c.*
    FROM program_tagging_table pt
    INNER JOIN year_level_table yl ON pt.year_level_id = yl.year_level_id
    INNER JOIN semester_table st ON pt.semester_id = st.semester_id
    INNER JOIN course_table c ON pt.course_id = c.course_id
  `;

    try {
      const [results] = await db3.query(getCourseQuery);
      res.status(200).json(results);
    } catch (err) {
      console.error("Database error:", err);
      res.status(500).json({
        error: "Failed to retrieve course tagging list",
        details: err.message,
      });
    }
  });

  // YEAR LEVEL PANEL (UPDATED!)
  app.post("/api/years_level", async (req, res) => {
    const { year_level_description, level_type } = req.body;

    if (!year_level_description) {
      return res
        .status(400)
        .json({ error: "year_level_description is required" });
    }

    const query =
      "INSERT INTO year_level_table (year_level_description, level_type) VALUES (?, ?)";

    try {
      const [result] = await db3.query(query, [
        year_level_description,
        level_type || "year", // fallback
      ]);

      res.status(201).json({
        year_level_id: result.insertId,
        year_level_description,
        level_type,
      });
    } catch (err) {
      console.error("Insert error:", err);
      res.status(500).json({ error: "Insert failed", details: err.message });
    }
  });

  // ROOM LIST (UPDATED!)
  app.get("/api/get_room", async (req, res) => {
    const { department_id } = req.query;

    if (!department_id) {
      return res.status(400).json({ error: "Department ID is required" });
    }

    const getRoomQuery = `
      SELECT r.room_id, r.room_description, d.dprtmnt_name
      FROM room_table r
      INNER JOIN dprtmnt_room_table drt ON r.room_id = drt.room_id
      INNER JOIN dprtmnt_table d ON drt.dprtmnt_id = d.dprtmnt_id
      WHERE drt.dprtmnt_id = ?
  `;

    try {
      const [result] = await db3.query(getRoomQuery, [department_id]);
      res.status(200).json(result);
    } catch (err) {
      console.error("Error fetching rooms:", err);
      res
        .status(500)
        .json({ error: "Failed to fetch rooms", details: err.message });
    }
  });

  // GET ENROLLED STUDENTS (UPDATED!)
  app.get(
    "/get_enrolled_students/:subject_id/:department_section_id/:active_school_year_id",
    async (req, res) => {
      const { subject_id, department_section_id, active_school_year_id } =
        req.params;

      // Validate the inputs
      if (!subject_id || !department_section_id || !active_school_year_id) {
        return res.status(400).json({
          message:
            "Subject ID, Department Section ID, and Active School Year ID are required.",
        });
      }

      const filterStudents = `
  SELECT
    person_table.*,
    enrolled_subject.*,
    time_table.*,
    section_table.description AS section_description,
    program_table.program_description,
    program_table.program_code,
    year_level_table.year_level_description,
    semester_table.semester_description,
    course_table.course_code,
    course_table.course_description,
    room_day_table.description AS day_description,
    room_table.room_description
  FROM time_table
  INNER JOIN enrolled_subject
    ON time_table.course_id = enrolled_subject.course_id
    AND time_table.department_section_id = enrolled_subject.department_section_id
    AND time_table.school_year_id = enrolled_subject.active_school_year_id
  INNER JOIN student_numbering_table
    ON enrolled_subject.student_number = student_numbering_table.student_number
  INNER JOIN person_table
    ON student_numbering_table.person_id = person_table.person_id
  INNER JOIN dprtmnt_section_table
    ON time_table.department_section_id = dprtmnt_section_table.id
  INNER JOIN section_table
    ON dprtmnt_section_table.section_id = section_table.id
  INNER JOIN curriculum_table
    ON dprtmnt_section_table.curriculum_id = curriculum_table.curriculum_id
  INNER JOIN program_table
    ON curriculum_table.program_id = program_table.program_id
  INNER JOIN program_tagging_table
    ON program_tagging_table.course_id = time_table.course_id
    AND program_tagging_table.curriculum_id = dprtmnt_section_table.curriculum_id
  INNER JOIN year_level_table
    ON program_tagging_table.year_level_id = year_level_table.year_level_id
  INNER JOIN semester_table
    ON program_tagging_table.semester_id = semester_table.semester_id
  INNER JOIN course_table
    ON program_tagging_table.course_id = course_table.course_id
  INNER JOIN active_school_year_table
    ON time_table.school_year_id = active_school_year_table.id
  INNER JOIN room_day_table
    ON time_table.room_day = room_day_table.id
  INNER JOIN dprtmnt_room_table
    ON time_table.department_room_id = dprtmnt_room_table.dprtmnt_room_id
  INNER JOIN room_table
    ON dprtmnt_room_table.room_id = room_table.room_id
  WHERE time_table.course_id = ?
    AND time_table.department_section_id = ?
    AND time_table.school_year_id = ?
    AND active_school_year_table.astatus = 1;

`;

      try {
        // Execute the query using promise-based `execute` method
        const [result] = await db3.execute(filterStudents, [
          subject_id,
          department_section_id,
          active_school_year_id,
        ]);

        // Check if no students were found
        if (result.length === 0) {
          return res.status(404).json({
            message: "No students found for this subject-section combination.",
          });
        }

        // Send the response with the result
        res.json({
          totalStudents: result.length,
          students: result,
        });
      } catch (err) {
        console.error("Query failed:", err);
        return res
          .status(500)
          .json({ message: "Server error while fetching students." });
      }
    },
  );

  app.get(
    "/get_subject_info/:subject_id/:department_section_id/:active_school_year_id",
    async (req, res) => {
      const { subject_id, department_section_id, active_school_year_id } =
        req.params;

      if (!subject_id || !department_section_id || !active_school_year_id) {
        return res.status(400).json({
          message:
            "Subject ID, Department Section ID, and School Year ID are required.",
        });
      }

      const sectionInfoQuery = `
  SELECT
    section_table.description AS section_description,
    course_table.course_code,
    course_table.course_description,
    year_level_table.year_level_description AS year_level_description,
    year_level_table.year_level_id,
    semester_table.semester_description,
    room_table.room_description,
    time_table.school_time_start,
    time_table.school_time_end,
    program_table.program_code,
    program_table.program_description,
    room_day_table.description AS day_description
  FROM time_table
  INNER JOIN dprtmnt_section_table
    ON time_table.department_section_id = dprtmnt_section_table.id
  INNER JOIN section_table
    ON dprtmnt_section_table.section_id = section_table.id
  LEFT JOIN curriculum_table
    ON dprtmnt_section_table.curriculum_id = curriculum_table.curriculum_id
  LEFT JOIN program_table
    ON curriculum_table.program_id = program_table.program_id
  INNER JOIN course_table
    ON time_table.course_id = course_table.course_id
  LEFT JOIN program_tagging_table
    ON program_tagging_table.course_id = time_table.course_id
  LEFT JOIN year_level_table
    ON program_tagging_table.year_level_id = year_level_table.year_level_id
  LEFT JOIN semester_table
    ON program_tagging_table.semester_id = semester_table.semester_id
  LEFT JOIN room_day_table
    ON time_table.room_day = room_day_table.id
  LEFT JOIN dprtmnt_room_table
    ON time_table.department_room_id = dprtmnt_room_table.dprtmnt_room_id
  LEFT JOIN room_table
    ON dprtmnt_room_table.room_id = room_table.room_id
  WHERE time_table.course_id = ?
    AND time_table.department_section_id = ?
    AND time_table.school_year_id = ?
  LIMIT 1;
`;

      try {
        const [result] = await db3.execute(sectionInfoQuery, [
          subject_id,
          department_section_id,
          active_school_year_id,
        ]);

        if (result.length === 0) {
          return res
            .status(404)
            .json({
              message: "No section information found for this mapping.",
            });
        }

        res.json({ sectionInfo: result[0] });
      } catch (err) {
        console.error("Section info query error:", err);
        res
          .status(500)
          .json({ message: "Server error while fetching section info." });
      }
    },
  );

  app.get(
    "/get_class_details/:selectedActiveSchoolYear/:profID",
    async (req, res) => {
      const { selectedActiveSchoolYear, profID } = req.params;
      try {
        const query = `
    SELECT
        cst.course_id,
        cst.course_unit,
        cst.lab_unit,
        cst.course_description,
        cst.course_code,
        pt.program_code,
        st.description AS section_description,
        rt.room_description,
        tt.school_time_start,
        tt.school_time_end,
        rdt.description AS day,
        tt.department_section_id,
        tt.school_year_id,
        yr.year_description AS current_year,
        yr.year_description + 1 AS next_year,
        smt.semester_description,
        COUNT(DISTINCT es.student_number) AS enrolled_students
      FROM time_table AS tt
        INNER JOIN course_table AS cst ON tt.course_id = cst.course_id
        INNER JOIN dprtmnt_section_table AS dst ON tt.department_section_id = dst.id
        INNER JOIN curriculum_table AS ct ON dst.curriculum_id = ct.curriculum_id
        INNER JOIN section_table AS st ON dst.section_id = st.id
        INNER JOIN program_table AS pt ON ct.program_id = pt.program_id
        INNER JOIN dprtmnt_room_table AS drt ON drt.dprtmnt_room_id = tt.department_room_id
        INNER JOIN room_table AS rt ON drt.room_id = rt.room_id
        INNER JOIN room_day_table AS rdt ON tt.room_day = rdt.id
        LEFT JOIN enrolled_subject AS es ON es.course_id = tt.course_id
          AND es.active_school_year_id = tt.school_year_id
          AND es.department_section_id = tt.department_section_id
        WHERE tt.school_year_id = ? AND tt.professor_id = ?
      GROUP BY cst.course_id, cst.course_description, cst.course_code, pt.program_code, st.description;
    `;
        const [result] = await db3.query(query, [
          selectedActiveSchoolYear,
          profID,
        ]);
        res.json(result);
      } catch (err) {
        console.error("Server Error: ", err);
        res.status(500).send({ message: "Internal Error", err });
      }
    },
  );

  app.get(
    "/get_student_list/:course_id/:department_section_id/:school_year_id",
    async (req, res) => {
      const { course_id, department_section_id, school_year_id } = req.params;
      try {
        const query = `
    SELECT es.id as enrolled_id,snt.student_number,pst.first_name, pst.middle_name, pst.last_name, pt.program_code, st.description AS section_description, ct.course_description, ct.course_code FROM enrolled_subject AS es
      INNER JOIN student_numbering_table AS snt ON es.student_number = snt.student_number
      INNER JOIN person_table AS pst ON snt.person_id = pst.person_id
      INNER JOIN dprtmnt_section_table AS dst ON es.department_section_id = dst.id
      INNER JOIN section_table AS st ON dst.section_id = st.id
      INNER JOIN curriculum_table AS cct ON dst.curriculum_id = cct.curriculum_id
      INNER JOIN program_table AS pt ON cct.program_id = pt.program_id
      INNER JOIN course_table AS ct ON es.course_id = ct.course_id
      INNER JOIN active_school_year_table AS sy ON es.active_school_year_id = sy.id
    WHERE es.course_id = ? AND es.department_section_id = ? AND es.active_school_year_id = ?
    `;
        const [result] = await db3.query(query, [
          course_id,
          department_section_id,
          school_year_id,
        ]);
        res.json(result);
      } catch (err) {
        console.error("Server Error: ", err);
        res.status(500).send({ message: "Internal Error", err });
      }
    },
  );

  // PROFESSOR LIST (UPDATED!)
  app.get("/api/get_prof", async (req, res) => {
    const { department_id } = req.query;

    // Validate the input
    if (!department_id) {
      return res.status(400).json({ message: "Department ID is required." });
    }

    const getProfQuery = `
  SELECT p.*, d.dprtmnt_name
  FROM prof_table p
  INNER JOIN dprtmnt_profs_table dpt ON p.prof_id = dpt.prof_id
  INNER JOIN dprtmnt_table d ON dpt.dprtmnt_id = d.dprtmnt_id
  WHERE dpt.dprtmnt_id = ?
  `;

    try {
      // Execute the query using promise-based `execute` method
      const [result] = await db3.execute(getProfQuery, [department_id]);

      // Send the response with the result
      res.status(200).json(result);
    } catch (err) {
      console.error("Error fetching professors:", err);
      return res
        .status(500)
        .json({ message: "Server error while fetching professors." });
    }
  });

  // prof filter
  app.get("/api/prof_list/:dprtmnt_id", async (req, res) => {
    const { dprtmnt_id } = req.params;

    try {
      const query = `SELECT pt.* FROM dprtmnt_profs_table as dpt
                  INNER JOIN prof_table as pt
                  ON dpt.prof_id = pt.prof_id
                  INNER JOIN dprtmnt_table as dt
                  ON dt.dprtmnt_id = dpt.dprtmnt_id
                  WHERE dpt.dprtmnt_id = ? `;
      const [results] = await db3.query(query, [dprtmnt_id]);
      res.status(200).send(results);
    } catch (error) {
      console.error(error);
      res.status(500).send(error);
    }
  });

  app.get("/api/room_list/:dprtmnt_id", async (req, res) => {
    const { dprtmnt_id } = req.params;

    try {
      const query = `SELECT rt.* FROM dprtmnt_room_table as drt
                  INNER JOIN room_table as rt
                  ON drt.room_id = rt.room_id
                  INNER JOIN dprtmnt_table as dt
                  ON dt.dprtmnt_id = drt.dprtmnt_id
                  WHERE drt.dprtmnt_id = ? `;
      const [results] = await db3.query(query, [dprtmnt_id]);
      res.status(200).send(results);
    } catch (error) {
      console.error(error);
      res.status(500).send(error);
    }
  });

  app.get("/api/schedule-plotting/day_list", async (req, res) => {
    try {
      const query =
        "SELECT rdt.id AS day_id, rdt.description AS day_description FROM room_day_table AS rdt";
      const [result] = await db3.query(query);
      res.status(200).send(result);
    } catch (error) {
      console.error(error);
      res.status(500).send(error);
    }
  });

  app.delete("/api/delete/schedule/:id", async (req, res) => {
    const { id } = req.params;

    try {
      const deleteQuery = `DELETE FROM time_table WHERE id = ?`;
      const [result] = await db3.execute(deleteQuery, [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Schedule not found." });
      }

      res.json({ message: "Schedule deleted successfully." });
    } catch (error) {
      console.error("Error deleting schedule:", error);
      res
        .status(500)
        .json({ error: "Database error while deleting schedule." });
    }
  });

  //SCHEDULE CHECKER
  app.post("/api/check-subject", async (req, res) => {
    const { section_id, school_year_id, subject_id, day_of_week } = req.body;

    if (!school_year_id || !subject_id || !day_of_week) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const query = `
    SELECT * FROM time_table
    WHERE department_section_id = ?
      AND school_year_id = ?
      AND course_id = ?
      AND room_day = ?
  `;

    try {
      const [result] = await db3.query(query, [
        section_id,
        school_year_id,
        subject_id,
        day_of_week,
      ]);

      if (result.length > 0) {
        return res.json({ exists: true });
      } else {
        return res.json({ exists: false });
      }
    } catch (error) {
      console.error("Database query error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  //HELPER FUNCTION
  function timeToMinutes(timeStr) {
    const parts = timeStr.trim().split(" ");
    let [hours, minutes] = parts[0].split(":").map(Number);
    const modifier = parts[1] ? parts[1].toUpperCase() : null;

    if (modifier) {
      if (modifier === "PM" && hours !== 12) hours += 12;
      if (modifier === "AM" && hours === 12) hours = 0;
    }

    return hours * 60 + minutes;
  }

  //CHECK CONFLICT
  app.post("/api/check-conflict", async (req, res) => {
    const {
      day,
      start_time,
      end_time,
      section_id,
      school_year_id,
      prof_id,
      room_id,
      subject_id,
    } = req.body;

    try {
      const start_time_m = timeToMinutes(start_time);
      const end_time_m = timeToMinutes(end_time);

      const countQuery = `
      SELECT COUNT(*) AS subject_count
      FROM time_table
      WHERE department_section_id = ?
        AND school_year_id = ?
        AND professor_id = ?
        AND department_room_id = ?
        AND course_id = ?
    `;
      const [countResult] = await db3.query(countQuery, [
        section_id,
        school_year_id,
        prof_id,
        room_id,
        subject_id,
      ]);

      if (countResult[0].subject_count >= 2) {
        return res.status(409).json({
          conflict: true,
          message:
            "This subject is already assigned twice for the same section, room, school year, and professor.",
        });
      }

      const query = `
      SELECT * FROM time_table
      WHERE department_section_id = ?
        AND school_year_id = ?
        AND course_id = ?
        AND room_day = ?
    `;

      const [subjectResult] = await db3.query(query, [
        section_id,
        school_year_id,
        subject_id,
        day,
      ]);

      if (subjectResult.length > 0) {
        return res.status(409).json({
          conflict: true,
          message:
            "This subject is already assigned in this section and school year on the same day.",
        });
      }

      // Check for time conflicts (prof, section, room)
      const checkTimeQuery = `
      SELECT * FROM time_table
      WHERE room_day = ?
        AND school_year_id = ?
        AND (professor_id = ? OR department_section_id = ? OR department_room_id = ?)
        AND (
          (? > TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60
          AND ? < TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60)
          OR
          (? > TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60
          AND ? < TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60)
          OR
          (TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60 > ?
          AND TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60 < ?)
          OR
          (TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60 > ?
          AND TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60 < ?)
          OR
          (TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60 = ?
          AND TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60 = ?)
        )
    `;

      const [timeResult] = await db3.query(checkTimeQuery, [
        day,
        school_year_id,
        prof_id,
        section_id,
        room_id,
        start_time_m,
        start_time_m,
        end_time_m,
        end_time_m,
        start_time_m,
        end_time_m,
        start_time_m,
        end_time_m,
        start_time_m,
        end_time_m,
      ]);

      if (timeResult.length > 0) {
        return res.status(409).json({
          conflict: true,
          message:
            "Schedule conflict detected! Please choose a different time.",
        });
      }

      return res
        .status(200)
        .json({ conflict: false, message: "Schedule is available." });
    } catch (error) {
      console.error("Database query error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/check-professor-substitution", async (req, res) => {
    const {
      day,
      start_time,
      end_time,
      school_year_id,
      prof_id,
      exclude_schedule_id,
    } = req.body;

    if (!day || !start_time || !end_time || !school_year_id || !prof_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const start_time_m = timeToMinutes(start_time);
      const end_time_m = timeToMinutes(end_time);

      const checkTimeQuery = `
      SELECT * FROM time_table
      WHERE room_day = ?
        AND school_year_id = ?
        AND professor_id = ?
        AND id != ?
        AND (
          (? > TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60
          AND ? < TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60)
          OR
          (? > TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60
          AND ? < TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60)
          OR
          (TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60 > ?
          AND TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60 < ?)
          OR
          (TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60 > ?
          AND TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60 < ?)
          OR
          (TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60 = ?
          AND TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60 = ?)
        )
    `;

      const [timeResult] = await db3.query(checkTimeQuery, [
        day,
        school_year_id,
        prof_id,
        exclude_schedule_id || 0,
        start_time_m,
        start_time_m,
        end_time_m,
        end_time_m,
        start_time_m,
        end_time_m,
        start_time_m,
        end_time_m,
        start_time_m,
        end_time_m,
      ]);

      if (timeResult.length > 0) {
        return res.status(409).json({
          conflict: true,
          message:
            "Schedule conflict detected! The substitute professor is already booked at this time.",
        });
      }

      return res.status(200).json({
        conflict: false,
        message: "Substitute professor is available at this time.",
      });
    } catch (error) {
      console.error("Professor substitution check error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/update-schedule/:id", async (req, res) => {
    const { id } = req.params;
    const {
      update_mode,
      prof_id,
      ishonorarium,
      is_servicecredit,
      is_temporary_substitution,
    } = req.body;

    try {
      const [existingRows] = await db3.query(
        `SELECT * FROM time_table WHERE id = ?`,
        [id]
      );

      if (!existingRows.length) {
        return res.status(404).json({ error: "Schedule not found." });
      }

      const existing = existingRows[0];

      if (update_mode === "substitution") {
        if (!prof_id) {
          return res.status(400).json({ error: "Professor is required for substitution." });
        }

        if (String(prof_id) === String(existing.professor_id)) {
          return res.status(409).json({
            conflict: true,
            message: "Select a different professor for substitution.",
          });
        }

        const startMinutes = timeToMinutes(existing.school_time_start);
        const endMinutes = timeToMinutes(existing.school_time_end);

        const checkTimeQuery = `
        SELECT * FROM time_table
        WHERE room_day = ?
          AND school_year_id = ?
          AND professor_id = ?
          AND id != ?
          AND (
            (? > TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60
            AND ? < TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60)
            OR
            (? > TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60
            AND ? < TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60)
            OR
            (TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60 > ?
            AND TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60 < ?)
            OR
            (TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60 > ?
            AND TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60 < ?)
            OR
            (TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60 = ?
            AND TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60 = ?)
          )
      `;

        const [timeResult] = await db3.query(checkTimeQuery, [
          existing.room_day,
          existing.school_year_id,
          prof_id,
          id,
          startMinutes,
          startMinutes,
          endMinutes,
          endMinutes,
          startMinutes,
          endMinutes,
          startMinutes,
          endMinutes,
          startMinutes,
          endMinutes,
        ]);

        if (timeResult.length > 0) {
          return res.status(409).json({
            conflict: true,
            message:
              "Schedule conflict detected! The substitute professor is already booked at this time.",
          });
        }

        await db3.query(
          `UPDATE time_table
           SET professor_id = ?, ishonorarium = 0, is_servicecredit = 0, is_temporary_substitution = 1
           WHERE id = ?`,
          [prof_id, id]
        );
      } else if (update_mode === "load_type") {
        const hon = Number(ishonorarium) === 1 ? 1 : 0;
        const sc = Number(is_servicecredit) === 1 ? 1 : 0;
        const ts = Number(is_temporary_substitution) === 1 ? 1 : 0;
        const activeCount = [hon, sc, ts].filter((flag) => flag === 1).length;

        if (activeCount > 1) {
          return res.status(400).json({
            error: "Only one load type can be active at a time.",
          });
        }

        if (activeCount === 0) {
          return res.status(400).json({
            error: "Select honorarium or service credit to update load type.",
          });
        }

        await db3.query(
          `UPDATE time_table
           SET ishonorarium = ?, is_servicecredit = ?, is_temporary_substitution = ?
           WHERE id = ?`,
          [hon, sc, ts, id]
        );
      } else {
        return res.status(400).json({ error: "Invalid update mode." });
      }

      res.status(200).json({ message: "Schedule updated successfully." });
    } catch (error) {
      console.error("Error updating schedule:", error);
      res.status(500).json({ error: "Failed to update schedule." });
    }
  });

  //  Check conflict API
  app.post("/api/check-time", async (req, res) => {
    const { start_time, end_time } = req.body;

    try {
      let startMinutes = timeToMinutes(start_time);
      let endMinutes = timeToMinutes(end_time);
      const earliest = timeToMinutes("7:00 AM");
      const latest = timeToMinutes("9:00 PM");

      if (endMinutes <= startMinutes) {
        return res.status(409).json({
          conflict: true,
          message: "End time must be later than start time (same day only).",
        });
      }

      //  Check validity
      if (startMinutes < earliest || endMinutes > latest) {
        return res.status(409).json({
          conflict: true,
          message: "Time must be between 7:00 AM and 9:00 PM (same day).",
        });
      }

      return res.status(200).json({
        conflict: false,
        message: "Valid schedule time",
      });
    } catch (err) {
      console.error("Error checking conflict:", err);
      return res
        .status(500)
        .json({ error: "Server error while checking conflict" });
    }
  });

  //  Insert schedule API
  app.post("/api/insert-schedule", async (req, res) => {
    const {
      day,
      start_time,
      end_time,
      section_id,
      subject_id,
      prof_id,
      room_id,
      school_year_id,
      ishonorarium,
      is_servicecredit,
      is_temporary_substitution,
    } = req.body;

    if (
      !day ||
      !start_time ||
      !end_time ||
      !school_year_id ||
      !prof_id ||
      !room_id ||
      !subject_id
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let startMinutes = timeToMinutes(start_time);
    let endMinutes = timeToMinutes(end_time);
    const earliest = timeToMinutes("7:00 AM");
    const latest = timeToMinutes("9:00 PM");

    // Validate times
    if (endMinutes <= startMinutes) {
      return res.status(409).json({
        conflict: true,
        message: "End time must be later than start time (same day only).",
      });
    }

    if (startMinutes < earliest || endMinutes > latest) {
      return res.status(409).json({
        conflict: true,
        message: "Time must be between 7:00 AM and 9:00 PM (same day).",
      });
    }

    try {
      const query = `
      SELECT * FROM time_table
      WHERE department_section_id = ?
        AND school_year_id = ?
        AND course_id = ?
        AND room_day = ?
    `;

      const [subjectResult] = await db3.query(query, [
        section_id,
        school_year_id,
        subject_id,
        day,
      ]);

      if (subjectResult.length > 0) {
        return res.status(409).json({
          conflict: true,
          message:
            "This subject is already assigned in this section and school year on the same day.",
        });
      }

      // Check for time conflicts (prof, section, room)
      const checkTimeQuery = `
      SELECT * FROM time_table
      WHERE room_day = ?
        AND school_year_id = ?
        AND (professor_id = ? OR department_section_id = ? OR department_room_id = ?)
        AND (
          (? > TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60
          AND ? < TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60)
          OR
          (? > TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60
          AND ? < TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60)
          OR
          (TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60 > ?
          AND TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60 < ?)
          OR
          (TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60 > ?
          AND TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60 < ?)
          OR
          (TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60 = ?
          AND TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60 = ?)
        )
    `;

      const [timeResult] = await db3.query(checkTimeQuery, [
        day,
        school_year_id,
        prof_id,
        section_id,
        room_id,
        startMinutes,
        startMinutes,
        endMinutes,
        endMinutes,
        startMinutes,
        endMinutes,
        startMinutes,
        endMinutes,
        startMinutes,
        endMinutes,
      ]);

      if (timeResult.length > 0) {
        return res.status(409).json({
          conflict: true,
          message:
            "Schedule conflict detected! Please choose a different time.",
        });
      }

      // Insert schedule
      const insertQuery = `
      INSERT INTO time_table
      (room_day, school_time_start, school_time_end, department_section_id, course_id, ishonorarium, is_servicecredit, is_temporary_substitution, professor_id, department_room_id, school_year_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
      await db3.query(insertQuery, [
        day,
        start_time,
        end_time,
        section_id,
        subject_id,
        Number(ishonorarium) === 1 ? 1 : 0,
        Number(is_servicecredit) === 1 ? 1 : 0,
        Number(is_temporary_substitution) === 1 ? 1 : 0,
        prof_id,
        room_id,
        school_year_id,
      ]);

      res.status(200).json({ message: "Schedule inserted successfully" });
    } catch (error) {
      console.error("Error inserting schedule:", error);
      res.status(500).json({ error: "Failed to insert schedule" });
    }
  });

  // GET STUDENTS THAT HAVE NO STUDENT NUMBER (UPDATED!)
  app.get("/api/persons", async (req, res) => {
    try {
      // STEP 1: Get all eligible persons (from ENROLLMENT DB)
      const [persons] = await db.execute(`
      SELECT p.*
      FROM admission.person_table p
      JOIN admission.person_status_table ps ON p.person_id = ps.person_id
      WHERE ps.student_registration_status = 0
      AND p.person_id NOT IN (SELECT person_id FROM enrollment.student_numbering_table)
    `);

      if (persons.length === 0) return res.json([]);

      const personIds = persons.map((p) => p.person_id);

      // STEP 2: Get all applicant numbers for those person_ids (from ADMISSION DB)
      const [applicantNumbers] = await db.query(
        `
      SELECT applicant_number, person_id
      FROM applicant_numbering_table
      WHERE person_id IN (?)
    `,
        [personIds],
      );

      // Create a quick lookup map
      const applicantMap = {};
      for (let row of applicantNumbers) {
        applicantMap[row.person_id] = row.applicant_number;
      }

      // STEP 3: Merge applicant_number into each person object
      const merged = persons.map((person) => ({
        ...person,
        applicant_number: applicantMap[person.person_id] || null,
      }));

      res.json(merged);
    } catch (err) {
      console.error(" Error merging person + applicant ID:", err);
      res.status(500).send("Server error");
    }
  });

  let lastSeenId = 0;

  // GET /proctor-applicants
  app.get("/api/proctor-applicants", async (req, res) => {
    const { query, schedule_id } = req.query;

    try {
      // Use db (admission) instead of db3 (enrollment)
      const [schedules] = await db.query(
        `SELECT * FROM entrance_exam_schedule
       WHERE proctor LIKE ? ${schedule_id ? "AND schedule_id = ?" : ""}`,
        schedule_id ? [`%${query}%`, schedule_id] : [`%${query}%`],
      );

      if (schedules.length === 0) return res.json([]);

      const results = await Promise.all(
        schedules.map(async (schedule) => {
          const [applicants] = await db.query(
            `SELECT ea.applicant_id, ea.schedule_id, ea.email_sent, ant.applicant_number,
                  pt.last_name, pt.first_name, pt.middle_name, pt.program,
                  s.building_description, s.room_description
           FROM exam_applicants ea
           JOIN applicant_numbering_table ant ON ant.applicant_number = ea.applicant_id
           JOIN person_table pt ON pt.person_id = ant.person_id
           JOIN entrance_exam_schedule s ON s.schedule_id = ea.schedule_id
           WHERE ea.schedule_id = ?
             AND COALESCE(ea.email_sent, 0) = 1`,
            [schedule.schedule_id],
          );

          return { schedule, applicants };
        }),
      );

      res.json(results);
    } catch (err) {
      console.error("Error fetching proctor applicants:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  //  Updates year_level_id for a student
  app.put("/api/update-student-year", async (req, res) => {
    const { student_number, year_level_id } = req.body;

    if (!student_number || !year_level_id) {
      return res
        .status(400)
        .json({ error: "Missing student_number or year_level_id" });
    }

    try {
      const sql = `UPDATE student_status_table SET year_level_id = ? WHERE student_number = ?`;
      const [result] = await db3.query(sql, [year_level_id, student_number]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Student not found" });
      }

      res.status(200).json({ message: "Year level updated successfully" });
    } catch (err) {
      console.error("Error updating year level:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // (UPDATED!)
  app.get("/api/check-new", async (req, res) => {
    try {
      const [results] = await db3.query(
        "SELECT * FROM enrolled_subject ORDER BY id DESC LIMIT 1",
      );

      if (results.length > 0) {
        const latest = results[0];
        const isNew = latest.id > lastSeenId;
        if (isNew) {
          lastSeenId = latest.id;
        }
        res.json({ newData: isNew, data: latest });
      } else {
        res.json({ newData: false });
      }
    } catch (err) {
      return res.status(500).json({ error: err });
    }
  });

  // (UPDATED!)

  app.get("/api/slot-monitoring-sections", async (req, res) => {
    const {
      departmentId,
      courseId,
      programId,
      curriculumId,
      yearLevelId,
      semesterId,
      campus,
      activeSchoolYearId,
    } = req.query;

    if (
      !departmentId ||
      !programId ||
      !curriculumId ||
      !yearLevelId ||
      !semesterId ||
      !campus ||
      !activeSchoolYearId
    ) {
      return res.status(400).json({
        error:
          "departmentId, programId, curriculumId, yearLevelId, semesterId, campus, and activeSchoolYearId are required",
      });
    }

    const params = [
      activeSchoolYearId,
      yearLevelId,
      semesterId,
      departmentId,
      programId,
      curriculumId,
      campus,
    ];
    const courseFilter = courseId ? "AND tt.course_id = ?" : "";
    if (courseId) params.push(courseId);

    const query = `
    SELECT
      dst.id AS department_section_id,
      ct.curriculum_id,
      pt.program_code,
      pt.program_description,
      st.description AS section_description,
      cst.course_id,
      cst.course_code,
      cst.course_description,
      GROUP_CONCAT(
        DISTINCT CONCAT(
          TIME_FORMAT(tt.school_time_start, '%h:%i %p'),
          ' - ',
          TIME_FORMAT(tt.school_time_end, '%h:%i %p')
        )
        ORDER BY tt.school_time_start
        SEPARATOR ', '
      ) AS schedule,
      dst.max_slots
    FROM dprtmnt_section_table dst
    INNER JOIN dprtmnt_curriculum_table dct ON dst.curriculum_id = dct.curriculum_id
    INNER JOIN section_table st ON dst.section_id = st.id
    INNER JOIN curriculum_table ct ON dct.curriculum_id = ct.curriculum_id
    INNER JOIN program_table pt ON ct.program_id = pt.program_id
    LEFT JOIN time_table tt
      ON dst.id = tt.department_section_id
      AND tt.school_year_id = ?
    LEFT JOIN program_tagging_table ptt
      ON ptt.curriculum_id = dst.curriculum_id
      AND ptt.course_id = tt.course_id
      AND ptt.year_level_id = ?
      AND ptt.semester_id = ?
    LEFT JOIN course_table cst
      ON cst.course_id = tt.course_id
      AND ptt.program_tagging_id IS NOT NULL
    WHERE dct.dprtmnt_id = ?
      AND pt.program_id = ?
      AND ct.curriculum_id = ?
      AND pt.components = ?
      ${courseFilter}
    GROUP BY dst.id, ct.curriculum_id, pt.program_code, pt.program_description, st.description, cst.course_id, cst.course_code, cst.course_description, dst.max_slots
    ORDER BY st.description ASC, cst.course_code ASC
  `;

    try {
      const [rows] = await db3.query(query, params);
      return res.status(200).json(rows);
    } catch (err) {
      console.error("Error fetching slot monitoring sections:", err);
      return res.status(500).json({
        error: "Database error",
        details: err.message,
      });
    }
  });

  app.post("/api/slot-monitoring-enrolled-count", async (req, res) => {
    const { curriculumId, sectionIds, activeSchoolYearId, courseId } = req.body;

    if (!curriculumId || !activeSchoolYearId) {
      return res.status(400).json({
        error: "curriculumId and activeSchoolYearId are required",
      });
    }

    if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
      return res.status(200).json([]);
    }

    const sectionPlaceholders = sectionIds.map(() => "?").join(", ");

    const courseFilter = courseId ? "AND es.course_id = ?" : "";
    const query = `
    SELECT
      es.department_section_id,
      es.course_id,
      COUNT(DISTINCT es.student_number) AS enrolled_student
    FROM enrolled_subject es
    INNER JOIN dprtmnt_section_table dst ON es.department_section_id = dst.id
    INNER JOIN active_school_year_table sy ON es.active_school_year_id = sy.id
    WHERE es.curriculum_id = ?
      AND es.department_section_id IN (${sectionPlaceholders})
      AND es.active_school_year_id = ?
      ${courseFilter}
    GROUP BY es.department_section_id, es.course_id
  `;

    try {
      const params = [curriculumId, ...sectionIds, activeSchoolYearId];
      if (courseId) params.push(courseId);
      const [rows] = await db3.query(query, params);
      return res.status(200).json(rows);
    } catch (err) {
      console.error("Error fetching slot monitoring enrolled counts:", err);
      return res.status(500).json({
        error: "Database error",
        details: err.message,
      });
    }
  });

  app.put(
    "/slot-monitoring-sections/:departmentSectionId/max-slots",
    async (req, res) => {
      const { departmentSectionId } = req.params;
      const { max_slots } = req.body;

      const parsedSlots = Number(max_slots);

      if (
        !departmentSectionId ||
        Number.isNaN(parsedSlots) ||
        parsedSlots < 0
      ) {
        return res.status(400).json({
          error:
            "departmentSectionId is required and max_slots must be a non-negative number",
        });
      }

      try {
        const [result] = await db3.query(
          "UPDATE dprtmnt_section_table SET max_slots = ? WHERE id = ?",
          [parsedSlots, departmentSectionId],
        );

        if (result.affectedRows === 0) {
          return res
            .status(404)
            .json({ error: "Department section not found" });
        }

        return res
          .status(200)
          .json({ message: "Max slots updated successfully" });
      } catch (err) {
        console.error("Error updating slot monitoring max slots:", err);
        return res.status(500).json({
          error: "Database error",
          details: err.message,
        });
      }
    },
  );

  // Express route (UPDATED!)

  ///////---------------------------- DUPLICATE ----------------------------//////////
  app.get("/api/departments", async (req, res) => {
    const {
      ensureDepartmentIsAllowedColumn,
    } = require("../routes/system_routes/dprmntRoute");

    try {
      await ensureDepartmentIsAllowedColumn();
      const [departments] = await db3.execute(`
      SELECT
        dt.dprtmnt_id,
        dt.dprtmnt_name,
        dt.dprtmnt_code,
        COALESCE(dt.is_allowed, 1) AS is_allowed
      FROM dprtmnt_table AS dt
    `);
      res.json(departments);
    } catch (err) {
      console.error("Error fetching departments:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Count how many students enrolled per subject for a selected section (UPDATED!)

  // Get user by person_id (UPDATED!)
  app.get("/api/user/:person_id", async (req, res) => {
    const { person_id } = req.params;

    try {
      const sql = "SELECT profile_img FROM person_table WHERE person_id = ?";
      const [results] = await db3.query(sql, [person_id]);

      if (results.length === 0) {
        return res.status(404).send("User not found");
      }

      res.json(results[0]);
    } catch (err) {
      console.error("Database error:", err);
      return res.status(500).send("Database error");
    }
  });

  // GET GRADING PERIOD (UPDATED!)
  app.get("/api/get-grading-period", async (req, res) => {
    try {
      const sql = "SELECT * FROM period_status";
      const [result] = await db3.query(sql);

      res.json(result);
    } catch (err) {
      console.error("Database error:", err);
      return res.status(500).send("Error fetching data");
    }
  });

  // ACTIVATOR API OF GRADING PERIOD (UPDATED!)
  app.post("/api/grade_period_activate/:id", async (req, res) => {
    const { id } = req.params;

    try {
      const sql1 = "UPDATE period_status SET status = 0";
      await db3.query(sql1);

      const sql2 = "UPDATE period_status SET status = 1 WHERE id = ?";
      await db3.query(sql2, [id]);

      res
        .status(200)
        .json({ message: "Grading period activated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to activate grading period" });
    }
  });

  app.get("/api/designation_list", async (req, res) => {
    const query = "SELECT * FROM course_table WHERE office_duty = 1;";

    try {
      const [result] = await db3.query(query);
      res.status(200).json(result);
    } catch (err) {
      console.error("Query error:", err);
      res.status(500).json({
        error: "Query failed",
        details: err.message,
      });
    }
  });

  // UPDATE()
  app.get(
    "/api/handle_section_of/:userID/:selectedCourse/:selectedActiveSchoolYear",
    async (req, res) => {
      const { userID, selectedCourse, selectedActiveSchoolYear } = req.params;

      try {
        const sql = `
    SELECT tt.department_section_id, ptbl.program_code, st.description AS section_description FROM time_table AS tt
      INNER JOIN prof_table AS pt ON tt.professor_id = pt.prof_id
      INNER JOIN dprtmnt_section_table AS dst ON tt.department_section_id = dst.id
      INNER JOIN curriculum_table AS ct ON dst.curriculum_id = ct.curriculum_id
      INNER JOIN section_table AS st ON dst.section_id = st.id
      INNER JOIN program_table AS ptbl ON ct.program_id = ptbl.program_id
      INNER JOIN active_school_year_table AS sy ON tt.school_year_id = sy.id
      INNER JOIN year_table AS yt ON sy.year_id = yt.year_id
    WHERE tt.professor_id = ? AND tt.course_id = ? AND sy.id = ? GROUP BY tt.department_section_id
    ORDER BY section_description
    `;
        const [result] = await db3.query(sql, [
          userID,
          selectedCourse,
          selectedActiveSchoolYear,
        ]);
        res.json(result);
      } catch (err) {
        console.error("Server Error: ", err);
        res.status(500).send({ message: "Internal Error", err });
      }
    },
  );

  // UPDATE ()
  app.get("/api/course_assigned_to/:userID", async (req, res) => {
    const { userID } = req.params;

    try {
      const sql = `
    SELECT DISTINCT tt.course_id, ct.course_description, ct.course_code, yt.year_id, st.semester_id FROM time_table AS tt
      INNER JOIN course_table AS ct ON tt.course_id = ct.course_id
      INNER JOIN prof_table AS pt ON tt.professor_id = pt.prof_id
      INNER JOIN active_school_year_table AS sy ON tt.school_year_id = sy.id
      INNER JOIN year_table AS yt ON sy.year_id = yt.year_id
      INNER JOIN semester_table AS st ON sy.semester_id = st.semester_id
    WHERE tt.professor_id = ? AND ct.office_duty = 0 AND sy.astatus = 1
    `;
      const [result] = await db3.query(sql, [userID]);
      res.json(result);
    } catch (err) {
      console.error("Server Error: ", err);
      res.status(500).send({ message: "Internal Error", err });
    }
  });

  // UPDATE ()
  app.get(
    "/course_assigned_to/:userID/:selectedSchoolYear/:selectedSchoolSemester",
    async (req, res) => {
      const { userID, selectedSchoolYear, selectedSchoolSemester } = req.params;

      try {
        const sql = `
    SELECT DISTINCT tt.course_id, ct.course_description, ct.course_code, yt.year_id, st.semester_id FROM time_table AS tt
      INNER JOIN course_table AS ct ON tt.course_id = ct.course_id
      INNER JOIN prof_table AS pt ON tt.professor_id = pt.prof_id
      INNER JOIN active_school_year_table AS sy ON tt.school_year_id = sy.id
      INNER JOIN year_table AS yt ON sy.year_id = yt.year_id
      INNER JOIN semester_table AS st ON sy.semester_id = st.semester_id
    WHERE tt.professor_id = ? AND ct.office_duty = 0 AND sy.year_id = ? AND sy.semester_id = ?
    `;
        const [result] = await db3.query(sql, [
          userID,
          selectedSchoolYear,
          selectedSchoolSemester,
        ]);
        res.json(result);
      } catch (err) {
        console.error("Server Error: ", err);
        res.status(500).send({ message: "Internal Error", err });
      }
    },
  );

  app.get(
    "/get_selecterd_year/:selectedSchoolYear/:selectedSchoolSemester",
    async (req, res) => {
      const { selectedSchoolYear, selectedSchoolSemester } = req.params;
      try {
        const query = `
    SELECT
    asyt.id AS school_year_id
  FROM active_school_year_table AS asyt
    INNER JOIN year_table AS yt ON asyt.year_id = yt.year_id
    INNER JOIN semester_table AS st ON asyt.semester_id = st.semester_id
  WHERE yt.year_id = ? AND st.semester_id = ?
    `;
        const [result] = await db3.query(query, [
          selectedSchoolYear,
          selectedSchoolSemester,
        ]);
        res.json(result);
      } catch (err) {
        console.error("Server Error: ", err);
        res.status(500).send({ message: "Internal Error", err });
      }
    },
  );

  app.get(
    "/api/enrolled_student_list/:userID/:selectedCourse/:department_section_id/:activeSchoolYear",
    async (req, res) => {
      const {
        userID,
        selectedCourse,
        department_section_id,
        activeSchoolYear,
      } = req.params;

      try {
        const [rows] = await db3.query(
          "SELECT status FROM period_status WHERE description = 'Final Grading Period'",
        );

        if (!rows.length || rows[0].status !== 1) {
          return res.status(403).json({ message: "Grades not available yet" });
        }

        const sql = `
      SELECT DISTINCT
        es.student_number,
        ptbl.last_name,
        ptbl.first_name,
        ptbl.middle_name,
        ylt.year_description,
        smt.semester_description,
        es.midterm,
        es.finals,
        es.final_grade,
        es.en_remarks,
        es.is_posted,
        st.description AS section_description,
        pgt.program_code,
        dst.id,
        smt.semester_id,
        es.active_school_year_id,
        ylt.year_id,
        ylt.year_description AS current_year,
        ylt.year_description + 1 AS next_year,
        cst.course_id,
        cst.course_description,
        cst.course_code,
        cst.course_unit,
        cst.lab_unit,
        dt.dprtmnt_name,
        yrlt.year_level_description
      FROM enrolled_subject AS es
        INNER JOIN student_numbering_table AS snt ON es.student_number = snt.student_number
        INNER JOIN person_table AS ptbl ON snt.person_id = ptbl.person_id
        INNER JOIN time_table AS tt
          ON es.department_section_id = tt.department_section_id
          AND es.course_id = tt.course_id
          AND es.active_school_year_id = tt.school_year_id
        INNER JOIN prof_table AS pt ON tt.professor_id = pt.prof_id
        INNER JOIN dprtmnt_section_table AS dst ON es.department_section_id = dst.id
        INNER JOIN section_table AS st ON dst.section_id = st.id
        INNER JOIN curriculum_table AS ct ON es.curriculum_id = ct.curriculum_id
        INNER JOIN program_table AS pgt ON ct.program_id = pgt.program_id
        INNER JOIN active_school_year_table AS sy ON es.active_school_year_id = sy.id
        INNER JOIN year_table AS ylt ON sy.year_id = ylt.year_id
        INNER JOIN semester_table AS smt ON sy.semester_id = smt.semester_id
        INNER JOIN course_table AS cst ON  es.course_id = cst.course_id
        LEFT JOIN program_tagging_table AS ptt
          ON es.curriculum_id = ptt.curriculum_id
          AND es.course_id = ptt.course_id
        LEFT JOIN year_level_table AS yrlt ON ptt.year_level_id = yrlt.year_level_id
        INNER JOIN dprtmnt_curriculum_table AS dct ON ct.curriculum_id = dct.curriculum_id
        INNER JOIN dprtmnt_table AS dt ON dct.dprtmnt_id = dt.dprtmnt_id
      WHERE tt.professor_id = ? AND es.course_id = ? AND es.department_section_id = ? AND es.active_school_year_id = ?
    `;

        const [result] = await db3.query(sql, [
          userID,
          selectedCourse,
          department_section_id,
          activeSchoolYear,
        ]);
        res.json(result);
      } catch (err) {
        console.error("Server Error: ", err);
        res.status(500).send({ message: "Internal Error", err });
      }
    },
  );

  app.get("/api/grading_sheet_bootstrap/:userID", async (req, res) => {
    const { userID } = req.params;
    const { course_id, department_section_id, active_school_year_id } =
      req.query;

    try {
      // Determine which grading period is currently active.
      // We only allow encoding/editing grades when an active period exists.
      const [[activePeriod]] = await db3.query(
        "SELECT id, description, status FROM period_status WHERE status = 1 LIMIT 1",
      );

      if (!activePeriod || activePeriod.status !== 1) {
        return res.status(403).json({ message: "Grades not available yet" });
      }

      const activeDesc = String(activePeriod.description || "").toLowerCase();

      let gradeEditMode = "BOTH";
      let midtermOpen = true;
      let finalsOpen = true;

      if (activeDesc.includes("midterm")) {
        gradeEditMode = "MIDTERM_ONLY";
        midtermOpen = true;
        finalsOpen = false;
      } else if (activeDesc.includes("final grading period")) {
        gradeEditMode = "BOTH";
        midtermOpen = true;
        finalsOpen = true;
      } else if (activeDesc.includes("finals")) {
        gradeEditMode = "FINALS_ONLY";
        midtermOpen = false;
        finalsOpen = true;
      } else if (activeDesc.includes("final")) {
        // Fallback if your DB uses a different description wording.
        gradeEditMode = "FINALS_ONLY";
        midtermOpen = false;
        finalsOpen = true;
      } else {
        return res.status(403).json({ message: "Grades not available yet" });
      }

      const [[activeYear]] = active_school_year_id
        ? await db3.query(
          `
            SELECT id AS school_year_id, year_id, semester_id
            FROM active_school_year_table
            WHERE id = ?
            LIMIT 1
            `,
          [active_school_year_id],
        )
        : await db3.query(
          `
            SELECT id AS school_year_id, year_id, semester_id
            FROM active_school_year_table
            WHERE astatus = 1
            LIMIT 1
            `,
        );

      if (!activeYear) {
        return res.json({
          activeSchoolYear: null,
          courses: [],
          sections: [],
          students: [],
        });
      }

      const [courses] = await db3.query(
        `
        SELECT DISTINCT
          tt.course_id,
          ct.course_description,
          ct.course_code,
          sy.year_id,
          sy.semester_id
        FROM time_table AS tt
          INNER JOIN course_table AS ct ON tt.course_id = ct.course_id
          INNER JOIN active_school_year_table AS sy ON tt.school_year_id = sy.id
        WHERE tt.professor_id = ?
          AND ct.office_duty = 0
          AND sy.id = ?
        ORDER BY ct.course_code ASC
        `,
        [userID, activeYear.school_year_id],
      );

      const courseExists = courses.some(
        (course) => String(course.course_id) === String(course_id),
      );
      const selectedCourseId = courseExists ? course_id : courses[0]?.course_id;

      const [sections] = selectedCourseId
        ? await db3.query(
          `
            SELECT DISTINCT
              tt.department_section_id,
              ptbl.program_code,
              st.description AS section_description
            FROM time_table AS tt
              INNER JOIN dprtmnt_section_table AS dst ON tt.department_section_id = dst.id
              INNER JOIN curriculum_table AS ct ON dst.curriculum_id = ct.curriculum_id
              INNER JOIN section_table AS st ON dst.section_id = st.id
              INNER JOIN program_table AS ptbl ON ct.program_id = ptbl.program_id
            WHERE tt.professor_id = ?
              AND tt.course_id = ?
              AND tt.school_year_id = ?
            GROUP BY tt.department_section_id
            ORDER BY section_description
            `,
          [userID, selectedCourseId, activeYear.school_year_id],
        )
        : [[]];

      const sectionExists = sections.some(
        (section) =>
          String(section.department_section_id) ===
          String(department_section_id),
      );
      const selectedSectionId = sectionExists
        ? department_section_id
        : sections[0]?.department_section_id;

      const [students] =
        selectedCourseId && selectedSectionId
          ? await db3.query(
            `
            SELECT DISTINCT
              es.student_number,
              ptbl.last_name,
              ptbl.first_name,
              ptbl.middle_name,
              ylt.year_description,
              smt.semester_description,
              es.midterm,
              es.finals,
        es.final_grade,
        es.en_remarks,
        es.is_posted,
        st.description AS section_description,
        pgt.program_code,
        dst.id,
        smt.semester_id,
        es.active_school_year_id,
        ylt.year_id,
        ylt.year_description AS current_year,
        ylt.year_description + 1 AS next_year,
        cst.course_id,
        cst.course_description,
        cst.course_code,
        cst.course_unit,
        cst.lab_unit,
        dt.dprtmnt_name,
        yrlt.year_level_description
      FROM enrolled_subject AS es
        INNER JOIN student_numbering_table AS snt ON es.student_number = snt.student_number
        INNER JOIN person_table AS ptbl ON snt.person_id = ptbl.person_id
        INNER JOIN time_table AS tt
          ON es.department_section_id = tt.department_section_id
          AND es.course_id = tt.course_id
          AND es.active_school_year_id = tt.school_year_id
        INNER JOIN prof_table AS pt ON tt.professor_id = pt.prof_id
        INNER JOIN dprtmnt_section_table AS dst ON es.department_section_id = dst.id
        INNER JOIN section_table AS st ON dst.section_id = st.id
        INNER JOIN curriculum_table AS ct ON es.curriculum_id = ct.curriculum_id
        INNER JOIN program_table AS pgt ON ct.program_id = pgt.program_id
        INNER JOIN active_school_year_table AS sy ON es.active_school_year_id = sy.id
        INNER JOIN year_table AS ylt ON sy.year_id = ylt.year_id
        INNER JOIN semester_table AS smt ON sy.semester_id = smt.semester_id
        INNER JOIN course_table AS cst ON es.course_id = cst.course_id
        LEFT JOIN program_tagging_table AS ptt
          ON es.curriculum_id = ptt.curriculum_id
          AND es.course_id = ptt.course_id
        LEFT JOIN year_level_table AS yrlt ON ptt.year_level_id = yrlt.year_level_id
        INNER JOIN dprtmnt_curriculum_table AS dct ON ct.curriculum_id = dct.curriculum_id
        INNER JOIN dprtmnt_table AS dt ON dct.dprtmnt_id = dt.dprtmnt_id
      WHERE tt.professor_id = ?
        AND es.course_id = ?
        AND es.department_section_id = ?
        AND es.active_school_year_id = ?
      ORDER BY ptbl.last_name ASC, ptbl.first_name ASC
            `,
            [
              userID,
              selectedCourseId,
              selectedSectionId,
              activeYear.school_year_id,
            ],
          )
          : [[]];

      res.json({
        activeSchoolYear: activeYear,
        courses,
        sections,
        selectedCourse: selectedCourseId || "",
        selectedSection: selectedSectionId || "",
        students,
        gradeEditMode,
        grade_edit_scope: { midtermOpen, finalsOpen },
      });
    } catch (err) {
      console.error("Grading sheet bootstrap error:", err);
      res.status(500).json({ message: "Internal Error", err });
    }
  });

  function getFormattedTimestamp() {
    const now = new Date();

    let month = now.getMonth() + 1; // Months start at 0
    let day = now.getDate();
    let year = now.getFullYear();

    let hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // hour '0' should be '12'

    // Add leading zeros
    const mm = month < 10 ? "0" + month : month;
    const dd = day < 10 ? "0" + day : day;
    const hh = hours < 10 ? "0" + hours : hours;
    const min = minutes < 10 ? "0" + minutes : minutes;
    const ss = seconds < 10 ? "0" + seconds : seconds;

    return `${mm}/${dd}/${year} ${hh}:${min}:${ss} ${ampm}`;
  }

  const ensureEnrolledSubjectIsPostedColumn = async () => {
    try {
      await db3.query(`
        ALTER TABLE enrolled_subject
          ADD COLUMN IF NOT EXISTS is_posted tinyint(1) NOT NULL DEFAULT 0 AFTER fe_status
      `);
    } catch (err) {
      console.error("Failed to ensure enrolled_subject.is_posted column:", err);
    }
  };

  ensureEnrolledSubjectIsPostedColumn();

  app.put("/api/post_student_grades", async (req, res) => {
    const {
      professor_id,
      course_id,
      department_section_id,
      active_school_year_id,
    } = req.body;

    if (
      !professor_id ||
      !course_id ||
      !department_section_id ||
      !active_school_year_id
    ) {
      return res.status(400).json({ message: "Missing required parameters." });
    }

    try {
      const [[activePeriod]] = await db3.execute(
        "SELECT id, description, status FROM period_status WHERE status = 1 LIMIT 1",
      );

      if (!activePeriod || activePeriod.status !== 1) {
        return res
          .status(403)
          .json({ message: "The posting of grades is still not open." });
      }

      const [assignmentRows] = await db3.execute(
        `
        SELECT tt.id
        FROM time_table AS tt
        WHERE tt.professor_id = ?
          AND tt.course_id = ?
          AND tt.department_section_id = ?
          AND tt.school_year_id = ?
        LIMIT 1
        `,
        [
          professor_id,
          course_id,
          department_section_id,
          active_school_year_id,
        ],
      );

      if (!assignmentRows.length) {
        return res.status(403).json({
          message: "You are not assigned to this subject and section.",
        });
      }

      const [result] = await db3.execute(
        `
        UPDATE enrolled_subject AS es
          INNER JOIN time_table AS tt
            ON es.course_id = tt.course_id
            AND es.department_section_id = tt.department_section_id
            AND es.active_school_year_id = tt.school_year_id
        SET es.is_posted = 1
        WHERE tt.professor_id = ?
          AND es.course_id = ?
          AND es.department_section_id = ?
          AND es.active_school_year_id = ?
        `,
        [
          professor_id,
          course_id,
          department_section_id,
          active_school_year_id,
        ],
      );

      return res.status(200).json({
        message: "Student grades posted successfully.",
        posted_count: result.affectedRows || 0,
      });
    } catch (err) {
      console.error("Failed to post student grades:", err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/add_grades", async (req, res) => {
    const {
      midterm,
      finals,
      final_grade,
      en_remarks,
      student_number,
      subject_id,
    } = req.body;

    try {
      const [[activePeriod]] = await db3.execute(
        "SELECT id, description, status FROM period_status WHERE status = 1 LIMIT 1",
      );

      if (!activePeriod || activePeriod.status !== 1) {
        return res
          .status(403)
          .json({ message: "The uploading of grades is still not open." });
      }

      const activeDesc = String(activePeriod.description || "").toLowerCase();

      let gradeEditMode = "BOTH";
      let midtermOpen = true;
      let finalsOpen = true;

      if (activeDesc.includes("midterm")) {
        gradeEditMode = "MIDTERM_ONLY";
        midtermOpen = true;
        finalsOpen = false;
      } else if (activeDesc.includes("final grading period")) {
        gradeEditMode = "BOTH";
        midtermOpen = true;
        finalsOpen = true;
      } else if (activeDesc.includes("finals")) {
        gradeEditMode = "FINALS_ONLY";
        midtermOpen = false;
        finalsOpen = true;
      } else if (activeDesc.includes("final")) {
        gradeEditMode = "FINALS_ONLY";
        midtermOpen = false;
        finalsOpen = true;
      } else {
        return res.status(403).json({ message: "Grades not available yet" });
      }

      const isIncomplete =
        String(midterm).toLowerCase() === "inc" ||
        String(midterm).toLowerCase() === "incomplete" ||
        String(finals).toLowerCase() === "inc" ||
        String(finals).toLowerCase() === "incomplete";

      // Enforce column editability based on active grading period.
      // - MIDTERM_ONLY: allow only midterm updates; preserve finals/final_grade/remarks
      // - FINALS_ONLY: allow only finals + final_grade/remarks updates; preserve midterm
      // - BOTH: allow all updates (existing behavior)
      let result;

      if (gradeEditMode === "MIDTERM_ONLY") {
        const [r] = await db3.execute(
          `UPDATE enrolled_subject
           SET midterm = ?
           WHERE student_number = ? AND course_id = ?`,
          [midterm, student_number, subject_id],
        );
        result = r;
      } else if (gradeEditMode === "FINALS_ONLY") {
        if (isIncomplete) {
          const [r] = await db3.execute(
            `UPDATE enrolled_subject
             SET finals = ?, final_grade = "0.00", grades_status = 'INC', en_remarks = 3
             WHERE student_number = ? AND course_id = ?`,
            [finals, student_number, subject_id],
          );
          result = r;
        } else {
          const [r] = await db3.execute(
            `UPDATE enrolled_subject
             SET finals = ?, final_grade = ?, grades_status = ?, en_remarks = ?
             WHERE student_number = ? AND course_id = ?`,
            [finals, final_grade, final_grade, en_remarks, student_number, subject_id],
          );
          result = r;
        }
      } else {
        // BOTH (final grading period) — keep existing behavior.
        if (isIncomplete) {
          const [r] = await db3.execute(
            `UPDATE enrolled_subject
             SET midterm = ?, finals = ? , final_grade = "0.00", grades_status = 'INC', en_remarks = 3
             WHERE student_number = ? AND course_id = ?`,
            [midterm, finals, student_number, subject_id],
          );
          result = r;
        } else {
          const [r] = await db3.execute(
            `UPDATE enrolled_subject
             SET midterm = ?, finals = ?, final_grade = ?, grades_status = ?, en_remarks = ?
             WHERE student_number = ? AND course_id = ?`,
            [
              midterm,
              finals,
              final_grade,
              final_grade,
              en_remarks,
              student_number,
              subject_id,
            ],
          );
          result = r;
        }
      }

      return result.affectedRows > 0
        ? res.status(200).json({ message: "Grades updated successfully!" })
        : res
          .status(404)
          .json({ message: "No matching record found to update." });
    } catch (err) {
      console.error("Failed to update grades:", err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // API ROOM SCHEDULE
  app.get("/api/get_room/:profID/:roomID", async (req, res) => {
    const { profID, roomID } = req.params;

    const query = `
    SELECT
      t.room_day,
      d.description as day,
      t.school_time_start AS start_time,
      t.school_time_end AS end_time,
      rt.room_description
    FROM time_table t
    JOIN room_day_table d ON d.id = t.room_day
    INNER JOIN dprtmnt_room_table drt ON drt.dprtmnt_room_id = t.department_room_id
    INNER JOIN room_table rt ON rt.room_id = drt.room_id
    INNER JOIN active_school_year_table asy ON t.school_year_id = asy.id
    WHERE t.professor_id = ? AND t.department_room_id = ? AND asy.astatus = 1
  `;
    try {
      const [result] = await db3.query(query, [profID, roomID]);
      res.json(result);
    } catch (error) {
      res.status(500).send({ message: "ERROR:", error });
    }
  });

  app.delete("/api/upload/:id", async (req, res) => {
    const { id } = req.params;
    const query = "DELETE FROM requirement_uploads WHERE upload_id = ?";

    try {
      const [result] = await db.execute(query, [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Requirement not found" });
      }

      res.status(200).json({ message: "Requirement deleted successfully" });
    } catch (err) {
      console.error("Delete error:", err);
      res.status(500).json({ error: "Failed to delete requirement" });
    }
  });

  app.get("/api/professor-schedule/:profId", async (req, res) => {
    const profId = req.params.profId;

    try {
      const [results] = await db3.execute(
        `
      SELECT
        t.id,
        t.room_day,
        t.professor_id,
        d.description as day_description,
        t.school_time_start AS school_time_start,
        t.school_time_end AS school_time_end,
        pgt.program_code,
        st.description AS section_description,
        rt.room_description,
        COALESCE(cst.course_code, wt.workload_code) AS course_code,
        wt.workload_color,
        cst.course_id,
        t.department_section_id,
        t.ishonorarium,
        t.is_servicecredit,
        t.is_temporary_substitution,
        st.id as section_id,
        t.school_year_id
      FROM time_table t
      LEFT JOIN room_day_table d ON d.id = t.room_day
      LEFT JOIN active_school_year_table asy ON t.school_year_id = asy.id
      LEFT JOIN dprtmnt_section_table AS dst ON t.department_section_id = dst.id
      LEFT JOIN section_table AS st ON dst.section_id = st.id
      LEFT JOIN curriculum_table AS cct ON dst.curriculum_id = cct.curriculum_id
      LEFT JOIN program_table AS pgt ON cct.program_id = pgt.program_id
      LEFT JOIN room_table AS rt ON t.department_room_id = rt.room_id
      LEFT JOIN course_table AS cst ON t.course_id = cst.course_id AND t.department_section_id IS NOT NULL
      LEFT JOIN workload_type AS wt ON t.course_id = wt.id AND t.department_section_id IS NULL
      WHERE t.professor_id = ? AND asy.astatus = 1;
    `,
        [profId],
      );

      res.json(results);
    } catch (err) {
      console.error(err);
      res.status(500).send("DB Error");
    }
  });

  // EXAM API ENDPOINTS

  app.post("/api/applicant_schedule", async (req, res) => {
    const { applicant_id, exam_id } = req.body;

    if (!applicant_id || !exam_id) {
      return res
        .status(400)
        .json({ error: "Applicant ID and Exam ID are required." });
    }

    const query = `INSERT INTO exam_applicants (applicant_id, schedule_id) VALUES (?, ?)`;

    try {
      const [result] = await db.query(query, [applicant_id, exam_id]);
      res.json({
        message: "Applicant scheduled successfully",
        insertId: result.insertId,
      });
    } catch (err) {
      console.error("Database error adding applicant to schedule:", err);
      res
        .status(500)
        .json({ error: "Database error adding applicant to schedule" });
    }
  });

  app.get("/api/get_applicant_schedule", async (req, res) => {
    const query = `
    SELECT *
    FROM person_status_table
    WHERE exam_status = 0
      AND applicant_id NOT IN (
        SELECT applicant_id
        FROM exam_applicants
      )
  `;

    try {
      const [results] = await db.query(query);
      res.json(results);
    } catch (err) {
      console.error("Database error fetching unscheduled applicants:", err);
      res
        .status(500)
        .json({ error: "Database error fetching unscheduled applicants" });
    }
  });

  app.get("/api/slot_count/:exam_id", async (req, res) => {
    const exam_id = req.params.exam_id;
    const sql = `SELECT COUNT(*) AS count FROM exam_applicants WHERE schedule_id = ?`;

    try {
      const [results] = await db.query(sql, [exam_id]);
      res.json({ occupied: results[0].count });
    } catch (err) {
      console.error("Database error getting slot count:", err);
      res.status(500).json({ error: "Database error getting slot count" });
    }
  });

  // GET person details by person_id including program and student_number
  app.get("/api/person/:id", async (req, res) => {
    const { id } = req.params;

    try {
      const [rows] = await db.execute(
        `
      SELECT
        p.*,
        st.student_number,
        ct.curriculum_id,
        pt.program_description AS program,
        pt.major AS major
      FROM person_table AS p
      LEFT JOIN student_numbering_table AS st ON st.person_id = p.person_id
      LEFT JOIN curriculum_table AS ct ON ct.curriculum_id = p.program
      LEFT JOIN program_table AS pt ON pt.program_id = ct.program_id
      WHERE p.person_id = ?
    `,
        [id],
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "Person not found" });
      }

      res.json(rows[0]); //  Send single merged result
    } catch (err) {
      console.error("Error fetching person details:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Program Display
  app.get("/api/class_roster/ccs/:id", async (req, res) => {
    const { id } = req.params;

    try {
      const query = `
      SELECT
        dct.dprtmnt_id, dt.dprtmnt_name, dt.dprtmnt_code,
        pt.program_id, pt.program_description, pt.program_code,
        ct.curriculum_id
      FROM dprtmnt_curriculum_table as dct
      INNER JOIN dprtmnt_table as dt ON dct.dprtmnt_id = dt.dprtmnt_id
      INNER JOIN curriculum_table as ct ON dct.curriculum_id = ct.curriculum_id
      INNER JOIN program_table as pt ON ct.program_id = pt.program_id
      -- LEFT JOIN year_table as yt ON ct.year_id = yt.year_id -- optional
      WHERE dct.dprtmnt_id = ?;
    `;

      const [programRows] = await db3.execute(query, [id]);

      if (programRows.length === 0) {
        return res.json([]); // empty array instead of error
      }

      res.json(programRows);
    } catch (err) {
      console.error("Error fetching data:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Curriculum Section
  app.get("/api/class_roster/:cID", async (req, res) => {
    const { cID } = req.params;
    try {
      const query = `
      SELECT ct.curriculum_id, st.description, dst.id from dprtmnt_section_table AS dst
        INNER JOIN curriculum_table AS ct ON dst.curriculum_id = ct.curriculum_id
        INNER JOIN section_table AS st ON dst.section_id = st.id
      WHERE ct.curriculum_id = ?;
    `;

      const [sectionList] = await db3.execute(query, [cID]);

      res.json(sectionList);
    } catch (err) {
      console.error("Error fetching data:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // prof list base dun curriculum id tsaka sa section id
  app.get("/api/class_roster/:cID/:dstID", async (req, res) => {
    const { cID, dstID } = req.params;
    try {
      const query = `
    SELECT DISTINCT cst.course_id, pft.prof_id, tt.department_section_id, pft.fname, pft.lname, pft.mname, cst.course_description, cst.course_code, st.description AS section_description, pgt.program_code FROM time_table AS tt
      INNER JOIN dprtmnt_section_table AS dst ON tt.department_section_id = dst.id
      INNER JOIN curriculum_table AS cmt ON dst.curriculum_id = cmt.curriculum_id
      INNER JOIN section_table AS st ON dst.section_id = st.id
      INNER JOIN course_table AS cst ON tt.course_id = cst.course_id
      INNER JOIN prof_table AS pft ON tt.professor_id = pft.prof_id
      INNER JOIN program_table AS pgt ON cmt.program_id = pgt.program_id
      INNER JOIN active_school_year_table AS asyt ON tt.school_year_id = asyt.id
    WHERE dst.curriculum_id = ? AND tt.department_section_id = ? AND asyt.astatus = 1
    `;
      const [profList] = await db3.execute(query, [cID, dstID]);

      res.json(profList);
    } catch (err) {
      console.error("Error fetching data:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Student Information
  app.get(
    "/class_roster/student_info/:cID/:dstID/:courseID/:professorID",
    async (req, res) => {
      const { cID, dstID, courseID, professorID } = req.params;
      try {
        const query = `
    SELECT DISTINCT
      es.student_number,
      pst.first_name, pst.middle_name, pst.last_name,
      pgt.program_description, pgt.program_code
    FROM enrolled_subject AS es
      INNER JOIN time_table AS tt ON es.department_section_id = tt.department_section_id
      INNER JOIN dprtmnt_section_table AS dst ON es.department_section_id = dst.id
      INNER JOIN active_school_year_table AS asyt ON es.active_school_year_id = asyt.id
      INNER JOIN student_status_table AS sst ON es.student_number = sst.student_number
      INNER JOIN student_numbering_table AS snt ON sst.student_number = snt.student_number
      INNER JOIN person_table AS pst ON snt.person_id = pst.person_id
      INNER JOIN curriculum_table AS cct ON es.curriculum_id = cct.curriculum_id
      INNER JOIN program_tagging_table AS ptt ON es.course_id = ptt.course_id
      INNER JOIN program_table AS pgt ON cct.program_id = pgt.program_id
    WHERE es.curriculum_id = ? AND es.department_section_id = ? AND asyt.astatus = 1 AND es.course_id = ? AND tt.professor_id = ? ORDER BY pst.last_name
    `;

        const [studentList] = await db3.execute(query, [
          cID,
          dstID,
          courseID,
          professorID,
        ]);
        res.json(studentList);
      } catch (err) {
        console.error("Error fetching data:", err);
        res.status(500).json({ error: "Internal Server Error", err });
      }
    },
  );

  // Class Information
  app.get(
    "/class_roster/classinfo/:cID/:dstID/:courseID/:professorID",
    async (req, res) => {
      const { cID, dstID, courseID, professorID } = req.params;
      try {
        const query = `
    SELECT DISTINCT
      st.description AS section_Description,
      pft.fname, pft.mname, pft.lname, pft.prof_id,
      smt.semester_description,
      ylt.year_level_description,
      ct.course_description, ct.course_code, ct.course_unit, ct.lab_unit, ct.course_id,
      yt.year_description,
      rdt.description as day,
      tt.school_time_start,
      tt.school_time_end
    FROM enrolled_subject AS es
      INNER JOIN time_table AS tt ON es.department_section_id = tt.department_section_id
      INNER JOIN dprtmnt_section_table AS dst ON es.department_section_id = dst.id
      INNER JOIN section_table AS st ON dst.section_id = st.id
      INNER JOIN active_school_year_table AS asyt ON es.active_school_year_id = asyt.id
      INNER JOIN prof_table AS pft ON tt.professor_id = pft.prof_id
      INNER JOIN course_table AS ct ON es.course_id = ct.course_id
      INNER JOIN curriculum_table AS cct ON es.curriculum_id = cct.curriculum_id
      INNER JOIN program_tagging_table AS ptt ON es.course_id = ptt.course_id
      INNER JOIN program_table AS pgt ON cct.program_id = pgt.program_id
      INNER JOIN year_table AS yt ON cct.year_id = yt.year_id
      INNER JOIN year_level_table AS ylt ON ptt.year_level_id = ylt.year_level_id
      INNER JOIN semester_table AS smt ON ptt.semester_id = smt.semester_id
      INNER JOIN room_day_table AS rdt ON tt.room_day = rdt.id
    WHERE es.curriculum_id = ? AND es.department_section_id = ? AND asyt.astatus = 1 AND es.course_id = ? AND tt.professor_id = ?
    `;

        const [class_data] = await db3.execute(query, [
          cID,
          dstID,
          courseID,
          professorID,
        ]);
        res.json(class_data);
      } catch (err) {
        console.error("Error fetching data:", err);
        res.status(500).json({ error: "Internal Server Error", err });
      }
    },
  );

  app.get(
    "/statistics/student_count/department/:dprtmnt_id",
    async (req, res) => {
      const { dprtmnt_id } = req.params;

      try {
        const query = `
      SELECT COUNT(DISTINCT es.student_number) AS student_count
      FROM enrolled_subject AS es
      INNER JOIN curriculum_table AS ct ON es.curriculum_id = ct.curriculum_id
      INNER JOIN dprtmnt_curriculum_table AS dct ON ct.curriculum_id = dct.curriculum_id
      INNER JOIN dprtmnt_table AS dt ON dct.dprtmnt_id = dt.dprtmnt_id
      INNER JOIN active_school_year_table AS asyt ON es.active_school_year_id = asyt.id
      INNER JOIN student_status_table AS sst ON es.student_number = sst.student_number
      INNER JOIN student_numbering_table AS snt ON sst.student_number = snt.student_number
      INNER JOIN person_table AS pst ON snt.person_id = pst.person_id
      WHERE dt.dprtmnt_id = ?
        AND asyt.astatus = 1
        AND sst.enrolled_status = 1
    `;

        const [rows] = await db3.execute(query, [dprtmnt_id]);
        res.json({ count: rows[0]?.student_count || 0 });
      } catch (err) {
        console.error("Error fetching total student count by department:", err);
        res.status(500).json({ error: "Internal Server Error" });
      }
    },
  );

  app.get("/api/departments/:dprtmnt_id", async (req, res) => {
    const { dprtmnt_id } = req.params;
    try {
      const [departments] = await db3.execute(
        `
      SELECT dt.dprtmnt_id, dt.dprtmnt_name, dt.dprtmnt_code FROM dprtmnt_table AS dt WHERE dt.dprtmnt_id = ?
    `,
        [dprtmnt_id],
      );
      res.json(departments);
    } catch (err) {
      console.error("Error fetching departments:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/departments", async (req, res) => {
    const {
      ensureDepartmentIsAllowedColumn,
    } = require("../routes/system_routes/dprmntRoute");

    try {
      await ensureDepartmentIsAllowedColumn();
      const [result] = await db3.query(
        `SELECT
           dprtmnt_id,
           dprtmnt_code,
           dprtmnt_name,
           COALESCE(is_allowed, 1) AS is_allowed
         FROM dprtmnt_table`,
      );
      res.json(result);
    } catch (err) {
      console.error("Error fetching departments:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // NEW ENDPOINT: All Year Levels Count
  app.get(
    "/statistics/student_count/department/:dprtmnt_id/by_year_level",
    async (req, res) => {
      const { dprtmnt_id } = req.params;

      try {
        const query = `
      SELECT ylt.year_level_id, ylt.year_level_description, COUNT(DISTINCT es.student_number) AS student_count
      FROM enrolled_subject AS es
      INNER JOIN curriculum_table AS ct ON es.curriculum_id = ct.curriculum_id
      INNER JOIN dprtmnt_curriculum_table AS dct ON ct.curriculum_id = dct.curriculum_id
      INNER JOIN dprtmnt_table AS dt ON dct.dprtmnt_id = dt.dprtmnt_id
      INNER JOIN active_school_year_table AS asyt ON es.active_school_year_id = asyt.id
      INNER JOIN student_status_table AS sst ON es.student_number = sst.student_number
      INNER JOIN year_level_table AS ylt ON sst.year_level_id = ylt.year_level_id
      WHERE dt.dprtmnt_id = ?
        AND asyt.astatus = 1
        AND sst.enrolled_status = 1
      GROUP BY ylt.year_level_id
      ORDER BY ylt.year_level_id ASC;
    `;

        const [rows] = await db3.execute(query, [dprtmnt_id]);
        res.json(rows); // [{ year_level_id: 1, year_level_description: "1st Year", student_count: 123 }, ...]
      } catch (err) {
        console.error("Error fetching year-level counts:", err);
        res.status(500).json({ error: "Internal Server Error" });
      }
    },
  );

  // 09/06/2025 UPDATE - FIXED: search by EMAIL not student_number
  app.post("/api/forgot-password-student", async (req, res) => {
    try {
      const { search } = req.body;

      if (!search) {
        return res
          .status(400)
          .json({ success: false, message: "Missing search value" });
      }

      const like = `%${search}%`;

      //   Allow reset via: student_number, name, person email, or user_accounts email
      const [rows] = await db3.query(
        `SELECT ua.email
       FROM user_accounts ua
       JOIN person_table pt ON ua.person_id = pt.person_id
       WHERE ua.role = 'student'
         AND (
            pt.student_number LIKE ?
            OR ua.email LIKE ?
            OR pt.emailAddress LIKE ?
            OR pt.first_name LIKE ?
            OR pt.middle_name LIKE ?
            OR pt.last_name LIKE ?
            OR CONCAT(pt.first_name, ' ', pt.last_name) LIKE ?
         )
       LIMIT 1`,
        [like, like, like, like, like, like, like],
      );

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Student not found." });
      }

      const email = rows[0].email;
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "No valid email found for this student.",
        });
      }

      //  Fetch short term from company settings
      const [settings] = await db.query(
        "SELECT short_term FROM company_settings WHERE id = 1",
      );
      const shortTerm = settings[0]?.short_term || "Institution";

      //  Generate new 8-letter password
      const newPassword = Array.from({ length: 8 }, () =>
        String.fromCharCode(Math.floor(Math.random() * 26) + 65),
      ).join("");

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      //  Update student password
      await db3.query("UPDATE user_accounts SET password = ? WHERE email = ?", [
        hashedPassword,
        email,
      ]);

      //  Send email
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: `"${shortTerm} - Information System" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your Password has Reset",
        text: `Your new temporary password is: ${newPassword}\n\nPlease change it after logging in.`,
      });

      res.json({
        success: true,
        message:
          "Password reset successfully. Check email for the new password.",
      });
    } catch (error) {
      console.error("Reset error:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  });

  /* Student Dashboard */
  //GET All Needed Student Personl Data

  //COUNT the Total Number of Courses the Student Enrolled

  //GET All Needed Student Academic Data (Program, etc...)
  app.get("/api/student_details/:id", async (req, res) => {
    const { id } = req.params;

    try {
      const [rows] = await db3.execute(
        `
    SELECT DISTINCT
      IFNULL(pgt.program_description, 'Not Currently Enrolled') AS program_description,
      IFNULL(st.description, 'Not Currently Enrolled') AS section_description,
      IFNULL(pgt.program_code, 'Not Currently Enrolled') AS program_code,
      IFNULL(ylt.year_level_description, 'Not Currently Enrolled') AS year_level
    FROM enrolled_subject AS es
      INNER JOIN student_numbering_table AS snt ON es.student_number = snt.student_number
      INNER JOIN person_table AS pt ON snt.person_id = pt.person_id
      INNER JOIN curriculum_table AS cct ON es.curriculum_id = cct.curriculum_id
      INNER JOIN program_table AS pgt ON cct.program_id = pgt.program_id
      INNER JOIN dprtmnt_section_table AS dst ON es.department_section_id = dst.id
      INNER JOIN section_table AS st ON dst.section_id = st.id
      INNER JOIN student_status_table AS sst ON snt.student_number = sst.student_number
      INNER JOIN year_level_table AS ylt ON sst.year_level_id = ylt.year_level_id
      INNER JOIN active_school_year_table AS sy ON sst.active_school_year_id = sy.id
    WHERE pt.person_id = ?`,
        [id],
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Person not found" });
      }

      res.json(rows[0]);
    } catch (error) {
      console.error("Error fetching person:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  /* Student Schedule */
  //GET Student Current Assigned Schedule

  app.get("/api/get/all_schedule/:roomID", async (req, res) => {
    const { roomID } = req.params;

    try {
      const scheduleQuery = `
      SELECT
        tt.id,
        tt.room_day,
        tt.department_section_id,
        tt.course_id,
        tt.professor_id,
        tt.department_room_id,
        tt.school_year_id,
        rdt.description AS day_description,
        tt.school_time_start,
        tt.school_time_end,
        pft.lname AS prof_lastname,
        pft.fname AS prof_firstname,
        COALESCE(cst.course_code, wt.workload_code) AS course_code,
        wt.workload_color,
        rmt.room_description,
        pgt.program_code,
        pgt.program_id,
        dct.dprtmnt_id,
        pft.employee_id,
        tt.ishonorarium,
        tt.is_servicecredit,
        tt.is_temporary_substitution,
        yt.year_description AS current_year,
        yt.year_description + 1 AS next_year,
        smt.semester_description,
        st.description AS section_description
      FROM time_table AS tt
        LEFT JOIN room_day_table AS rdt ON tt.room_day = rdt.id
        LEFT JOIN dprtmnt_section_table AS dst ON tt.department_section_id = dst.id
        LEFT JOIN curriculum_table AS cct ON dst.curriculum_id = cct.curriculum_id
        LEFT JOIN dprtmnt_curriculum_table AS dct ON dst.curriculum_id = dct.curriculum_id
        LEFT JOIN program_table AS pgt ON cct.program_id = pgt.program_id
        LEFT JOIN course_table AS cst ON tt.course_id = cst.course_id AND tt.department_section_id IS NOT NULL
        LEFT JOIN workload_type AS wt ON tt.course_id = wt.id AND tt.department_section_id IS NULL
        LEFT JOIN prof_table AS pft ON tt.professor_id = pft.prof_id
        LEFT JOIN active_school_year_table AS syt ON tt.school_year_id = syt.id
        LEFT JOIN room_table AS rmt ON tt.department_room_id = rmt.room_id
        LEFT JOIN section_table AS st ON dst.section_id = st.id
        LEFT JOIN active_school_year_table AS sy ON tt.school_year_id = sy.id
        LEFT JOIN year_table AS yt ON sy.year_id = yt.year_id
        LEFT JOIN semester_table AS smt ON sy.semester_id = smt.semester_id
      WHERE (rmt.room_id = ? OR tt.department_room_id IS NULL) AND sy.astatus = 1;
    `;
      const [schedule] = await db3.execute(scheduleQuery, [roomID]);

      if (schedule.length === 0) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      res.json(schedule);
    } catch (error) {
      console.error("Error fetching person:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.post("/api/insert-schedule-designation", async (req, res) => {
    const { day, start_time, end_time, subject_id, prof_id, school_year_id } =
      req.body;

    if (!day || !start_time || !end_time || !school_year_id || !prof_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let startMinutes = timeToMinutes(start_time);
    let endMinutes = timeToMinutes(end_time);
    const earliest = timeToMinutes("7:00 AM");
    const latest = timeToMinutes("9:00 PM");

    // Validate times
    if (endMinutes <= startMinutes) {
      return res.status(409).json({
        conflict: true,
        message: "End time must be later than start time (same day only).",
      });
    }

    if (startMinutes < earliest || endMinutes > latest) {
      return res.status(409).json({
        conflict: true,
        message: "Time must be between 7:00 AM and 9:00 PM (same day).",
      });
    }

    try {
      // Check for time conflicts (prof, section, room)
      const checkTimeQuery = `
      SELECT * FROM time_table
      WHERE room_day = ?
        AND school_year_id = ?
        AND (professor_id = ? OR department_section_id = ?)
        AND (
          (? > TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60
          AND ? < TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60)
          OR
          (? > TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60
          AND ? < TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60)
          OR
          (TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60 > ?
          AND TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60 < ?)
          OR
          (TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60 > ?
          AND TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60 < ?)
          OR
          (TIME_TO_SEC(STR_TO_DATE(school_time_start, '%l:%i %p'))/60 = ?
          AND TIME_TO_SEC(STR_TO_DATE(school_time_end, '%l:%i %p'))/60 = ?)
        )
    `;

      const [timeResult] = await db3.query(checkTimeQuery, [
        day,
        school_year_id,
        prof_id,
        startMinutes,
        startMinutes,
        endMinutes,
        endMinutes,
        startMinutes,
        endMinutes,
        startMinutes,
        endMinutes,
        startMinutes,
        endMinutes,
        startMinutes,
        endMinutes,
        startMinutes,
        endMinutes,
      ]);

      if (timeResult.length > 0) {
        return res.status(409).json({
          conflict: true,
          message:
            "Schedule conflict detected! Please choose a different time.",
        });
      }

      // Insert schedule
      const insertQuery = `
      INSERT INTO time_table
      (room_day, school_time_start, school_time_end, department_section_id, course_id, professor_id, department_room_id, school_year_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
      await db3.query(insertQuery, [
        day,
        start_time,
        end_time,
        null,
        subject_id,
        prof_id,
        null,
        school_year_id,
      ]);

      res.status(200).json({ message: "Schedule inserted successfully" });
    } catch (error) {
      console.error("Error inserting schedule:", error);
      res.status(500).json({ error: "Failed to insert schedule" });
    }
  });

  app.delete("/api/delete/schedule/:scheduleId", async (req, res) => {
    const { scheduleId } = req.params;

    try {
      const deleteQuery = `DELETE FROM time_table WHERE id = ?`;
      const [result] = await db3.execute(deleteQuery, [scheduleId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Schedule not found." });
      }

      res.json({ message: "Schedule deleted successfully." });
    } catch (error) {
      console.error("Error deleting schedule:", error);
      res
        .status(500)
        .json({ error: "Database error while deleting schedule." });
    }
  });

  function timeToMinutes(timeStr) {
    const parts = timeStr.trim().split(" ");
    let [hours, minutes] = parts[0].split(":").map(Number);
    const modifier = parts[1] ? parts[1].toUpperCase() : null;

    if (modifier) {
      if (modifier === "PM" && hours !== 12) hours += 12;
      if (modifier === "AM" && hours === 12) hours = 0;
    }

    return hours * 60 + minutes;
  }

  app.get("/api/program_list/:dprtmnt_id", async (req, res) => {
    const { dprtmnt_id } = req.params;

    try {
      const query = `
      SELECT pt.program_id, pt.program_description, pt.program_code, pt.major
      FROM dprtmnt_curriculum_table AS dct
      INNER JOIN curriculum_table AS ct ON dct.curriculum_id = ct.curriculum_id
      INNER JOIN program_table AS pt ON ct.program_id = pt.program_id
      WHERE dct.dprtmnt_id = ?;
    `;

      const [results] = await db3.query(query, [dprtmnt_id]);
      res.status(200).send(results);
    } catch (error) {
      console.error(error);
      res.status(500).send(error);
    }
  });

  app.get("/api/person_with_applicant/:person_id", (req, res) => {
    const personId = req.params.person_id;
    const sql = `
    SELECT
      p.*,
      an.applicant_number,
      p.applyingAs,
      ps.qualifying_result   AS qualifying_exam_score,
      ps.interview_result    AS qualifying_interview_score,
      ps.exam_result         AS exam_score
    FROM person_table p
    LEFT JOIN applicant_numbering_table an ON an.person_id = p.person_id
    LEFT JOIN person_status_table ps ON ps.person_id = p.person_id
    WHERE p.person_id = ?
    LIMIT 1
  `;
    db.query(sql, [personId], (err, results) => {
      if (err) {
        console.error("person_with_applicant SQL error:", err);
        return res.status(500).json({ error: err.message });
      }
      if (!results[0])
        return res.status(404).json({ error: "Person not found" });
      res.json(results[0]);
    });
  });

  app.get("/api/person_with_applicant/:id", (req, res) => {
    const id = req.params.id;

    const sql = `
    SELECT
      p.*,
      an.applicant_number,
      p.applyingAs,
      ps.qualifying_result   AS qualifying_exam_score,
      ps.interview_result    AS qualifying_interview_score,
      ps.exam_result         AS exam_score
    FROM person_table p
    LEFT JOIN applicant_numbering_table an ON an.person_id = p.person_id
    LEFT JOIN person_status_table ps ON ps.person_id = p.person_id
    WHERE p.person_id = ? OR an.applicant_number = ?
    LIMIT 1
  `;

    // bind the same param twice so the endpoint accepts either numeric person_id or applicant_number
    db.query(sql, [id, id], (err, results) => {
      if (err) {
        console.error("person_with_applicant SQL error:", err);
        return res.status(500).json({ error: err.message });
      }
      if (!results[0])
        return res.status(404).json({ error: "Person not found" });
      res.json(results[0]);
    });
  });

  app.get("/api/person_status_by_applicant/:applicant_number", (req, res) => {
    const applicantNumber = req.params.applicant_number;
    const sql = `
    SELECT ps.*
    FROM person_status_table ps
    JOIN applicant_numbering_table an ON an.person_id = ps.person_id
    WHERE an.applicant_number = ?
    LIMIT 1
  `;
    db.query(sql, [applicantNumber], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results[0] || null);
    });
  });

  app.get("/api/requirements/status/:person_id", async (req, res) => {
    const { person_id } = req.params;

    try {
      // 1 Get applicant type from person_table.applyingAs
      const [[person]] = await db.query(
        `
      SELECT applyingAs
      FROM person_table
      WHERE person_id = ?
      `,
        [person_id],
      );

      if (!person) {
        return res.status(404).json({
          error: "Person not found",
        });
      }

      const applyingAs = String(person.applyingAs);

      // 2 Get required requirements for this applicant type
      const [required] = await db.query(
        `
      SELECT id, description, category
      FROM requirements_table
      WHERE (applicant_type = ? OR applicant_type = '0' OR applicant_type = 0 OR applicant_type = 'All')
        AND is_optional = 0
      `,
        [applyingAs],
      );

      // 3 Get uploaded requirements
      const [uploaded] = await db.query(
        `
      SELECT requirements_id
      FROM requirement_uploads
      WHERE person_id = ?
      AND document_status = 'Approved'
      `,
        [person_id],
      );

      const uploadedIds = uploaded.map((r) => r.requirements_id);

      // 4 Check missing requirements
      const missing = required.filter((req) => !uploadedIds.includes(req.id));

      res.json({
        required_count: required.length,
        uploaded_count: uploaded.length,
        missing_requirements: missing,
        completed: missing.length === 0,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: "Failed to check requirements",
      });
    }
  });

  app.get("/api/applied_program/:dprtmnt_id", async (req, res) => {
    const { dprtmnt_id } = req.params;
    try {
      const [rows] = await db3.execute(
        `
      SELECT
        ct.curriculum_id,
        ct.year_id,
        yt.year_description,
        pt.program_id,
        pt.program_code,
        pt.program_description,
        pt.major,
        pt.components,
        pt.academic_program,
        d.dprtmnt_id,
        d.dprtmnt_name
   
      FROM curriculum_table AS ct
      INNER JOIN program_table AS pt ON pt.program_id = ct.program_id
      INNER JOIN dprtmnt_curriculum_table AS dc ON ct.curriculum_id = dc.curriculum_id
      INNER JOIN year_table AS yt ON ct.year_id = yt.year_id
      INNER JOIN dprtmnt_table AS d ON dc.dprtmnt_id = d.dprtmnt_id
      WHERE d.dprtmnt_id = ? AND ct.lock_status = 1

    `,
        [dprtmnt_id],
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "No curriculum data found" });
      }

      res.json(rows);
    } catch (error) {
      console.error("Error fetching curriculum data:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.get("/api/person_data/:person_id/:role", async (req, res) => {
    try {
      const { person_id, role } = req.params;
      let userData;

      if (role === "registrar") {
        //  Fetch registrar info directly from user_accounts (db3)
        const [rows] = await db3.query(
          `SELECT
           ua.person_id,
           ua.profile_picture AS profile_image,
           ua.first_name AS fname,
           ua.middle_name AS mname,
           ua.last_name AS lname,
           ua.role,
           ua.employee_id,
           dt.dprtmnt_id,
           dt.dprtmnt_name,
           dt.dprtmnt_code,
           ua.email
         FROM user_accounts AS ua
         LEFT JOIN dprtmnt_table AS dt ON ua.dprtmnt_id = dt.dprtmnt_id 
         WHERE ua.person_id = ? AND ua.role = 'registrar'`,
          [person_id],
        );
        userData = rows[0];
      } else if (role === "faculty") {
        const [rows] = await db3.query(
          `SELECT
           pt.person_id,
           pt.employee_id,
           pt.profile_image,
           pt.fname,
           pt.lname,
           'faculty' AS role,
           dt.dprtmnt_id,
           dt.dprtmnt_name,
           dt.dprtmnt_code,
           pt.email
         FROM prof_table AS pt
         LEFT JOIN dprtmnt_profs_table AS dpt ON pt.prof_id = dpt.prof_id
         LEFT JOIN dprtmnt_table AS dt ON dpt.dprtmnt_id = dpt.dprtmnt_id
         WHERE pt.person_id = ?`,
          [person_id],
        );
        userData = rows[0];
      } else if (role === "student") {
        const [rows] = await db3.query(
          `SELECT
           pt.person_id,
           pt.profile_img AS profile_image,
           pt.first_name AS fname,
           pt.middle_name AS mname,
           pt.last_name AS lname,
           ua.role,
           snt.student_number,
           ua.email
         FROM person_table AS pt
         INNER JOIN user_accounts AS ua
           ON pt.person_id = ua.person_id
         INNER JOIN student_numbering_table AS snt 
           ON snt.person_id = pt.person_id
         WHERE pt.person_id = ? AND ua.role = 'student'`,
          [person_id],
        );
        userData = rows[0];
      } else if (role === "applicant") {
        const [rows] = await db.query(
          `SELECT
           p.person_id,
           p.profile_img AS profile_image,
           p.first_name AS fname,
           p.middle_name AS mname,
           p.last_name AS lname,
           ua.role,
           ant.applicant_number,
           ua.email
         FROM person_table AS p
         INNER JOIN user_accounts AS ua
           ON p.person_id = ua.person_id
         INNER JOIN applicant_numbering_table AS ant
         ON p.person_id =  ant.person_id
         WHERE p.person_id = ? AND ua.role = ?`,
          [person_id, role],
        );
        userData = rows[0];
      } else {
        return res.status(400).send({ message: "Invalid role provided" });
      }

      if (!userData) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(userData);
    } catch (err) {
      console.error(" Error fetching person data:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get(
    "/api/applicant-interview-schedule/:applicantNumber",
    async (req, res) => {
      const { applicantNumber } = req.params;

      try {
        const [rows] = await db.query(
          `
        SELECT
          ies.schedule_id,
          ies.day_description,
          ies.building_description,
          ies.room_description,
          ies.start_time,
          ies.end_time,
          ies.interviewer,

          ps.exam_result,

          ia.qualifying_status,
          ia.interview_status,
          ia.email_sent

        FROM interview_applicants ia
        JOIN interview_exam_schedule ies
          ON ia.schedule_id = ies.schedule_id
        LEFT JOIN person_status_table ps
          ON ia.applicant_id = ps.applicant_id
        WHERE ia.applicant_id = ?
          AND COALESCE(ia.email_sent, 0) = 1
        LIMIT 1
        `,
          [applicantNumber],
        );

        if (rows.length > 0) {
          const applicant = rows[0];

          res.json({
            ...applicant,

            qualifying_result:
              applicant.qualifying_status === null ||
                applicant.qualifying_status === undefined
                ? null
                : Number(applicant.qualifying_status),

            interview_result:
              applicant.interview_status === null ||
                applicant.interview_status === undefined
                ? null
                : Number(applicant.interview_status),
          });
        } else {
          res.status(404).json({
            message: "No interview schedule found for this applicant",
          });
        }
      } catch (err) {
        console.error("Error fetching interview schedule:", err);
        res.status(500).json({
          message: "Server error fetching interview schedule",
        });
      }
    },
  );
  app.get("/api/interview_applicants/:applicantId", async (req, res) => {
    try {
      const { applicantId } = req.params;
      const [rows] = await db.query(
        "SELECT status FROM interview_applicants WHERE applicant_id = ? ORDER BY id DESC LIMIT 1",
        [applicantId],
      );

      if (rows.length === 0) {
        return res.json({ status: null });
      }
      res.json(rows[0]);
    } catch (err) {
      console.error(" Error fetching interview applicant status:", err);
      res.status(500).send("Server error");
    }
  });

  // Class List — professor sections for active term
  app.get("/api/class-list/professor-sections", async (req, res) => {
    const { professorId, yearId, semesterId, departmentId } = req.query;

    if (!professorId || !yearId || !semesterId) {
      return res.status(400).json({
        error: "professorId, yearId, and semesterId are required",
      });
    }

    const filters = ["tt.professor_id = ?", "sy.year_id = ?", "sy.semester_id = ?"];
    const params = [professorId, yearId, semesterId];

    if (departmentId) {
      filters.push("dct.dprtmnt_id = ?");
      params.push(departmentId);
    }

    try {
      const [rows] = await db3.query(
        `
        SELECT DISTINCT
          tt.department_section_id,
          ptbl.program_code,
          ptbl.program_description,
          st.description AS section_description,
          dst.curriculum_id,
          dct.dprtmnt_id
        FROM time_table AS tt
        INNER JOIN dprtmnt_section_table AS dst ON tt.department_section_id = dst.id
        INNER JOIN section_table AS st ON dst.section_id = st.id
        INNER JOIN curriculum_table AS ct ON dst.curriculum_id = ct.curriculum_id
        INNER JOIN program_table AS ptbl ON ct.program_id = ptbl.program_id
        INNER JOIN dprtmnt_curriculum_table AS dct ON ct.curriculum_id = dct.curriculum_id
        INNER JOIN active_school_year_table AS sy ON tt.school_year_id = sy.id
        WHERE ${filters.join(" AND ")}
        ORDER BY ptbl.program_code ASC, st.description ASC
        `,
        params,
      );
      res.json(rows);
    } catch (error) {
      console.error("Error fetching professor sections for class list:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Class List — student numbers for professor/section filters
  app.get("/api/class-list/filter-student-numbers", async (req, res) => {
    const { professorId, departmentSectionId, yearId, semesterId } = req.query;

    if (!yearId || !semesterId) {
      return res.status(400).json({
        error: "yearId and semesterId are required",
      });
    }

    if (!professorId && !departmentSectionId) {
      return res.json([]);
    }

    try {
      let rows = [];

      if (departmentSectionId) {
        [rows] = await db3.query(
          `
          SELECT DISTINCT es.student_number
          FROM enrolled_subject AS es
          INNER JOIN active_school_year_table AS sy
            ON es.active_school_year_id = sy.id
          WHERE es.department_section_id = ?
            AND sy.year_id = ?
            AND sy.semester_id = ?
          `,
          [departmentSectionId, yearId, semesterId],
        );
      } else if (professorId) {
        [rows] = await db3.query(
          `
          SELECT DISTINCT es.student_number
          FROM enrolled_subject AS es
          INNER JOIN time_table AS tt
            ON es.department_section_id = tt.department_section_id
           AND es.course_id = tt.course_id
           AND es.active_school_year_id = tt.school_year_id
          INNER JOIN active_school_year_table AS sy
            ON es.active_school_year_id = sy.id
          WHERE tt.professor_id = ?
            AND sy.year_id = ?
            AND sy.semester_id = ?
          `,
          [professorId, yearId, semesterId],
        );
      }

      res.json(rows.map((row) => String(row.student_number)));
    } catch (error) {
      console.error("Error fetching class list filter student numbers:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  // 09/16/2025 — optimized: single query for multiple departments + optional term filter
  app.get("/api/student_number", async (req, res) => {
    try {
      const {
        department_id,
        departmentIds: departmentIdsRaw,
        curriculum_id,
        yearId,
        semesterId,
      } = req.query;

      const departmentIds = departmentIdsRaw
        ? String(departmentIdsRaw)
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : department_id
          ? [String(department_id).trim()]
          : [];

      const innerFilters = [];
      const innerParams = [];
      const regStatsFilters = [];
      const regStatsParams = [];

      if (departmentIds.length === 1) {
        innerFilters.push("dct.dprtmnt_id = ?");
        innerParams.push(departmentIds[0]);
        regStatsFilters.push("dct2.dprtmnt_id = ?");
        regStatsParams.push(departmentIds[0]);
      } else if (departmentIds.length > 1) {
        const placeholders = departmentIds.map(() => "?").join(", ");
        innerFilters.push(`dct.dprtmnt_id IN (${placeholders})`);
        innerParams.push(...departmentIds);
        regStatsFilters.push(`dct2.dprtmnt_id IN (${placeholders})`);
        regStatsParams.push(...departmentIds);
      }

      if (curriculum_id) {
        innerFilters.push("es.curriculum_id = ?");
        innerParams.push(curriculum_id);
        regStatsFilters.push("es2.curriculum_id = ?");
        regStatsParams.push(curriculum_id);
      }

      let termJoinSql = "";
      let regStatsTermJoin = "";

      if (yearId && semesterId) {
        termJoinSql = `
        INNER JOIN active_school_year_table AS asyt_filter
          ON es.active_school_year_id = asyt_filter.id
        `;
        regStatsTermJoin = `
        INNER JOIN active_school_year_table AS asyt2
          ON es2.active_school_year_id = asyt2.id
        `;
        innerFilters.push("asyt_filter.year_id = ?");
        innerFilters.push("asyt_filter.semester_id = ?");
        innerParams.push(yearId, semesterId);
        regStatsFilters.push("asyt2.year_id = ?");
        regStatsFilters.push("asyt2.semester_id = ?");
        regStatsParams.push(yearId, semesterId);
      }

      const innerWhereClause = innerFilters.length
        ? `WHERE ${innerFilters.join(" AND ")}`
        : "";

      const regStatsWhereClause = regStatsFilters.length
        ? `WHERE ${regStatsFilters.join(" AND ")}`
        : "";

      const queryParams = [...innerParams, ...regStatsParams];

      const [rows] = await db3.execute(`
      SELECT
        snt.student_number,
        pst.campus,
        pst.last_name,
        pst.first_name,
        pst.middle_name,
        pgt.program_description,
        smt.semester_description,
        smt.semester_id,
        pgt.program_code,
        pgt.program_id,
        dpt.dprtmnt_id,
        dpt.dprtmnt_code,
        es_base.status,
        es_base.is_regular,
        CASE
          WHEN reg_stats.reg_count = 0 THEN NULL
          WHEN reg_stats.min_is_regular = 0 THEN 0
          ELSE 1
        END AS official_is_regular,
        sy.year_id,
        sy.semester_id,
        es_base.en_remarks,
        ylt.year_level_description,
        ylt.year_level_id,
        es_base.curriculum_id,
        student_section.section_description,
        student_section.section_program_code
      FROM (
        SELECT
          es.student_number,
          es.active_school_year_id,
          es.curriculum_id,
          MAX(es.en_remarks) AS en_remarks,
          MAX(es.status) AS status,
          MAX(es.is_regular) AS is_regular
        FROM enrolled_subject AS es
        INNER JOIN dprtmnt_curriculum_table AS dct
          ON es.curriculum_id = dct.curriculum_id
        ${termJoinSql}
        ${innerWhereClause}
        GROUP BY es.student_number, es.active_school_year_id, es.curriculum_id
      ) AS es_base
        INNER JOIN active_school_year_table AS sy
          ON es_base.active_school_year_id = sy.id
        INNER JOIN semester_table AS smt
          ON sy.semester_id = smt.semester_id
        INNER JOIN curriculum_table AS cmt
          ON es_base.curriculum_id = cmt.curriculum_id
        INNER JOIN program_table AS pgt
          ON cmt.program_id = pgt.program_id
        INNER JOIN student_numbering_table AS snt
          ON es_base.student_number = snt.student_number
        INNER JOIN person_table AS pst
          ON snt.person_id = pst.person_id
        INNER JOIN dprtmnt_curriculum_table AS dct
          ON cmt.curriculum_id = dct.curriculum_id
        INNER JOIN dprtmnt_table AS dpt
          ON dct.dprtmnt_id = dpt.dprtmnt_id
        INNER JOIN student_status_table AS sst
          ON es_base.student_number = sst.student_number
         AND es_base.active_school_year_id = sst.active_school_year_id
        INNER JOIN year_level_table AS ylt
          ON sst.year_level_id = ylt.year_level_id
        LEFT JOIN (
          SELECT
            es2.student_number,
            es2.active_school_year_id,
            COUNT(es2.is_regular) AS reg_count,
            MIN(es2.is_regular) AS min_is_regular
          FROM enrolled_subject AS es2
          INNER JOIN dprtmnt_curriculum_table AS dct2
            ON es2.curriculum_id = dct2.curriculum_id
          ${regStatsTermJoin}
          ${regStatsWhereClause}
          GROUP BY es2.student_number, es2.active_school_year_id
        ) AS reg_stats
          ON es_base.student_number = reg_stats.student_number
         AND es_base.active_school_year_id = reg_stats.active_school_year_id
        LEFT JOIN (
          SELECT
            pick.student_number,
            pick.active_school_year_id,
            st_sec.description AS section_description,
            pt_sec.program_code AS section_program_code
          FROM (
            SELECT
              es_sec.student_number,
              es_sec.active_school_year_id,
              MIN(es_sec.department_section_id) AS department_section_id
            FROM enrolled_subject AS es_sec
            WHERE es_sec.department_section_id IS NOT NULL
              AND es_sec.department_section_id > 0
            GROUP BY es_sec.student_number, es_sec.active_school_year_id
          ) AS pick
          INNER JOIN dprtmnt_section_table AS dst_sec
            ON pick.department_section_id = dst_sec.id
          INNER JOIN section_table AS st_sec
            ON dst_sec.section_id = st_sec.id
          INNER JOIN curriculum_table AS cct_sec
            ON dst_sec.curriculum_id = cct_sec.curriculum_id
          INNER JOIN program_table AS pt_sec
            ON cct_sec.program_id = pt_sec.program_id
        ) AS student_section
          ON es_base.student_number = student_section.student_number
         AND es_base.active_school_year_id = student_section.active_school_year_id
      ORDER BY pst.last_name ASC, pst.first_name ASC, snt.student_number ASC
    `, queryParams);

      res.json(rows);
    } catch (error) {
      console.error("Error fetching curriculum data:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.get("/api/get_class_details/:userID", async (req, res) => {
    const { userID } = req.params;
    try {
      const query = `
      SELECT
        snt.student_number,
        es.status,
        es.is_regular,
        ct.course_unit,
        ct.lab_unit,
        pst.first_name,
        pst.middle_name,
        pst.last_name,
        pst.gender,
        pst.age,
        pt.program_code,
        st.description AS section_description,
        ct.course_id,
        ct.course_description,
        rt.room_description,
        tt.school_time_start,
        tt.school_time_end,
        rdt.description AS day,
        tt.department_section_id,
        ct.course_code,
        sy.year_id,
        sy.semester_id,
        yr.year_description AS current_year,
        yr.year_description + 1 AS next_year,
        smt.semester_description,
        dt.dprtmnt_name,
        yrlt.year_level_description
      FROM enrolled_subject AS es
      INNER JOIN student_numbering_table AS snt ON es.student_number = snt.student_number
      INNER JOIN person_table AS pst ON snt.person_id = pst.person_id
      INNER JOIN dprtmnt_section_table AS dst ON es.department_section_id = dst.id
      INNER JOIN section_table AS st ON dst.section_id = st.id
      INNER JOIN curriculum_table AS cct ON dst.curriculum_id = cct.curriculum_id
      INNER JOIN program_table AS pt ON cct.program_id = pt.program_id
      INNER JOIN course_table AS ct ON es.course_id = ct.course_id
      INNER JOIN active_school_year_table AS sy ON es.active_school_year_id = sy.id
      LEFT JOIN time_table AS tt
      ON tt.school_year_id = es.active_school_year_id
      AND tt.department_section_id = es.department_section_id
      AND tt.course_id = es.course_id
      INNER JOIN year_table AS yr ON sy.year_id = yr.year_id
      INNER JOIN semester_table AS smt ON sy.semester_id = smt.semester_id
      INNER JOIN room_day_table AS rdt ON tt.room_day = rdt.id
      INNER JOIN room_table AS rt ON tt.department_room_id = rt.room_id
      INNER JOIN dprtmnt_curriculum_table AS dct ON cct.curriculum_id = dct.curriculum_id
      INNER JOIN dprtmnt_table AS dt ON dct.dprtmnt_id = dt.dprtmnt_id
      LEFT JOIN student_status_table AS sst ON es.student_number = sst.student_number
      LEFT JOIN year_level_table AS yrlt ON sst.year_level_id = yrlt.year_level_id
    WHERE tt.professor_id = ?
    `;
      const [result] = await db3.query(query, [userID]);
      res.json(result);
    } catch (err) {
      console.error("Server Error: ", err);
      res.status(500).send({ message: "Internal Error", err });
    }
  });

  app.get("/api/faculty_masterlist_bootstrap/:userID", async (req, res) => {
    const { userID } = req.params;

    try {
      const [[activeYear]] = await db3.query(
        `
        SELECT sy.id AS school_year_id, sy.year_id, sy.semester_id
        FROM active_school_year_table AS sy
        WHERE sy.astatus = 1
        LIMIT 1
        `,
      );

      if (!activeYear) {
        return res.json({
          activeSchoolYear: null,
          courses: [],
          sections: [],
          classDetails: [],
        });
      }

      const [courses] = await db3.query(
        `
        SELECT DISTINCT
          tt.course_id,
          ct.course_description,
          ct.course_code,
          sy.year_id,
          sy.semester_id
        FROM time_table AS tt
          INNER JOIN course_table AS ct ON tt.course_id = ct.course_id
          INNER JOIN active_school_year_table AS sy ON tt.school_year_id = sy.id
        WHERE tt.professor_id = ?
          AND ct.office_duty = 0
          AND sy.id = ?
        ORDER BY ct.course_code ASC
        `,
        [userID, activeYear.school_year_id],
      );

      const firstCourseId = courses[0]?.course_id || null;
      const [sections] = firstCourseId
        ? await db3.query(
          `
            SELECT DISTINCT
              tt.department_section_id,
              ptbl.program_code,
              st.description AS section_description
            FROM time_table AS tt
              INNER JOIN dprtmnt_section_table AS dst ON tt.department_section_id = dst.id
              INNER JOIN curriculum_table AS ct ON dst.curriculum_id = ct.curriculum_id
              INNER JOIN section_table AS st ON dst.section_id = st.id
              INNER JOIN program_table AS ptbl ON ct.program_id = ptbl.program_id
            WHERE tt.professor_id = ?
              AND tt.course_id = ?
              AND tt.school_year_id = ?
            GROUP BY tt.department_section_id
            ORDER BY section_description
            `,
          [userID, firstCourseId, activeYear.school_year_id],
        )
        : [[]];

      const [classDetails] = await db3.query(
        `
        SELECT
          snt.student_number,
          es.status,
          es.is_regular,
          ct.course_unit,
          ct.lab_unit,
          pst.first_name,
          pst.middle_name,
          pst.last_name,
          pst.gender,
          pst.age,
          pt.program_code,
          st.description AS section_description,
          ct.course_id,
          ct.course_description,
          rt.room_description,
          tt.school_time_start,
          tt.school_time_end,
          rdt.description AS day,
          tt.department_section_id,
          ct.course_code,
          sy.year_id,
          sy.semester_id,
          yr.year_description AS current_year,
          yr.year_description + 1 AS next_year,
          smt.semester_description,
          dt.dprtmnt_name,
          yrlt.year_level_description
        FROM enrolled_subject AS es
          INNER JOIN student_numbering_table AS snt ON es.student_number = snt.student_number
          INNER JOIN person_table AS pst ON snt.person_id = pst.person_id
          INNER JOIN dprtmnt_section_table AS dst ON es.department_section_id = dst.id
          INNER JOIN section_table AS st ON dst.section_id = st.id
          INNER JOIN curriculum_table AS cct ON dst.curriculum_id = cct.curriculum_id
          INNER JOIN program_table AS pt ON cct.program_id = pt.program_id
          INNER JOIN course_table AS ct ON es.course_id = ct.course_id
          INNER JOIN active_school_year_table AS sy ON es.active_school_year_id = sy.id
          INNER JOIN year_table AS yr ON sy.year_id = yr.year_id
          INNER JOIN semester_table AS smt ON sy.semester_id = smt.semester_id
          LEFT JOIN time_table AS tt
            ON tt.school_year_id = es.active_school_year_id
            AND tt.department_section_id = es.department_section_id
            AND tt.course_id = es.course_id
            AND tt.professor_id = ?
          LEFT JOIN room_day_table AS rdt ON tt.room_day = rdt.id
          LEFT JOIN room_table AS rt ON tt.department_room_id = rt.room_id
          INNER JOIN dprtmnt_curriculum_table AS dct ON cct.curriculum_id = dct.curriculum_id
          INNER JOIN dprtmnt_table AS dt ON dct.dprtmnt_id = dt.dprtmnt_id
          LEFT JOIN student_status_table AS sst
            ON es.student_number = sst.student_number
            AND es.active_school_year_id = sst.active_school_year_id
          LEFT JOIN year_level_table AS yrlt ON sst.year_level_id = yrlt.year_level_id
        WHERE es.active_school_year_id = ?
          AND tt.professor_id = ?
        `,
        [userID, activeYear.school_year_id, userID],
      );

      res.json({
        activeSchoolYear: activeYear,
        courses,
        sections,
        classDetails,
      });
    } catch (err) {
      console.error("Faculty masterlist bootstrap error:", err);
      res.status(500).json({ message: "Internal Error", err });
    }
  });

  app.get(
    "/section_assigned_to/:userID/:selectedSchoolYear/:selectedSchoolSemester",
    async (req, res) => {
      const { userID, selectedSchoolYear, selectedSchoolSemester } = req.params;
      try {
        const [schoolYearRows] = await db3.execute(
          "SELECT id FROM active_school_year_table WHERE year_id = ? AND semester_id = ?",
          [selectedSchoolYear, selectedSchoolSemester],
        );
        if (schoolYearRows.length === 0) {
          return res
            .status(404)
            .json({ error: "Active school year not found" });
        }

        const selectedActiveSchoolYear = schoolYearRows[0].id;

        const [rows] = await db3.execute(
          `
      SELECT DISTINCT
		st.id AS section_id,
        st.description AS section_description,
        pgt.program_code
      FROM time_table t
      JOIN room_day_table d ON d.id = t.room_day
      INNER JOIN active_school_year_table asy ON t.school_year_id = asy.id
      INNER JOIN dprtmnt_section_table AS dst ON t.department_section_id = dst.id
      INNER JOIN section_table AS st ON dst.section_id = st.id
      INNER JOIN curriculum_table AS cct ON dst.curriculum_id = cct.curriculum_id
      INNER JOIN program_table AS pgt ON cct.program_id = pgt.program_id
      INNER JOIN prof_table AS pft ON t.professor_id = pft.prof_id
      WHERE t.professor_id = ? AND t.school_year_id = ?
    `,
          [userID, selectedActiveSchoolYear],
        );

        if (rows.length === 0) {
          return res.status(404).json({ error: "No Section data found" });
        }

        res.json(rows);
      } catch (error) {
        console.error("Error fetching curriculum data:", error);
        res.status(500).json({ error: "Database error" });
      }
    },
  );

  app.get(
    "/section_assigned_to/:userID/:courseID/:yearID/:semesterID",
    async (req, res) => {
      const { userID, courseID, yearID, semesterID } = req.params;

      try {
        const [rows] = await db3.execute(
          `
      SELECT DISTINCT
        t.department_section_id,
        st.description AS section_description,
        pgt.program_code
      FROM time_table t
      INNER JOIN active_school_year_table asy ON t.school_year_id = asy.id
      INNER JOIN dprtmnt_section_table dst ON t.department_section_id = dst.id
      INNER JOIN section_table st ON dst.section_id = st.id
      INNER JOIN curriculum_table cct ON dst.curriculum_id = cct.curriculum_id
      INNER JOIN program_table pgt ON cct.program_id = pgt.program_id
      INNER JOIN prof_table pft ON t.professor_id = pft.prof_id
      WHERE t.professor_id = ?
      AND t.course_id = ?
      AND asy.year_id = ?
      AND asy.semester_id = ?
    `,
          [userID, courseID, yearID, semesterID],
        );

        res.json(rows);
      } catch (error) {
        console.Error("Error:", error);
        res.status(500).json({ error: "Database Error" });
      }
    },
  );

  // Mark applicant schedule email state only.
  const markInterviewApplicantEmailSent = async (req, res) => {
    const { applicant_id } = req.params;

    try {
      const [result] = await db.execute(
        "UPDATE admission.interview_applicants SET email_sent = 1 WHERE applicant_id = ?",
        [applicant_id],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Applicant not found" });
      }

      res.json({ success: true, message: "Applicant email_sent updated to 1" });
    } catch (err) {
      console.error(" Error updating email_sent:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };

  app.put(
    "/interview_applicants/:applicant_id/email-sent",
    markInterviewApplicantEmailSent,
  );

  app.post("/api/send-email", async (req, res) => {
    const {
      to,
      subject,
      html,
      senderName,
      user_person_id,
      applicant_number,
      applicant_name,
      update_interview_status,
      interview_status_value,
      audit_actor_id,
      audit_actor_role,
      department_id,
      program_id,
    } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ message: "Missing required email fields (to, subject, html)." });
    }

    try {
      // ✅ Step 1: Resolve actor from user_accounts using person_id
      const [actorRows] = await db3.query(
        `SELECT role, employee_id, last_name, first_name, middle_name, email
       FROM user_accounts
       WHERE person_id = ?
       LIMIT 1`,
        [user_person_id]
      );

      const actor = actorRows[0];

      if (!actor) {
        return res.status(404).json({
          message: `User not found for person_id="${user_person_id}". Make sure you are logged in correctly.`,
        });
      }

      if (!actor.employee_id) {
        return res.status(400).json({
          message: `Your account (${actor.email || user_person_id}) has no employee_id. Contact your administrator.`,
        });
      }

      if (!department_id || !program_id) {
        return res.status(400).json({
          message: `Missing department_id or program_id in request. department_id="${department_id}", program_id="${program_id}".`,
        });
      }

      // ✅ Step 2: Get company short name
      const [[company]] = await db.query(
        "SELECT short_term FROM company_settings WHERE id = 1"
      );
      const shortTerm = company?.short_term || "EARIST";

      // ✅ Step 3: Find matching email template for this employee + department + program
      const [userEmailRows] = await db.query(
        `SELECT et.sender_name, etp.dprtmnt_id
       FROM email_template_employees ete
       INNER JOIN email_templates et ON ete.template_id = et.template_id
       INNER JOIN email_template_programs etp ON etp.template_id = et.template_id
       WHERE ete.employee_id = ?
         AND etp.dprtmnt_id = ?
         AND etp.program_id = ?
         AND et.is_active = 1
       ORDER BY et.updated_at DESC
       LIMIT 1`,
        [actor.employee_id, department_id, program_id]
      );

      const templateRow = userEmailRows[0];

      if (!templateRow) {
        return res.status(404).json({
          message: `No active email template found for employee_id="${actor.employee_id}", department_id="${department_id}", program_id="${program_id}". Please assign an email account to this employee for this program.`,
        });
      }

      // ✅ Step 4: Use sender from template (ignore frontend senderName)
      const senderEmail = templateRow.sender_name;
      const senderAccount = getSenderAccountForEmail(senderEmail);

      if (!senderAccount) {
        return res.status(400).json({
          message: `Sender email "${senderEmail}" is not configured in the server .env file (EMAIL_USER1–EMAIL_USER10). Please check your environment configuration.`,
        });
      }

      // ✅ Step 5: Get department name for display
      const [depRows] = await db3.query(
        `SELECT dprtmnt_name FROM dprtmnt_table WHERE dprtmnt_id = ?`,
        [templateRow.dprtmnt_id]
      );
      const depName = depRows[0]?.dprtmnt_name || "Department";

      // ✅ Step 6: Validate interview status value
      const nextInterviewStatus =
        update_interview_status
          ? interview_status_value === undefined || interview_status_value === null
            ? 1
            : Number(interview_status_value)
          : null;

      if (update_interview_status && ![0, 1].includes(nextInterviewStatus)) {
        return res.status(400).json({ message: "interview_status_value must be 0 or 1." });
      }

      // ✅ Step 7: Send the email
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: senderAccount,
      });

      await transporter.sendMail({
        from: `${shortTerm} - ${depName} <${senderAccount.user}>`,
        to,
        subject,
        html,
      });

      // ✅ Step 8: Update interview status if requested
      if (update_interview_status && applicant_number) {
        await db.query(
          `INSERT INTO person_status_table (person_id, applicant_id, interview_status)
         SELECT ant.person_id, ant.applicant_number, ?
         FROM applicant_numbering_table ant
         WHERE ant.applicant_number = ?
         ON DUPLICATE KEY UPDATE interview_status = VALUES(interview_status)`,
          [nextInterviewStatus, applicant_number]
        );
      }

      // ✅ Step 9: Audit log
      const safeActor = audit_actor_id || actor.employee_id || user_person_id || "unknown";
      const actorRole = audit_actor_role || actor.role || "registrar";
      const roleLabel = formatAuditActorRole(actorRole);

      let resolvedApplicantNumber = applicant_number || "N/A";
      let resolvedApplicantName = applicant_name || "";

      try {
        const [[applicantRow]] = await db.query(
          `SELECT ant.applicant_number, pt.first_name, pt.middle_name, pt.last_name
         FROM person_table pt
         LEFT JOIN applicant_numbering_table ant ON ant.person_id = pt.person_id
         WHERE pt.emailAddress = ? OR ant.applicant_number = ?
         LIMIT 1`,
          [to, applicant_number || ""]
        );

        if (applicantRow) {
          resolvedApplicantNumber = applicantRow.applicant_number || resolvedApplicantNumber;
          resolvedApplicantName = [
            applicantRow.first_name,
            applicantRow.middle_name,
            applicantRow.last_name,
          ]
            .filter(Boolean)
            .join(" ");
        }
      } catch (auditLookupErr) {
        console.error("Audit lookup failed (non-fatal):", auditLookupErr.message);
      }

      await insertAuditLogAdmission({
        actorId: safeActor,
        role: actorRole,
        action: "QUALIFYING_INTERVIEW_EMAIL_SENT",
        severity: "INFO",
        message: `${roleLabel} (${safeActor}) sent qualifying/interview acceptance email to Applicant #${resolvedApplicantNumber}${resolvedApplicantName ? ` - ${resolvedApplicantName}` : ""} (${to}). Subject: ${subject}.`,
      });

      return res.json({ success: true, message: "Email sent successfully." });

    } catch (err) {
      console.error("❌ /api/send-email error:", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to send email.",
      });
    }
  });

  app.get("/api/email-templates/active-senders", async (req, res) => {
    const { department_id, program_id, employee_id } = req.query;

    if (!department_id || !program_id || !employee_id) {
      return res.status(400).json({
        message: "department_id, program_id, and employee_id are required.",
      });
    }

    try {
      // ✅ Step 1: Try to find matching template directly with the given program_id
      // (program_id in admission.person_table may be a curriculum_id from enrollment db)
      // So we search email_template_programs.program_id using both the raw value
      // AND any matching curriculum_id from enrollment.curriculum_table

      // Get all curriculum_ids that match either as curriculum_id OR via program_id
      const [curriculumRows] = await db3.query(
        `SELECT curriculum_id FROM enrollment.curriculum_table
       WHERE curriculum_id = ? OR program_id = ?`,
        [program_id, program_id]
      );

      // Build list of all program_ids to search
      const allProgramIds = [String(program_id)];
      curriculumRows.forEach((r) => {
        const cid = String(r.curriculum_id);
        if (!allProgramIds.includes(cid)) {
          allProgramIds.push(cid);
        }
      });

      // ✅ Step 2: Search email_template_programs with all possible program_id values
      const placeholders = allProgramIds.map(() => "?").join(", ");

      const [rows] = await db.query(
        `SELECT et.sender_name, etp.dprtmnt_id, etp.program_id, et.template_id
       FROM email_template_employees ete
       INNER JOIN email_templates et ON ete.template_id = et.template_id
       INNER JOIN email_template_programs etp ON etp.template_id = et.template_id
       WHERE ete.employee_id = ?
         AND etp.dprtmnt_id = ?
         AND etp.program_id IN (${placeholders})
         AND et.is_active = 1
       ORDER BY et.updated_at DESC
       LIMIT 1`,
        [employee_id, department_id, ...allProgramIds]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          message: `No active email template found for employee_id="${employee_id}", department_id="${department_id}", searched program_ids=[${allProgramIds.join(",")}]`,
        });
      }

      res.json(rows);
    } catch (err) {
      console.error("❌ /api/email-templates/active-senders error:", err);
      res.status(500).json({ message: err.message || "Server error" });
    }
  });

  app.put("/api/interview_applicants/accept-top", async (req, res) => {
    const { count, dprtmnt_id } = req.body;

    // Validate inputs
    if (!count || isNaN(count) || count <= 0)
      return res.status(400).json({ message: "Invalid count" });
    if (!dprtmnt_id)
      return res.status(400).json({ message: "Missing department ID" });

    try {
      // 1  Select top applicants from status 0
      const [rows] = await db3.query(
        `SELECT ps.applicant_id
       FROM admission.person_status_table ps
       JOIN admission.interview_applicants ia ON ia.applicant_id = ps.applicant_id
       JOIN admission.applicant_numbering_table ant ON ant.applicant_number = ps.applicant_id
       JOIN admission.person_table p ON p.person_id = ant.person_id
       JOIN enrollment.dprtmnt_curriculum_table dct ON dct.curriculum_id = p.academicProgram
       WHERE ia.status = 0 AND dct.dprtmnt_id = ?
       ORDER BY ((ps.qualifying_result + ps.interview_result)/2) DESC
       LIMIT ?`,
        [Number(dprtmnt_id), Number(count)],
      );

      if (!rows.length)
        return res
          .status(404)
          .json({ message: "No applicants with status 0 found" });

      const ids = rows.map((r) => r.applicant_id);

      // 2  Update their status to 1
      const [updateResult] = await db3.query(
        `UPDATE admission.interview_applicants
       SET status = 1
       WHERE applicant_id IN (?)`,
        [ids],
      );

      res.json({
        message: `Updated ${ids.length} applicant status value(s) to 1 in department ${dprtmnt_id}`,
        updated: ids,
      });
    } catch (err) {
      console.error("Error accepting top applicants:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/college/persons", async (req, res) => {
    try {
      // STEP 1: Get all eligible persons (from ENROLLMENT DB)
      const [persons] = await db.execute(`
      SELECT p.*, SUBSTRING(a.applicant_number, 5, 1) AS middle_code, pt.*
      FROM admission.person_table p
      JOIN admission.person_status_table ps ON p.person_id = ps.person_id
      LEFT JOIN admission.applicant_numbering_table AS a
        ON p.person_id = a.person_id
      INNER JOIN enrollment.curriculum_table ct ON p.program = ct.curriculum_id
      INNER JOIN enrollment.program_table pt ON ct.program_id = pt.program_id
      WHERE ps.student_registration_status = 0 AND ps.exam_status = 1 AND ps.interview_status = 1
      AND NOT EXISTS (
        SELECT 1 
        FROM enrollment.person_table ep
        WHERE ep.emailAddress = p.emailAddress
      )
    `);

      if (persons.length === 0) return res.json([]);

      const personIds = persons.map((p) => p.person_id);

      // STEP 2: Get all applicant numbers for those person_ids (from ADMISSION DB)
      const [applicantNumbers] = await db.query(
        `
      SELECT applicant_number, person_id
      FROM applicant_numbering_table
      WHERE person_id IN (?)
    `,
        [personIds],
      );

      // Create a quick lookup map
      const applicantMap = {};
      for (let row of applicantNumbers) {
        applicantMap[row.person_id] = row.applicant_number;
      }

      // STEP 3: Merge applicant_number into each person object
      const merged = persons.map((person) => ({
        ...person,
        applicant_number: applicantMap[person.person_id] || null,
      }));

      res.json(merged);
    } catch (err) {
      console.error(" Error merging person + applicant ID:", err);
      res.status(500).send("Server error");
    }
  });

  app.put(
    "/update_profile_image/:person_id",
    profileUpload.single("profileImage"),
    async (req, res) => {
      const { person_id } = req.params;
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filename = req.file.filename;

      try {
        // Update DB (set filename to the same name we saved)
        const [result] = await db3.query(
          "UPDATE prof_table SET profile_image = ? WHERE person_id = ?",
          [filename, person_id],
        );

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: "Person not found" });
        }

        res.json({
          message: " Profile image updated successfully",
          filename,
        });
      } catch (err) {
        console.error(" DB Error:", err);
        res.status(500).json({ error: "Database update failed" });
      }
    },
  );

  // --------------------------------- FOR MIGRATION DATA PANEL

  //   Get interviewer schedules + applicants
  app.get("/api/interviewers", async (req, res) => {
    const { query = "", schedule } = req.query;

    try {
      const scheduleParams = [];
      const scheduleWhere = [];

      if (schedule) {
        scheduleWhere.push("schedule_id = ?");
        scheduleParams.push(schedule);
      } else {
        scheduleWhere.push("interviewer LIKE ?");
        scheduleParams.push(`%${query}%`);
      }

      // 1. Find schedules by clicked schedule id, or by interviewer search text.
      const [schedules] = await db.query(
        `SELECT * FROM interview_exam_schedule WHERE ${scheduleWhere.join(" AND ")}`,
        scheduleParams,
      );

      if (schedules.length === 0) {
        return res.json([]);
      }

      // 2. For each schedule, attach applicants
      const results = await Promise.all(
        schedules.map(async (sched) => {
          const [applicants] = await db.query(
            `
          SELECT
            ia.applicant_id AS applicant_number,
            ia.email_sent,
            ia.status,
            p.person_id,
            p.last_name,
            p.first_name,
            p.middle_name,
            p.program,
            s.interviewer,
            s.building_description,
            s.room_description,
            s.day_description,
            s.start_time,
            s.end_time
          FROM interview_applicants ia
          JOIN applicant_numbering_table an
            ON ia.applicant_id = an.applicant_number
          JOIN person_table p
            ON an.person_id = p.person_id
          JOIN interview_exam_schedule s
            ON ia.schedule_id = s.schedule_id
          WHERE ia.schedule_id = ?
            AND COALESCE(ia.email_sent, 0) = 1
          `,
            [sched.schedule_id],
          );

          return { schedule: sched, applicants };
        }),
      );

      res.json(results);
    } catch (err) {
      console.error(" Error in /interviewers:", err);
      res.status(500).send("Server error");
    }
  });

  // 09/26/2025

  // GET person details by student_number (Enrollment DB)
  app.get("/api/person_id/:student_number", async (req, res) => {
    try {
      const [rows] = await db3.query(
        `SELECT
         p.*,
         sn.student_number,
         p.program AS original_program,
         COALESCE(NULLIF(sst.active_curriculum, 0), p.program) AS current_program,
         asy.id AS active_school_year_id
       FROM student_numbering_table sn
       JOIN person_table p ON p.person_id = sn.person_id
       LEFT JOIN active_school_year_table asy ON asy.astatus = 1
       LEFT JOIN student_status_table sst
         ON sst.student_number = sn.student_number
        AND sst.active_school_year_id = asy.id
       WHERE sn.student_number = ?
       ORDER BY sst.id DESC
       LIMIT 1`,
        [req.params.student_number],
      );

      if (!rows.length) {
        return res.status(404).json({ message: "Person not found" });
      }

      const person = rows[0];
      person.program = person.current_program ?? person.original_program ?? person.program;
      res.json(person);
    } catch (err) {
      console.error("Error fetching person by student_number:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  //  NEW: Get persons (Enrollment DB) with student_number
  app.get("/api/enrollment_upload_documents", async (req, res) => {
    try {
      const [persons] = await db3.query(`
      SELECT
        p.person_id,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.profile_img,
        p.height,
        p.generalAverage,
        p.emailAddress,
        sn.student_number
      FROM person_table p
      LEFT JOIN student_numbering_table sn ON p.person_id = sn.person_id
    `);

      res.status(200).json(persons);
    } catch (error) {
      console.error(" Error fetching enrollment upload documents:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  //  Get person by person_id (Enrollment DB)
  // program = current-term curriculum from student_status_table (active SY)
  // original_program = person_table.program (never overwritten by course shift)
  app.get("/api/enrollment_person/:person_id", async (req, res) => {
    try {
      const [rows] = await db3.query(
        `
        SELECT
          pt.*,
          pt.program AS original_program,
          COALESCE(NULLIF(sst.active_curriculum, 0), pt.program) AS current_program,
          asy.id AS active_school_year_id,
          snt.student_number
        FROM person_table pt
        LEFT JOIN student_numbering_table snt ON snt.person_id = pt.person_id
        LEFT JOIN active_school_year_table asy ON asy.astatus = 1
        LEFT JOIN student_status_table sst
          ON sst.student_number = snt.student_number
         AND sst.active_school_year_id = asy.id
        WHERE pt.person_id = ?
        ORDER BY sst.id DESC
        LIMIT 1
        `,
        [req.params.person_id],
      );

      if (!rows.length) {
        return res.status(404).json({ message: "Person not found" });
      }

      const person = rows[0];
      person.program = person.current_program ?? person.original_program ?? person.program;
      res.json(person);
    } catch (err) {
      console.error("Error fetching enrollment person:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  //  Update person (Enrollment DB) safely
  app.put("/api/enrollment_person/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Remove person_id from payload
      delete updates.person_id;

      // If nothing left, just skip
      const fields = Object.keys(updates);
      if (fields.length === 0) {
        return res.json({ message: "No valid fields to update, skipping." });
      }

      // Build SET clause dynamically
      const setClause = fields.map((field) => `${field} = ?`).join(", ");
      const values = fields.map((field) => updates[field]);

      await db3.query(
        `UPDATE person_table SET ${setClause} WHERE person_id = ?`,
        [...values, id],
      );

      res.json({ message: "Enrollment person updated successfully" });
    } catch (err) {
      console.error(" Error updating enrollment person:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/student-person-data/:id", async (req, res) => {
    const { id } = req.params;

    try {
      const [rows] = await db3.query(
        `SELECT snt.student_number, pt.* FROM student_numbering_table AS snt
      LEFT JOIN person_table AS pt ON snt.person_id = pt.person_id
      WHERE pt.person_id = ?`,
        [id],
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Person not found" });
      }

      res.json(rows[0]);
    } catch (err) {
      console.error("Error fetching person data:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Add near your other GET routes in server.js

  // Get person_id by applicant_number
  app.get("/api/person-by-applicant/:applicant_number", async (req, res) => {
    const { applicant_number } = req.params;
    try {
      const [rows] = await db.query(
        "SELECT person_id FROM applicant_numbering_table WHERE applicant_number = ? LIMIT 1",
        [applicant_number],
      );
      if (!rows.length)
        return res.status(404).json({ message: "Applicant not found" });
      res.json({ person_id: rows[0].person_id });
    } catch (err) {
      console.error("Error fetching person by applicant:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  //WORKING
  app.get("/api/document_status/:applicant_number", async (req, res) => {
    const { applicant_number } = req.params;

    try {
      const [rows] = await db.query(
        `SELECT
         ru.document_status     AS upload_document_status,
         rt.id                  AS requirement_id,
         ua.email               AS evaluator_email,
         ua.role                AS evaluator_role,
         ua.employee_id         AS evaluator_employee_id,
         ua.first_name          AS evaluator_fname,
         ua.middle_name         AS evaluator_mname,
         ua.last_name           AS evaluator_lname,
         ru.created_at,
         ru.last_updated_by
       FROM applicant_numbering_table AS ant
       LEFT JOIN requirement_uploads AS ru
         ON ant.person_id = ru.person_id
       LEFT JOIN requirements_table AS rt
         ON ru.requirements_id = rt.id
       LEFT JOIN enrollment.user_accounts ua
         ON ru.last_updated_by = ua.person_id
       WHERE ant.applicant_number = ?
         AND rt.is_verifiable = 1
       ORDER BY ru.created_at DESC`,
        [applicant_number],
      );

      // 🟥 If no uploads found
      if (!rows || rows.length === 0) {
        return res.json({
          document_status: "On Process",
          evaluator: null,
        });
      }

      const statuses = rows.map((r) => r.upload_document_status);
      const latest = rows[0];

      // 🟡 Determine final document status
      let finalStatus = "On Process";
      if (statuses.every((s) => s === "Disapproved / Program Closed")) {
        finalStatus = "Disapproved / Program Closed";
      } else if (statuses.every((s) => s === "Documents Verified & ECAT")) {
        finalStatus = "Documents Verified & ECAT";
      }

      // 🟢 Build evaluator display name with employee ID
      // 🟢 Build evaluator display name with employee ID (no HTML tags)
      let actorEmail = null;
      let actorName = "Unknown - System";

      if (latest?.evaluator_email) {
        const role = latest.evaluator_role?.toUpperCase() || "UNKNOWN";
        const empId = latest.evaluator_employee_id
          ? `(${latest.evaluator_employee_id})`
          : "";
        const lname = latest.evaluator_lname || "";
        const fname = latest.evaluator_fname || "";
        const mname = latest.evaluator_mname || "";

        actorEmail = latest.evaluator_email;
        actorName = `${role} ${empId} - ${lname}, ${fname} ${mname}`.trim();
        latest.evaluator_display = `BY: ${actorName} (${actorEmail})`;
      } else {
        latest.evaluator_display = `BY: Unknown - System`;
      }

      return res.json({
        document_status: finalStatus,
        evaluator: latest,
      });
    } catch (err) {
      console.error(" Error fetching document status:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put("/api/document_status/:applicant_number", async (req, res) => {
    const { applicant_number } = req.params;
    const { document_status, user_id } = req.body;

    if (!document_status || !user_id) {
      return res
        .status(400)
        .json({ message: "document_status and user_id are required." });
    }

    try {
      // 1. Get person_id
      const [personRows] = await db.query(
        `SELECT pt.person_id
       FROM applicant_numbering_table ant
       INNER JOIN person_table pt
       ON ant.person_id = pt.person_id
       WHERE ant.applicant_number = ?`,
        [applicant_number],
      );

      if (personRows.length === 0) {
        return res.status(404).json({ message: "Applicant not found." });
      }

      const { person_id } = personRows[0];

      // ?? 2. IF VERIFIED ? FORCE ALL STATUS = 1
      if (document_status === "Documents Verified & ECAT") {
        await db.query(
          `UPDATE requirement_uploads
     SET status = 1,
         document_status = ?,
         last_updated_by = ?,
         verified_at = COALESCE(verified_at, NOW())
     WHERE person_id = ?`,
          [document_status, user_id, person_id],
        );
      }

      // ?? 3. IF DISAPPROVED ? FORCE ALL STATUS = 2
      else if (document_status === "Disapproved / Program Closed") {
        await db.query(
          `UPDATE requirement_uploads
         SET status = 2,
             document_status = ?,
             last_updated_by = ?
         WHERE person_id = ?`,
          [document_status, user_id, person_id],
        );
      }

      // ?? 4. ON PROCESS ? do not override row statuses
      else {
        await db.query(
          `UPDATE requirement_uploads
         SET document_status = ?,
             last_updated_by = ?
         WHERE person_id = ?`,
          [document_status, user_id, person_id],
        );
      }

      res.json({
        message: "? Document status + row statuses synced successfully.",
      });
    } catch (err) {
      console.error("Error updating document status:", err);
      res.status(500).json({ error: "Failed to update document status" });
    }
  });

  //  Dynamic: Check if applicant's required verifiable documents are verified
  app.get("/api/document_status/check/:applicant_number", async (req, res) => {
    const { applicant_number } = req.params;

    try {
      const [personResult] = await db.query(
        `
      SELECT pt.person_id, pt.applyingAs
      FROM applicant_numbering_table ant
      INNER JOIN person_table pt
        ON ant.person_id = pt.person_id
      WHERE ant.applicant_number = ?
      `,
        [applicant_number],
      );

      if (personResult.length === 0) {
        return res.status(404).json({ message: "Applicant not found" });
      }

      const { person_id, applyingAs } = personResult[0];

      const [reqRows] = await db.query(
        `
      SELECT id
      FROM requirements_table
      WHERE category = 'Main'
        AND is_verifiable = 1
        AND (
          applicant_type = ?
          OR applicant_type = '0'
          OR applicant_type = 0
          OR applicant_type = 'All'
        )
    `,
        [applyingAs],
      );

      if (reqRows.length === 0) {
        return res.json({
          verified: false,
          message: "No verifiable requirements found.",
        });
      }

      const requirementIds = reqRows.map((r) => r.id);
      const placeholders = requirementIds.map(() => "?").join(",");

      // 3️   Get applicant  s uploaded documents for those requirements
      const [docs] = await db.query(
        `
        SELECT requirements_id, document_status
        FROM requirement_uploads
        WHERE person_id = ? AND requirements_id IN (${placeholders})
      `,
        [person_id, ...requirementIds],
      );

      if (docs.length < requirementIds.length) {
        return res.json({
          verified: false,
          message: "Missing required documents.",
        });
      }

      // 4️   Check if all are  Documents Verified & ECAT
      const allVerified = docs.every(
        (d) => d.document_status === "Documents Verified & ECAT",
      );

      res.json({
        verified: allVerified,
        person_id,
        required_count: requirementIds.length,
        verified_count: docs.filter(
          (d) => d.document_status === "Documents Verified & ECAT",
        ).length,
      });
    } catch (err) {
      console.error("Error checking document status:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  //  GET registrar name (or any prof by role)
  app.get("/api/scheduled-by/:role", async (req, res) => {
    const { role } = req.params;

    try {
      const [rows] = await db3.query(
        `
      SELECT first_name, middle_name, last_name
      FROM user_accounts
      WHERE role = ?
      LIMIT 1
      `,
        [role],
      );

      if (!rows.length) {
        return res.status(404).json({ message: "No user found for that role" });
      }

      const { first_name, middle_name, last_name } = rows[0];
      const fullName =
        `${first_name || ""} ${middle_name ? middle_name + " " : ""}${last_name || ""}`.trim();

      res.json({ fullName });
    } catch (err) {
      console.error(" Error fetching user by role:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  //  Toggle submitted_medical (1 = checked, 0 = unchecked)
  app.put("/api/submitted-medical/:upload_id", async (req, res) => {
    const { upload_id } = req.params;
    const {
      submitted_medical,
      user_person_id,
      audit_actor_id,
      audit_actor_role,
    } = req.body;

    try {
      // 1  Find person_id
      const [[row]] = await db.query(
        "SELECT person_id, submitted_medical FROM requirement_uploads WHERE upload_id = ?",
        [upload_id],
      );
      if (!row) return res.status(404).json({ error: "Upload not found" });

      const person_id = row.person_id;
      const previousSubmittedMedical = Number(row.submitted_medical || 0);
      const nextSubmittedMedical = submitted_medical ? 1 : 0;

      // 2  Applicant info
      const [[appInfo]] = await db.query(
        `
      SELECT ant.applicant_number, pt.last_name, pt.first_name, pt.middle_name
      FROM applicant_numbering_table ant
      JOIN person_table pt ON ant.person_id = pt.person_id
      WHERE ant.person_id = ?
    `,
        [person_id],
      );

      const applicant_number = appInfo?.applicant_number || "Unknown";
      const fullName = `${appInfo?.last_name || ""}, ${appInfo?.first_name || ""} ${appInfo?.middle_name?.charAt(0) || ""}.`;

      // 3  Update submitted_medical
      await db.query(
        "UPDATE requirement_uploads SET submitted_medical = ? WHERE person_id = ?",
        [nextSubmittedMedical, person_id],
      );

      // 4  Create message
      const type = submitted_medical ? "submit_medical" : "unsubmit_medical";
      const action = submitted_medical
        ? " Medical submitted"
        : " Medical unsubmitted";
      const message = `${action} (Applicant #${applicant_number} - ${fullName})`;

      //  Full actor info (same as exam/save)
      let actorEmail = "earistmis@gmail.com";
      let actorName = "SYSTEM";
      let auditActorId =
        audit_actor_id ||
        req.headers["x-audit-actor-id"] ||
        user_person_id ||
        "unknown";
      let auditActorRole =
        audit_actor_role || req.headers["x-audit-actor-role"] || "";

      if (user_person_id) {
        const [actorRows] = await db3.query(
          `SELECT email, role, employee_id, last_name, first_name, middle_name
         FROM user_accounts
         WHERE person_id = ?
         LIMIT 1`,
          [user_person_id],
        );

        if (actorRows.length > 0) {
          const u = actorRows[0];
          const role = u.role?.toUpperCase() || "UNKNOWN";
          const empId = u.employee_id || "";
          const lname = u.last_name || "";
          const fname = u.first_name || "";
          const mname = u.middle_name || "";
          const email = u.email || "";

          actorEmail = email;
          actorName = `${role} (${empId}) - ${lname}, ${fname} ${mname}`.trim();
          auditActorId =
            auditActorId === user_person_id
              ? empId || email || user_person_id
              : auditActorId;
          auditActorRole = auditActorRole || u.role || "registrar";
        }
      }
      auditActorRole = auditActorRole || "registrar";

      if (previousSubmittedMedical !== nextSubmittedMedical) {
        const roleLabel = formatAuditActorRole(auditActorRole);
        await insertAuditLogAdmission({
          actorId: auditActorId,
          role: auditActorRole,
          action: nextSubmittedMedical
            ? "MEDICAL_DOCUMENTS_SUBMIT"
            : "MEDICAL_DOCUMENTS_UNSUBMIT",
          severity: "INFO",
          message: `${roleLabel} (${auditActorId}) marked submitted medical documents of Applicant (${applicant_number}) as ${nextSubmittedMedical ? "submitted" : "unsubmitted"}.`,
        });
      }

      res.json({ success: true, message });
    } catch (err) {
      console.error(" Error toggling submitted medical:", err);
      res.status(500).json({ error: "Failed to toggle submitted medical" });
    }
  });

  app.get("/api/requirements", async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT id, description, short_label, label, category, is_verifiable, is_optional, applicant_type
       FROM requirements_table
       ORDER BY id ASC`,
      );
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch requirements" });
    }
  });

  app.get("/api/program_evaluation/:student_number", async (req, res) => {
    const { student_number } = req.params;

    try {
      const [rows] = await db3.query(
        `
        SELECT DISTINCT
          pt.gender, pt.birthOfDate, pt.campus, pt.schoolLastAttended1, pt.yearGraduated1, rt.id AS requirements, pt.last_name, pt.first_name, pt.schoolLastAttended, pt.profile_img AS profile_image, pt.yearGraduated - 1 AS previous_year, pt.yearGraduated, pt.middle_name, pgt.program_code, pgt.major, yt.year_description, pgt.program_description, snt.student_number, dpt.dprtmnt_name FROM enrolled_subject AS es
        LEFT JOIN student_numbering_table AS snt ON es.student_number = snt.student_number
        LEFT JOIN person_table AS pt ON snt.person_id = pt.person_id
        LEFT JOIN curriculum_table AS cct ON es.curriculum_id = cct.curriculum_id
       LEFT JOIN program_table AS pgt ON cct.program_id = pgt.program_id
        LEFT JOIN year_table AS yt ON cct.year_id = yt.year_id
        LEFT JOIN dprtmnt_curriculum_table AS dct ON cct.curriculum_id = dct.curriculum_id
        LEFT JOIN dprtmnt_table AS dpt ON dct.dprtmnt_id = dpt.dprtmnt_id
        LEFT JOIN requirement_uploads AS ru ON pt.person_id = ru.person_id
        LEFT JOIN requirements_table AS rt ON ru.requirements_id = rt.id
        WHERE es.student_number = ?;
      `,
        [student_number],
      );

      if (rows.length === 0) {
        return res.status(404).send({ message: "Student is not found" });
      }

      const studentInfo = {
        ...rows[0], // keep the first row s data
        requirements: [
          ...new Set(rows.map((r) => r.requirements).filter(Boolean)),
        ],
      };

      res.json(studentInfo);
    } catch (error) {
      res.status(500).send({ message: "Database/Server Error", error });
    }
  });

  app.get("/api/registrar-users", async (req, res) => {
    try {
      const requestedPageId = Number(req.query.pageId);

      const parsePageIds = (value) => {
        if (!value) return [];

        try {
          const parsed = Array.isArray(value) ? value : JSON.parse(value);
          return parsed
            .filter(
              (entry) =>
                typeof entry !== "object" ||
                entry === null ||
                Number(entry.page_privilege ?? entry.access ?? 1) === 1,
            )
            .map((entry) =>
              Number(
                typeof entry === "object" && entry !== null
                  ? (entry.page_id ?? entry.pageId ?? entry.id)
                  : entry,
              ),
            )
            .filter((pageId) => Number.isInteger(pageId));
        } catch (error) {
          console.error("Error parsing page access:", error);
          return [];
        }
      };

      const [users] = await db3.query(`
      SELECT
        ua.id,
        ua.person_id,
        ua.employee_id,
        ua.last_name,
        ua.middle_name,
        ua.first_name,
        ua.role,
        ua.email,
        ua.status,
        ua.access_level,
        at.access_id,
        at.access_description,
        at.access_page,
        GROUP_CONCAT(DISTINCT pa.page_id ORDER BY pa.page_id ASC) AS assigned_page_ids
      FROM user_accounts ua
      LEFT JOIN access_table at
        ON ua.access_level = at.access_id
      LEFT JOIN page_access pa
        ON pa.user_id = ua.employee_id
      WHERE ua.role = 'registrar'
      GROUP BY
        ua.id,
        ua.person_id,
        ua.employee_id,
        ua.last_name,
        ua.middle_name,
        ua.first_name,
        ua.role,
        ua.email,
        ua.status,
        ua.access_level,
        at.access_id,
        at.access_description,
        at.access_page
      ORDER BY ua.first_name ASC, ua.last_name ASC
    `);

      const registrars = users
        .map((user) => {
          const accessTablePages = parsePageIds(user.access_page);
          const assignedPageIds = (user.assigned_page_ids || "")
            .split(",")
            .map((pageId) => Number(pageId))
            .filter((pageId) => Number.isInteger(pageId));

          return {
            ...user,
            access_page: accessTablePages,
            assigned_page_ids: assignedPageIds,
          };
        })
        .filter((user) => {
          if (!Number.isInteger(requestedPageId)) return true;

          return (
            user.access_page.includes(requestedPageId) ||
            user.assigned_page_ids.includes(requestedPageId)
          );
        });

      res.json({ registrars });
    } catch (error) {
      console.error("Error fetching registrar users:", error);
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    }
  });

  app.get("/api/my_schedule/:prof_id", async (req, res) => {
    const { prof_id } = req.params;
    try {
      const sql = `
    SELECT rdt.description, rt.room_description, tt.school_time_start, tt.school_time_end, ct.course_code, pgt.program_code, st.description AS section  FROM time_table AS tt
    LEFT JOIN room_day_table AS rdt ON tt.room_day = rdt.id
    LEFT JOIN room_table AS rt ON tt.department_room_id = rt.room_id
    LEFT JOIN course_table AS ct ON tt.course_id = ct.course_id
    LEFT JOIN active_school_year_table AS sy ON tt.school_year_id = sy.id
    LEFT JOIN dprtmnt_section_table AS dst ON tt.department_section_id = dst.id
    LEFT JOIN curriculum_table AS cct ON dst.curriculum_id = cct.curriculum_id
    LEFT JOIN program_table AS pgt ON cct.program_id = pgt.program_id
    LEFT JOIN section_table AS st ON dst.section_id = st.id
    WHERE tt.professor_id = ? AND sy.astatus = 1;`;
      const [rows] = await db3.query(sql, [prof_id]);

      res.json(rows);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Internal Server Error" });
    }
  });

  app.get(
    "/api/program_evaluation/details/:student_number",
    async (req, res) => {
      const { student_number } = req.params;

      try {
        const [rows] = await db3.query(
          `
        SELECT
          es.id as enrolled_id,
          es.final_grade,
          es.component,
          ct.course_code,
          st.description as section,
          ct.course_description,
          ct.course_unit,
          ct.lab_unit,
          smt.semester_description,
          smt.semester_id,
          sy.id as school_year,
          ct.course_id,
          yt.year_description as current_year,
          yt.year_id,
          pgt.program_code,
          pgt.major,
          pgt.program_description,
          es.en_remarks,
          yt.year_description + 1 as next_year
        FROM enrolled_subject AS es
          LEFT JOIN course_table AS ct ON es.course_id = ct.course_id
          LEFT JOIN active_school_year_table AS sy ON es.active_school_year_id = sy.id
          LEFT JOIN dprtmnt_section_table AS dst ON es.department_section_id = dst.id
          LEFT JOIN section_table AS st ON dst.section_id = st.id
          LEFT JOIN curriculum_table AS cct ON dst.curriculum_id = cct.curriculum_id
          LEFT JOIN program_table AS pgt ON cct.program_id = pgt.program_id
          LEFT JOIN semester_table AS smt ON sy.semester_id = smt.semester_id
          LEFT JOIN year_table AS yt ON sy.year_id = yt.year_id
        WHERE es.student_number= ?;
    `,
          [student_number],
        );

        if (rows.length === 0) {
          return res.status(404).send({ message: "Student Data is not found" });
        }

        res.json(rows);
      } catch (err) {
        res.status(500).send({ message: "Student Data is not found" });
      }
    },
  );

  //  Upload and update registrar profile picture
  app.put(
    "/update_profile_image/:person_id",
    upload.single("profileImage"),
    async (req, res) => {
      const { person_id } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      try {
        //  Save filename in db3.user_accounts
        const [result] = await db3.query(
          `UPDATE user_accounts
       SET profile_picture = ?
       WHERE person_id = ?`,
          [file.filename, person_id],
        );

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: "User not found" });
        }

        res.json({
          success: true,
          message: "Profile picture updated successfully.",
          filename: file.filename,
        });
      } catch (err) {
        console.error(" Error updating profile picture:", err);
        res.status(500).json({ error: "Failed to update profile picture" });
      }
    },
  );

  app.get("/api/applicant-status/:applicant_id", async (req, res) => {
    const { applicant_id } = req.params;
    try {
      const [rows] = await db.query(
        "SELECT status FROM interview_applicants WHERE applicant_id = ? LIMIT 1",
        [applicant_id],
      );

      if (rows.length === 0) {
        return res.json({ found: false, message: "Applicant not found" });
      }

      res.json({ found: true, status: rows[0].status });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Database error" });
    }
  });

  app.get("/api/applicant-scores/:applicant_number", async (req, res) => {
    const { applicant_number } = req.params;

    const resolveProfileResultStatus = (status, { scheduleId, resultScore } = {}) => {
      if (status === null || status === undefined) return null;

      const numericStatus = Number(status);
      if (Number.isNaN(numericStatus)) return null;

      // Failed is only set intentionally by staff.
      if (numericStatus === 1) return 1;

      // Passed (0) should not appear until interview/qualifying progress exists.
      if (numericStatus === 0) {
        const hasProgress =
          scheduleId !== null &&
          scheduleId !== undefined &&
          String(scheduleId).trim() !== "" ||
          Number(resultScore) > 0;

        return hasProgress ? 0 : null;
      }

      return null;
    };

    try {
      // Get person_id
      const [personRow] = await db.query(
        "SELECT person_id FROM applicant_numbering_table WHERE applicant_number = ? LIMIT 1",
        [applicant_number],
      );

      if (!personRow.length) {
        return res.status(404).json({ message: "Applicant not found" });
      }

      const person_id = personRow[0].person_id;

      const [examRow] = await db.query(
        `
        SELECT er.status, er.total_score, ea.schedule_id, ea.email_sent
        FROM exam_results er
        LEFT JOIN exam_applicants ea ON ea.applicant_id = ?
        WHERE er.person_id = ?
        LIMIT 1
        `,
        [applicant_number, person_id],
      );

      let entrance_exam_status = null;
      if (
        examRow.length &&
        examRow[0].status !== null &&
        examRow[0].status !== undefined
      ) {
        const examStatus = Number(examRow[0].status);
        const hasExamProgress =
          examRow[0].schedule_id != null ||
          Number(examRow[0].email_sent) === 1 ||
          Number(examRow[0].total_score) > 0;

        if (examStatus === 1 || hasExamProgress) {
          entrance_exam_status = examRow[0].status;
        }
      }

      const [statusRow] = await db.query(
        `
        SELECT
          pst.qualifying_result,
          pst.interview_result,
          ia.qualifying_status,
          ia.interview_status,
          ia.schedule_id
        FROM person_status_table pst
        LEFT JOIN interview_applicants ia
          ON ia.applicant_id = ?
        WHERE pst.person_id = ?
        LIMIT 1
        `,
        [applicant_number, person_id],
      );

      const row = statusRow[0];

      const qualifying_result = row ? row.qualifying_result : null;
      const interview_result = row ? row.interview_result : null;

      res.json({
        entrance_exam_status,
        qualifying_result,
        interview_result,
        qualifying_status: row
          ? resolveProfileResultStatus(row.qualifying_status, {
            scheduleId: row.schedule_id,
            resultScore: row.qualifying_result,
          })
          : null,
        interview_status: row
          ? resolveProfileResultStatus(row.interview_status, {
            scheduleId: row.schedule_id,
            resultScore: row.interview_result,
          })
          : null,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error fetching scores" });
    }
  });

  app.get("/api/applicant-has-score/:applicant_number", async (req, res) => {
    const { applicant_number } = req.params;

    try {
      const [rows] = await db.query(
        "SELECT * FROM applicant_numbering_table WHERE applicant_number = ? LIMIT 1",
        [applicant_number],
      );

      if (rows.length > 0) {
        res.json({ hasScore: true, score: rows[0] });
      } else {
        res.json({ hasScore: false });
      }
    } catch (err) {
      console.error("Error checking applicant score:", err);
      res.status(500).json({ message: "Database error" });
    }
  });

  //  CHECK IF APPLICANT IS QUALIFIED FOR INTERVIEW / QUALIFYING EXAM (NO PASSING SCORE)
  app.get(
    "/applicant-qualified-interview/:applicant_number",
    async (req, res) => {
      const { applicant_number } = req.params;

      try {
        // 1  Get person_id from applicant_numbering_table
        const [personRows] = await db.query(
          "SELECT person_id FROM applicant_numbering_table WHERE applicant_number = ? LIMIT 1",
          [applicant_number],
        );

        if (personRows.length === 0) {
          return res
            .status(404)
            .json({ qualified: false, message: "Applicant not found." });
        }

        const person_id = personRows[0].person_id;

        // 2  Check if applicant has exam record in
        const [examRows] = await db.query(
          "SELECT final_rating FROM exam_results WHERE person_id = ? LIMIT 1",
          [person_id],
        );

        if (examRows.length === 0) {
          return res.json({
            qualified: false,
            message:
              " Applicant has no entrance exam score yet  not qualified for interview.",
          });
        }

        // 3  If applicant has any exam record, they are qualified
        const finalRating = examRows[0].final_rating;

        res.json({
          qualified: true,
          person_id,
          final_rating: finalRating,
          message:
            " Applicant is qualified to take the Qualifying / Interview Exam.",
        });
      } catch (err) {
        console.error("Error checking interview qualification:", err);
        res.status(500).json({
          qualified: false,
          message: "Server error while checking qualification.",
        });
      }
    },
  );

  //  Fetch Qualifying, Interview, and Exam Results by Person ID
  app.get("/api/person_status/:person_id", async (req, res) => {
    const { person_id } = req.params;

    try {
      const [rows] = await db.query(
        `
      SELECT qualifying_result, interview_result, exam_result
      FROM person_status_table
      WHERE person_id = ?
      LIMIT 1
      `,
        [person_id],
      );

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ message: "No status record found for this person" });
      }

      res.json(rows[0]);
    } catch (err) {
      console.error(" Error fetching person_status:", err);
      res.status(500).json({ message: "Database error" });
    }
  });

  app.get("/api/get_prof_data/:id", async (req, res) => {
    const id = req.params.id;

    const query = `
    SELECT pt.prof_id, pt.person_id, pt.profile_image, pt.email, pt.fname, pt.mname, pt.lname, pt.employee_id FROM prof_table AS pt
    WHERE pt.person_id = ?
  `;

    try {
      const [rows] = await db3.query(query, [id]);
      res.json(rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/get_prof_data_by_prof/:prof_id", async (req, res) => {
    const { prof_id } = req.params;

    const query = `
    SELECT pt.prof_id, pt.person_id, pt.profile_image, pt.email, pt.fname, pt.mname, pt.lname, pt.employee_id FROM prof_table AS pt
    WHERE pt.prof_id = ?
  `;

    try {
      const [rows] = await db3.query(query, [prof_id]);
      res.json(rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/get_prof_data_by_employee/:employee_id", async (req, res) => {
    const { employee_id } = req.params;

    const query = `
    SELECT pt.prof_id, pt.person_id, pt.profile_image, pt.email, pt.fname, pt.mname, pt.lname, pt.employee_id FROM prof_table AS pt
    WHERE pt.employee_id = ?
  `;

    try {
      const [rows] = await db3.query(query, [employee_id]);
      res.json(rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // UPDATED

  app.post("/api/insert-logs/faculty/:prof_id", async (req, res) => {
    const { prof_id } = req.params;
    const { message, type } = req.body;

    try {
      const [professorData] = await db3.query(
        "SELECT * FROM prof_table WHERE prof_id = ?",
        [prof_id],
      );

      if (professorData === 0) {
        res.status(400).send({ message: "No Data found" });
      }

      const prof = professorData[0];
      const profID = prof.prof_id;
      const fullName = `${prof.lname}, ${prof.fname} ${prof.mname}`;
      const email = prof.email;

      res.json({ success: true, message: "Log skipped" });
    } catch (err) {
      console.error("Error handling faculty log:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/verification-status/:applicant_number", async (req, res) => {
    const { applicant_number } = req.params;

    try {
      //  Step 1: Get person_id from applicant_number
      const [personRows] = await db.query(
        `
      SELECT pt.person_id, pt.applyingAs
      FROM applicant_numbering_table ant
      INNER JOIN person_table pt
        ON ant.person_id = pt.person_id
      WHERE ant.applicant_number = ?
      `,
        [applicant_number],
      );
      if (personRows.length === 0) {
        return res.json({ verified: false, reason: "Applicant not found" });
      }

      const { person_id: personId, applyingAs } = personRows[0];

      //  Step 2: Count how many verifiable requirements exist
      const [requirements] = await db.query(
        `
      SELECT COUNT(*) AS total_required
      FROM requirements_table
      WHERE is_verifiable = 1
        AND applicant_type = ?
      `,
        [applyingAs],
      );
      const totalRequired = requirements[0]?.total_required || 0;

      //  Step 3: Count how many of those requirements were submitted & verified
      const [verifiedUploads] = await db.query(
        `
      SELECT COUNT(DISTINCT requirements_id) AS total_verified
      FROM requirement_uploads
      WHERE person_id = ?
      AND document_status = 'Documents Verified & ECAT'
      `,
        [personId],
      );
      const totalVerified = verifiedUploads[0]?.total_verified || 0;

      //  Step 4: Check if applicant has an exam schedule
      const [schedule] = await db.query(
        `
      SELECT ees.*
      FROM exam_applicants ea
      JOIN entrance_exam_schedule ees ON ea.schedule_id = ees.schedule_id
      WHERE ea.applicant_id = ?
      `,
        [applicant_number],
      );
      const hasSchedule = schedule.length > 0;

      //  Step 5: Determine if verified
      const fullyVerified = totalVerified >= totalRequired && hasSchedule;

      res.json({
        verified: fullyVerified,
        totalRequired,
        totalVerified,
        hasSchedule,
      });
    } catch (error) {
      console.error("Error checking applicant verification:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/student_data_as_applicant/:id", async (req, res) => {
    const { id } = req.params;

    try {
      const [[person]] = await db3.query(
        `
      SELECT *
      FROM enrollment.person_table
      WHERE person_id = ?
      `,
        [id],
      );

      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }

      // Get latest document status + evaluator
      const [rows] = await db3.query(
        `
      SELECT
        ru.document_status AS upload_document_status,
        rt.id AS requirement_id,
        ua.email AS evaluator_email,
        ua.role AS evaluator_role,
        ua.first_name AS evaluator_fname,
        ua.middle_name AS evaluator_mname,
        ua.last_name AS evaluator_lname,
        ru.created_at,
        ru.last_updated_by
      FROM enrollment.requirement_uploads AS ru
      LEFT JOIN enrollment.requirements_table AS rt 
        ON ru.requirements_id = rt.id
      LEFT JOIN enrollment.user_accounts ua 
        ON ru.last_updated_by = ua.person_id
      WHERE ru.person_id = ?
      ORDER BY ru.created_at DESC
      `,
        [person.person_id],
      );

      if (rows.length > 0) {
        person.document_status = rows[0].upload_document_status || "On process";
        person.evaluator = rows[0];
      } else {
        person.document_status = "On process";
        person.evaluator = null;
      }

      res.json(person);
    } catch (err) {
      console.error(" Error fetching person_with_applicant:", err);
      res.status(500).json({ error: "Failed to fetch person" });
    }
  });

  //  UPDATE person_table in ENROLLMENT DB3
  app.put("/api/enrollment_person/:person_id", async (req, res) => {
    try {
      const { person_id } = req.params;
      const updateData = req.body;

      if (!person_id) {
        return res.status(400).json({ error: "Missing person_id" });
      }

      if (!updateData || Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No update data provided" });
      }

      // Remove unsafe fields if present
      delete updateData.person_id;
      delete updateData.created_at;
      delete updateData.current_step;

      // Build dynamic SET fields
      const fields = Object.keys(updateData)
        .map((field) => `${field} = ?`)
        .join(", ");

      const values = Object.values(updateData);

      // Execute update query
      const query = `
            UPDATE person_table
            SET ${fields}
            WHERE person_id = ?
        `;

      values.push(person_id);

      const [result] = await db3.query(query, values);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Person not found" });
      }

      return res.json({
        message: "Person updated successfully",
        updated: updateData,
      });
    } catch (error) {
      console.error(" Error updating enrollment person:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/uploads/by-student/:student_number", async (req, res) => {
    const student_number = req.params.student_number;

    try {
      const [personResult] = await db3.query(
        "SELECT person_id FROM student_numbering_table WHERE student_number = ?",
        [student_number],
      );

      if (personResult.length === 0) {
        return res.status(404).json({ message: "Applicant not found" });
      }

      const person_id = personResult[0].person_id;

      const [uploads] = await db3.query(
        `
      SELECT
        ru.upload_id,
        ru.requirements_id,
        ru.person_id,
        ru.file_path,
        ru.original_name,
        ru.remarks,
        ru.status,
        ru.document_status,
        ru.registrar_status,
        ru.created_at,
        rt.description,
        rt.short_label,
        ua.email AS evaluator_email,
        ua.role  AS evaluator_role,
        pr.lname AS evaluator_lname,
        pr.fname AS evaluator_fname,
        pr.mname AS evaluator_mname
      FROM requirement_uploads ru
      JOIN requirements_table rt
        ON ru.requirements_id = rt.id
      LEFT JOIN user_accounts ua
        ON ru.last_updated_by = ua.person_id
      WHERE ru.person_id = ?;
    `,
        [person_id],
      );

      res.status(200).json(uploads);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error", error: err });
    }
  });

  app.get("/api/document_status/:student_number", async (req, res) => {
    const { student_number } = req.params;

    try {
      const [rows] = await db3.query(
        `SELECT
         ru.document_status     AS upload_document_status,
         rt.id                  AS requirement_id,
         ua.email               AS evaluator_email,
         ua.role                AS evaluator_role,
         ua.employee_id         AS evaluator_employee_id,
         ua.first_name          AS evaluator_fname,
         ua.middle_name         AS evaluator_mname,
         ua.last_name           AS evaluator_lname,
         ru.created_at,
         ru.last_updated_by
       FROM student_numbering_table AS snt
       LEFT JOIN requirement_uploads AS ru ON snt.person_id = ru.person_id
       LEFT JOIN requirements_table AS rt ON ru.requirements_id = rt.id
       LEFT JOIN enrollment.user_accounts ua ON ru.last_updated_by = ua.person_id
       WHERE snt.student_number = ? AND rt.is_verifiable = 1
       ORDER BY ru.created_at DESC`,
        [student_number],
      );

      //   If no uploads found
      if (!rows || rows.length === 0) {
        return res.json({
          document_status: "On Process",
          evaluator: null,
        });
      }

      const statuses = rows.map((r) => r.upload_document_status);
      const latest = rows[0];

      //    Determine final document status
      let finalStatus = "On Process";
      if (statuses.every((s) => s === "Disapproved / Program Closed")) {
        finalStatus = "Disapproved / Program Closed";
      } else if (statuses.every((s) => s === "Documents Verified & ECAT")) {
        finalStatus = "Documents Verified & ECAT";
      }

      //    Build evaluator display name with employee ID
      //    Build evaluator display name with employee ID (no HTML tags)
      let actorEmail = null;
      let actorName = "Unknown - System";

      if (latest?.evaluator_email) {
        const role = latest.evaluator_role?.toUpperCase() || "UNKNOWN";
        const empId = latest.evaluator_employee_id
          ? `(${latest.evaluator_employee_id})`
          : "";
        const lname = latest.evaluator_lname || "";
        const fname = latest.evaluator_fname || "";
        const mname = latest.evaluator_mname || "";

        actorEmail = latest.evaluator_email;
        actorName = `${role} ${empId} - ${lname}, ${fname} ${mname}`.trim();
        latest.evaluator_display = `BY: ${actorName} (${actorEmail})`;
      }

      return res.json({
        document_status: finalStatus,
        evaluator: latest,
      });
    } catch (err) {
      console.error(" Error fetching document status:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/student_upload_documents_data", async (req, res) => {
    try {
      const [persons] = await db3.query(`
      SELECT
        pt.person_id,
        pt.first_name,
        pt.middle_name,
        pt.last_name,
        pt.profile_img,
        pt.height,
        pt.generalAverage1,
        pt.emailAddress,
        snt.student_number
      FROM person_table pt
      LEFT JOIN student_numbering_table snt ON pt.person_id = snt.person_id
    `);

      res.status(200).json(persons);
    } catch (error) {
      console.error(" Error fetching upload documents:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete("/api/admin/uploads/:uploadId", async (req, res) => {
    const { uploadId } = req.params;

    try {
      // 1  Get upload row (file + person_id)
      const [uploadRows] = await db3.query(
        "SELECT person_id, file_path FROM requirement_uploads WHERE upload_id = ?",
        [uploadId],
      );
      if (!uploadRows.length) {
        return res.status(404).json({ error: "Upload not found." });
      }

      const { person_id: personId, file_path: filePath } = uploadRows[0];

      // 2  Student info
      const [[appInfo]] = await db3.query(
        `
      SELECT snt.student_number, pt.last_name, pt.first_name, pt.middle_name
      FROM student_numbering_table snt
      LEFT JOIN person_table pt ON snt.person_id = pt.person_id
      WHERE snt.person_id = ?;
    `,
        [personId],
      );

      const student_number = appInfo?.student_number || "Unknown";
      const fullName = `${appInfo?.last_name || ""}, ${appInfo?.first_name || ""} ${appInfo?.middle_name?.charAt(0) || ""}.`;

      // 3  Actor (admin performing the action)
      const user_person_id = req.headers["x-person-id"];
      const { actorEmail, actorName } = await getActorInfo(user_person_id);

      // 4  Delete physical file
      if (filePath) {
        const fullPath = path.join(applicantDocsDir, filePath);

        try {
          await fs.promises.unlink(fullPath);
        } catch (err) {
          if (err.code === "ENOENT") {
            console.warn("   File already missing:", fullPath);
          } else {
            console.error("File delete error:", err);
          }
        }
      }

      // 5  Delete DB record
      await db.query("DELETE FROM requirement_uploads WHERE upload_id = ?", [
        uploadId,
      ]);

      res.status(200).json({ message: " Upload deleted successfully." });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ error: "Failed to delete the upload." });
    }
  });

  // app.get("/api/get_applicant_account_id/:person_id", async (req, res) => {
  //   const { person_id } = req.params;
  //   try {
  //     const [rows] = await db.query(
  //       "SELECT user_id FROM user_accounts WHERE person_id = ? LIMIT 1",
  //       [person_id]
  //     );
  //     if (rows.length === 0) return res.status(404).json({ message: "User not found" });
  //     res.json({ user_account_id: rows[0].user_id });
  //   } catch (err) {
  //     console.error(" Error fetching user_account_id:", err);
  //     res.status(500).json({ error: "Internal Server Error" });
  //   }
  // });

  app.post(
    "/update_applicant/:user_id",
    profileUpload.single("profile_picture"),
    async (req, res) => {
      const { user_id } = req.params;
      const data = req.body;
      const file = req.file;

      try {
        // Get user info
        const [existing] = await db.query(
          "SELECT * FROM user_accounts WHERE user_id = ?",
          [user_id],
        );
        if (existing.length === 0)
          return res.status(404).json({ message: "User not found" });
        const applicant_person_id = existing[0].person_id;

        // Get applicant_number
        const [applicant] = await db.query(
          "SELECT * FROM applicant_numbering_table WHERE person_id = ?",
          [applicant_person_id],
        );
        if (applicant.length === 0)
          return res.status(404).json({ message: "Applicant not found" });
        const applicant_number = applicant[0].applicant_number;

        // Get current profile
        const [datas] = await db.query(
          "SELECT * FROM person_table WHERE person_id = ?",
          [applicant_person_id],
        );
        const current = datas[0];

        let finalFilename = current.profile_img;

        if (file) {
          const a_id = applicant_number || "unknown";

          const philTime = new Date().toLocaleString("en-US", {
            timeZone: "Asia/Manila",
          });
          const year = new Date(philTime).getFullYear();

          const ext = path.extname(file.originalname).toLowerCase();
          finalFilename = `${a_id}_1by1_${year}${ext}`;

          //  New folder: uploads/Applicant1by1
          const uploadDir = path.join(__dirname, "uploads", "Applicant1by1");
          if (!fs.existsSync(uploadDir))
            fs.mkdirSync(uploadDir, { recursive: true });

          const tempPath = path.join(__dirname, "uploads", file.filename); // temp file multer stored
          const newPath = path.join(uploadDir, finalFilename);

          // Delete old file if exists
          if (current.profile_img) {
            const oldPath = path.join(uploadDir, current.profile_img);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          }

          // Move temp file to new folder
          fs.renameSync(tempPath, newPath);
        }

        // Update DB
        const sql = `UPDATE person_table SET profile_img = ? WHERE person_id = ?`;
        const [updated] = await db.query(sql, [
          finalFilename,
          applicant_person_id,
        ]);

        res.json({
          success: true,
          message: "Applicant updated successfully!",
          updated,
        });
      } catch (error) {
        console.error(" Error updating applicant:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    },
  );

  // ---------------- Get total required count ----------------
  app.get("/api/total-requirements", async (req, res) => {
    try {
      const { person_id } = req.query;
      let rows;

      if (person_id) {
        [rows] = await db.query(
          `
        SELECT COUNT(*) AS total
        FROM requirements_table rt
        INNER JOIN person_table pt
          ON rt.applicant_type = pt.applyingAs
        WHERE rt.is_verifiable = 1
          AND pt.person_id = ?
        `,
          [person_id],
        );
      } else {
        [rows] = await db.query(
          "SELECT COUNT(*) AS total FROM requirements_table WHERE is_verifiable = 1",
        );
      }

      res.json({ total: rows[0].total });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to get total requirements" });
    }
  });

  app.get("/api/get_prof_account_id/:person_id", async (req, res) => {
    const { person_id } = req.params;
    try {
      const [rows] = await db3.query(
        "SELECT prof_id FROM prof_table WHERE person_id = ? LIMIT 1",
        [person_id],
      );
      if (rows.length === 0)
        return res.status(404).json({ message: "User not found" });
      res.json({ user_account_id: rows[0].prof_id });
    } catch (err) {
      console.error(" Error fetching uproft_id:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post(
    "/update_faculty/:id",
    profileUpload.single("profile_picture"),
    async (req, res) => {
      const { id } = req.params;
      const file = req.file;

      try {
        const [existing] = await db3.query(
          "SELECT * FROM prof_table WHERE prof_id = ?",
          [id],
        );
        if (existing.length === 0)
          return res.status(404).json({ message: "Faculty not found" });

        const current = existing[0];

        let finalFilename = current.profile_image; // fallback to existing if no new file

        if (file) {
          //  Get employee_id for filename
          const employee_id = current.prof_id || "unknown";

          //  Get current Philippine year
          const philTime = new Date().toLocaleString("en-US", {
            timeZone: "Asia/Manila",
          });
          const year = new Date(philTime).getFullYear();

          //  Build final filename
          const ext = path.extname(file.originalname).toLowerCase();
          finalFilename = `2${current.person_id}${employee_id}_profile_image_${year}${ext}`;

          //  Paths
          const uploadDir = path.join(__dirname, "uploads");
          const tempPath = path.join(uploadDir, file.filename);
          const newPath = path.join(uploadDir, finalFilename);

          //  Delete old image if exists
          if (current.profile_image) {
            const oldPath = path.join(uploadDir, current.profile_image);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          }

          //  Rename temp file to proper name
          fs.renameSync(tempPath, newPath);
        }

        //  Update registrar data in DB
        const updated = {
          profile_picture: finalFilename,
        };

        const sql = `
      UPDATE prof_table
      SET profile_image=?
      WHERE prof_id=?`;
        const values = [updated.profile_picture, id];

        await db3.query(sql, values);

        res.json({
          success: true,
          message: "Faculty updated successfully!",
          updated,
        });
      } catch (error) {
        console.error(" Error updating faculty:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    },
  );

  app.put(
    "/update_prof_profile_image/:person_id",
    profileUpload.single("profileImage"),
    async (req, res) => {
      const { person_id } = req.params;
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filename = req.file.filename;

      try {
        // Update DB (set filename to the same name we saved)
        const [result] = await db3.query(
          "UPDATE prof_table SET profile_image = ? WHERE person_id = ?",
          [filename, person_id],
        );

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: "Person not found" });
        }

        res.json({
          message: " Profile image updated successfully",
          filename,
        });
      } catch (err) {
        console.error(" DB Error:", err);
        res.status(500).json({ error: "Database update failed" });
      }
    },
  );

  app.post(
    "/api/update_student/:user_id",
    profileUpload.single("profile_picture"),
    async (req, res) => {
      const { user_id } = req.params;
      const data = req.body;
      const file = req.file;

      try {
        const [existing] = await db3.query(
          "SELECT * FROM user_accounts WHERE id = ?",
          [user_id],
        );
        if (existing.length === 0)
          return res.status(404).json({ message: "User not found" });
        const student_person_id = existing[0].person_id;

        const [student] = await db3.query(
          "SELECT * FROM student_numbering_table WHERE person_id = ?",
          [student_person_id],
        );

        if (student.length === 0)
          return res.status(404).json({ message: "Student not found" });
        const student_number = student[0].student_number;

        const [datas] = await db3.query(
          "SELECT * FROM person_table WHERE person_id = ?",
          [student_person_id],
        );
        const current = datas[0];

        let finalFilename = current.profile_img;

        if (file) {
          const s_id = student_number || "unknown";
          const philTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
          const year = new Date(philTime).getFullYear();
          const ext = path.extname(file.originalname).toLowerCase();
          finalFilename = `${s_id}_profile_image_${year}${ext}`;

          const tempUploadDir = path.join(__dirname, "uploads");            // where multer actually saved it
          const studentPhotoDir = path.join(__dirname, "uploads", "Student1by1"); // where it needs to live

          if (!fs.existsSync(studentPhotoDir)) {
            fs.mkdirSync(studentPhotoDir, { recursive: true });
          }

          const tempPath = path.join(tempUploadDir, file.filename);
          const newPath = path.join(studentPhotoDir, finalFilename);

          if (current.profile_img) {
            const oldPath = path.join(studentPhotoDir, current.profile_img); // look in Student1by1, not uploads root
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          }

          fs.renameSync(tempPath, newPath);
        }

        const sql = `
      UPDATE person_table SET profile_img = ? WHERE person_id = ?
    `;

        const [updated] = await db3.query(sql, [
          finalFilename,
          student_person_id,
        ]);

        res.json({
          success: true,
          message: "Student updated successfully!",
          updated,
        });
      } catch (error) {
        console.error(" Error updating student:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    },
  );

  //  Check if applicant already has a student number
  app.get("/api/student_status/:person_id", async (req, res) => {
    const { person_id } = req.params;
    try {
      const [applicantEmail] = await db.query(
        `SELECT emailAddress FROM person_table WHERE person_id = ?`,
        [person_id],
      );

      if (applicantEmail.length === 0) {
        return res.status(500).json({ message: "Email Address not found" });
      }

      const [studentPersonID] = await db3.query(
        `SELECT person_id FROM person_table WHERE emailAddress = ?`,
        [applicantEmail[0].emailAddress],
      );

      if (studentPersonID.length === 0) {
        return res
          .status(500)
          .json({ message: "Person Id of this email is not found" });
      }

      const [rows] = await db3.query(
        "SELECT student_number FROM student_numbering_table WHERE person_id = ?",
        [studentPersonID[0].person_id],
      );

      if (rows.length > 0 && rows[0].student_number) {
        res.json({
          hasStudentNumber: true,
          student_number: rows[0].student_number,
        });
      } else {
        res.json({ hasStudentNumber: false });
      }
    } catch (error) {
      console.error(" Error checking student number:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/admin/active-year
  // Returns the current active school year description (e.g. 2026).
  // ─────────────────────────────────────────────────────────────────────────────
  app.get('/api/admin/active-year', async (req, res) => {
    try {
      const [[row]] = await db3.query(
        `SELECT yt.year_description AS year
         FROM active_school_year_table asy
         JOIN year_table yt ON asy.year_id = yt.year_id
         WHERE asy.astatus = 1
         LIMIT 1`
      );
      res.json({ year: row?.year || new Date().getFullYear() });
    } catch (err) {
      console.error('[admin/active-year GET]', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/all-persons", (req, res) => {
    db.query(
      "SELECT person_id, last_name, first_name, middle_name FROM person_table",
      (err, result) => {
        if (err) {
          console.error("Error fetching persons:", err);
          return res.status(500).json({ error: "Failed to fetch persons" });
        }
        res.json(result);
      },
    );
  });

  app.get(
    "/applicant_uploaded_requirements/:person_id",
    async (req, res) => {
      try {
        const { person_id } = req.params;

        const [rows] = await db.query(
          `
      SELECT
        pt.person_id,
        pt.first_name,
        pt.middle_name,
        pt.last_name,
        pt.profile_img,
        pt.emailAddress,

        -- applicant_numbering_table
        ant.applicant_number,
        ant.qr_code,

        -- requirements_table
        rt.id AS requirement_id,
        rt.description,
        rt.short_label,
        rt.label,
        rt.category,
        rt.is_optional,
        rt.is_verifiable,

        -- requirement_uploads
        ru.upload_id,
        ru.requirements_id,
        ru.submitted_documents,
        ru.registrar_status,
        ru.document_status,
        ru.remarks,
        ru.missing_documents,
        ru.submitted_medical,
        ru.file_path,
        ru.original_name

      FROM person_table pt
      LEFT JOIN applicant_numbering_table ant
        ON pt.person_id = ant.person_id
      LEFT JOIN requirements_table rt
        ON rt.applicant_type = pt.applyingAs
      LEFT JOIN requirement_uploads ru
        ON pt.person_id = ru.person_id
       AND ru.requirements_id = rt.id

      WHERE pt.person_id = ?
      ORDER BY rt.id
    `,
          [person_id],
        );

        res.json(rows);
      } catch (error) {
        console.error(
          " Error fetching applicant uploaded requirements:",
          error,
        );
        res.status(500).json({ error: "Internal Server Error" });
      }
    },
  );

  app.get("/api/applicant-documents/:person_id", async (req, res) => {
    try {
      const { person_id } = req.params;

      const [rows] = await db.query(
        `SELECT
          requirements_id,
          submitted_documents,
          registrar_status,
          document_status
       FROM requirement_uploads
       WHERE person_id = ?
       ORDER BY requirements_id`,
        [person_id],
      );

      res.json(rows);
    } catch (error) {
      console.error(" Error loading applicant documents:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  //UPDATE ()
  app.post("/api/insert-logs/:userID", async (req, res) => {
    const { userID } = req.params;
    const { message, type } = req.body;

    try {
      const [userData] = await db3.query(
        "SELECT * FROM user_accounts WHERE person_id = ?",
        [userID],
      );

      if (userData.length === 0) {
        return res.status(400).send({ message: "No Data found" });
      }

      const user = userData[0];
      const UserID = user.employee_id;
      const fullName =
        `${user.last_name || ""}, ${user.first_name || ""} ${user.middle_name || ""}`.trim();
      const email = user.email;

      res.json({ success: true, message: "Log skipped" });
    } catch (err) {
      console.error("Error handling log:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/get_college_professor_schedule/:dprtmnt_id", async (req, res) => {
    const { dprtmnt_id } = req.params;
    try {
      const sql = `
      SELECT pt.employee_id, pt.fname, pt.mname, pt.lname, ct.course_code, pgt.program_id, pgt.program_code, sct.description AS section_description, rdt.description AS day, tt.school_time_start, tt.school_time_end, rt.room_id, rt.room_description, tt.ishonorarium, yt.year_id, yt.year_description AS current_year, yt.year_description + 1 AS next_year, st.semester_id, st.semester_description FROM time_table tt
      LEFT JOIN prof_table pt ON tt.professor_id = pt.prof_id
      LEFT JOIN course_table ct ON tt.course_id = ct.course_id
      LEFT JOIN dprtmnt_section_table dst ON tt.department_section_id = dst.id
      LEFT JOIN section_table sct ON dst.section_id = sct.id
      LEFT JOIN curriculum_table cct ON dst.curriculum_id = cct.curriculum_id
      LEFT JOIN program_table pgt ON cct.program_id = pgt.program_id
      LEFT JOIN room_day_table rdt ON tt.room_day = rdt.id
      LEFT JOIN dprtmnt_room_table drt ON tt.department_room_id = drt.dprtmnt_room_id
      LEFT JOIN dprtmnt_table dt ON drt.dprtmnt_id = dt.dprtmnt_id
      LEFT JOIN room_table rt ON drt.room_id = rt.room_id
      INNER JOIN active_school_year_table sy ON tt.school_year_id = sy.id
      LEFT JOIN year_table yt ON sy.year_id = yt.year_id
      LEFT JOIN semester_table st ON sy.semester_id = st.semester_id
      WHERE dt.dprtmnt_id = ? AND sy.astatus = 1
    `;

      const [rows] = await db3.execute(sql, [dprtmnt_id]);

      if (rows.length === 0) {
        return res.status(404).json({ error: "No schedule found" });
      }

      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/get_professor_schedule/:employee_id", async (req, res) => {
    const { employee_id } = req.params;

    try {
      const sql = `
      SELECT
        pt.employee_id,
        pt.fname,
        pt.mname,
        pt.lname,
        COALESCE(ct.course_code, wt.workload_code) AS course_code,
        wt.workload_color,
        pgt.program_id,
        pgt.program_code,
        sct.description AS section_description,
        rdt.description AS day,
        tt.school_time_start,
        tt.school_time_end,
        COALESCE(rt_from_mapping.room_id, rt_direct.room_id) AS room_id,
        COALESCE(rt_from_mapping.room_description, rt_direct.room_description) AS room_description,
        tt.ishonorarium,
        tt.is_servicecredit,
        tt.is_temporary_substitution,
        yt.year_id,
        yt.year_description AS current_year,
        yt.year_description + 1 AS next_year,
        st.semester_id,
        st.semester_description
      FROM time_table tt
      INNER JOIN prof_table pt ON tt.professor_id = pt.prof_id
      LEFT JOIN course_table ct ON tt.course_id = ct.course_id AND tt.department_section_id IS NOT NULL
      LEFT JOIN workload_type wt ON tt.course_id = wt.id AND tt.department_section_id IS NULL
      LEFT JOIN dprtmnt_section_table dst ON tt.department_section_id = dst.id
      LEFT JOIN section_table sct ON dst.section_id = sct.id
      LEFT JOIN curriculum_table cct ON dst.curriculum_id = cct.curriculum_id
      LEFT JOIN program_table pgt ON cct.program_id = pgt.program_id
      LEFT JOIN room_day_table rdt ON tt.room_day = rdt.id
      LEFT JOIN dprtmnt_room_table drt ON tt.department_room_id = drt.dprtmnt_room_id
      LEFT JOIN room_table rt_from_mapping ON drt.room_id = rt_from_mapping.room_id
      LEFT JOIN room_table rt_direct ON tt.department_room_id = rt_direct.room_id
      INNER JOIN active_school_year_table sy ON tt.school_year_id = sy.id
      LEFT JOIN year_table yt ON sy.year_id = yt.year_id
      LEFT JOIN semester_table st ON sy.semester_id = st.semester_id
      WHERE pt.employee_id = ? AND sy.astatus = 1
      ORDER BY FIELD(rdt.description, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'),
               tt.school_time_start,
               tt.school_time_end
    `;

      const [rows] = await db3.execute(sql, [employee_id]);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });
  //----------------------------prereq end

  app.get("/api/prof_dropdown", async (req, res) => {
    try {
      const [rows] = await db3.query(`
      SELECT
        person_id,
        fname,
        mname,
        lname
      FROM prof_table
      ORDER BY lname, fname
    `);

      res.json(rows);
    } catch (err) {
      console.error("Error fetching prof dropdown:", err);
      res.status(500).json({ message: "Failed to load professors" });
    }
  });

  //  NEWLY ADDED API 1/13/2025

  //  GET all year levels
  // GET only YEAR levels

  // ================= POST =================

  app.delete("/api/delete_subject/:id", async (req, res) => {
    const { id } = req.params;
    try {
      if (!id) {
        return res
          .status(400)
          .json({ error: "Please Select a Subject to Delete" });
      }

      await db3.execute("DELETE FROM enrolled_subject WHERE id = ?", [id]);
      res.json({ message: "Deleted Successfully" });
    } catch (err) {
      console.error("Error in Deleting a suject", err);
      res.status(500).json({ error: "Error in Deleting a subject", err });
    }
  });

  app.post("/api/insert_subject", async (req, res) => {
    const { course_id, student_number, currId, active_school_year_id } =
      req.body;

    if (!course_id || !student_number || !currId || !active_school_year_id) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    try {
      const sql = `
      INSERT INTO enrolled_subject
        (course_id, student_number, curriculum_id, active_school_year_id)
      VALUES (?, ?, ?, ?)
    `;

      await db3.execute(sql, [
        course_id,
        student_number,
        currId,
        active_school_year_id,
      ]);

      res.json({ message: "Course added successfully" });
    } catch (err) {
      console.error("Insert subject error:", err);
      res.status(500).json({ error: "Failed to add subject" });
    }
  });

  app.put("/api/update_subject", async (req, res) => {
    const {
      course_id,
      student_number,
      currId,
      active_school_year_id,
      final_grade,
    } = req.body;

    if (!course_id || !student_number || !currId || !active_school_year_id) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    try {
      // Dynamic conversion keeps subject updates aligned with grade_conversion records.
      const gradeConversions = await getGradeConversions();
      const numericGrade = getStoredNumericGrade(final_grade, gradeConversions);

      if (numericGrade === null) {
        return res
          .status(400)
          .json({ error: "Invalid grade conversion value" });
      }

      const sql = `
      UPDATE enrolled_subject SET final_grade = ? WHERE
        course_id = ? AND student_number = ? AND curriculum_id = ? AND active_school_year_id = ?
    `;

      await db3.execute(sql, [
        numericGrade,
        course_id,
        student_number,
        currId,
        active_school_year_id,
      ]);

      res.json({ message: "Course added successfully" });
    } catch (err) {
      console.error("Insert subject error:", err);
      res.status(500).json({ error: "Failed to add subject" });
    }
  });

  io.on("connection", (socket) => {

    socket.on(
      "send_verify_schedule_emails",
      async ({
        schedule_id,
        applicant_numbers,
        subject,
        message,
        user_person_id,
        audit_actor_id,
        audit_actor_role,
      }) => {

        try {
          if (
            !schedule_id ||
            !Array.isArray(applicant_numbers) ||
            applicant_numbers.length === 0
          ) {
            return socket.emit("send_verify_schedule_emails_result", {
              success: false,
              error: "No applicants provided.",
            });
          }

          // OFFICE NAME
          const [[office]] = await db.query(
            "SELECT short_term FROM company_settings WHERE id = 1",
          );

          const shortTerm = office?.short_term || "EARIST";
          const officeName = `${shortTerm} - Admission Office`;

          //  Fetch applicants with email
          const [rows] = await db.query(
            `
      SELECT
        va.applicant_id,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.emailAddress
      FROM verify_applicants va
      JOIN applicant_numbering_table an
        ON va.applicant_id = an.applicant_number
      JOIN person_table p
        ON an.person_id = p.person_id
      WHERE va.schedule_id = ?
      AND va.applicant_id IN (?)
      AND va.email_sent = 0
    `,
            [schedule_id, applicant_numbers],
          );

          if (rows.length === 0) {
            return socket.emit("send_verify_schedule_emails_result", {
              success: false,
              error: "No pending applicants found.",
            });
          }

          const sent = [];
          const failed = [];

          for (const row of rows) {
            if (!row.emailAddress) {
              failed.push(row.applicant_id);
              continue;
            }

            const personalizedMsg = message
              .replace("{first_name}", row.first_name || "")
              .replace("{middle_name}", row.middle_name || "")
              .replace("{last_name}", row.last_name || "")
              .replace("{applicant_number}", row.applicant_id);

            try {
              await transporter.sendMail({
                from: `"${officeName}" <${process.env.EMAIL_USER}>`,
                to: row.emailAddress,
                subject,
                text: personalizedMsg,
              });

              //  Mark sent
              await db.query(
                "UPDATE verify_applicants SET email_sent = 1 WHERE applicant_id = ?",
                [row.applicant_id],
              );

              sent.push(row.applicant_id);
            } catch (err) {
              console.error("Email failed:", err.message);

              await db.query(
                "UPDATE verify_applicants SET email_sent = -1 WHERE applicant_id = ?",
                [row.applicant_id],
              );

              failed.push(row.applicant_id);
            }
          }

          const safeActor = audit_actor_id || user_person_id || "unknown";
          const roleLabel = formatAuditActorRole(audit_actor_role);
          const scheduleLabel = await getVerifyScheduleLabel(schedule_id);
          const sentList = sent.length > 0 ? sent.join(", ") : "None";
          const failedNote =
            failed.length > 0
              ? ` Failed applicant(s): ${failed.join(", ")}.`
              : "";

          await insertAuditLogAdmission({
            actorId: safeActor,
            role: audit_actor_role || "registrar",
            action: "VERIFY_SCHEDULE_EMAIL",
            severity: sent.length > 0 ? "INFO" : "WARNING",
            message: `${roleLabel} (${safeActor}) sent document verification schedule email to ${sent.length} applicant(s) for ${scheduleLabel}. Applicant(s): ${sentList}.${failedNote}`,
          });

          //  Return result
          socket.emit("send_verify_schedule_emails_result", {
            success: true,
            sent,
            failed,
            message: `Verify emails: Sent=${sent.length}, Failed=${failed.length}`,
          });

          io.emit("schedule_updated", { schedule_id });
        } catch (err) {
          console.error("Verify email error:", err);

          socket.emit("send_verify_schedule_emails_result", {
            success: false,
            error: "Server error sending verify emails.",
          });
        }
      },
    );

    socket.on(
      "update_verify_schedule",
      async ({
        schedule_id,
        applicant_numbers,
        audit_actor_id,
        audit_actor_role,
      }) => {
        try {
          if (!schedule_id || !applicant_numbers?.length) {
            return socket.emit("update_verify_schedule_result", {
              success: false,
              error: "Schedule ID and applicants required.",
            });
          }

          //  Get quota
          const [[scheduleInfo]] = await db.query(
            `SELECT room_quota FROM verify_document_schedule WHERE schedule_id = ?`,
            [schedule_id],
          );

          if (!scheduleInfo) {
            return socket.emit("update_verify_schedule_result", {
              success: false,
              error: "Schedule not found.",
            });
          }

          const roomQuota = scheduleInfo.room_quota;

          //  Current count
          const [[{ currentCount }]] = await db.query(
            `SELECT COUNT(*) AS currentCount FROM verify_applicants WHERE schedule_id = ?`,
            [schedule_id],
          );

          let runningCount = currentCount;

          const assigned = [];
          const updated = [];
          const skipped = [];

          for (const applicant_number of applicant_numbers) {
            //  STOP when full
            if (runningCount >= roomQuota) {
              break;
            }

            const [check] = await db.query(
              `SELECT schedule_id FROM verify_applicants WHERE applicant_id = ?`,
              [applicant_number],
            );

            if (check.length > 0) {
              if (check[0].schedule_id === schedule_id) {
                skipped.push(applicant_number);
              } else {
                await db.query(
                  `UPDATE verify_applicants SET schedule_id = ? WHERE applicant_id = ?`,
                  [schedule_id, applicant_number],
                );
                updated.push(applicant_number);
                runningCount++; // increase count
              }
            } else {
              await db.query(
                `INSERT INTO verify_applicants (applicant_id, schedule_id, email_sent)
            VALUES (?, ?, 0)`,
                [applicant_number, schedule_id],
              );

              assigned.push(applicant_number);
              runningCount++; // increase count
            }
          }

          const changedApplicants = [...assigned, ...updated];
          if (changedApplicants.length > 0) {
            const safeActor = audit_actor_id || "unknown";
            const roleLabel = formatAuditActorRole(audit_actor_role);
            const scheduleLabel = await getVerifyScheduleLabel(schedule_id);

            await insertAuditLogAdmission({
              actorId: safeActor,
              role: audit_actor_role || "registrar",
              action: "VERIFY_SCHEDULE",
              severity: "INFO",
              message: `${roleLabel} (${safeActor}) assigned ${changedApplicants.length} applicant(s) to document verification ${scheduleLabel}. Applicant(s): ${changedApplicants.join(", ")}.`,
            });
          }

          socket.emit("update_verify_schedule_result", {
            success: true,
            assigned,
            updated,
            skipped,
          });
        } catch (err) {
          console.error(" Verify assign error:", err);
          socket.emit("update_verify_schedule_result", {
            success: false,
            error: "Failed to assign applicants.",
          });
        }
      },
    );
  });
};

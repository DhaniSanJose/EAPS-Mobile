const express = require("express");
const router = express.Router();
const QRCode = require("qrcode");
const { db3 } = require("../database/database");
const fs = require("fs");
const path = require("path");

const REMARKS_PASSED = 1;


const formatStudent = (student) => {
  const clean = (v) => (v === null || v === undefined ? "" : String(v).trim());

  const last = clean(student.last_name);
  const nameParts = [clean(student.first_name), clean(student.middle_name), clean(student.extension)].filter(
    Boolean,
  );

  return {
    student_number: student.student_number,
    full_name: last && nameParts.length ? `${last}, ${nameParts.join(" ")}`.toUpperCase() : last.toUpperCase(),
    profile_image: student.profile_img || null,
  };
};

router.get("/tor-qr-information/:student_number", async (req, res) => {
  const studentNumber = String(req.params.student_number || "").trim();
  if (!studentNumber) {
    return res.status(400).json({ success: false, message: "Student number is required." });
  }

  try {
    // 1) Student record must exist
    const [studentRows] = await db3.query(
      `
      SELECT
        snt.student_number,
        pt.person_id,
        pt.first_name,
        pt.middle_name,
        pt.last_name,
        pt.extension,
        pt.profile_img
      FROM student_numbering_table snt
      INNER JOIN person_table pt ON pt.person_id = snt.person_id
      WHERE snt.student_number = ?
      LIMIT 1
      `,
      [studentNumber],
    );

    if (studentRows.length === 0) {
      return res.status(404).json({ success: false, message: "No student record found for this student number." });
    }

    const student = studentRows[0];

    // 2) GATE: student must have a portal account
    const [accountRows] = await db3.query(
      `SELECT id, status FROM user_accounts WHERE person_id = ? AND role = 'student' LIMIT 1`,
      [student.person_id],
    );

    if (accountRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "This student does not have a portal account yet, so no TOR QR has been issued.",
      });
    }

    // 3) GATE: the TOR QR file must already exist on disk — this is the exact
    //    file written by send_student_password_reminder, not a fresh regeneration.
    const torQrDir = path.join(__dirname, "..", "..", "uploads", "TORStudentQRCodeGenerated");
    const torQrFilename = `${studentNumber}_tor_qrcode.png`;
    const torQrPath = path.join(torQrDir, torQrFilename);

    if (!fs.existsSync(torQrPath)) {
      return res.status(404).json({
        success: false,
        message: "A TOR QR code has not been generated for this student yet.",
      });
    }

    // 4) Program/curriculum, for display only
    const [curriculumRows] = await db3.query(
      `
      SELECT pgt.program_code, pgt.program_description, pgt.major
      FROM enrolled_subject es
      LEFT JOIN curriculum_table ct ON ct.curriculum_id = es.curriculum_id
      LEFT JOIN program_table pgt ON pgt.program_id = ct.program_id
      WHERE es.student_number = ?
      ORDER BY es.id DESC
      LIMIT 1
      `,
      [studentNumber],
    );

    const clean = (v) => (v === null || v === undefined ? "" : String(v).trim());
    const nameParts = [clean(student.first_name), clean(student.middle_name), clean(student.extension)].filter(Boolean);
    const fullName = clean(student.last_name) && nameParts.length
      ? `${clean(student.last_name)}, ${nameParts.join(" ")}`.toUpperCase()
      : clean(student.last_name).toUpperCase();

    return res.json({
      success: true,
      student: {
        student_number: student.student_number,
        full_name: fullName,
        profile_image: student.profile_img || null,
      },
      program: curriculumRows[0] || null,
      account_status: accountRows[0].status,
      // served from the SAME uploads path the QR file was written to
      tor_qr_image_url: `/uploads/TORStudentQRCodeGenerated/${torQrFilename}`,
    });
  } catch (error) {
    console.error("TOR QR information lookup failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load TOR QR information right now." });
  }
});

router.get("/tor-qr-status/:student_number", async (req, res) => {
  const studentNumber = String(req.params.student_number || "").trim();

  if (!studentNumber) {
    return res.status(400).json({ success: false, message: "Student number is required." });
  }

  try {
    const torQrDir = path.join(__dirname, "..", "..", "uploads", "TORStudentQRCodeGenerated");
    const torQrFilename = `${studentNumber}_tor_qrcode.png`;
    const torQrPath = path.join(torQrDir, torQrFilename);

    const hasQr = fs.existsSync(torQrPath);

    return res.json({
      success: true,
      has_qr: hasQr,
      tor_qr_image_url: hasQr ? `/uploads/TORStudentQRCodeGenerated/${torQrFilename}` : null,
    });
  } catch (error) {
    console.error("TOR QR status check failed:", error);
    return res.status(500).json({ success: false, message: "Unable to check TOR QR status right now." });
  }
});

router.get("/verify-graduate/:student_number", async (req, res) => {
  const studentNumber = String(req.params.student_number || "").trim();

  if (!studentNumber) {
    return res.status(400).json({ success: false, message: "Student number is required." });
  }

  try {
    // 1) Student identity
    const [studentRows] = await db3.query(
      `
      SELECT
        snt.student_number,
        pt.person_id,
        pt.first_name,
        pt.middle_name,
        pt.last_name,
        pt.extension,
        pt.profile_img
      FROM student_numbering_table snt
      INNER JOIN person_table pt ON pt.person_id = snt.person_id
      WHERE snt.student_number = ?
      LIMIT 1
      `,
      [studentNumber],
    );

    if (studentRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No student record found for this student number.",
      });
    }

    const student = studentRows[0];

    // 2) Curriculum the student's subjects were enrolled under
    const [curriculumRows] = await db3.query(
      `
      SELECT
        es.curriculum_id,
        ct.program_id,
        pgt.program_code,
        pgt.program_description,
        pgt.major
      FROM enrolled_subject es
      LEFT JOIN curriculum_table ct ON ct.curriculum_id = es.curriculum_id
      LEFT JOIN program_table pgt ON pgt.program_id = ct.program_id
      WHERE es.student_number = ?
      ORDER BY es.id DESC
      LIMIT 1
      `,
      [studentNumber],
    );

    if (curriculumRows.length === 0 || !curriculumRows[0].curriculum_id) {
      return res.json({
        success: true,
        is_graduate: false,
        reason: "No enrollment record was found for this student under any curriculum.",
        student: formatStudent(student),
      });
    }

    const { curriculum_id, program_code, program_description, major } = curriculumRows[0];

    // 3) Terminal term of that curriculum (last year level, last semester)
    const [finalTermRows] = await db3.query(
      `
      SELECT year_level_id, semester_id
      FROM program_tagging_table
      WHERE curriculum_id = ?
      ORDER BY year_level_id DESC, semester_id DESC
      LIMIT 1
      `,
      [curriculum_id],
    );

    if (finalTermRows.length === 0) {
      return res.json({
        success: true,
        is_graduate: false,
        reason: "This curriculum has no tagged subjects to evaluate against.",
        student: formatStudent(student),
        program: { program_code, program_description, major },
      });
    }

    const { year_level_id: finalYearLevelId, semester_id: finalSemesterId } = finalTermRows[0];

    // 4) Every subject required in that terminal term
    const [requiredCourses] = await db3.query(
      `
      SELECT ptt.course_id, ct.course_code, ct.course_description
      FROM program_tagging_table ptt
      INNER JOIN course_table ct ON ct.course_id = ptt.course_id
      WHERE ptt.curriculum_id = ? AND ptt.year_level_id = ? AND ptt.semester_id = ?
      `,
      [curriculum_id, finalYearLevelId, finalSemesterId],
    );

    if (requiredCourses.length === 0) {
      return res.json({
        success: true,
        is_graduate: false,
        reason: "No subjects are tagged for the final term of this curriculum.",
        student: formatStudent(student),
        program: { program_code, program_description, major },
      });
    }

    const requiredCourseIds = requiredCourses.map((c) => c.course_id);
    const placeholders = requiredCourseIds.map(() => "?").join(", ");

    // 5) Did the student pass every one of those subjects?
    const [completedRows] = await db3.query(
      `
      SELECT
        es.course_id,
        es.final_grade,
        es.en_remarks,
        yt.year_description,
        smt.ordinal_label AS semester_label
      FROM enrolled_subject es
      LEFT JOIN active_school_year_table ast ON ast.id = es.active_school_year_id
      LEFT JOIN year_table yt ON yt.year_id = ast.year_id
      LEFT JOIN semester_table smt ON smt.semester_id = ast.semester_id
      WHERE es.student_number = ?
        AND es.curriculum_id = ?
        AND es.course_id IN (${placeholders})
      ORDER BY es.id DESC
      `,
      [studentNumber, curriculum_id, ...requiredCourseIds],
    );

    // Keep only the latest attempt per course (handles retakes)
    const latestByCourseId = new Map();
    for (const row of completedRows) {
      if (!latestByCourseId.has(row.course_id)) latestByCourseId.set(row.course_id, row);
    }

    const finalTermSubjects = requiredCourses.map((course) => {
      const record = latestByCourseId.get(course.course_id);
      return {
        course_code: course.course_code,
        course_description: course.course_description,
        final_grade: record?.final_grade ?? null,
        passed: record ? Number(record.en_remarks) === REMARKS_PASSED : false,
        school_year:
          record?.year_description != null ? `${record.year_description}-${Number(record.year_description) + 1}` : null,
        semester: record?.semester_label ?? null,
      };
    });

    const isGraduate = finalTermSubjects.length > 0 && finalTermSubjects.every((s) => s.passed);

    const [[yearLevelRow]] = await db3.query(
      `SELECT ordinal_label FROM year_level_table WHERE year_level_id = ? LIMIT 1`,
      [finalYearLevelId],
    );
    const [[semesterRow]] = await db3.query(
      `SELECT ordinal_label FROM semester_table WHERE semester_id = ? LIMIT 1`,
      [finalSemesterId],
    );

    return res.json({
      success: true,
      is_graduate: isGraduate,
      student: formatStudent(student),
      program: { program_code, program_description, major },
      final_term: {
        year_level: yearLevelRow?.ordinal_label || null,
        semester: semesterRow?.ordinal_label || null,
        subjects: finalTermSubjects,
      },
      verified_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Graduate verification failed:", error);
    return res.status(500).json({ success: false, message: "Unable to verify graduation status right now." });
  }
});

router.get("/graduate-qr/:student_number", async (req, res) => {
  const studentNumber = String(req.params.student_number || "").trim();
  if (!studentNumber) {
    return res.status(400).json({ success: false, message: "Student number is required." });
  }

  try {
    let frontendUrl = (process.env.FRONTEND_URL || "").trim();
   

    if (frontendUrl && !/^https?:\/\//i.test(frontendUrl)) {
      frontendUrl = `http://${frontendUrl}`;
    }

    const verificationUrl = `${frontendUrl}/tor_qr_information/${encodeURIComponent(studentNumber)}`;

    const qrBuffer = await QRCode.toBuffer(verificationUrl, {
      color: { dark: "#000", light: "#FFF" },
      width: 300,
      margin: 1,
    });

    res.set("Content-Type", "image/png");
    res.send(qrBuffer);
  } catch (error) {
    console.error("Graduate QR generation failed:", error);
    res.status(500).json({ success: false, message: "Unable to generate verification QR code." });
  }
});

module.exports = router;
/**
 * ADMISSIONS REPORT MODULE
 * ------------------------------------------------------------
 * Drives the 4 report boxes + downloadable PDF lists on
 * AdmissionOfficerDashboard.jsx / ECAT Monitoring Panel area:
 *
 *   1. ECAT Exam Takers               -> exam_results
 *   2. Entrance Exam Non-Appearance   -> exam_attendance (QR scanner)
 *   3. Applicant Realignment          -> applicant_realignment_log (new table)
 *   4. ECAT Passers / Failers         -> exam_results.status
 *
 * CAMPUS FILTER
 * ------------------------------------------------------------
 * Every endpoint below now accepts an optional ?campus=<id> query
 * param, where <id> matches the "id" of an entry inside
 * company_settings.branches (e.g. 1 = Manila, 2 = Cavite). Campus is
 * resolved via person_table.campus, joined in through whichever
 * table links back to a person (applicant_numbering_table, or
 * person_id directly). Omit campus (or pass "all") to see every
 * campus combined, same as before.
 *
 * PDF generation is NOT duplicated here — the frontend builds an HTML
 * table (see AdmissionsReportPanel.jsx) and posts it to the existing
 * generic route POST /api/generate-attendance-report-pdf (already
 * defined in routes/forms/downloadableFormsRoute.js), which already
 * renders the corner-label letterhead + table your other exports use.
 *
 * Mount in server.js:
 *   const admissionReportsRoute = require("./routes/admission_routes/admissionReportsRoute");
 *   app.use("/api", admissionReportsRoute);
 *
 * Requires the applicant_realignment_log table — see
 * applicant_realignment_log.sql in this same delivery.
 */

const express = require("express");
const { db } = require("../database/database");

const router = express.Router();

// ------------------------------------------------------------------
// Helper: build a WHERE clause for a given date column + period.
// period: "day" | "week" | "month" | "all"
// value:  optional anchor date. "day" -> "YYYY-MM-DD", "week" -> any
//         date inside the target ISO week, "month" -> "YYYY-MM".
//         Omit value to default to the current day/week/month.
// ------------------------------------------------------------------
const periodWhere = (column, period, value) => {
    switch (period) {
        case "day":
            return value
                ? { clause: `DATE(${column}) = ?`, params: [value] }
                : { clause: `DATE(${column}) = CURDATE()`, params: [] };
        case "week":
            return value
                ? { clause: `YEARWEEK(${column}, 1) = YEARWEEK(?, 1)`, params: [value] }
                : { clause: `YEARWEEK(${column}, 1) = YEARWEEK(CURDATE(), 1)`, params: [] };
        case "month":
            return value
                ? { clause: `DATE_FORMAT(${column}, '%Y-%m') = ?`, params: [value] }
                : {
                    clause: `DATE_FORMAT(${column}, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
                    params: [],
                };
        default:
            return { clause: "1=1", params: [] };
    }
};

// ------------------------------------------------------------------
// Helper: campus filter fragment. `alias` is the person_table alias
// already present in the query (e.g. "pt"). Returns "" + [] when no
// campus was requested.
// ------------------------------------------------------------------
const campusWhere = (alias, campus) => {
    if (campus === undefined || campus === "" || campus === "all") {
        return { clause: "", params: [] };
    }
    return { clause: ` AND ${alias}.campus = ?`, params: [campus] };
};

const REALIGNMENT_FORM_TYPES = ["changeCourse", "changeCourse1", "newForm", "newForm1"];

const FORM_TYPE_LABELS = {
    changeCourse: "Change Course (College Dean)",
    changeCourse1: "Change Course (Campus Director)",
    newForm: "Empty Change Course (College Dean)",
    newForm1: "Empty Change Course (Campus Director)",
};

// ====================================================================
// SUMMARY — powers the 4 dashboard boxes (Today / This Week / This Month)
// Accepts ?campus=<id> to scope all 4 boxes to one campus.
// ====================================================================
router.get("/reports/admissions-summary", async (req, res) => {
    try {
        const { campus } = req.query;
        const hasCampus = campus !== undefined && campus !== "" && campus !== "all";

        const [[takers]] = await db.query(
            `
      SELECT
        SUM(CASE WHEN DATE(er.date_created) = CURDATE() THEN 1 ELSE 0 END) AS today,
        SUM(CASE WHEN YEARWEEK(er.date_created,1) = YEARWEEK(CURDATE(),1) THEN 1 ELSE 0 END) AS this_week,
        SUM(CASE WHEN DATE_FORMAT(er.date_created,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m') THEN 1 ELSE 0 END) AS this_month,
        COUNT(*) AS all_time
      FROM exam_results er
      ${hasCampus ? "INNER JOIN person_table pt ON pt.person_id = er.person_id" : ""}
      WHERE 1=1 ${hasCampus ? "AND pt.campus = ?" : ""}
    `,
            hasCampus ? [campus] : [],
        );

        // "created_at" on entrance_exam_schedule is the same column the rest
        // of the app already treats as the exam date (see ApplicantSchedule /
        // ExamPermit's "Date of Exam"), so non-appearance is grouped by it
        // instead of exam_attendance's own row-insert timestamp.
        const [[nonAppearance]] = await db.query(
            `
  SELECT
    SUM(CASE WHEN DATE(ea.absent_at) = CURDATE() THEN 1 ELSE 0 END) AS today,
    SUM(CASE WHEN YEARWEEK(ea.absent_at,1) = YEARWEEK(CURDATE(),1) THEN 1 ELSE 0 END) AS this_week,
    SUM(CASE WHEN DATE_FORMAT(ea.absent_at,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m') THEN 1 ELSE 0 END) AS this_month,
    COUNT(*) AS all_time
  FROM exam_attendance ea
  ${hasCampus ? "INNER JOIN applicant_numbering_table ant ON ant.applicant_number = ea.applicant_id INNER JOIN person_table pt ON pt.person_id = ant.person_id" : ""}
  WHERE ea.status = 'absent' ${hasCampus ? "AND pt.campus = ?" : ""}
`,
            hasCampus ? [campus] : [],
        );

        const [[realignment]] = await db.query(
            `
      SELECT
        SUM(CASE WHEN DATE(arl.created_at) = CURDATE() THEN 1 ELSE 0 END) AS today,
        SUM(CASE WHEN YEARWEEK(arl.created_at,1) = YEARWEEK(CURDATE(),1) THEN 1 ELSE 0 END) AS this_week,
        SUM(CASE WHEN DATE_FORMAT(arl.created_at,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m') THEN 1 ELSE 0 END) AS this_month,
        COUNT(*) AS all_time
      FROM applicant_realignment_log arl
      ${hasCampus ? "INNER JOIN person_table pt ON pt.person_id = arl.person_id" : ""}
      WHERE 1=1 ${hasCampus ? "AND pt.campus = ?" : ""}
    `,
            hasCampus ? [campus] : [],
        );

        const [[results]] = await db.query(
            `
      SELECT
        SUM(CASE WHEN DATE(er.date_created)=CURDATE() AND er.status=0 THEN 1 ELSE 0 END) AS today_passed,
        SUM(CASE WHEN DATE(er.date_created)=CURDATE() AND er.status=1 THEN 1 ELSE 0 END) AS today_failed,
        SUM(CASE WHEN YEARWEEK(er.date_created,1)=YEARWEEK(CURDATE(),1) AND er.status=0 THEN 1 ELSE 0 END) AS week_passed,
        SUM(CASE WHEN YEARWEEK(er.date_created,1)=YEARWEEK(CURDATE(),1) AND er.status=1 THEN 1 ELSE 0 END) AS week_failed,
        SUM(CASE WHEN DATE_FORMAT(er.date_created,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m') AND er.status=0 THEN 1 ELSE 0 END) AS month_passed,
        SUM(CASE WHEN DATE_FORMAT(er.date_created,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m') AND er.status=1 THEN 1 ELSE 0 END) AS month_failed,
        SUM(CASE WHEN er.status=0 THEN 1 ELSE 0 END) AS all_time_passed,
        SUM(CASE WHEN er.status=1 THEN 1 ELSE 0 END) AS all_time_failed
      FROM exam_results er
      ${hasCampus ? "INNER JOIN person_table pt ON pt.person_id = er.person_id" : ""}
      WHERE 1=1 ${hasCampus ? "AND pt.campus = ?" : ""}
    `,
            hasCampus ? [campus] : [],
        );

        const n = (v) => Number(v || 0);

        res.json({
            ecat_takers: {
                today: n(takers.today),
                this_week: n(takers.this_week),
                this_month: n(takers.this_month),
                all_time: n(takers.all_time),
            },
            non_appearance: {
                today: n(nonAppearance.today),
                this_week: n(nonAppearance.this_week),
                this_month: n(nonAppearance.this_month),
                all_time: n(nonAppearance.all_time),
            },
            realignment: {
                today: n(realignment.today),
                this_week: n(realignment.this_week),
                this_month: n(realignment.this_month),
                all_time: n(realignment.all_time),
            },
            ecat_results: {
                today_passed: n(results.today_passed),
                today_failed: n(results.today_failed),
                week_passed: n(results.week_passed),
                week_failed: n(results.week_failed),
                month_passed: n(results.month_passed),
                month_failed: n(results.month_failed),
                all_time_passed: n(results.all_time_passed),
                all_time_failed: n(results.all_time_failed),
            },
        });
    } catch (err) {
        console.error("Error building admissions summary:", err);
        res.status(500).json({ error: "Failed to build admissions summary" });
    }
});

// ====================================================================
// 1. ECAT EXAM TAKERS — list for the downloadable PDF
// ====================================================================
router.get("/reports/ecat-takers/list", async (req, res) => {
    const { period = "month", value, campus } = req.query;
    const { clause, params } = periodWhere("er.date_created", period, value);
    const cw = campusWhere("pt", campus);

    try {
        const [rows] = await db.query(
            `
      SELECT
        er.id, er.person_id, er.total_score, er.percentage, er.final_rating,
        er.status, er.date_created,
        ant.applicant_number, pt.last_name, pt.first_name, pt.middle_name,
        pt.extension, pt.program, pt.campus
      FROM exam_results er
      JOIN person_table pt ON er.person_id = pt.person_id
      LEFT JOIN applicant_numbering_table ant ON ant.person_id = pt.person_id
      WHERE ${clause}${cw.clause}
      ORDER BY er.date_created DESC
      `,
            [...params, ...cw.params],
        );
        res.json(rows);
    } catch (err) {
        console.error("Error fetching ECAT takers list:", err);
        res.status(500).json({ error: "Failed to fetch ECAT takers list" });
    }
});

// ====================================================================
// 2. NON-APPEARANCE — list for the downloadable PDF
// Definition: exam_attendance.status = 'absent' i.e. the registrar ran
// "Mark Absent" for that schedule and this applicant never scanned in.
// ====================================================================
router.get("/reports/non-appearance/list", async (req, res) => {
    const { period = "month", value, campus } = req.query;
    const { clause, params } = periodWhere("ea.absent_at", period, value);
    const cw = campusWhere("pt", campus);

    try {
        const [rows] = await db.query(
            `
      SELECT
        ea.id AS attendance_id, ea.applicant_id, ea.status, ea.absent_at,
        ea.scanned_at, ea.scanned_by,
        s.schedule_id, s.created_at AS exam_date, s.day_description,
        s.room_description, s.building_description,
        pt.last_name, pt.first_name, pt.middle_name, pt.extension, pt.program, pt.campus
      FROM exam_attendance ea
      JOIN entrance_exam_schedule s ON ea.schedule_id = s.schedule_id
      JOIN applicant_numbering_table ant ON ant.applicant_number = ea.applicant_id
      JOIN person_table pt ON pt.person_id = ant.person_id
      WHERE ea.status = 'absent' AND ${clause}${cw.clause}
      ORDER BY ea.absent_at DESC
      `,
            [...params, ...cw.params],
        );
        res.json(rows);
    } catch (err) {
        console.error("Error fetching non-appearance list:", err);
        res.status(500).json({ error: "Failed to fetch non-appearance list" });
    }
});

// ====================================================================
// 3. REALIGNMENT — list for the downloadable PDF
// Fed by applicant_realignment_log, written by POST /reports/realignment/log
// (call site: ExaminationPermitChangeCourse.jsx's fetchControlNumber).
// current_curriculum_id lets the list show whether the applicant's
// program on file actually differs today from what it was when the
// Change Course form was generated.
// ====================================================================
router.get("/reports/realignment/list", async (req, res) => {
    const { period = "month", value, campus } = req.query;
    const { clause, params } = periodWhere("arl.created_at", period, value);
    const cw = campusWhere("pt", campus);

    try {
        const [rows] = await db.query(
            `
      SELECT
        arl.id, arl.person_id, arl.applicant_number, arl.applicant_name,
        arl.from_curriculum_id, arl.form_type, arl.action_type,
        arl.control_number, arl.actor_id, arl.actor_role, arl.created_at,
        pt.program AS current_curriculum_id, pt.campus
      FROM applicant_realignment_log arl
      LEFT JOIN person_table pt ON pt.person_id = arl.person_id
      WHERE ${clause}${cw.clause}
      ORDER BY arl.created_at DESC
      `,
            [...params, ...cw.params],
        );
        res.json(rows);
    } catch (err) {
        console.error("Error fetching realignment list:", err);
        res.status(500).json({ error: "Failed to fetch realignment list" });
    }
});

// Called right after a Change Course control number is generated
// (print or download) so every issuance is tracked for the report.
router.post("/reports/realignment/log", async (req, res) => {
    const {
        person_id,
        applicant_number,
        form_type,
        action_type,
        control_number,
        audit_actor_id,
        audit_actor_role,
    } = req.body;

    if (!person_id || !form_type) {
        return res.status(400).json({ error: "person_id and form_type are required" });
    }

    if (!REALIGNMENT_FORM_TYPES.includes(form_type)) {
        // Not a Change Course form (e.g. the Exam Permit) — nothing to log.
        return res.json({ logged: false, reason: "form_type is not a change-course form" });
    }

    try {
        const [[person]] = await db.query(
            `SELECT last_name, first_name, middle_name, program FROM person_table WHERE person_id = ? LIMIT 1`,
            [person_id],
        );

        const applicantName = person
            ? [person.last_name, person.first_name, person.middle_name].filter(Boolean).join(", ")
            : "";

        await db.query(
            `INSERT INTO applicant_realignment_log
        (person_id, applicant_number, applicant_name, from_curriculum_id, form_type, action_type, control_number, actor_id, actor_role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                person_id,
                applicant_number || null,
                applicantName,
                person?.program || null,
                form_type,
                action_type || "download",
                control_number || null,
                audit_actor_id || "unknown",
                audit_actor_role || "registrar",
            ],
        );

        res.json({ logged: true, form_type_label: FORM_TYPE_LABELS[form_type] });
    } catch (err) {
        console.error("Error logging realignment:", err);
        res.status(500).json({ error: "Failed to log realignment" });
    }
});

// ====================================================================
// 4. ECAT PASSERS / FAILERS — list for the downloadable PDF
// status query param: "0" = passed only, "1" = failed only, omit = both
// ====================================================================
router.get("/reports/ecat-results/list", async (req, res) => {
    const { period = "month", value, status, campus } = req.query;
    const { clause, params } = periodWhere("er.date_created", period, value);
    const cw = campusWhere("pt", campus);

    let statusClause = "";
    const statusParams = [];
    if (status === "0" || status === "1") {
        statusClause = " AND er.status = ?";
        statusParams.push(status);
    }

    try {
        const [rows] = await db.query(
            `
      SELECT
        er.id, er.person_id, er.total_score, er.percentage, er.final_rating,
        er.status, er.date_created,
        ant.applicant_number, pt.last_name, pt.first_name, pt.middle_name,
        pt.extension, pt.program, pt.campus
      FROM exam_results er
      JOIN person_table pt ON er.person_id = pt.person_id
      LEFT JOIN applicant_numbering_table ant ON ant.person_id = pt.person_id
      WHERE ${clause}${statusClause}${cw.clause}
      ORDER BY er.date_created DESC
      `,
            [...params, ...statusParams, ...cw.params],
        );
        res.json(rows);
    } catch (err) {
        console.error("Error fetching ECAT results list:", err);
        res.status(500).json({ error: "Failed to fetch ECAT results list" });
    }
});

module.exports = router;
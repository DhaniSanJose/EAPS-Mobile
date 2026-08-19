const express = require("express");
const { db } = require("../database/database");

const router = express.Router();

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

// ── accepts a `column` override so callers can filter on something other
// than `<alias>.campus` (e.g. applicant_realignment_log's `campus_id`,
// resolved from the Document No. at generation time instead of the
// applicant's current person_table.campus).
const campusWhere = (alias, campus, column = "campus") => {
    if (campus === undefined || campus === "" || campus === "all") {
        return { clause: "", params: [] };
    }
    return { clause: ` AND ${alias}.${column} = ?`, params: [campus] };
};

const REALIGNMENT_FORM_TYPES = ["changeCourse", "changeCourse1", "newForm", "newForm1"];

const FORM_TYPE_LABELS = {
    changeCourse: "Change Course (College Dean)",
    changeCourse1: "Change Course (Campus Director)",
    newForm: "Empty Change Course (College Dean)",
    newForm1: "Empty Change Course (Campus Director)",
};

// ── ALL FOUR REPORT BOXES NOW DEDUPE PER PERSON ─────────────────────────
// Every summary count below uses COUNT(DISTINCT person_id) instead of
// SUM(CASE...), and every /list endpoint uses a ROW_NUMBER() PARTITION BY
// person_id subquery keeping only each person's most recent row in the
// selected period. So if an applicant is scanned present twice, marked
// absent then present, retakes the exam, or prints/downloads a Change
// Course form multiple times, they still only ever show up ONCE in the
// counts and ONCE in the downloadable PDF list.
//
// NOTE: ROW_NUMBER() requires MySQL 8.0+. If you're on 5.7, swap each
// subquery for a correlated `WHERE x.id = (SELECT MAX(id) FROM ... WHERE
// person_id = x.person_id AND <same period/status filters>)` instead.

router.get("/reports/admissions-summary", async (req, res) => {
    try {
        const { campus } = req.query;
        const hasCampus = campus !== undefined && campus !== "" && campus !== "all";

        // ── ECAT TAKERS — dedupe by person_id. Join to person_table is now
        // unconditional (not just when hasCampus) because COUNT(DISTINCT)
        // needs pt.person_id regardless of whether a campus filter is applied.
        const [[takers]] = await db.query(
            `
      SELECT
        COUNT(DISTINCT CASE WHEN DATE(ea.scanned_at) = CURDATE() THEN pt.person_id END) AS today,
        COUNT(DISTINCT CASE WHEN YEARWEEK(ea.scanned_at,1) = YEARWEEK(CURDATE(),1) THEN pt.person_id END) AS this_week,
        COUNT(DISTINCT CASE WHEN DATE_FORMAT(ea.scanned_at,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m') THEN pt.person_id END) AS this_month,
        COUNT(DISTINCT pt.person_id) AS all_time
      FROM exam_attendance ea
      INNER JOIN applicant_numbering_table ant ON ant.applicant_number = ea.applicant_id
      INNER JOIN person_table pt ON pt.person_id = ant.person_id
      WHERE ea.status = 'present' ${hasCampus ? "AND pt.campus = ?" : ""}
    `,
            hasCampus ? [campus] : [],
        );

        // ── NON-APPEARANCE — dedupe by person_id.
        const [[nonAppearance]] = await db.query(
            `
      SELECT
        COUNT(DISTINCT CASE WHEN DATE(ea.absent_at) = CURDATE() THEN pt.person_id END) AS today,
        COUNT(DISTINCT CASE WHEN YEARWEEK(ea.absent_at,1) = YEARWEEK(CURDATE(),1) THEN pt.person_id END) AS this_week,
        COUNT(DISTINCT CASE WHEN DATE_FORMAT(ea.absent_at,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m') THEN pt.person_id END) AS this_month,
        COUNT(DISTINCT pt.person_id) AS all_time
      FROM exam_attendance ea
      INNER JOIN applicant_numbering_table ant ON ant.applicant_number = ea.applicant_id
      INNER JOIN person_table pt ON pt.person_id = ant.person_id
      WHERE ea.status = 'absent' ${hasCampus ? "AND pt.campus = ?" : ""}
    `,
            hasCampus ? [campus] : [],
        );

        // ── REALIGNMENT — campus resolved from applicant_realignment_log.campus_id
        // (set from the Document No. at generation time), dedupe by person_id.
        const cwRealign = campusWhere("arl", campus, "campus_id");
        const [[realignment]] = await db.query(
            `
      SELECT
        COUNT(DISTINCT CASE WHEN DATE(arl.created_at) = CURDATE() THEN arl.person_id END) AS today,
        COUNT(DISTINCT CASE WHEN YEARWEEK(arl.created_at,1) = YEARWEEK(CURDATE(),1) THEN arl.person_id END) AS this_week,
        COUNT(DISTINCT CASE WHEN DATE_FORMAT(arl.created_at,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m') THEN arl.person_id END) AS this_month,
        COUNT(DISTINCT arl.person_id) AS all_time
      FROM applicant_realignment_log arl
      WHERE 1=1 ${cwRealign.clause}
    `,
            cwRealign.params,
        );

        // ── ECAT RESULTS — dedupe by person_id (in case someone retakes the exam).
        const cwResults = campusWhere("pt", campus);
        const [[results]] = await db.query(
            `
      SELECT
        COUNT(DISTINCT CASE WHEN DATE(er.date_created)=CURDATE() AND er.status=0 THEN er.person_id END) AS today_passed,
        COUNT(DISTINCT CASE WHEN DATE(er.date_created)=CURDATE() AND er.status=1 THEN er.person_id END) AS today_failed,
        COUNT(DISTINCT CASE WHEN YEARWEEK(er.date_created,1)=YEARWEEK(CURDATE(),1) AND er.status=0 THEN er.person_id END) AS week_passed,
        COUNT(DISTINCT CASE WHEN YEARWEEK(er.date_created,1)=YEARWEEK(CURDATE(),1) AND er.status=1 THEN er.person_id END) AS week_failed,
        COUNT(DISTINCT CASE WHEN DATE_FORMAT(er.date_created,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m') AND er.status=0 THEN er.person_id END) AS month_passed,
        COUNT(DISTINCT CASE WHEN DATE_FORMAT(er.date_created,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m') AND er.status=1 THEN er.person_id END) AS month_failed,
        COUNT(DISTINCT CASE WHEN er.status=0 THEN er.person_id END) AS all_time_passed,
        COUNT(DISTINCT CASE WHEN er.status=1 THEN er.person_id END) AS all_time_failed
      FROM exam_results er
      INNER JOIN person_table pt ON pt.person_id = er.person_id
      WHERE 1=1 ${cwResults.clause}
    `,
            cwResults.params,
        );

        const n = (v) => Number(v || 0);

        res.json({
            ecat_takers: { today: n(takers.today), this_week: n(takers.this_week), this_month: n(takers.this_month), all_time: n(takers.all_time) },
            non_appearance: { today: n(nonAppearance.today), this_week: n(nonAppearance.this_week), this_month: n(nonAppearance.this_month), all_time: n(nonAppearance.all_time) },
            realignment: { today: n(realignment.today), this_week: n(realignment.this_week), this_month: n(realignment.this_month), all_time: n(realignment.all_time) },
            ecat_results: {
                today_passed: n(results.today_passed), today_failed: n(results.today_failed),
                week_passed: n(results.week_passed), week_failed: n(results.week_failed),
                month_passed: n(results.month_passed), month_failed: n(results.month_failed),
                all_time_passed: n(results.all_time_passed), all_time_failed: n(results.all_time_failed),
            },
        });
    } catch (err) {
        console.error("Error building admissions summary:", err);
        res.status(500).json({ error: "Failed to build admissions summary" });
    }
});

// ====================================================================
// 1. ECAT TAKERS — list for the downloadable PDF (deduped per person)
// ====================================================================
router.get("/reports/ecat-takers/list", async (req, res) => {
    const { period = "month", value, campus } = req.query;
    const { clause, params } = periodWhere("ea2.scanned_at", period, value);
    const cw = campusWhere("pt", campus);

    try {
        const [rows] = await db.query(
            `
      SELECT
        ea.id AS attendance_id, ea.applicant_id AS applicant_number,
        ea.status, ea.scanned_at, ea.scanned_by,
        s.schedule_id, s.created_at AS exam_date, s.day_description,
        s.room_description, s.building_description,
        pt.last_name, pt.first_name, pt.middle_name, pt.extension, pt.program, pt.campus
      FROM (
        SELECT ea2.*, ant2.person_id AS resolved_person_id,
               ROW_NUMBER() OVER (PARTITION BY ant2.person_id ORDER BY ea2.scanned_at DESC) AS rn
        FROM exam_attendance ea2
        JOIN applicant_numbering_table ant2 ON ant2.applicant_number = ea2.applicant_id
        WHERE ea2.status = 'present' AND ${clause}
      ) ea
      JOIN entrance_exam_schedule s ON ea.schedule_id = s.schedule_id
      JOIN person_table pt ON pt.person_id = ea.resolved_person_id
      WHERE ea.rn = 1 ${cw.clause}
      ORDER BY ea.scanned_at DESC
      `,
            [...params, ...cw.params],
        );
        res.json(rows);
    } catch (err) {
        console.error("Error fetching ECAT takers (present) list:", err);
        res.status(500).json({ error: "Failed to fetch ECAT takers list." });
    }
});

// ====================================================================
// 2. NON-APPEARANCE — list for the downloadable PDF (deduped per person)
// ====================================================================
router.get("/reports/non-appearance/list", async (req, res) => {
    const { period = "month", value, campus } = req.query;
    const { clause, params } = periodWhere("ea2.absent_at", period, value);
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
      FROM (
        SELECT ea2.*, ant2.person_id AS resolved_person_id,
               ROW_NUMBER() OVER (PARTITION BY ant2.person_id ORDER BY ea2.absent_at DESC) AS rn
        FROM exam_attendance ea2
        JOIN applicant_numbering_table ant2 ON ant2.applicant_number = ea2.applicant_id
        WHERE ea2.status = 'absent' AND ${clause}
      ) ea
      JOIN entrance_exam_schedule s ON ea.schedule_id = s.schedule_id
      JOIN person_table pt ON pt.person_id = ea.resolved_person_id
      WHERE ea.rn = 1 ${cw.clause}
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
// 3. REALIGNMENT — list for the downloadable PDF (deduped per person)
// ====================================================================
// Filters on arl.campus_id (resolved from the Document No. at issuance,
// not the applicant's current person_table.campus).
router.get("/reports/realignment/list", async (req, res) => {
    const { period = "month", value, campus } = req.query;
    const { clause, params } = periodWhere("arl2.created_at", period, value);
    const cw = campusWhere("arl2", campus, "campus_id");

    try {
        const [rows] = await db.query(
            `
      SELECT
        arl.id, arl.person_id, arl.applicant_number, arl.applicant_name,
        arl.from_curriculum_id, arl.form_type, arl.action_type,
        arl.control_number, arl.campus_id, arl.actor_id, arl.actor_role, arl.created_at,
        pt.program AS current_curriculum_id
      FROM (
        SELECT arl2.*,
               ROW_NUMBER() OVER (PARTITION BY arl2.person_id ORDER BY arl2.created_at DESC) AS rn
        FROM applicant_realignment_log arl2
        WHERE ${clause}${cw.clause}
      ) arl
      LEFT JOIN person_table pt ON pt.person_id = arl.person_id
      WHERE arl.rn = 1
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

// Accepts + stores campus_id (resolved from the Document No. at the moment
// it was generated via generateFormControlNumber). Falls back to the
// applicant's current person_table.campus only if the caller didn't pass
// one (legacy calls that haven't been updated yet).
router.post("/reports/realignment/log", async (req, res) => {
    const {
        person_id,
        applicant_number,
        form_type,
        action_type,
        control_number,
        campus_id,
        audit_actor_id,
        audit_actor_role,
    } = req.body;

    if (!person_id || !form_type) {
        return res.status(400).json({ error: "person_id and form_type are required" });
    }

    if (!REALIGNMENT_FORM_TYPES.includes(form_type)) {
        return res.json({ logged: false, reason: "form_type is not a change-course form" });
    }

    try {
        const [[person]] = await db.query(
            `SELECT last_name, first_name, middle_name, program, campus FROM person_table WHERE person_id = ? LIMIT 1`,
            [person_id],
        );

        const applicantName = person
            ? [person.last_name, person.first_name, person.middle_name].filter(Boolean).join(", ")
            : "";

        const resolvedCampusId = campus_id ?? person?.campus ?? null;

        await db.query(
            `INSERT INTO applicant_realignment_log
        (person_id, applicant_number, applicant_name, from_curriculum_id, form_type, action_type, control_number, campus_id, actor_id, actor_role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                person_id,
                applicant_number || null,
                applicantName,
                person?.program || null,
                form_type,
                action_type || "download",
                control_number || null,
                resolvedCampusId,
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
// 4. ECAT PASSERS / FAILERS — list for the downloadable PDF (deduped per person)
// ====================================================================
router.get("/reports/ecat-results/list", async (req, res) => {
    const { period = "month", value, status, campus } = req.query;
    const { clause, params } = periodWhere("er2.date_created", period, value);
    const cw = campusWhere("pt", campus);

    let statusClause = "";
    const statusParams = [];
    if (status === "0" || status === "1") {
        statusClause = " AND er2.status = ?";
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
      FROM (
        SELECT er2.*,
               ROW_NUMBER() OVER (PARTITION BY er2.person_id ORDER BY er2.date_created DESC) AS rn
        FROM exam_results er2
        WHERE ${clause}${statusClause}
      ) er
      JOIN person_table pt ON er.person_id = pt.person_id
      LEFT JOIN applicant_numbering_table ant ON ant.person_id = pt.person_id
      WHERE er.rn = 1 ${cw.clause}
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
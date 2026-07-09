const express = require("express");
const { db, db3 } = require("../database/database");
const router = express.Router();

const GWA_UNIT_SQL =
    "COALESCE(NULLIF(CAST(ct.course_unit AS DECIMAL(10,4)), 0), NULLIF(COALESCE(CAST(ct.lec_unit AS DECIMAL(10,4)), 0) + COALESCE(CAST(ct.lab_unit AS DECIMAL(10,4)), 0), 0), 0)";

const GWA_EXCLUSION_SQL = `
    (
        UPPER(REPLACE(COALESCE(ct.course_code, ''), ' ', '')) LIKE 'NSTP%'
        OR UPPER(REPLACE(COALESCE(ct.course_code, ''), ' ', '')) LIKE 'NST%'
        OR UPPER(COALESCE(ct.course_code, '')) LIKE '%CWTS%'
        OR UPPER(COALESCE(ct.course_code, '')) LIKE '%CTWS%'
        OR UPPER(COALESCE(ct.course_code, '')) LIKE '%LTS%'
        OR UPPER(COALESCE(ct.course_code, '')) LIKE '%MTS%'
        OR UPPER(REPLACE(COALESCE(ct.course_description, ''), ' ', '')) LIKE '%NSTP%'
        OR UPPER(COALESCE(ct.course_description, '')) LIKE '%NATIONAL SERVICE TRAINING%'
        OR UPPER(COALESCE(ct.course_description, '')) LIKE '%CIVIC WELFARE TRAINING%'
        OR UPPER(COALESCE(ct.course_description, '')) LIKE '%LITERACY TRAINING SERVICE%'
        OR UPPER(COALESCE(ct.course_description, '')) LIKE '%RESERVE OFFICERS TRAINING%'
        OR EXISTS (
            SELECT 1
            FROM program_tagging_table ptt_ex
            LEFT JOIN year_level_table ylt_ex
                ON ylt_ex.year_level_id = ptt_ex.year_level_id
            WHERE ptt_ex.curriculum_id = es.curriculum_id
                AND ptt_ex.course_id = es.course_id
                AND (
                    COALESCE(ptt_ex.is_nstp, 0) = 1
                    OR LOWER(COALESCE(CAST(ptt_ex.category AS CHAR), '')) IN ('bridging', 'bridge', 'special')
                    OR LOWER(COALESCE(ylt_ex.year_level_description, '')) LIKE '%bridg%'
                    OR COALESCE(LOWER(ylt_ex.level_type), 'year') = 'special'
                )
        )
    )
`;

const graduateProgramExclusionSql = (alias) => `
    (
        COALESCE(${alias}.academic_program, 0) IN (1, 2)
        OR UPPER(COALESCE(${alias}.program_code, '')) LIKE '%MASTER%'
        OR UPPER(COALESCE(${alias}.program_code, '')) LIKE '%DOCTOR%'
        OR UPPER(COALESCE(${alias}.program_code, '')) LIKE '%PHD%'
        OR UPPER(COALESCE(${alias}.program_description, '')) LIKE '%MASTER%'
        OR UPPER(COALESCE(${alias}.program_description, '')) LIKE '%MASTERAL%'
        OR UPPER(COALESCE(${alias}.program_description, '')) LIKE '%DOCTOR%'
        OR UPPER(COALESCE(${alias}.program_description, '')) LIKE '%DOCTORAL%'
        OR UPPER(COALESCE(${alias}.program_description, '')) LIKE '%PHD%'
        OR UPPER(COALESCE(${alias}.major, '')) LIKE '%MASTER%'
        OR UPPER(COALESCE(${alias}.major, '')) LIKE '%MASTERAL%'
        OR UPPER(COALESCE(${alias}.major, '')) LIKE '%DOCTOR%'
        OR UPPER(COALESCE(${alias}.major, '')) LIKE '%DOCTORAL%'
        OR UPPER(COALESCE(${alias}.major, '')) LIKE '%PHD%'
    )
`;

const honorRecordDisqualificationSql = (studentAlias) => `
    NOT EXISTS (
        SELECT 1
        FROM enrolled_subject es_bad
        WHERE es_bad.student_number = ${studentAlias}.student_number
            AND (
                COALESCE(es_bad.en_remarks, 0) IN (2, 3, 4)
                OR UPPER(TRIM(COALESCE(CAST(es_bad.final_grade AS CHAR), ''))) IN ('INC', 'INCOMPLETE', 'DRP', 'DROP', 'DROPPED', 'FAILED')
                OR UPPER(TRIM(COALESCE(CAST(es_bad.grades_status AS CHAR), ''))) IN ('INC', 'INCOMPLETE', 'DRP', 'DROP', 'DROPPED', 'FAILED')
            )
    )
`;

// ─────────────────────────────────────────────────────────────────────────────
// School Year dropdown → shows "2025-2026" (no semester suffix).
//   school_year_id sent to API = year_table.year_id
//   Backend filters with:  asyt.year_id = ?
//
// Semester dropdown → separate filter, pulled from semester_table.
//   semester_id sent to API = semester_table.semester_id
//   Backend filters with:  asyt.semester_id = ?
//
// Both work independently or together. No S1/S2/S3 mixed into the year label.
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// GET /honors/academic_achievers
// ─────────────────────────────────────────────────────────────────────────────
router.get("/honors/academic_achievers", async (req, res) => {
    try {
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
        const offset = (page - 1) * limit;

        const search       = (req.query.search || "").trim();
        const programId    = req.query.program_id    || "";
        const schoolYearId = req.query.school_year_id || "";
        const semesterId   = req.query.semester_id   || "";
        const campusId     = req.query.campus_id     || "";

        // ── Build the latestSyClause dynamically so year/semester filter
        //    happens INSIDE the MAX() subquery — not after it.
        const latestSyParams = [];
        let latestSyWhere = `ss.enrolled_status = '1'`;

        if (schoolYearId) {
            latestSyWhere += ` AND asyt_inner.year_id = ?`;
            latestSyParams.push(schoolYearId);
        }
        if (semesterId) {
            latestSyWhere += ` AND asyt_inner.semester_id = ?`;
            latestSyParams.push(semesterId);
        }

        // This picks the highest active_school_year_id that matches the
        // requested year+semester (or all years if no filter).
        const latestSyClause = `
            SELECT ss.student_number,
                   MAX(ss.active_school_year_id) AS active_school_year_id
            FROM   student_status_table ss
            INNER JOIN active_school_year_table asyt_inner
                   ON asyt_inner.id = ss.active_school_year_id
            WHERE  ${latestSyWhere}
            GROUP  BY ss.student_number
        `;

        // ── Outer filters ──────────────────────────────────────────────────
        const outerConditions = [];
        const outerParams     = [];
        outerConditions.push(`NOT ${graduateProgramExclusionSql("pgt")}`);
        outerConditions.push(honorRecordDisqualificationSql("snt"));

        if (search) {
            outerConditions.push(
                `(snt.student_number LIKE ? OR pt.last_name LIKE ? OR pt.first_name LIKE ?)`
            );
            const s = `${search}%`;
            outerParams.push(s, s, s);
        }
        if (programId) {
            // Use INNER JOIN for program so the filter is reliable
            outerConditions.push(`pgt.program_id = ?`);
            outerParams.push(programId);
        }
        if (campusId) {
            outerConditions.push(`pt.campus = ?`);
            outerParams.push(Number(campusId));
        }

        const outerWhere = outerConditions.length
            ? `AND ${outerConditions.join(" AND ")}`
            : "";

        const dataSql = `
            SELECT
                gwa_calc.student_number,
                gwa_calc.latest_school_year_id,
                gwa_calc.gwa,
                gwa_calc.max_grade,
                gwa_calc.subject_count,
                pt.last_name,
                pt.first_name,
                pt.middle_name,
                pt.emailAddress,
                pt.campus,
                pgt.program_code,
                pgt.program_description,
                pgt.major,
                dt.dprtmnt_name,
                hr.title     AS honor_title,
                hr.min_gwa,
                hr.max_gwa,
                hr.max_subject_grade

            FROM (
                SELECT
                    es.student_number,
                    latest_sy.active_school_year_id                           AS latest_school_year_id,
                    ROUND(
                        SUM(CAST(gc.equivalent_grade AS DECIMAL(10,4)) * ${GWA_UNIT_SQL})
                        / NULLIF(SUM(${GWA_UNIT_SQL}), 0),
                        4
                    ) AS gwa,
                    MAX(CAST(gc.equivalent_grade       AS DECIMAL(10,4)))     AS max_grade,
                    COUNT(es.id)                                              AS subject_count
                FROM (${latestSyClause}) latest_sy
                INNER JOIN enrolled_subject es
                    ON  es.student_number        = latest_sy.student_number
                    AND es.active_school_year_id = latest_sy.active_school_year_id
                    AND es.en_remarks            = 1
                INNER JOIN course_table ct
                    ON  ct.course_id            = es.course_id
                    AND ct.is_academic_achiever = 1
                INNER JOIN grade_conversion gc
                    ON  gc.is_disqualified = 0
                    AND gc.min_score IS NOT NULL
                    AND gc.max_score IS NOT NULL
                    AND CAST(es.final_grade AS DECIMAL(8,2)) > 0
                    AND CAST(es.final_grade AS DECIMAL(8,2))
                            BETWEEN gc.min_score AND gc.max_score
                WHERE ${GWA_UNIT_SQL} > 0
                    AND NOT ${GWA_EXCLUSION_SQL}
                GROUP BY es.student_number, latest_sy.active_school_year_id
            ) gwa_calc

            INNER JOIN student_numbering_table snt
                ON  snt.student_number = gwa_calc.student_number
            INNER JOIN person_table pt
                ON  pt.person_id = snt.person_id

            LEFT JOIN enrolled_subject es_prog
                ON  es_prog.id = (
                    SELECT MAX(es2.id) FROM enrolled_subject es2
                    WHERE  es2.student_number        = gwa_calc.student_number
                      AND  es2.active_school_year_id = gwa_calc.latest_school_year_id
                )
            LEFT JOIN curriculum_table ct2
                ON  ct2.curriculum_id = es_prog.curriculum_id
            LEFT JOIN program_table pgt
                ON  pgt.program_id = ct2.program_id
            LEFT JOIN dprtmnt_curriculum_table dct
                ON  dct.curriculum_id = ct2.curriculum_id
            LEFT JOIN dprtmnt_table dt
                ON  dt.dprtmnt_id = dct.dprtmnt_id

            INNER JOIN honors_rules hr
                ON  hr.category        = 0
                AND gwa_calc.gwa       BETWEEN hr.min_gwa AND hr.max_gwa
                AND gwa_calc.max_grade <= hr.max_subject_grade

            WHERE 1=1 ${outerWhere}

            ORDER BY gwa_calc.gwa ASC, pt.last_name ASC
            LIMIT ? OFFSET ?
        `;

        const countSql = `
            SELECT COUNT(*) AS total
            FROM (
                SELECT gwa_calc.student_number
                FROM (
                    SELECT
                        es.student_number,
                        latest_sy.active_school_year_id AS latest_school_year_id,
                        ROUND(
                            SUM(CAST(gc.equivalent_grade AS DECIMAL(10,4)) * ${GWA_UNIT_SQL})
                            / NULLIF(SUM(${GWA_UNIT_SQL}), 0),
                            4
                        ) AS gwa,
                        MAX(CAST(gc.equivalent_grade       AS DECIMAL(10,4)))     AS max_grade
                    FROM (${latestSyClause}) latest_sy
                    INNER JOIN enrolled_subject es
                        ON  es.student_number        = latest_sy.student_number
                        AND es.active_school_year_id = latest_sy.active_school_year_id
                        AND es.en_remarks            = 1
                    INNER JOIN course_table ct
                        ON  ct.course_id            = es.course_id
                        AND ct.is_academic_achiever = 1
                    INNER JOIN grade_conversion gc
                        ON  gc.is_disqualified = 0
                        AND gc.min_score IS NOT NULL
                        AND gc.max_score IS NOT NULL
                        AND CAST(es.final_grade AS DECIMAL(8,2)) > 0
                        AND CAST(es.final_grade AS DECIMAL(8,2))
                                BETWEEN gc.min_score AND gc.max_score
                    WHERE ${GWA_UNIT_SQL} > 0
                        AND NOT ${GWA_EXCLUSION_SQL}
                    GROUP BY es.student_number, latest_sy.active_school_year_id
                ) gwa_calc
                INNER JOIN student_numbering_table snt
                    ON snt.student_number = gwa_calc.student_number
                INNER JOIN person_table pt
                    ON pt.person_id = snt.person_id
                LEFT JOIN enrolled_subject es_prog
                    ON es_prog.id = (
                        SELECT MAX(es2.id) FROM enrolled_subject es2
                        WHERE  es2.student_number        = gwa_calc.student_number
                          AND  es2.active_school_year_id = gwa_calc.latest_school_year_id
                    )
                LEFT JOIN curriculum_table ct2
                    ON ct2.curriculum_id = es_prog.curriculum_id
                LEFT JOIN program_table pgt
                    ON pgt.program_id = ct2.program_id
                INNER JOIN honors_rules hr
                    ON  hr.category        = 0
                    AND gwa_calc.gwa       BETWEEN hr.min_gwa AND hr.max_gwa
                    AND gwa_calc.max_grade <= hr.max_subject_grade
                WHERE 1=1 ${outerWhere}
            ) counted
        `;

        // latestSyParams used twice (data + count), outerParams used twice
        const allLatest = [...latestSyParams];
        const allOuter  = [...outerParams];

        const [rows]      = await db3.query(dataSql,  [...allLatest, ...allOuter, limit, offset]);
        const [countRows] = await db3.query(countSql, [...allLatest, ...allOuter]);

        res.json({
            data:       rows,
            total:      countRows[0].total,
            page,
            totalPages: Math.ceil(countRows[0].total / limit),
        });

    } catch (err) {
        console.error("Academic achievers error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /honors/latin_honors
// ─────────────────────────────────────────────────────────────────────────────
router.get("/honors/latin_honors", async (req, res) => {
    try {
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
        const offset = (page - 1) * limit;

        const search       = (req.query.search || "").trim();
        const programId    = req.query.program_id    || "";
        const campusId     = req.query.campus_id     || "";
        // Latin honors = cumulative overall GWA, so no school-year or semester filter.

        let innerWhere = `es.en_remarks = 1`;

        // ── Outer filters ──────────────────────────────────────────────────
        const outerConditions = [];
        const outerParams     = [];
        outerConditions.push(`NOT ${graduateProgramExclusionSql("pgt")}`);
        outerConditions.push(honorRecordDisqualificationSql("snt"));

        if (search) {
            outerConditions.push(
                `(snt.student_number LIKE ? OR pt.last_name LIKE ? OR pt.first_name LIKE ?)`
            );
            const s = `${search}%`;
            outerParams.push(s, s, s);
        }
        if (programId) {
            outerConditions.push(`pgt.program_id = ?`);
            outerParams.push(programId);
        }
        if (campusId) {
            outerConditions.push(`pt.campus = ?`);
            outerParams.push(Number(campusId));
        }

        const outerWhere = outerConditions.length
            ? `AND ${outerConditions.join(" AND ")}`
            : "";

        const dataSql = `
            SELECT
                gwa_calc.student_number,
                gwa_calc.cumulative_gwa,
                gwa_calc.max_grade,
                gwa_calc.subject_count,
                pt.last_name,
                pt.first_name,
                pt.middle_name,
                pt.emailAddress,
                pt.campus,
                pgt.program_code,
                pgt.program_description,
                pgt.major,
                dt.dprtmnt_name,
                hr.title AS latin_honor,
                hr.min_gwa,
                hr.max_gwa,
                hr.max_subject_grade

            FROM (
                SELECT
                    es.student_number,
                    ROUND(
                        SUM(CAST(gc.equivalent_grade AS DECIMAL(10,4)) * ${GWA_UNIT_SQL})
                        / NULLIF(SUM(${GWA_UNIT_SQL}), 0),
                        4
                    ) AS cumulative_gwa,
                    MAX(CAST(gc.equivalent_grade       AS DECIMAL(10,4)))     AS max_grade,
                    COUNT(es.id)                                              AS subject_count
                FROM enrolled_subject es
                INNER JOIN student_status_table ss
                    ON  ss.student_number        = es.student_number
                    AND ss.active_school_year_id = es.active_school_year_id
                    AND ss.enrolled_status       = '1'
                INNER JOIN active_school_year_table asyt
                    ON  asyt.id = es.active_school_year_id
                INNER JOIN course_table ct
                    ON  ct.course_id = es.course_id
                    AND ct.is_latin  = 1
                INNER JOIN grade_conversion gc
                    ON  gc.is_disqualified = 0
                    AND gc.min_score IS NOT NULL
                    AND gc.max_score IS NOT NULL
                    AND CAST(es.final_grade AS DECIMAL(8,2)) > 0
                    AND CAST(es.final_grade AS DECIMAL(8,2))
                            BETWEEN gc.min_score AND gc.max_score
                WHERE ${innerWhere}
                    AND ${GWA_UNIT_SQL} > 0
                    AND NOT ${GWA_EXCLUSION_SQL}
                GROUP BY es.student_number
            ) gwa_calc

            INNER JOIN student_numbering_table snt
                ON  snt.student_number = gwa_calc.student_number
            INNER JOIN person_table pt
                ON  pt.person_id = snt.person_id

            LEFT JOIN enrolled_subject es_prog
                ON  es_prog.id = (
                    SELECT MAX(es2.id) FROM enrolled_subject es2
                    WHERE  es2.student_number = gwa_calc.student_number
                )
            LEFT JOIN curriculum_table ct2
                ON  ct2.curriculum_id = es_prog.curriculum_id
            LEFT JOIN program_table pgt
                ON  pgt.program_id = ct2.program_id
            LEFT JOIN dprtmnt_curriculum_table dct
                ON  dct.curriculum_id = ct2.curriculum_id
            LEFT JOIN dprtmnt_table dt
                ON  dt.dprtmnt_id = dct.dprtmnt_id

            INNER JOIN honors_rules hr
                ON  hr.category             = 1
                AND gwa_calc.cumulative_gwa BETWEEN hr.min_gwa AND hr.max_gwa
                AND gwa_calc.max_grade      <= hr.max_subject_grade

            WHERE 1=1 ${outerWhere}

            ORDER BY gwa_calc.cumulative_gwa ASC, pt.last_name ASC
            LIMIT ? OFFSET ?
        `;

        const countSql = `
            SELECT COUNT(*) AS total
            FROM (
                SELECT gwa_calc.student_number
                FROM (
                    SELECT
                        es.student_number,
                        ROUND(
                            SUM(CAST(gc.equivalent_grade AS DECIMAL(10,4)) * ${GWA_UNIT_SQL})
                            / NULLIF(SUM(${GWA_UNIT_SQL}), 0),
                            4
                        ) AS cumulative_gwa,
                        MAX(CAST(gc.equivalent_grade       AS DECIMAL(10,4)))     AS max_grade
                    FROM enrolled_subject es
                    INNER JOIN student_status_table ss
                        ON  ss.student_number        = es.student_number
                        AND ss.active_school_year_id = es.active_school_year_id
                        AND ss.enrolled_status       = '1'
                    INNER JOIN active_school_year_table asyt
                        ON  asyt.id = es.active_school_year_id
                    INNER JOIN course_table ct
                        ON  ct.course_id = es.course_id
                        AND ct.is_latin  = 1
                    INNER JOIN grade_conversion gc
                        ON  gc.is_disqualified = 0
                        AND gc.min_score IS NOT NULL
                        AND gc.max_score IS NOT NULL
                        AND CAST(es.final_grade AS DECIMAL(8,2)) > 0
                        AND CAST(es.final_grade AS DECIMAL(8,2))
                                BETWEEN gc.min_score AND gc.max_score
                    WHERE ${innerWhere}
                        AND ${GWA_UNIT_SQL} > 0
                        AND NOT ${GWA_EXCLUSION_SQL}
                    GROUP BY es.student_number
                ) gwa_calc
                INNER JOIN student_numbering_table snt
                    ON snt.student_number = gwa_calc.student_number
                INNER JOIN person_table pt
                    ON pt.person_id = snt.person_id
                LEFT JOIN enrolled_subject es_prog
                    ON es_prog.id = (
                        SELECT MAX(e2.id) FROM enrolled_subject e2
                        WHERE e2.student_number = gwa_calc.student_number
                    )
                LEFT JOIN curriculum_table ct2
                    ON ct2.curriculum_id = es_prog.curriculum_id
                LEFT JOIN program_table pgt
                    ON pgt.program_id = ct2.program_id
                INNER JOIN honors_rules hr
                    ON  hr.category             = 1
                    AND gwa_calc.cumulative_gwa BETWEEN hr.min_gwa AND hr.max_gwa
                    AND gwa_calc.max_grade      <= hr.max_subject_grade
                WHERE 1=1 ${outerWhere}
            ) counted
        `;

        const [rows]      = await db3.query(dataSql,  [...outerParams, limit, offset]);
        const [countRows] = await db3.query(countSql, [...outerParams]);

        res.json({
            data:       rows,
            total:      countRows[0].total,
            page,
            totalPages: Math.ceil(countRows[0].total / limit),
        });

    } catch (err) {
        console.error("Latin honors error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /honors/school_years
// One entry per academic year — "2025-2026", "2024-2025", etc.
// Highest year first. school_year_id = year_table.year_id.
// Semester is a SEPARATE filter — not mixed into this dropdown at all.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/honors/school_years", async (req, res) => {
    try {
        const [rows] = await db3.query(`
      SELECT
        yt.year_id                                                    AS school_year_id,
        CONCAT(yt.year_description, '-', (yt.year_description + 1))  AS school_year_description
      FROM year_table yt
      WHERE EXISTS (
        SELECT 1 FROM active_school_year_table asyt
        WHERE asyt.year_id = yt.year_id
      )
      ORDER BY yt.year_description DESC
    `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /honors/semesters
// First Semester / Second Semester / Summer — from semester_table.
// Used by the Semester dropdown (academic achievers tab only).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/honors/semesters", async (req, res) => {
    try {
        const [rows] = await db3.query(`
      SELECT semester_id, semester_description, semester_code
      FROM   semester_table
      ORDER  BY semester_id ASC
    `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /honors/programs
// ─────────────────────────────────────────────────────────────────────────────
router.get("/honors/programs", async (req, res) => {
    try {
        const campusId = req.query.campus_id || "";
        const params = [];
        let campusWhere = "";

        if (campusId) {
            campusWhere = `
                AND EXISTS (
                    SELECT 1
                    FROM student_numbering_table snt
                    INNER JOIN person_table pt
                        ON pt.person_id = snt.person_id
                    INNER JOIN enrolled_subject es
                        ON es.student_number = snt.student_number
                    INNER JOIN curriculum_table ct
                        ON ct.curriculum_id = es.curriculum_id
                    WHERE ct.program_id = p.program_id
                        AND pt.campus = ?
                )
            `;
            params.push(Number(campusId));
        }

        const [rows] = await db3.query(`
      SELECT program_id, program_code, program_description, major
      FROM   program_table p
      WHERE  NOT ${graduateProgramExclusionSql("p")}
        ${campusWhere}
      ORDER  BY program_code ASC
    `, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;

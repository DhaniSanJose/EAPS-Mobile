const express = require("express");
const { db3 } = require("../database/database");
const {
  CanCreate,
  CanDelete,
  CanEdit,
} = require("../../middleware/pagePermissions");
const { insertAuditLogEnrollment } = require("../../utils/auditLogger");
const {
  getScopes,
  isInScope,
  employeeHasAnyScope,
} = require("../../utils/registrarScopeService");

const router = express.Router();

const formatAuditActorRole = (role) => {
  const safeRole = String(role || "registrar").trim();
  if (!safeRole) return "Registrar";
  return safeRole
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const getAuditActor = (req) => ({
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

const insertSectionSlotAuditLog = async ({ req, action, message }) => {
  const { actorId, actorRole } = getAuditActor(req);
  await insertAuditLogEnrollment({
    actorId,
    role: actorRole,
    action,
    message,
    severity: "INFO",
  });
};

const getEmployeeScope = async (employeeId) => {
  if (!employeeId) return null;

  const scopes = await getScopes(employeeId);
  if (!scopes.length) {
    const [[legacy]] = await db3.query(
      `SELECT employee_id, dprtmnt_id
       FROM user_accounts
       WHERE employee_id = ?
       LIMIT 1`,
      [employeeId],
    );
    return legacy
      ? {
          employee_id: legacy.employee_id,
          dprtmnt_id: legacy.dprtmnt_id,
          program_id: null,
        }
      : null;
  }

  return {
    employee_id: employeeId,
    scopes,
    dprtmnt_id: scopes.length === 1 ? scopes[0].dprtmnt_id : null,
    program_id: scopes.length === 1 ? scopes[0].program_id : null,
  };
};

const enforceReadScope = async (req, res, departmentId, programId) => {
  if (String(req.query.enforceScope) !== "1") return true;

  const employeeId = req.headers["x-employee-id"];
  if (!employeeId) {
    res.status(400).json({ error: "Employee ID is required for scoped access" });
    return false;
  }

  const hasScopeRows = await employeeHasAnyScope(employeeId);
  if (hasScopeRows) {
    const allowed = await isInScope(employeeId, departmentId, programId);
    if (!allowed) {
      res.status(403).json({ error: "You do not have access to this department/program" });
      return false;
    }
    return true;
  }

  const scope = await getEmployeeScope(employeeId);
  if (!scope) {
    res.status(403).json({ error: "Employee scope not found" });
    return false;
  }

  if (scope.dprtmnt_id && String(scope.dprtmnt_id) !== String(departmentId)) {
    res.status(403).json({ error: "You do not have access to this department" });
    return false;
  }

  if (scope.program_id && String(scope.program_id) !== String(programId)) {
    res.status(403).json({ error: "You do not have access to this program" });
    return false;
  }

  return true;
};

const getSectionLabel = async (departmentSectionId) => {
  const [[row]] = await db3.query(
    `SELECT pt.program_code, st.description AS section_description
     FROM dprtmnt_section_table dst
     INNER JOIN curriculum_table ct ON dst.curriculum_id = ct.curriculum_id
     INNER JOIN program_table pt ON ct.program_id = pt.program_id
     INNER JOIN section_table st ON dst.section_id = st.id
     WHERE dst.id = ?
     LIMIT 1`,
    [departmentSectionId],
  );
  if (!row) return `section ID ${departmentSectionId}`;
  return `${row.program_code}-${row.section_description}`;
};

const getCourseLabel = async (courseId) => {
  const [[row]] = await db3.query(
    `SELECT course_code, course_description
     FROM course_table
     WHERE course_id = ?
     LIMIT 1`,
    [courseId],
  );
  if (!row) return `course ID ${courseId}`;
  return `${row.course_code} - ${row.course_description}`;
};

const buildSectionsQuery = (courseFilter) => `
  SELECT
    dst.id AS department_section_id,
    ct.curriculum_id,
    pt.program_code,
    pt.program_description,
    st.description AS section_description,
    sst.id AS section_subject_id,
    sst.course_id,
    cst.course_code,
    cst.course_description,
    ylt.year_level_description,
    GROUP_CONCAT(
      DISTINCT CONCAT(
        TIME_FORMAT(tt.school_time_start, '%h:%i %p'),
        ' - ',
        TIME_FORMAT(tt.school_time_end, '%h:%i %p')
      )
      ORDER BY tt.school_time_start
      SEPARATOR ', '
    ) AS schedule,
    GROUP_CONCAT(
      DISTINCT NULLIF(
        TRIM(CONCAT(IFNULL(prf.lname, ''), ', ', IFNULL(prf.fname, ''), ' ', IFNULL(prf.mname, ''))),
        ','
      )
      ORDER BY prf.lname, prf.fname
      SEPARATOR ', '
    ) AS faculty_name,
    COALESCE(sst.max_slots, dst.max_slots) AS max_slots
  FROM dprtmnt_section_table dst
  INNER JOIN dprtmnt_curriculum_table dct ON dst.curriculum_id = dct.curriculum_id
  INNER JOIN section_table st ON dst.section_id = st.id
  INNER JOIN curriculum_table ct ON dct.curriculum_id = ct.curriculum_id
  INNER JOIN program_table pt ON ct.program_id = pt.program_id
  LEFT JOIN section_subject_table sst
    ON dst.id = sst.department_section_id
    AND sst.active_school_year_id = ?
  LEFT JOIN course_table cst ON sst.course_id = cst.course_id
  LEFT JOIN program_tagging_table ptt
    ON ptt.curriculum_id = dst.curriculum_id
    AND ptt.course_id = sst.course_id
    AND ptt.year_level_id = ?
    AND ptt.semester_id = ?
  LEFT JOIN year_level_table ylt ON ptt.year_level_id = ylt.year_level_id
  LEFT JOIN time_table tt
    ON dst.id = tt.department_section_id
    AND tt.course_id = sst.course_id
    AND tt.school_year_id = ?
  LEFT JOIN prof_table prf ON tt.professor_id = prf.prof_id
  WHERE dct.dprtmnt_id = ?
    AND pt.program_id = ?
    AND ct.curriculum_id = ?
    AND pt.components = ?
    AND dst.year_level_id = ?
    AND (sst.course_id IS NULL OR ptt.program_tagging_id IS NOT NULL)
    ${courseFilter}
  GROUP BY
    dst.id,
    ct.curriculum_id,
    pt.program_code,
    pt.program_description,
    st.description,
    sst.id,
    sst.course_id,
    cst.course_code,
    cst.course_description,
    ylt.year_level_description,
    COALESCE(sst.max_slots, dst.max_slots)
  ORDER BY st.description ASC, cst.course_code ASC
`;

router.get("/section-slot/sections", async (req, res) => {
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

  const scopeOk = await enforceReadScope(req, res, departmentId, programId);
  if (!scopeOk) return;

  const params = [
    activeSchoolYearId,
    yearLevelId,
    semesterId,
    activeSchoolYearId,
    departmentId,
    programId,
    curriculumId,
    campus,
    yearLevelId,
  ];
  const courseFilter = courseId ? "AND sst.course_id = ?" : "";
  if (courseId) params.push(courseId);

  try {
    const [rows] = await db3.query(buildSectionsQuery(courseFilter), params);
    return res.status(200).json(rows);
  } catch (err) {
    console.error("Error fetching section slot rows:", err);
    return res.status(500).json({
      error: "Database error",
      details: err.message,
    });
  }
});

router.get("/slot-monitoring-sections", async (req, res) => {
  req.query.enforceScope = req.query.enforceScope || "0";
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

  const scopeOk = await enforceReadScope(req, res, departmentId, programId);
  if (!scopeOk) return;

  const params = [
    activeSchoolYearId,
    yearLevelId,
    semesterId,
    activeSchoolYearId,
    departmentId,
    programId,
    curriculumId,
    campus,
    yearLevelId,
  ];
  const courseFilter = courseId ? "AND sst.course_id = ?" : "";
  if (courseId) params.push(courseId);

  try {
    const [rows] = await db3.query(buildSectionsQuery(courseFilter), params);
    return res.status(200).json(rows);
  } catch (err) {
    console.error("Error fetching slot monitoring sections:", err);
    return res.status(500).json({
      error: "Database error",
      details: err.message,
    });
  }
});

router.post("/section-slot/enrolled-count", async (req, res) => {
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
    console.error("Error fetching enrolled counts:", err);
    return res.status(500).json({
      error: "Database error",
      details: err.message,
    });
  }
});

router.post("/slot-monitoring-enrolled-count", async (req, res) => {
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
    console.error("Error fetching enrolled counts:", err);
    return res.status(500).json({
      error: "Database error",
      details: err.message,
    });
  }
});

router.get("/section-slot/tagged-subjects/:departmentSectionId", async (req, res) => {
  const { departmentSectionId } = req.params;
  const { activeSchoolYearId } = req.query;

  if (!departmentSectionId || !activeSchoolYearId) {
    return res.status(400).json({
      error: "departmentSectionId and activeSchoolYearId are required",
    });
  }

  try {
    const [rows] = await db3.query(
      `SELECT
        sst.id AS section_subject_id,
        sst.department_section_id,
        sst.course_id,
        sst.curriculum_id,
        sst.active_school_year_id,
        cst.course_code,
        cst.course_description,
        CASE WHEN tt.id IS NOT NULL THEN 1 ELSE 0 END AS has_schedule
      FROM section_subject_table sst
      INNER JOIN course_table cst ON sst.course_id = cst.course_id
      LEFT JOIN time_table tt
        ON tt.department_section_id = sst.department_section_id
        AND tt.course_id = sst.course_id
        AND tt.school_year_id = sst.active_school_year_id
      WHERE sst.department_section_id = ?
        AND sst.active_school_year_id = ?
      ORDER BY cst.course_code ASC`,
      [departmentSectionId, activeSchoolYearId],
    );
    return res.status(200).json(rows);
  } catch (err) {
    console.error("Error fetching tagged subjects:", err);
    return res.status(500).json({
      error: "Database error",
      details: err.message,
    });
  }
});

router.post("/section-slot/tag", CanCreate, async (req, res) => {
  const {
    department_section_id,
    curriculum_id,
    active_school_year_id,
    year_level_id,
    semester_id,
    course_ids,
  } = req.body;

  if (
    !department_section_id ||
    !curriculum_id ||
    !active_school_year_id ||
    !Array.isArray(course_ids) ||
    course_ids.length === 0
  ) {
    return res.status(400).json({
      error:
        "department_section_id, curriculum_id, active_school_year_id, and course_ids are required",
    });
  }

  try {
    const [[section]] = await db3.query(
      `SELECT id FROM dprtmnt_section_table WHERE id = ? AND curriculum_id = ? LIMIT 1`,
      [department_section_id, curriculum_id],
    );
    if (!section) {
      return res.status(404).json({ error: "Department section not found" });
    }

    const [[activeYear]] = await db3.query(
      `SELECT id FROM active_school_year_table WHERE id = ? LIMIT 1`,
      [active_school_year_id],
    );
    if (!activeYear) {
      return res.status(404).json({ error: "Active school year not found" });
    }

    const uniqueCourseIds = [
      ...new Set(course_ids.map((id) => Number(id)).filter((id) => !Number.isNaN(id))),
    ];

    if (uniqueCourseIds.length === 0) {
      return res.status(400).json({ error: "No valid course IDs provided" });
    }

    const placeholders = uniqueCourseIds.map(() => "?").join(", ");
    const [existingCourses] = await db3.query(
      `SELECT course_id FROM course_table WHERE course_id IN (${placeholders})`,
      uniqueCourseIds,
    );

    if (existingCourses.length !== uniqueCourseIds.length) {
      return res.status(400).json({ error: "One or more courses were not found" });
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    const sectionLabel = await getSectionLabel(department_section_id);
    const taggedLabels = [];

    for (const courseId of uniqueCourseIds) {
      const [result] = await db3.query(
        `INSERT IGNORE INTO section_subject_table
          (department_section_id, course_id, curriculum_id, active_school_year_id, year_level_id, semester_id, tagged_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          department_section_id,
          courseId,
          curriculum_id,
          active_school_year_id,
          year_level_id || null,
          semester_id || null,
          actorId,
        ],
      );

      if (result.affectedRows > 0) {
        taggedLabels.push(await getCourseLabel(courseId));
      }
    }

    if (taggedLabels.length > 0) {
      await insertSectionSlotAuditLog({
        req,
        action: "SECTION_SUBJECT_TAG",
        message: `${roleLabel} (${actorId}) tagged ${taggedLabels.join(", ")} to ${sectionLabel}.`,
      });
    }

    return res.status(200).json({
      message: "Subjects tagged successfully",
      tagged_count: taggedLabels.length,
    });
  } catch (err) {
    console.error("Error tagging section subjects:", err);
    return res.status(500).json({
      error: "Database error",
      details: err.message,
    });
  }
});

router.get("/section-slot/tag/:id/check", async (req, res) => {
  const { id } = req.params;

  try {
    const [[tag]] = await db3.query(
      `SELECT department_section_id, course_id, active_school_year_id
       FROM section_subject_table
       WHERE id = ?
       LIMIT 1`,
      [id],
    );

    if (!tag) {
      return res.status(404).json({ error: "Tagged subject not found" });
    }

    const [[enrolled]] = await db3.query(
      `SELECT COUNT(DISTINCT student_number) AS enrolled_count
       FROM enrolled_subject
       WHERE department_section_id = ?
         AND course_id = ?
         AND active_school_year_id = ?`,
      [tag.department_section_id, tag.course_id, tag.active_school_year_id],
    );

    const [[schedule]] = await db3.query(
      `SELECT COUNT(*) AS schedule_count
       FROM time_table
       WHERE department_section_id = ?
         AND course_id = ?
         AND school_year_id = ?`,
      [tag.department_section_id, tag.course_id, tag.active_school_year_id],
    );

    return res.status(200).json({
      enrolled_count: Number(enrolled?.enrolled_count) || 0,
      has_schedule: Number(schedule?.schedule_count) > 0,
    });
  } catch (err) {
    console.error("Error checking tagged subject:", err);
    return res.status(500).json({
      error: "Database error",
      details: err.message,
    });
  }
});

router.delete("/section-slot/tag/:id", CanDelete, async (req, res) => {
  const { id } = req.params;

  try {
    const [[tag]] = await db3.query(
      `SELECT sst.id, sst.department_section_id, sst.course_id, sst.active_school_year_id,
              cst.course_code, cst.course_description
       FROM section_subject_table sst
       LEFT JOIN course_table cst ON sst.course_id = cst.course_id
       WHERE sst.id = ?
       LIMIT 1`,
      [id],
    );

    if (!tag) {
      return res.status(404).json({ error: "Tagged subject not found" });
    }

    const [[enrolled]] = await db3.query(
      `SELECT COUNT(DISTINCT student_number) AS enrolled_count
       FROM enrolled_subject
       WHERE department_section_id = ?
         AND course_id = ?
         AND active_school_year_id = ?`,
      [tag.department_section_id, tag.course_id, tag.active_school_year_id],
    );

    if (Number(enrolled?.enrolled_count) > 0) {
      return res.status(400).json({
        error: "Cannot untag subject while students are enrolled.",
        enrolled_count: Number(enrolled.enrolled_count),
      });
    }

    await db3.query(`DELETE FROM section_subject_table WHERE id = ?`, [id]);

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    const sectionLabel = await getSectionLabel(tag.department_section_id);
    const courseLabel = `${tag.course_code || ""} - ${tag.course_description || ""}`.trim();

    await insertSectionSlotAuditLog({
      req,
      action: "SECTION_SUBJECT_UNTAG",
      message: `${roleLabel} (${actorId}) removed ${courseLabel} from ${sectionLabel}.`,
    });

    return res.status(200).json({ message: "Subject untagged successfully" });
  } catch (err) {
    console.error("Error untagging section subject:", err);
    return res.status(500).json({
      error: "Database error",
      details: err.message,
    });
  }
});

router.put("/section-slot/tag/:id/max-slots", CanEdit, async (req, res) => {
  const { id } = req.params;
  const { max_slots } = req.body;
  const parsedSlots = Number(max_slots);

  if (!id || Number.isNaN(parsedSlots) || parsedSlots < 0) {
    return res.status(400).json({
      error: "sectionSubjectId is required and max_slots must be a non-negative number",
    });
  }

  try {
    const [[tag]] = await db3.query(
      `SELECT sst.id, sst.department_section_id, sst.course_id
       FROM section_subject_table sst
       WHERE sst.id = ?
       LIMIT 1`,
      [id],
    );

    if (!tag) {
      return res.status(404).json({ error: "Tagged subject not found" });
    }

    const sectionLabel = await getSectionLabel(tag.department_section_id);
    const courseLabel = await getCourseLabel(tag.course_id);

    const [result] = await db3.query(
      `UPDATE section_subject_table SET max_slots = ? WHERE id = ?`,
      [parsedSlots, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Tagged subject not found" });
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);

    await insertSectionSlotAuditLog({
      req,
      action: "SECTION_SUBJECT_SLOT_UPDATE",
      message: `${roleLabel} (${actorId}) changed max slots of ${courseLabel} in ${sectionLabel} to ${parsedSlots}.`,
    });

    return res.status(200).json({ message: "Max slots updated successfully" });
  } catch (err) {
    console.error("Error updating subject max slots:", err);
    return res.status(500).json({
      error: "Database error",
      details: err.message,
    });
  }
});

router.put("/section-slot/sections/:departmentSectionId/max-slots", CanEdit, async (req, res) => {
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
    const beforeLabel = await getSectionLabel(departmentSectionId);

    const [result] = await db3.query(
      `UPDATE dprtmnt_section_table SET max_slots = ? WHERE id = ?`,
      [parsedSlots, departmentSectionId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Department section not found" });
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);

    await insertSectionSlotAuditLog({
      req,
      action: "SECTION_SLOT_UPDATE",
      message: `${roleLabel} (${actorId}) changed max slots of ${beforeLabel} to ${parsedSlots}.`,
    });

    return res.status(200).json({ message: "Max slots updated successfully" });
  } catch (err) {
    console.error("Error updating max slots:", err);
    return res.status(500).json({
      error: "Database error",
      details: err.message,
    });
  }
});

router.put("/slot-monitoring-sections/:departmentSectionId/max-slots", CanEdit, async (req, res) => {
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
    const beforeLabel = await getSectionLabel(departmentSectionId);

    const [result] = await db3.query(
      `UPDATE dprtmnt_section_table SET max_slots = ? WHERE id = ?`,
      [parsedSlots, departmentSectionId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Department section not found" });
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);

    await insertSectionSlotAuditLog({
      req,
      action: "SECTION_SLOT_UPDATE",
      message: `${roleLabel} (${actorId}) changed max slots of ${beforeLabel} to ${parsedSlots}.`,
    });

    return res.status(200).json({ message: "Max slots updated successfully" });
  } catch (err) {
    console.error("Error updating max slots:", err);
    return res.status(500).json({
      error: "Database error",
      details: err.message,
    });
  }
});

module.exports = router;

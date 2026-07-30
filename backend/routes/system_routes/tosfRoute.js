const express = require('express');
const multer = require("multer");
const { db, db3 } = require('../database/database');
const {
  CanCreate,
  CanDelete,
  CanEdit,
} = require("../../middleware/pagePermissions");
const { insertAuditLogEnrollment, resolveAuditActor } = require("../../utils/auditLogger");

const router = express.Router();

const formatAuditActorRole = (role) => {
  const safeRole = String(role || "registrar").trim();
  if (!safeRole) return "Registrar";

  return safeRole
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const getAuditActor = resolveAuditActor;

const insertTosfAuditLog = async ({ req, action, message }) => {
  const { actorId, actorRole } = getAuditActor(req);

  await insertAuditLogEnrollment({
    actorId,
    role: actorRole,
    action,
    message,
    severity: "INFO",
  });
};

const getActorLabel = (req) => {
  const { actorId, actorRole } = getAuditActor(req);
  return {
    actorId,
    roleLabel: formatAuditActorRole(actorRole),
  };
};

const FEE_CATEGORY = {
  TUITION: 2,
  MISCELLANEOUS: 3,
  OTHER: 5,
};

const normalizeAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : 0;
};

const normalizeTinyInt = (value, defaultValue) => {
  const n = Number(value);
  return Number.isInteger(n) ? n : defaultValue;
};

const normalizeNullableInt = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
};

const normalizeFeeCatalogPayload = (body) => ({
  feeCode: String(body.fee_code || "").trim().toUpperCase(),
  feeName: String(body.fee_name || "").trim(),
  feeCategory: normalizeTinyInt(body.fee_category, FEE_CATEGORY.OTHER),
  isActive: normalizeTinyInt(body.is_active, 1) === 1 ? 1 : 0,
  sortOrder: normalizeTinyInt(body.sort_order, 0),
  feeGroup: normalizeNullableInt(body.fee_group),
  accountType: normalizeNullableInt(body.account_type),
});

const normalizeFeeRatePayload = (body) => {
  const appliesToAll = normalizeTinyInt(body.applies_to_all, 1) === 1 ? 1 : 0;
  const appliedTo = normalizeNullableInt(body.applied_to) ?? 0;

  return {
    feeId: normalizeNullableInt(body.fee_id),
    dprtmntCurriculumId: appliesToAll ? null : normalizeNullableInt(body.dprtmnt_curriculum_id),
    branchId: normalizeNullableInt(body.branch_id),
    amount: normalizeAmount(body.amount),
    appliedTo,
    appliesToAll,
    isActive: normalizeTinyInt(body.is_active, 1) === 1 ? 1 : 0,
  };
};

const findDuplicateFeeRate = async (conn, payload, excludeFeeRateId = null) => {
  const params = [
    payload.feeId,
    payload.appliedTo,
    payload.appliesToAll,
    payload.dprtmntCurriculumId,
    payload.branchId,
  ];

  let sql = `
    SELECT fee_rate_id
    FROM fee_rate
    WHERE fee_id = ?
      AND applied_to = ?
      AND applies_to_all = ?
      AND (dprtmnt_curriculum_id <=> ?)
      AND (branch_id <=> ?)
  `;

  if (excludeFeeRateId) {
    sql += " AND fee_rate_id <> ?";
    params.push(excludeFeeRateId);
  }

  sql += " LIMIT 1";

  const [rows] = await conn.query(sql, params);
  return rows[0] || null;
};

router.get("/scholarship_types", async (req, res) => {
  try {
    const [rows] = await db3.query(
      "SELECT id, scholarship_name, rfd, tfd, mfd, nfd, afd, scholarship_status, created_at FROM scholarship_type ORDER BY id DESC"
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching scholarship types" });
  }
});

router.post("/insert_scholarship_type", CanCreate, async (req, res) => {
  const { scholarship_name, scholarship_status, created_at } = req.body;

  if (!scholarship_name || !String(scholarship_name).trim()) {
    return res.status(400).json({ message: "scholarship_name is required" });
  }

  try {
    const [maxRow] = await db3.query(
      "SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM scholarship_type"
    );
    const nextId = maxRow?.[0]?.next_id || 1;

    await db3.query(
      `INSERT INTO scholarship_type (
        id,
        scholarship_name,
        scholarship_status,
        created_at
      ) VALUES (?, ?, ?, ?)`,
      [
        nextId,
        String(scholarship_name).trim(),
        scholarship_status ?? 1,
        created_at ?? Math.floor(Date.now() / 1000),
      ]
    );

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "SCHOLARSHIP_TYPE_CREATE",
      message: `${roleLabel} (${actorId}) created scholarship type ${String(scholarship_name).trim()}.`,
    });

    res.json({ success: true, message: "Scholarship type inserted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while inserting scholarship type" });
  }
});

router.put("/update_scholarship_type/:id", CanEdit, async (req, res) => {
  const { id } = req.params;
  const { scholarship_name, scholarship_status } = req.body;

  if (!scholarship_name || !String(scholarship_name).trim()) {
    return res.status(400).json({ message: "scholarship_name is required" });
  }

  try {
    const [result] = await db3.query(
      `UPDATE scholarship_type
       SET scholarship_name = ?, scholarship_status = ?
       WHERE id = ?`,
      [
        String(scholarship_name).trim(),
        scholarship_status ?? 1,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Scholarship type not found" });
    }

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "SCHOLARSHIP_TYPE_UPDATE",
      message: `${roleLabel} (${actorId}) updated scholarship type ${String(scholarship_name).trim()}.`,
    });

    res.json({ success: true, message: "Scholarship type updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while updating scholarship type" });
  }
});

router.delete("/delete_scholarship_type/:id", CanDelete, async (req, res) => {
  const { id } = req.params;

  try {
    const [[scholarshipType]] = await db3.query(
      "SELECT scholarship_name FROM scholarship_type WHERE id = ? LIMIT 1",
      [id]
    );

    const [result] = await db3.query(
      "DELETE FROM scholarship_type WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Scholarship type not found" });
    }

    const scholarshipLabel = scholarshipType?.scholarship_name || `scholarship type ID ${id}`;
    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "SCHOLARSHIP_TYPE_DELETE",
      message: `${roleLabel} (${actorId}) deleted scholarship type ${scholarshipLabel}.`,
    });

    res.json({ success: true, message: "Scholarship type deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while deleting scholarship type" });
  }
});

// ================== SCHOLARSHIP RULES (PHASE 1 - no fee mapping yet) ==================

router.get("/tosf/scholarship-rule-options", async (req, res) => {
  try {
    const [yearLevels] = await db3.query(`
      SELECT year_level_id, year_level_description, level_type
      FROM year_level_table
      WHERE COALESCE(LOWER(level_type), 'year') <> 'special'
      ORDER BY year_level_id ASC
    `);

    const [schoolYears] = await db3.query(`
      SELECT id, year_id, semester_id, astatus
      FROM active_school_year_table
      ORDER BY id DESC
    `);

    const [years] = await db3.query(`
      SELECT year_id, year_description
      FROM year_table
      ORDER BY year_id DESC
    `);

    const [semesters] = await db3.query(`
      SELECT semester_id, semester_description
      FROM semester_table
      ORDER BY semester_id ASC
    `);

    res.json({ yearLevels, schoolYears, years, semesters });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching scholarship rule options" });
  }
});

router.get("/tosf/scholarship-rules", async (req, res) => {
  try {
    const scholarshipId = req.query?.scholarship_id;
    if (!scholarshipId) {
      return res.status(400).json({ message: "scholarship_id is required" });
    }

    const [rows] = await db3.query(
      `SELECT
        sr.*,
        st.scholarship_name
       FROM scholarship_rule sr
       INNER JOIN scholarship_type st ON st.id = sr.scholarship_id
       WHERE sr.scholarship_id = ?
       ORDER BY sr.id DESC`,
      [scholarshipId]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching scholarship rules" });
  }
});

router.post("/tosf/scholarship-rules", CanCreate, async (req, res) => {
  const {
    scholarship_id,
    discount_type,
    discount_value,
    year_level_id,
    school_year_id,
    semester_id,
    is_active,
  } = req.body || {};

  if (!scholarship_id) {
    return res.status(400).json({ message: "scholarship_id is required" });
  }
  if (!discount_type || !["percent", "fixed_amount"].includes(String(discount_type))) {
    return res.status(400).json({ message: "discount_type must be percent or fixed_amount" });
  }

  try {
    const [result] = await db3.query(
      `INSERT INTO scholarship_rule
       (scholarship_id, discount_type, discount_value, year_level_id, school_year_id, semester_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(scholarship_id),
        String(discount_type),
        Number(discount_value ?? 0),
        year_level_id === "" ? null : (year_level_id == null ? null : Number(year_level_id)),
        school_year_id === "" ? null : (school_year_id == null ? null : Number(school_year_id)),
        semester_id === "" ? null : (semester_id == null ? null : Number(semester_id)),
        Number(is_active ?? 1) ? 1 : 0,
      ]
    );

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "SCHOLARSHIP_RULE_CREATE",
      message: `${roleLabel} (${actorId}) created scholarship rule ${result.insertId} for scholarship_id ${scholarship_id}.`,
    });

    res.json({ success: true, id: result.insertId, message: "Scholarship rule created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while creating scholarship rule" });
  }
});

router.put("/tosf/scholarship-rules/:id", CanEdit, async (req, res) => {
  const { id } = req.params;
  const {
    scholarship_id,
    discount_type,
    discount_value,
    year_level_id,
    school_year_id,
    semester_id,
    is_active,
  } = req.body || {};

  if (!scholarship_id) {
    return res.status(400).json({ message: "scholarship_id is required" });
  }
  if (!discount_type || !["percent", "fixed_amount"].includes(String(discount_type))) {
    return res.status(400).json({ message: "discount_type must be percent or fixed_amount" });
  }

  try {
    const [result] = await db3.query(
      `UPDATE scholarship_rule
       SET scholarship_id = ?,
           discount_type = ?,
           discount_value = ?,
           year_level_id = ?,
           school_year_id = ?,
           semester_id = ?,
           is_active = ?
       WHERE id = ?`,
      [
        Number(scholarship_id),
        String(discount_type),
        Number(discount_value ?? 0),
        year_level_id === "" ? null : (year_level_id == null ? null : Number(year_level_id)),
        school_year_id === "" ? null : (school_year_id == null ? null : Number(school_year_id)),
        semester_id === "" ? null : (semester_id == null ? null : Number(semester_id)),
        Number(is_active ?? 1) ? 1 : 0,
        Number(id),
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Scholarship rule not found" });
    }

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "SCHOLARSHIP_RULE_UPDATE",
      message: `${roleLabel} (${actorId}) updated scholarship rule ${id}.`,
    });

    res.json({ success: true, message: "Scholarship rule updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while updating scholarship rule" });
  }
});

router.delete("/tosf/scholarship-rules/:id", CanDelete, async (req, res) => {
  const { id } = req.params;

  try {
    const [[rule]] = await db3.query(
      `SELECT id, scholarship_id FROM scholarship_rule WHERE id = ? LIMIT 1`,
      [id]
    );

    const [result] = await db3.query(
      `DELETE FROM scholarship_rule WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Scholarship rule not found" });
    }

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "SCHOLARSHIP_RULE_DELETE",
      message: `${roleLabel} (${actorId}) deleted scholarship rule ${id} (scholarship_id ${rule?.scholarship_id ?? "unknown"}).`,
    });

    res.json({ success: true, message: "Scholarship rule deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while deleting scholarship rule" });
  }
});

router.get("/tosf/fee-options", async (req, res) => {
  try {
    const [curricula] = await db3.query(`
      SELECT
        dc.dprtmnt_curriculum_id,
        dc.dprtmnt_id,
        d.dprtmnt_name,
        dc.curriculum_id,
        c.year_id,
        y.year_description,
        p.program_id,
        p.program_code,
        p.program_description,
        p.major
      FROM dprtmnt_curriculum_table dc
      INNER JOIN dprtmnt_table d ON d.dprtmnt_id = dc.dprtmnt_id
      INNER JOIN curriculum_table c ON c.curriculum_id = dc.curriculum_id
      INNER JOIN year_table y ON y.year_id = c.year_id
      INNER JOIN program_table p ON p.program_id = c.program_id
      ORDER BY d.dprtmnt_name, p.program_code, y.year_description
    `);

    const [yearLevels] = await db3.query(`
      SELECT year_level_id, year_level_description, level_type
      FROM year_level_table
      WHERE COALESCE(LOWER(level_type), 'year') <> 'special'
      ORDER BY year_level_id ASC
    `);

    res.json({
      categories: FEE_CATEGORY,
      yearLevels,
      curricula,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching fee options" });
  }
});

router.get("/tosf/fee-catalog", async (req, res) => {
  try {
    const [rows] = await db3.query(
      `SELECT
        fc.*,
        COALESCE(rate_counts.rate_count, 0) AS rate_count,
        fg.description AS fee_group_description,
        at.description AS account_type_description
       FROM fee_catalog fc
       LEFT JOIN fee_group fg ON fg.id = fc.fee_group
       LEFT JOIN account_type at ON at.id = fc.account_type
       LEFT JOIN (
        SELECT fee_id, COUNT(*) AS rate_count
        FROM fee_rate
        GROUP BY fee_id
       ) rate_counts ON rate_counts.fee_id = fc.fee_id
       ORDER BY fc.sort_order ASC, fc.fee_name ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching fee catalog" });
  }
});

router.post("/tosf/fee-catalog", CanCreate, async (req, res) => {
  const payload = normalizeFeeCatalogPayload(req.body);

  if (!payload.feeCode || !payload.feeName) {
    return res.status(400).json({ message: "fee_code and fee_name are required" });
  }

  try {
    const [result] = await db3.query(
      `INSERT INTO fee_catalog
       (fee_code, fee_name, fee_category, is_active, sort_order, fee_group, account_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.feeCode,
        payload.feeName,
        payload.feeCategory,
        payload.isActive,
        payload.sortOrder,
        payload.feeGroup,
        payload.accountType,
      ]
    );

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "FEE_CATALOG_CREATE",
      message: `${roleLabel} (${actorId}) created fee ${payload.feeName} (${payload.feeCode}).`,
    });

    res.json({ success: true, fee_id: result.insertId, message: "Fee created successfully" });
  } catch (error) {
    console.error(error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Fee code already exists" });
    }
    res.status(500).json({ message: "Server error while creating fee" });
  }
});

router.put("/tosf/fee-catalog/:fee_id", CanEdit, async (req, res) => {
  const { fee_id } = req.params;
  const payload = normalizeFeeCatalogPayload(req.body);

  if (!payload.feeCode || !payload.feeName) {
    return res.status(400).json({ message: "fee_code and fee_name are required" });
  }

  try {
    const [result] = await db3.query(
      `UPDATE fee_catalog
       SET fee_code = ?, fee_name = ?, fee_category = ?, is_active = ?, sort_order = ?, fee_group = ?, account_type = ?
       WHERE fee_id = ?`,
      [
        payload.feeCode,
        payload.feeName,
        payload.feeCategory,
        payload.isActive,
        payload.sortOrder,
        payload.feeGroup,
        payload.accountType,
        fee_id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Fee not found" });
    }

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "FEE_CATALOG_UPDATE",
      message: `${roleLabel} (${actorId}) updated fee ${payload.feeName} (${payload.feeCode}).`,
    });

    res.json({ success: true, message: "Fee updated successfully" });
  } catch (error) {
    console.error(error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Fee code already exists" });
    }
    res.status(500).json({ message: "Server error while updating fee" });
  }
});

router.delete("/tosf/fee-catalog/:fee_id", CanDelete, async (req, res) => {
  const { fee_id } = req.params;
  let conn;

  try {
    conn = await db3.getConnection();
    await conn.beginTransaction();

    const [[fee]] = await conn.query(
      "SELECT fee_code, fee_name FROM fee_catalog WHERE fee_id = ? LIMIT 1",
      [fee_id]
    );

    if (!fee) {
      await conn.rollback();
      return res.status(404).json({ message: "Fee not found" });
    }

    await conn.query("DELETE FROM fee_rate WHERE fee_id = ?", [fee_id]);
    await conn.query("DELETE FROM fee_catalog WHERE fee_id = ?", [fee_id]);
    await conn.commit();

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "FEE_CATALOG_DELETE",
      message: `${roleLabel} (${actorId}) deleted fee ${fee.fee_name} (${fee.fee_code}) and its rates.`,
    });

    res.json({ success: true, message: "Fee deleted successfully" });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error(error);
    res.status(500).json({ message: "Server error while deleting fee" });
  } finally {
    if (conn) conn.release();
  }
});

router.get("/tosf/fee-rates", async (req, res) => {
  try {
    const [rows] = await db3.query(`
      SELECT
        fr.*,
        fc.fee_code,
        fc.fee_name,
        fc.fee_category,
        d.dprtmnt_name,
        p.program_code,
        p.program_description,
        p.major,
        y.year_description
      FROM fee_rate fr
      INNER JOIN fee_catalog fc ON fc.fee_id = fr.fee_id
      LEFT JOIN dprtmnt_curriculum_table dc ON dc.dprtmnt_curriculum_id = fr.dprtmnt_curriculum_id
      LEFT JOIN dprtmnt_table d ON d.dprtmnt_id = dc.dprtmnt_id
      LEFT JOIN curriculum_table c ON c.curriculum_id = dc.curriculum_id
      LEFT JOIN year_table y ON y.year_id = c.year_id
      LEFT JOIN program_table p ON p.program_id = c.program_id
      ORDER BY fc.sort_order ASC, fc.fee_name ASC, fr.fee_rate_id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching fee rates" });
  }
});

router.post("/tosf/fee-rates", CanCreate, async (req, res) => {
  const payload = normalizeFeeRatePayload(req.body);

  if (!payload.feeId) {
    return res.status(400).json({ message: "fee_id is required" });
  }

  if (!payload.appliesToAll && !payload.dprtmntCurriculumId) {
    return res.status(400).json({ message: "dprtmnt_curriculum_id is required unless applies_to_all is enabled" });
  }

  try {
    const duplicate = await findDuplicateFeeRate(db3, payload);
    if (duplicate) {
      return res.status(409).json({
        message: "A fee rate with the same fee, curriculum scope, branch, and year level already exists.",
      });
    }

    const [result] = await db3.query(
      `INSERT INTO fee_rate
       (fee_id, dprtmnt_curriculum_id, branch_id, amount, applied_to, applies_to_all, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.feeId,
        payload.dprtmntCurriculumId,
        payload.branchId,
        payload.amount,
        payload.appliedTo,
        payload.appliesToAll,
        payload.isActive,
      ]
    );

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "FEE_RATE_CREATE",
      message: `${roleLabel} (${actorId}) created fee rate ${result.insertId}.`,
    });

    res.json({ success: true, fee_rate_id: result.insertId, message: "Fee rate created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while creating fee rate" });
  }
});

router.put("/tosf/fee-rates/:fee_rate_id", CanEdit, async (req, res) => {
  const { fee_rate_id } = req.params;
  const payload = normalizeFeeRatePayload(req.body);

  if (!payload.feeId) {
    return res.status(400).json({ message: "fee_id is required" });
  }

  if (!payload.appliesToAll && !payload.dprtmntCurriculumId) {
    return res.status(400).json({ message: "dprtmnt_curriculum_id is required unless applies_to_all is enabled" });
  }

  try {
    const duplicate = await findDuplicateFeeRate(db3, payload, Number(fee_rate_id));
    if (duplicate) {
      return res.status(409).json({
        message: "A fee rate with the same fee, curriculum scope, branch, and year level already exists.",
      });
    }

    const [result] = await db3.query(
      `UPDATE fee_rate
       SET fee_id = ?, dprtmnt_curriculum_id = ?, branch_id = ?, amount = ?,
           applied_to = ?, applies_to_all = ?, is_active = ?
       WHERE fee_rate_id = ?`,
      [
        payload.feeId,
        payload.dprtmntCurriculumId,
        payload.branchId,
        payload.amount,
        payload.appliedTo,
        payload.appliesToAll,
        payload.isActive,
        fee_rate_id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Fee rate not found" });
    }

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "FEE_RATE_UPDATE",
      message: `${roleLabel} (${actorId}) updated fee rate ${fee_rate_id}.`,
    });

    res.json({ success: true, message: "Fee rate updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while updating fee rate" });
  }
});

router.delete("/tosf/fee-rates/:fee_rate_id", CanDelete, async (req, res) => {
  const { fee_rate_id } = req.params;

  try {
    const [result] = await db3.query(
      "DELETE FROM fee_rate WHERE fee_rate_id = ?",
      [fee_rate_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Fee rate not found" });
    }

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "FEE_RATE_DELETE",
      message: `${roleLabel} (${actorId}) deleted fee rate ${fee_rate_id}.`,
    });

    res.json({ success: true, message: "Fee rate deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while deleting fee rate" });
  }
});

const normalizeDescription = (value) => String(value || "").trim().slice(0, 60);

router.get("/tosf/fee-groups", async (req, res) => {
  try {
    const [rows] = await db3.query(
      "SELECT id, description FROM fee_group ORDER BY description ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching fee groups" });
  }
});

router.post("/tosf/fee-groups", CanCreate, async (req, res) => {
  const description = normalizeDescription(req.body.description);

  if (!description) {
    return res.status(400).json({ message: "description is required" });
  }

  try {
    const [result] = await db3.query(
      "INSERT INTO fee_group (description) VALUES (?)",
      [description]
    );

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "FEE_GROUP_CREATE",
      message: `${roleLabel} (${actorId}) created fee group ${description}.`,
    });

    res.json({ success: true, id: result.insertId, message: "Fee group created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while creating fee group" });
  }
});

router.put("/tosf/fee-groups/:id", CanEdit, async (req, res) => {
  const { id } = req.params;
  const description = normalizeDescription(req.body.description);

  if (!description) {
    return res.status(400).json({ message: "description is required" });
  }

  try {
    const [result] = await db3.query(
      "UPDATE fee_group SET description = ? WHERE id = ?",
      [description, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Fee group not found" });
    }

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "FEE_GROUP_UPDATE",
      message: `${roleLabel} (${actorId}) updated fee group ${description}.`,
    });

    res.json({ success: true, message: "Fee group updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while updating fee group" });
  }
});

router.delete("/tosf/fee-groups/:id", CanDelete, async (req, res) => {
  const { id } = req.params;

  try {
    const [[feeGroup]] = await db3.query(
      "SELECT description FROM fee_group WHERE id = ? LIMIT 1",
      [id]
    );

    const [result] = await db3.query("DELETE FROM fee_group WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Fee group not found" });
    }

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "FEE_GROUP_DELETE",
      message: `${roleLabel} (${actorId}) deleted fee group ${feeGroup?.description || id}.`,
    });

    res.json({ success: true, message: "Fee group deleted successfully" });
  } catch (error) {
    console.error(error);
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({ message: "Cannot delete fee group because it is in use" });
    }
    res.status(500).json({ message: "Server error while deleting fee group" });
  }
});

router.get("/tosf/account-types", async (req, res) => {
  try {
    const [rows] = await db3.query(
      "SELECT id, description FROM account_type ORDER BY description ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching account types" });
  }
});

router.post("/tosf/account-types", CanCreate, async (req, res) => {
  const description = normalizeDescription(req.body.description);

  if (!description) {
    return res.status(400).json({ message: "description is required" });
  }

  try {
    const [result] = await db3.query(
      "INSERT INTO account_type (description) VALUES (?)",
      [description]
    );

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "ACCOUNT_TYPE_CREATE",
      message: `${roleLabel} (${actorId}) created account type ${description}.`,
    });

    res.json({ success: true, id: result.insertId, message: "Account type created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while creating account type" });
  }
});

router.put("/tosf/account-types/:id", CanEdit, async (req, res) => {
  const { id } = req.params;
  const description = normalizeDescription(req.body.description);

  if (!description) {
    return res.status(400).json({ message: "description is required" });
  }

  try {
    const [result] = await db3.query(
      "UPDATE account_type SET description = ? WHERE id = ?",
      [description, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Account type not found" });
    }

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "ACCOUNT_TYPE_UPDATE",
      message: `${roleLabel} (${actorId}) updated account type ${description}.`,
    });

    res.json({ success: true, message: "Account type updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while updating account type" });
  }
});

router.delete("/tosf/account-types/:id", CanDelete, async (req, res) => {
  const { id } = req.params;

  try {
    const [[accountType]] = await db3.query(
      "SELECT description FROM account_type WHERE id = ? LIMIT 1",
      [id]
    );

    const [result] = await db3.query("DELETE FROM account_type WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Account type not found" });
    }

    const { actorId, roleLabel } = getActorLabel(req);
    await insertTosfAuditLog({
      req,
      action: "ACCOUNT_TYPE_DELETE",
      message: `${roleLabel} (${actorId}) deleted account type ${accountType?.description || id}.`,
    });

    res.json({ success: true, message: "Account type deleted successfully" });
  } catch (error) {
    console.error(error);
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({ message: "Cannot delete account type because it is in use" });
    }
    res.status(500).json({ message: "Server error while deleting account type" });
  }
});

router.post("/tosf/resolve-fees", async (req, res) => {
  const { resolveFees } = require("../../utils/resolveFees");

  try {
    let dprtmntCurriculumId = req.body.dprtmnt_curriculum_id;
    if (
      (dprtmntCurriculumId == null || dprtmntCurriculumId === "") &&
      req.body.curriculum_id
    ) {
      const [curriculumRows] = await db3.query(
        `SELECT dprtmnt_curriculum_id
         FROM dprtmnt_curriculum_table
         WHERE curriculum_id = ?
         LIMIT 1`,
        [req.body.curriculum_id]
      );
      dprtmntCurriculumId = curriculumRows[0]?.dprtmnt_curriculum_id ?? null;
    }

    const context = {
      branch_id: req.body.branch_id,
      dprtmnt_curriculum_id: dprtmntCurriculumId,
      year_level_id: req.body.year_level_id,
      tuition_amount: req.body.tuition_amount,
      has_nstp: req.body.has_nstp,
      nstp_count: req.body.nstp_count,
      has_computer: req.body.has_computer,
      has_laboratory: req.body.has_laboratory,
      is_first_year_first_sem: req.body.is_first_year_first_sem,
    };

    const result = await resolveFees({ db: db3, context });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while resolving fees" });
  }
});

router.get("/tosf/matriculation/:matriculation_id/fee-lines", async (req, res) => {
  const {
    getMatriculationFeeLines,
    getMatriculationFeeLineTotals,
  } = require("../../utils/matriculationFeeLines");

  try {
    const { matriculation_id } = req.params;
    const feeLines = await getMatriculationFeeLines(db3, matriculation_id);
    const totals = getMatriculationFeeLineTotals(feeLines);

    res.json({
      fee_lines: feeLines,
      totals,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching matriculation fee lines" });
  }
});

module.exports = router;
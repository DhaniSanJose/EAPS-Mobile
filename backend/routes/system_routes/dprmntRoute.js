const express = require("express");
const { db3 } = require("../database/database");
const {
  CanCreate,
  CanDelete,
  CanEdit,
} = require("../../middleware/pagePermissions");
const { insertAuditLogEnrollment } = require("../../utils/auditLogger");
const router = express.Router();

let isAllowedColumnReady = false;

const ensureDepartmentIsAllowedColumn = async () => {
  if (isAllowedColumnReady) return;

  try {
    await db3.query(`
      ALTER TABLE dprtmnt_table
      ADD COLUMN is_allowed tinyint(1) NOT NULL DEFAULT 1
    `);
  } catch (err) {
    if (err?.code !== "ER_DUP_FIELDNAME") {
      throw err;
    }
  }

  isAllowedColumnReady = true;
};

const ensureDepatmentGrantTableExisted = async () => {
  try{
    await db3.query(`
      CREATE TABLE IF NOT EXISTS dprtmnt_grant_table (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_dept_id TINYINT(1) NOT NULL DEFAULT 0,
        requesting_dept_id TINYINT(1) NOT NULL DEFAULT 0,
        active_school_year_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_request_grant (request_dept_id, requesting_dept_id, active_school_year_id)
      )
    `);
  } catch (err) {
    console.error("Error creating table:", err);
  }
};

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

const insertDepartmentAuditLog = async ({ req, action, message }) => {
  const { actorId, actorRole } = getAuditActor(req);

  await insertAuditLogEnrollment({
    actorId,
    role: actorRole,
    action,
    message,
    severity: "INFO",
  });
};

// -------------------- CREATE DEPARTMENT --------------------
router.post("/department", CanCreate, async (req, res) => {
  const { dep_name, dep_code, dept_number, components } = req.body;

  if (!dep_name || !dep_code || !dept_number || !components) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const normalized_code = dep_code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

 // Check duplicate department code
const [rows] = await db3.query(
  "SELECT dprtmnt_id FROM dprtmnt_table WHERE dprtmnt_code = ?",
  [normalized_code]
);

if (rows.length > 0) {
  return res.status(400).json({
    message: "Department code already exists",
  });
}

// Check duplicate department number
const [deptNumberRows] = await db3.query(
  "SELECT dprtmnt_id FROM dprtmnt_table WHERE dept_number = ?",
  [dept_number]
);

if (deptNumberRows.length > 0) {
  return res.status(400).json({
    message: "Department number already exists",
  });
}

    const [result] = await db3.query(
      `INSERT INTO dprtmnt_table
   (dprtmnt_name, dprtmnt_code, dept_number, components)
   VALUES (?, ?, ?, ?)`,
      [dep_name, normalized_code, dept_number, components]
    );

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertDepartmentAuditLog({
      req,
      action: "DEPARTMENT_CREATE",
      message: `${roleLabel} (${actorId}) created department ${dep_name} (${normalized_code}).`,
    });

    res.status(200).json({
      message: "Department created successfully",
      insertId: result.insertId,
    });
  } catch (err) {
    console.error("Error creating department:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// -------------------- GET DEPARTMENTS --------------------
router.get("/get_department", async (req, res) => {
  try {
    await ensureDepartmentIsAllowedColumn();
    const [result] = await db3.query("SELECT * FROM dprtmnt_table");
    res.status(200).json(result);
  } catch (err) {
    console.error("Error fetching departments:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// -------------------- UPDATE DEPARTMENT --------------------
// -------------------- UPDATE DEPARTMENT --------------------
router.put("/department/:id", CanEdit, async (req, res) => {
  const { id } = req.params;
  const { dep_name, dep_code, dept_number, components } = req.body;

  if (!dep_name || !dep_code || !dept_number || !components) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const normalized_code = dep_code
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();

    // Check if another department already uses this code
    const [codeRows] = await db3.query(
      `SELECT dprtmnt_id
       FROM dprtmnt_table
       WHERE dprtmnt_code = ?
       AND dprtmnt_id <> ?`,
      [normalized_code, id]
    );

    if (codeRows.length > 0) {
      return res.status(400).json({
        message: "Department code already exists",
      });
    }

    // Check if another department already uses this department number
    const [deptNumberRows] = await db3.query(
      `SELECT dprtmnt_id
       FROM dprtmnt_table
       WHERE dept_number = ?
       AND dprtmnt_id <> ?`,
      [dept_number, id]
    );

    if (deptNumberRows.length > 0) {
      return res.status(400).json({
        message: "Department number already exists",
      });
    }

    const [result] = await db3.query(
      `UPDATE dprtmnt_table
       SET dprtmnt_name = ?,
           dprtmnt_code = ?,
           dept_number = ?,
           components = ?
       WHERE dprtmnt_id = ?`,
      [dep_name, normalized_code, dept_number, components, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Department not found" });
    }

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);

    await insertDepartmentAuditLog({
      req,
      action: "DEPARTMENT_UPDATE",
      message: `${roleLabel} (${actorId}) updated department ${dep_name} (${normalized_code}) [Dept No: ${dept_number}].`,
    });

    res.json({
      message: "Department updated successfully",
    });
  } catch (err) {
    console.error("Error updating department:", err);
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

// -------------------- DELETE DEPARTMENT --------------------
router.delete("/department/:id", CanDelete, async (req, res) => {
  const { id } = req.params;

  try {
    const [departmentRows] = await db3.query(
      "SELECT dprtmnt_name, dprtmnt_code FROM dprtmnt_table WHERE dprtmnt_id = ?",
      [id],
    );

    const [result] = await db3.query(
      "DELETE FROM dprtmnt_table WHERE dprtmnt_id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Department not found" });
    }

    const department = departmentRows[0];
    const departmentLabel = department
      ? `${department.dprtmnt_name} (${department.dprtmnt_code})`
      : `department ID ${id}`;
    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertDepartmentAuditLog({
      req,
      action: "DEPARTMENT_DELETE",
      message: `${roleLabel} (${actorId}) deleted ${departmentLabel}.`,
    });

    res.json({ message: "Department deleted successfully" });
  } catch (err) {
    console.error("Error deleting department:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.put("/department/:id/is-allowed", CanEdit, async (req, res) => {
  const { id } = req.params;
  const isAllowed = Number(req.body?.is_allowed) === 1 ? 1 : 0;

  try {
    await ensureDepartmentIsAllowedColumn();

    const [departmentRows] = await db3.query(
      "SELECT dprtmnt_name, dprtmnt_code FROM dprtmnt_table WHERE dprtmnt_id = ?",
      [id],
    );

    if (!departmentRows.length) {
      return res.status(404).json({ message: "Department not found" });
    }

    const [result] = await db3.query(
      "UPDATE dprtmnt_table SET is_allowed = ? WHERE dprtmnt_id = ?",
      [isAllowed, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Department not found" });
    }

    const department = departmentRows[0];
    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertDepartmentAuditLog({
      req,
      action: "DEPARTMENT_PLOTTING_ACCESS",
      message: `${roleLabel} (${actorId}) ${isAllowed ? "enabled" : "disabled"} schedule plotting for ${department.dprtmnt_name} (${department.dprtmnt_code}).`,
    });

    res.json({
      success: true,
      dprtmnt_id: Number(id),
      is_allowed: isAllowed,
      message: isAllowed
        ? "Department schedule plotting enabled."
        : "Department schedule plotting disabled.",
    });
  } catch (err) {
    console.error("Error updating department plotting access:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/department/grant-access", async (req, res) => {
  const { request_dept_id, requesting_dept_id } = req.body;

  console.log("Grant Access Request:", { request_dept_id, requesting_dept_id });
  try{
    await ensureDepatmentGrantTableExisted();

    if(!request_dept_id || !requesting_dept_id){
      return res.status(400).json({ message: "Missing required fields" });
    }

    const [activeYearRows] = await db3.query(
      "SELECT id FROM active_school_year_table WHERE astatus = 1 LIMIT 1"
    );

    if (!activeYearRows.length) {
      return res.status(400).json({ message: "No active school year found" });
    }

    const activeYearId = activeYearRows[0].id;

  

    const [result] = await db3.query(`
      INSERT INTO dprtmnt_grant_table (request_dept_id, requesting_dept_id, active_school_year_id)
      VALUES (?, ?, ?)
    `, [request_dept_id, requesting_dept_id, activeYearId]);

    console.log("Department access granted:", result);

    const { actorId, actorRole } = getAuditActor(req);
    const roleLabel = formatAuditActorRole(actorRole);
    await insertDepartmentAuditLog({
      req,
      action: "DEPARTMENT_GRANT_ACCESS",
      message: `${roleLabel} (${actorId}) granted access from department ID ${request_dept_id} to department ID ${requesting_dept_id} for school year ID ${activeYearId}.`,
    });

    return res.status(200).json({
      success: true,
      message: "Access granted successfully.",
      insertId: result.insertId,
    });
  } catch (err) {
    console.error("Error granting department access:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
module.exports.ensureDepartmentIsAllowedColumn = ensureDepartmentIsAllowedColumn;
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { db, db3 } = require("../database/database");
const { insertAuditLogAdmission } = require("../../utils/auditLogger");

const applicantDocsDir = path.join(
  __dirname,
  "uploads",
  "applicant_documents"
);


const getRequirementUploadAuditInfo = async (uploadId) => {
  const [rows] = await db.query(
    `
    SELECT
      ru.upload_id,
      ru.person_id,
      ru.status,
      ru.document_status,
      rt.description,
      ant.applicant_number,
      pt.first_name,
      pt.middle_name,
      pt.last_name,
      pt.emailAddress
    FROM requirement_uploads ru
    LEFT JOIN requirements_table rt ON rt.id = ru.requirements_id
    LEFT JOIN person_table pt ON pt.person_id = ru.person_id
    LEFT JOIN applicant_numbering_table ant ON ant.person_id = ru.person_id
    WHERE ru.upload_id = ?
    LIMIT 1
    `,
    [uploadId],
  );

  return rows?.[0] || null;
};

const requirementStatusLabel = (status) => {
  if (Number(status) === 1) return "Verified";
  if (Number(status) === 2) return "Rejected";
  return "Pending";
};


// Ito
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024 // ✅ 4MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf"
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPG, JPEG, PNG, PDF allowed"));
    }

    cb(null, true);
  }
});

router.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: "File exceeds 4MB limit"
    });
  }

  if (err.message === "Only JPG, JPEG, PNG, PDF allowed") {
    return res.status(400).json({
      error: err.message
    });
  }

  next(err);
});

const applicantAuditLabel = (applicant) => {
  const applicantName = [
    applicant?.last_name,
    applicant?.first_name,
    applicant?.middle_name,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    applicant?.applicant_number ||
    applicantName ||
    applicant?.emailAddress ||
    `person_id ${applicant?.person_id || "unknown"}`
  );
};


const insertRequirementAuditLog = async ({
  actorId,
  actorRole,
  message,
  severity = "INFO",
}) => {
  await insertAuditLogAdmission({
    actorId: actorId || "unknown",
    role: actorRole || "registrar",
    action: "APPLICANT_REQUIREMENTS",
    severity,
    message,
  });
};

const formatAuditActorRole = (role) => {
  const safeRole = String(role || "registrar").trim();
  if (!safeRole) return "Registrar";

  return safeRole
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};


const getApplicantDocumentStatusInfo = async (applicantNumber) => {
  const [rows] = await db.query(
    `
    SELECT
      ant.applicant_number,
      pt.person_id,
      pt.first_name,
      pt.middle_name,
      pt.last_name,
      pt.emailAddress,
      ru.document_status
    FROM applicant_numbering_table ant
    INNER JOIN person_table pt ON pt.person_id = ant.person_id
    LEFT JOIN requirement_uploads ru ON ru.person_id = pt.person_id
    WHERE ant.applicant_number = ?
    ORDER BY ru.upload_id DESC
    LIMIT 1
    `,
    [applicantNumber],
  );

  return rows?.[0] || null;
};


const getShortLabel = async (desc) => {
  try {
    const [rows] = await db.query(
      "SELECT short_label FROM requirements_table WHERE LOWER(description) LIKE CONCAT('%', LOWER(?), '%') LIMIT 1",
      [desc],
    );

    if (rows.length > 0) {
      return rows[0].short_label; //  return short_label directly from DB
    } else {
      return "Unknown"; // no match found
    }
  } catch (error) {
    console.error("Error fetching short_label:", error);
    return "Unknown";
  }
};


router.get("/person_with_applicant/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [[person]] = await db.query(
      `
      SELECT
        pt.*,
        ant.applicant_number
      FROM person_table pt
      JOIN applicant_numbering_table ant ON pt.person_id = ant.person_id
      WHERE pt.person_id = ? OR ant.applicant_number = ?
      LIMIT 1
    `,
      [id, id],
    );

    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }

    // get latest document status + evaluator
    const [rows] = await db.query(
      `
      SELECT
        ru.document_status    AS upload_document_status,
        rt.id                 AS requirement_id,
        ua.email              AS evaluator_email,
        ua.role               AS evaluator_role,
        ua.first_name              AS evaluator_fname,
        ua.middle_name              AS evaluator_mname,
        ua.last_name              AS evaluator_lname,
        ru.created_at,
        ru.last_updated_by
      FROM requirement_uploads AS ru
      LEFT JOIN requirements_table AS rt ON ru.requirements_id = rt.id
      LEFT JOIN enrollment.user_accounts ua ON ru.last_updated_by = ua.person_id
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

router.get("/uploads/by-applicant/:applicant_number", async (req, res) => {
  const applicant_number = req.params.applicant_number;

  try {
    const [personResult] = await db.query(
      "SELECT person_id FROM applicant_numbering_table WHERE applicant_number = ?",
      [applicant_number],
    );

    if (personResult.length === 0) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    const person_id = personResult[0].person_id;

    const [uploads] = await db.query(
      `
      SELECT
        ru.upload_id,
        ru.requirements_id,
        ru.person_id,
        ru.file_path,
        ru.original_name,
        ru.remarks,
        ru.status,

        CASE
          WHEN ru.status = 1 THEN 'Approved'
          WHEN ru.status = 2 THEN 'Rejected'
          ELSE 'Pending'
        END AS status_label,

        ru.document_status,
        ru.registrar_status,
        ru.created_at,
        rt.description,


        ua.email AS evaluator_email,
        ua.role  AS evaluator_role,
        ua.last_name AS evaluator_lname,
        ua.first_name AS evaluator_fname,
        ua.middle_name AS evaluator_mname

      FROM requirement_uploads ru
      JOIN requirements_table rt
        ON ru.requirements_id = rt.id
      LEFT JOIN enrollment.user_accounts ua
        ON ru.last_updated_by = ua.person_id
      WHERE ru.person_id = ?
      `,
      [person_id],
    );

    res.status(200).json(uploads);
  } catch (err) {
    console.error("Error fetching uploads by applicant number:", err);
    res.status(500).json({ message: "Internal Server Error", error: err });
  }
});

router.get("/document_status/:applicant_number", async (req, res) => {
  const { applicant_number } = req.params;

  try {
    const [rows] = await db.query(
      `
      SELECT
        COALESCE(ru.document_status, 'On process') AS document_status,
        ua.email AS evaluator_email,
        ua.last_name AS evaluator_lname,
        ua.first_name AS evaluator_fname,
        ua.middle_name AS evaluator_mname,
        ru.created_at
      FROM applicant_numbering_table ant
      INNER JOIN person_table pt ON pt.person_id = ant.person_id
      LEFT JOIN requirement_uploads ru ON ru.person_id = pt.person_id
      LEFT JOIN enrollment.user_accounts ua ON ua.person_id = ru.last_updated_by
      WHERE ant.applicant_number = ?
      ORDER BY ru.upload_id DESC
      LIMIT 1
      `,
      [applicant_number],
    );

    const row = rows?.[0] || {};
    res.json({
      document_status: row.document_status || "On process",
      evaluator: row.evaluator_email
        ? {
          evaluator_email: row.evaluator_email,
          evaluator_lname: row.evaluator_lname,
          evaluator_fname: row.evaluator_fname,
          evaluator_mname: row.evaluator_mname,
          created_at: row.created_at,
        }
        : null,
    });
  } catch (err) {
    console.error("Error fetching document status:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.put("/document_status/:applicant_number", async (req, res) => {
  const { applicant_number } = req.params;
  const {
    document_status,
    user_id,
    audit_actor_id,
    audit_actor_role,
  } = req.body;

  if (!document_status || !user_id) {
    return res.status(400).json({
      message: "document_status and user_id are required",
    });
  }

  try {
    const applicantBefore = await getApplicantDocumentStatusInfo(applicant_number);

    if (!applicantBefore) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    let statusSyncSql = "";
    const updateParams = [document_status, user_id];

    if (document_status === "Documents Verified & ECAT") {
      statusSyncSql = ", ru.status = ?, ru.verified_at = NOW()";
      updateParams.push(1);
    } else if (document_status === "Disapproved / Program Closed") {
      statusSyncSql = ", ru.status = ?, ru.verified_at = NULL";
      updateParams.push(2);
    } else {
      statusSyncSql = ", ru.verified_at = NULL";
    }

    updateParams.push(applicant_number);

    const [result] = await db.query(
      `
      UPDATE requirement_uploads ru
      INNER JOIN applicant_numbering_table ant ON ant.person_id = ru.person_id
      SET ru.document_status = ?, ru.last_updated_by = ?${statusSyncSql}
      WHERE ant.applicant_number = ?
      `,
      updateParams,
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Applicant uploads not found" });
    }

    if (
      String(applicantBefore.document_status || "On process") !==
      String(document_status || "On process")
    ) {
      const safeActor = audit_actor_id || user_id || "unknown";
      const roleLabel = formatAuditActorRole(audit_actor_role || "registrar");

      await insertRequirementAuditLog({
        actorId: safeActor,
        actorRole: audit_actor_role || "registrar",
        message: `${roleLabel} (${safeActor}) changed overall document status of Applicant (${applicantAuditLabel(applicantBefore)}) from ${applicantBefore.document_status || "On process"} to ${document_status}.`,
      });
    }

    res.json({
      success: true,
      document_status,
      message: "Document status updated successfully",
    });
  } catch (err) {
    console.error("Error updating document status:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//  Get uploads with evaluator info

// Add to server.js
// “ GET persons and their applicant numbers for AdminRequirementsPanel.jsx
router.get("/upload_documents", async (req, res) => {
  try {
    const [persons] = await db.query(`
      SELECT
        pt.person_id,
        pt.first_name,
        pt.middle_name,
        pt.last_name,
        pt.profile_img,
        pt.height,
        pt.generalAverage1,
        pt.emailAddress,
        ant.applicant_number,
        pt.applyingAs
      FROM person_table pt
      LEFT JOIN applicant_numbering_table ant ON pt.person_id = ant.person_id
    `);

    res.status(200).json(persons);
  } catch (error) {
    console.error(" Error fetching upload documents:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//  Update status only
router.put("/uploads/status/:upload_id", async (req, res) => {
  const { upload_id } = req.params;
  const { status, user_id, audit_actor_id, audit_actor_role } = req.body;

  try {
    const uploadBefore = await getRequirementUploadAuditInfo(upload_id);
    if (!uploadBefore) {
      return res.status(404).json({ message: "Upload not found" });
    }

    // 1. Update single row status
    await db.query(
      `UPDATE requirement_uploads
       SET status = ?, last_updated_by = ?, verified_at = CASE WHEN ? = 1 OR ? = '1' THEN NOW() ELSE NULL END
       WHERE upload_id = ?`,
      [status, user_id, status, status, upload_id]
    );

    const person_id = uploadBefore.person_id;

    // 3. Get all verifiable documents of this applicant
    const [docs] = await db.query(
      `SELECT status
       FROM requirement_uploads ru
       JOIN requirements_table rt ON ru.requirements_id = rt.id
       WHERE ru.person_id = ?
       AND rt.is_verifiable = 1`,
      [person_id]
    );

    // 4. Check if ALL are verified (status = 1)
    const allVerified = docs.length > 0 && docs.every(d => d.status === 1);

    if (allVerified) {
      // 🔥 5. AUTO UPDATE document_status
      await db.query(
        `UPDATE requirement_uploads
         SET document_status = 'Documents Verified & ECAT',
             verified_at = COALESCE(verified_at, NOW())
         WHERE person_id = ?`,
        [person_id]
      );

      // 🔥 6. OPTIONAL: ensure ALL status = 1 (safety sync)
      await db.query(
        `UPDATE requirement_uploads
         SET status = 1
         WHERE person_id = ?`,
        [person_id]
      );
    }

    if (String(uploadBefore.status ?? "0") !== String(status ?? "0")) {
      const safeActor = audit_actor_id || user_id || "unknown";
      const roleLabel = formatAuditActorRole(audit_actor_role || "registrar");
      await insertRequirementAuditLog({
        actorId: safeActor,
        actorRole: audit_actor_role || "registrar",
        message: `${roleLabel} (${safeActor}) changed document status of Applicant (${applicantAuditLabel(uploadBefore)}) for ${uploadBefore.description || "document"} from ${requirementStatusLabel(uploadBefore.status)} to ${requirementStatusLabel(status)}.`,
      });
    }

    res.json({ message: "Status updated and auto-sync checked." });

  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/admin/uploads/:uploadId", async (req, res) => {
  const { uploadId } = req.params;

  try {
    // 1¸ Get upload row (file + person_id)
    const [uploadRows] = await db.query(
      "SELECT person_id, file_path FROM requirement_uploads WHERE upload_id = ?",
      [uploadId],
    );
    if (!uploadRows.length) {
      return res.status(404).json({ error: "Upload not found." });
    }

    const { person_id: personId, file_path: filePath } = uploadRows[0];

    // 2¸ Applicant info
    const [[appInfo]] = await db.query(
      `
      SELECT ant.applicant_number, pt.last_name, pt.first_name, pt.middle_name
      FROM applicant_numbering_table ant
      JOIN person_table pt ON ant.person_id = pt.person_id
      WHERE ant.person_id = ?
    `,
      [personId],
    );

    const applicant_number = appInfo?.applicant_number || "Unknown";
    const fullName = `${appInfo?.last_name || ""}, ${appInfo?.first_name || ""} ${appInfo?.middle_name?.charAt(0) || ""}.`;

    // 3¸ Actor (admin performing the action)
    const user_person_id = req.headers["x-person-id"];

    // 4¸ Delete physical file
    if (filePath) {
      const fullPath = path.join(applicantDocsDir, filePath);

      try {
        await fs.promises.unlink(fullPath);
        console.log("—‘¸ File deleted:", fullPath);
      } catch (err) {
        if (err.code === "ENOENT") {
          console.warn(" ¸ File already missing:", fullPath);
        } else {
          console.error("File delete error:", err);
        }
      }
    }

    // 5¸ Delete DB record
    await db.query("DELETE FROM requirement_uploads WHERE upload_id = ?", [
      uploadId,
    ]);

    // Deleted upload record and file.
   

    res.status(200).json({ message: " Upload deleted successfully." });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Failed to delete the upload." });
  }
});

module.exports = router;  

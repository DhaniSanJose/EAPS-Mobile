const express = require("express");
const { db, db3 } = require("../database/database");
const { logStudentHistoryFromRequest } = require("../../utils/studentHistoryLogger");
const { createUnifastPaymentLine } = require("../../utils/unifastPaymentLines");
const {
  upsertMatriculationAssessmentPaymentLine,
} = require("../../utils/matriculationPaymentLines");

const router = express.Router();

const normalizeFeeLines = (feeLines = []) =>
  Array.isArray(feeLines)
    ? feeLines
        .map((line) => ({
          fee_rate_id: Number(line?.fee_rate_id),
          amount: Number(line?.amount) || 0,
        }))
        .filter((line) => Number.isFinite(line.fee_rate_id) && line.fee_rate_id > 0)
    : [];

const insertFeeLines = async (connection, tableName, idColumn, ownerId, feeLines) => {
  const lines = normalizeFeeLines(feeLines);
  if (!lines.length) return;

  await connection.query(
    `INSERT INTO ${tableName} (${idColumn}, fee_rate_id, amount) VALUES ?`,
    [lines.map((line) => [ownerId, line.fee_rate_id, line.amount])]
  );
};

router.get("/payment-status/:studentNumber", async (req, res) => {
  const { studentNumber } = req.params;
  const requestedSchoolYearId = req.query.active_school_year_id;

  try {
    let activeSchoolYearId = requestedSchoolYearId;

    if (!activeSchoolYearId) {
      const [activeRows] = await db3.query(
        "SELECT id FROM active_school_year_table WHERE astatus = 1 LIMIT 1",
      );
      activeSchoolYearId = activeRows[0]?.id;
    }

    if (!activeSchoolYearId) {
      return res.json({
        success: true,
        saved_unifast: false,
        saved_matriculation: false,
      });
    }

    const [unifastRows] = await db3.query(
      "SELECT status FROM unifast WHERE student_number = ? AND status = 1 AND active_school_year_id = ? LIMIT 1",
      [studentNumber, activeSchoolYearId],
    );
    const [matricRows] = await db3.query(
      "SELECT status FROM matriculation WHERE student_number = ? AND status = 1 AND active_school_year_id = ? LIMIT 1",
      [studentNumber, activeSchoolYearId],
    );

    res.json({
      success: true,
      saved_unifast: unifastRows.length > 0,
      saved_matriculation: matricRows.length > 0,
      active_school_year_id: activeSchoolYearId,
    });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({ message: "Server error while fetching status" });
  }
});

router.post("/save_to_unifast", async (req, res) => {
  const {
    campus_name,
    student_number,
    learner_reference_number,
    last_name,
    given_name,
    middle_initial,
    degree_program,
    year_level,
    sex,
    email_address,
    phone_number,
    tuition_fees,
    total_tosf,
    remark,
    active_school_year_id,
    status,
    fee_lines,
  } = req.body;
  
  try {
    if (!student_number || !String(student_number).trim()) {
      return res.status(400).json({
        message: "Student number is required before saving to UNIFAST.",
      });
    }

    const statusValue = Number.isFinite(Number(status)) ? Number(status) : 1;
    const [unifastScholarships] = await db3.query(
      `SELECT id
       FROM scholarship_type
       WHERE UPPER(TRIM(scholarship_name)) LIKE '%UNIFAST%'
         AND scholarship_status = 1
       ORDER BY id ASC
       LIMIT 1`,
    );

    const unifastScholarshipId = unifastScholarships?.[0]?.id ?? null;
    if (!unifastScholarshipId) {
      return res.status(400).json({
        message:
          "Cannot save to UNIFAST because no active scholarship type containing 'UNIFAST' was found.",
      });
    }

    const connection = await db3.getConnection();
    let unifast_id;

    try {
      await connection.beginTransaction();

      const query = `
        INSERT INTO unifast (
          campus_name, student_number, learner_reference_number, last_name, given_name, middle_initial,
          degree_program, year_level, sex, email_address, phone_number, scholarship_id,
          total_tosf, remark, active_school_year_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        campus_name,
        student_number,
        learner_reference_number || "No LRN Number",
        last_name,
        given_name,
        middle_initial || "",
        degree_program,
        year_level,
        sex,
        email_address || null,
        phone_number || null,
        unifastScholarshipId,
        total_tosf,
        remark || "UNIFAST",
        active_school_year_id,
        statusValue,
      ];

      const [result] = await connection.query(query, values);
      unifast_id = result.insertId;

      await insertFeeLines(
        connection,
        "unifast_fee_lines",
        "unifast_id",
        unifast_id,
        fee_lines,
      );
      await createUnifastPaymentLine(connection, {
        unifastId: unifast_id,
        tuitionFees: tuition_fees,
        totalTosf: total_tosf,
      });

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const studentName = [last_name, given_name, middle_initial]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" ");

    await logStudentHistoryFromRequest({
      req,
      studentNumber: student_number,
      action: "save_unifast",
      details: {
        student_name: studentName || "Unknown Student",
        payment_target: remark || "UNIFAST",
      },
    });

    res.json({
      success: true,
      unifast_id,
      message: "Data successfully saved to UNIFAST",
    });
  } catch (error) {
    console.error("Error saving to UNIFAST:", error);
    res.status(500).json({ message: "Server error while saving data" });
  }
});

router.post("/save_to_matriculation", async (req, res) => {
  const {
    campus_name,
    student_number,
    learner_reference_number,
    last_name,
    given_name,
    middle_initial,
    degree_program,
    year_level,
    sex,
    email_address,
    phone_number,
    tuition_fees,
    total_tosf,
    scholarship_id,
    remark,
    matriculation_remark,
    active_school_year_id,
    status,
    fee_lines,
  } = req.body;

  try {
    if (!student_number || !String(student_number).trim()) {
      return res.status(400).json({
        message: "Student number is required before saving to MATRICULATION.",
      });
    }

    const statusValue = Number.isFinite(Number(status)) ? Number(status) : 1;
    const connection = await db3.getConnection();
    let matriculation_id;

    try {
      await connection.beginTransaction();

      const query = `
        INSERT INTO matriculation (
          campus_name, student_number, learner_reference_number, last_name, given_name, middle_initial,
          degree_program, year_level, sex, email_address, phone_number, scholarship_id,
          total_tosf, remark, active_school_year_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        campus_name,
        student_number,
        learner_reference_number || "No LRN Number",
        last_name,
        given_name,
        middle_initial || "",
        degree_program,
        year_level,
        sex,
        email_address || null,
        phone_number || null,
        scholarship_id,
        total_tosf,
        matriculation_remark || remark || "Matriculation",
        active_school_year_id,
        statusValue,
      ];

      const [result] = await connection.query(query, values);
      matriculation_id = result.insertId;

      await insertFeeLines(
        connection,
        "matriculation_fee_lines",
        "matriculation_id",
        matriculation_id,
        fee_lines,
      );
      await upsertMatriculationAssessmentPaymentLine(connection, {
        matriculationId: matriculation_id,
        tuitionFees: tuition_fees,
        totalTosf: total_tosf,
      });

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const studentName = [last_name, given_name, middle_initial]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" ");

    await logStudentHistoryFromRequest({
      req,
      studentNumber: student_number,
      action: "save_matriculation",
      details: {
        student_name: studentName || "Unknown Student",
        payment_target: matriculation_remark || remark || "Matriculation",
      },
    });

    res.json({
      success: true,
      matriculation_id,
      message: "Data successfully saved to MATRICULATION",
    });
  } catch (error) {
    console.error("Error saving to MATRICULATION:", error);
    res.status(500).json({ message: "Server error while saving data" });
  }
});

module.exports = router

// utils/formControlNumber.js
const generateFormControlNumber = async (pool, {
  formType,
  applicantNumber = null,
  personId = null,
  actionType = "download",
}) => {
  if (!formType) {
    throw new Error("generateFormControlNumber: formType is required");
  }

  const conn = await pool.getConnection();
  try {
    await conn.query(
      "CALL sp_generate_form_control_number(?, ?, ?, ?, @out)",
      [formType, applicantNumber, personId, actionType]
    );
    const [[row]] = await conn.query("SELECT @out AS controlNumber");
    return row.controlNumber; // e.g. "2026-0001"
  } finally {
    conn.release();
  }
};

module.exports = { generateFormControlNumber };
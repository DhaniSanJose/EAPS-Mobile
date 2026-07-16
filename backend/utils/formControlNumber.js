const generateFormControlNumber = async (pool, {
  formType,
  applicantNumber = null,
  personId = null,
  actionType = "download",
}) => {
  if (!formType) {
    throw new Error("generateFormControlNumber: formType is required");
  }

  const safeActionType = actionType === "print" ? "print" : "download";

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the active school year row so concurrent requests queue
    // instead of colliding on the same running number.
    const [yearRows] = await conn.query(
      "SELECT year_id, year_description FROM year_table WHERE status = 1 LIMIT 1 FOR UPDATE",
    );

    if (!yearRows.length) {
      throw new Error("No active school year found (year_table.status = 1).");
    }

    const { year_id: yearId, year_description: yearDesc } = yearRows[0];

    // Ensure a counter row exists for this (year, form_type).
    await conn.query(
      `INSERT INTO form_control_sequence (year_id, form_type, last_number)
       VALUES (?, ?, 0)
       ON DUPLICATE KEY UPDATE last_number = last_number`,
      [yearId, formType],
    );

    // Atomically bump the counter.
    await conn.query(
      `UPDATE form_control_sequence
       SET last_number = last_number + 1
       WHERE year_id = ? AND form_type = ?`,
      [yearId, formType],
    );

    // Read back the new value (still inside the locked transaction).
    const [seqRows] = await conn.query(
      `SELECT last_number FROM form_control_sequence
       WHERE year_id = ? AND form_type = ?`,
      [yearId, formType],
    );

    const nextNumber = seqRows[0].last_number;
    const controlNumber = `${yearDesc}-${String(nextNumber).padStart(4, "0")}`;

    // Log the transaction (one row per print/download).
    await conn.query(
      `INSERT INTO form_print_transaction
         (control_number, year_id, running_number, form_type, applicant_number, person_id, action_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [controlNumber, yearId, nextNumber, formType, applicantNumber, personId, safeActionType],
    );

    await conn.commit();
    return controlNumber; // e.g. "2026-0007"
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = { generateFormControlNumber };
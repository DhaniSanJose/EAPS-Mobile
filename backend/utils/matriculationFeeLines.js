const FEE_LINE_SELECT = `
  SELECT
    mfl.id,
    mfl.matriculation_id,
    mfl.fee_rate_id,
    mfl.amount,
    mfl.is_paid,
    COALESCE(mfl.paid_amount, 0) AS paid_amount,
    CASE WHEN mfl.fee_rate_id = 0 THEN 0 ELSE fr.fee_id END AS fee_id,
    CASE WHEN mfl.fee_rate_id = 0 THEN 'TUITION' ELSE fc.fee_code END AS fee_code,
    CASE WHEN mfl.fee_rate_id = 0 THEN 'Tuition Fees' ELSE fc.fee_name END AS fee_name,
    CASE WHEN mfl.fee_rate_id = 0 THEN 2 ELSE fc.fee_category END AS fee_category,
    CASE WHEN mfl.fee_rate_id = 0 THEN 0 ELSE fc.sort_order END AS sort_order,
    CASE WHEN mfl.fee_rate_id = 0 THEN NULL ELSE fc.fee_group END AS fee_group,
    CASE WHEN mfl.fee_rate_id = 0 THEN NULL ELSE fc.account_type END AS account_type,
    CASE WHEN mfl.fee_rate_id = 0 THEN 'Any' ELSE fg.description END AS fee_group_description,
    CASE WHEN mfl.fee_rate_id = 0 THEN 'Any' ELSE at.description END AS account_type_description,
    CASE WHEN mfl.fee_rate_id = 0 THEN 1 ELSE 0 END AS is_tuition
  FROM matriculation_fee_lines mfl
  LEFT JOIN fee_rate fr ON fr.fee_rate_id = mfl.fee_rate_id
  LEFT JOIN fee_catalog fc ON fc.fee_id = fr.fee_id
  LEFT JOIN fee_group fg ON fg.id = fc.fee_group
  LEFT JOIN account_type at ON at.id = fc.account_type
`;

let feeLineColumnsReady = false;

const ensureFeeLinePaymentColumns = async (db) => {
  if (feeLineColumnsReady) return;

  await db.query(`
    ALTER TABLE matriculation_fee_lines
      ADD COLUMN IF NOT EXISTS is_paid tinyint(1) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS paid_amount decimal(10,2) NOT NULL DEFAULT 0
  `);

  feeLineColumnsReady = true;
};

const getMatriculationFeeLines = async (db, matriculationId) => {
  await ensureFeeLinePaymentColumns(db);
  const [rows] = await db.query(
    `${FEE_LINE_SELECT}
     WHERE mfl.matriculation_id = ?
     ORDER BY
       CASE WHEN mfl.fee_rate_id = 0 THEN 0 ELSE COALESCE(fc.sort_order, 999999) END ASC,
       CASE WHEN mfl.fee_rate_id = 0 THEN 'Tuition Fees' ELSE fc.fee_name END ASC`,
    [matriculationId]
  );
  return rows;
};

const getMatriculationFeeLineTotals = (lines) => {
  const catalogTotal = lines.reduce(
    (sum, line) => sum + (Number(line.amount) || 0),
    0
  );
  return { catalog_total: catalogTotal };
};

const applyFeeLinePaymentAllocations = async (db, allocations = []) => {
  for (const allocation of allocations) {
    // Keep skipping the virtual tuition placeholder, but still update the real
    // matriculation_fee_lines row when fee_rate_id = 0 has an actual id.
    if (allocation.matriculation_fee_line_id === "tuition") {
      continue;
    }

    const paidAmount = Number(allocation.paid_amount) || 0;
    if (paidAmount <= 0) continue;

    const lineId = allocation.matriculation_fee_line_id;
    if (lineId == null || lineId === "") continue;

    await db.query(
      `UPDATE matriculation_fee_lines
       SET paid_amount = COALESCE(paid_amount, 0) + ?,
           is_paid = CASE
             WHEN COALESCE(paid_amount, 0) + ? >= amount THEN 1
             ELSE 0
           END
       WHERE id = ?`,
      [paidAmount, paidAmount, lineId]
    );
  }
};

module.exports = {
  FEE_LINE_SELECT,
  ensureFeeLinePaymentColumns,
  getMatriculationFeeLines,
  getMatriculationFeeLineTotals,
  applyFeeLinePaymentAllocations,
};

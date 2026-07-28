const FEE_LINE_SELECT = `
  SELECT
    mfl.id,
    mfl.matriculation_id,
    mfl.fee_rate_id,
    mfl.amount,
    mfl.is_paid,
    COALESCE(mfl.paid_amount, 0) AS paid_amount,
    fr.fee_id,
    fc.fee_code,
    fc.fee_name,
    fc.fee_category,
    fc.sort_order,
    fc.fee_group,
    fc.account_type,
    fg.description AS fee_group_description,
    at.description AS account_type_description
  FROM matriculation_fee_lines mfl
  INNER JOIN fee_rate fr ON fr.fee_rate_id = mfl.fee_rate_id
  INNER JOIN fee_catalog fc ON fc.fee_id = fr.fee_id
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
     ORDER BY fc.sort_order ASC, fc.fee_name ASC`,
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
    if (allocation.is_tuition || allocation.matriculation_fee_line_id === "tuition") {
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
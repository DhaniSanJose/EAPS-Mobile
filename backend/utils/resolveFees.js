const FEE_CATEGORY = {
  TUITION: 2,
  MISCELLANEOUS: 3,
  OTHER: 5,
};

const {
  normalizeFeeCode,
  isNstpCatalogFee,
  normalizeHasNstpSubject,
  normalizeBooleanFlag,
} = require("./feeNormalization");

const normalizeFlag = (value) => normalizeBooleanFlag(value);

const normalizeAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : 0;
};

const isNstpFeeCode = (code) => String(code || "").toUpperCase().includes("NSTP");

const isBaseTuitionFee = (fee) => {
  const code = normalizeFeeCode(fee);
  if (!code || isNstpFeeCode(code)) return false;
  return (
    code === "TUITION" ||
    code.includes("TUITION_FEE") ||
    code.includes("LEC_LAB") ||
    code.includes("UNIT_TUITION")
  );
};

const isTuitionRelatedCategory = (feeCategory) =>
  Number(feeCategory) === FEE_CATEGORY.TUITION;

const shouldIncludeFee = (fee, context) => {
  const code = normalizeFeeCode(fee);

  if (isNstpCatalogFee(fee)) {
    return normalizeHasNstpSubject({
      nstpCount: context.nstp_count,
      hasNstpFlag: context.has_nstp,
    });
  }

  if (code.includes("SCHOOL") && code.includes("ID")) {
    return normalizeFlag(context.is_first_year_first_sem);
  }

  if (code.includes("COMPUTER")) {
    return normalizeFlag(context.has_computer);
  }

  if (code.includes("LABORATORY") || code === "LAB") {
    return normalizeFlag(context.has_laboratory);
  }

  return true;
};

const scoreFeeRate = (rate, context) => {
  const branchId =
    context.branch_id == null || context.branch_id === ""
      ? null
      : Number(context.branch_id);
  const curriculumId =
    context.dprtmnt_curriculum_id == null || context.dprtmnt_curriculum_id === ""
      ? null
      : Number(context.dprtmnt_curriculum_id);
  const yearLevelId =
    context.year_level_id == null || context.year_level_id === ""
      ? null
      : Number(context.year_level_id);

  const rateBranchId =
    rate.branch_id == null || rate.branch_id === "" ? null : Number(rate.branch_id);
  const rateCurriculumId =
    rate.dprtmnt_curriculum_id == null || rate.dprtmnt_curriculum_id === ""
      ? null
      : Number(rate.dprtmnt_curriculum_id);
  const rateYearLevelId = Number(rate.applied_to) === 0 ? null : Number(rate.applied_to);

  if (rateBranchId !== null && rateBranchId !== branchId) {
    return -1;
  }

  if (Number(rate.applies_to_all) !== 1) {
    if (rateCurriculumId === null || rateCurriculumId !== curriculumId) {
      return -1;
    }
  }

  if (rateYearLevelId !== null && rateYearLevelId !== yearLevelId) {
    return -1;
  }

  let score = 0;
  if (rateBranchId !== null) score += 20;
  if (Number(rate.applies_to_all) !== 1) score += 20;
  if (rateYearLevelId !== null) score += 20;
  return score;
};

const pickBestRate = (rates, context) => {
  let best = null;
  let bestScore = -1;

  for (const rate of rates) {
    if (Number(rate.is_active) !== 1) continue;
    const score = scoreFeeRate(rate, context);
    if (score > bestScore) {
      bestScore = score;
      best = rate;
    }
  }

  if (best) return best;

  for (const rate of rates) {
    if (Number(rate.is_active) !== 1) continue;
    if (Number(rate.applies_to_all) === 1) {
      const rateBranchId =
        rate.branch_id == null || rate.branch_id === "" ? null : Number(rate.branch_id);
      const branchId =
        context.branch_id == null || context.branch_id === ""
          ? null
          : Number(context.branch_id);
      const yearLevelId =
        context.year_level_id == null || context.year_level_id === ""
          ? null
          : Number(context.year_level_id);
      const rateYearLevelId =
        Number(rate.applied_to) === 0 ? null : Number(rate.applied_to);
      if (rateBranchId === null || rateBranchId === branchId) {
        if (rateYearLevelId !== null && rateYearLevelId !== yearLevelId) {
          continue;
        }
        return rate;
      }
    }
  }

  return rates.find((rate) => Number(rate.is_active) === 1) || null;
};

const buildFeeLineFromRate = (fee, rate, amount, extra = {}) => ({
  fee_rate_id: rate.fee_rate_id,
  fee_id: fee.fee_id,
  fee_code: fee.fee_code,
  fee_name: fee.fee_name,
  fee_category: Number(fee.fee_category),
  sort_order: Number(fee.sort_order ?? 0),
  fee_group: fee.fee_group ?? null,
  account_type: fee.account_type ?? null,
  fee_group_description: fee.fee_group_description ?? null,
  account_type_description: fee.account_type_description ?? null,
  amount: normalizeAmount(amount),
  ...extra,
});

const resolveFees = async ({ db, context }) => {
  const computedTuition = normalizeAmount(context.tuition_amount);

  const [catalogRows] = await db.query(
    `SELECT
      fc.fee_id,
      fc.fee_code,
      fc.fee_name,
      fc.fee_category,
      fc.sort_order,
      fc.fee_group,
      fc.account_type,
      fg.description AS fee_group_description,
      at.description AS account_type_description
    FROM fee_catalog fc
    LEFT JOIN fee_group fg ON fg.id = fc.fee_group
    LEFT JOIN account_type at ON at.id = fc.account_type
    WHERE fc.is_active = 1
    ORDER BY fc.sort_order ASC, fc.fee_name ASC`
  );

  const [rateRows] = await db.query(
    `SELECT
      fr.fee_rate_id,
      fr.fee_id,
      fr.dprtmnt_curriculum_id,
      fr.branch_id,
      fr.amount,
      fr.applied_to,
      fr.applies_to_all,
      fr.is_active
    FROM fee_rate fr
    INNER JOIN fee_catalog fc ON fc.fee_id = fr.fee_id
    WHERE fc.is_active = 1 AND fr.is_active = 1`
  );

  const ratesByFeeId = rateRows.reduce((acc, rate) => {
    const key = String(rate.fee_id);
    if (!acc[key]) acc[key] = [];
    acc[key].push(rate);
    return acc;
  }, {});

  const catalogFeeLines = [];
  let baseTuitionLine = null;

  for (const fee of catalogRows) {
    if (!shouldIncludeFee(fee, context)) {
      continue;
    }

    const rates = ratesByFeeId[String(fee.fee_id)] || [];
    const bestRate = pickBestRate(rates, context);
    if (!bestRate) continue;

    if (isBaseTuitionFee(fee)) {
      if (computedTuition <= 0) continue;
      baseTuitionLine = buildFeeLineFromRate(fee, bestRate, computedTuition, {
        is_computed_tuition: true,
      });
      continue;
    }

    const amount = normalizeAmount(bestRate.amount);
    if (amount <= 0) continue;

    catalogFeeLines.push(
      buildFeeLineFromRate(fee, bestRate, amount, {
        is_nstp_fee: isNstpCatalogFee(fee),
      })
    );
  }

  catalogFeeLines.sort(
    (a, b) =>
      Number(a.sort_order) - Number(b.sort_order) ||
      String(a.fee_name).localeCompare(String(b.fee_name))
  );

  const tuitionRelated = catalogFeeLines
    .filter((line) => isTuitionRelatedCategory(line.fee_category))
    .reduce((sum, line) => sum + normalizeAmount(line.amount), 0);
  const miscellaneous = catalogFeeLines
    .filter((line) => Number(line.fee_category) === FEE_CATEGORY.MISCELLANEOUS)
    .reduce((sum, line) => sum + normalizeAmount(line.amount), 0);
  const other = catalogFeeLines
    .filter((line) => Number(line.fee_category) === FEE_CATEGORY.OTHER)
    .reduce((sum, line) => sum + normalizeAmount(line.amount), 0);
  const catalogTotal = catalogFeeLines.reduce(
    (sum, line) => sum + normalizeAmount(line.amount),
    0
  );

  const totals = {
    computed_tuition: computedTuition,
    tuition: computedTuition,
    tuition_related: normalizeAmount(tuitionRelated),
    miscellaneous: normalizeAmount(miscellaneous),
    other: normalizeAmount(other),
    total_tosf: normalizeAmount(computedTuition + catalogTotal),
  };

  return {
    fee_lines: catalogFeeLines,
    computed_tuition: computedTuition,
    base_tuition_line: baseTuitionLine,
    totals,
  };
};

module.exports = {
  FEE_CATEGORY,
  resolveFees,
  normalizeAmount,
  isBaseTuitionFee,
  isTuitionRelatedCategory,
  isNstpFeeCode,
};
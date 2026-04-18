/* =========================================================
   Oney & Co — Shared finance math (Phase 1)
   Single source of truth for repayments / DTI / LVR / yield.
   No tool-specific helpers, no DOM access.
   ========================================================= */

export function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[, _]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function toMonthlyRate(annualRatePct) {
  return toNumber(annualRatePct) / 100 / 12;
}

/**
 * Standard P&I monthly repayment.
 * Returns 0 when principal or term is missing. Returns straight-line when rate is 0.
 */
export function calcMonthlyRepayment({ principal, annualRatePct, termYears }) {
  const p = toNumber(principal);
  const r = toMonthlyRate(annualRatePct);
  const n = toNumber(termYears) * 12;
  if (!p || !n) return 0;
  if (!r) return p / n;
  return (p * r) / (1 - Math.pow(1 + r, -n));
}

export function calcInterestOnly({ principal, annualRatePct }) {
  return toNumber(principal) * (toNumber(annualRatePct) / 100) / 12;
}

export function calcTotalInterest({ principal, annualRatePct, termYears }) {
  const monthly = calcMonthlyRepayment({ principal, annualRatePct, termYears });
  const totalPaid = monthly * toNumber(termYears) * 12;
  return Math.max(0, totalPaid - toNumber(principal));
}

export function calcDTI({ totalDebt, grossAnnualIncome }) {
  const debt = toNumber(totalDebt);
  const income = toNumber(grossAnnualIncome);
  if (!debt || !income) return 0;
  return debt / income;
}

export function calcLVR({ loanAmount, securityValue }) {
  const loan = toNumber(loanAmount);
  const value = toNumber(securityValue);
  if (!loan || !value) return 0;
  return loan / value;
}

export function calcGrossYield({ weeklyRent, purchasePrice }) {
  const rent = toNumber(weeklyRent) * 52;
  const price = toNumber(purchasePrice);
  if (!rent || !price) return 0;
  return rent / price;
}

export function calcNetYield({ weeklyRent, annualCosts, purchasePrice }) {
  const rent = toNumber(weeklyRent) * 52;
  const costs = toNumber(annualCosts);
  const price = toNumber(purchasePrice);
  if (!price) return 0;
  return (rent - costs) / price;
}

export function calcICR({ noi, annualInterest }) {
  const interest = toNumber(annualInterest);
  if (!interest) return 0;
  return toNumber(noi) / interest;
}

export function calcDSCR({ noi, annualDebtService }) {
  const ds = toNumber(annualDebtService);
  if (!ds) return 0;
  return toNumber(noi) / ds;
}

/* ---------- Formatting ---------- */

export function formatCurrency(value, { fractionDigits = 0 } = {}) {
  const n = toNumber(value);
  return new Intl.NumberFormat('en-AU', {
    style: 'currency', currency: 'AUD',
    minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits,
  }).format(n);
}

export function formatPercent(value, { fractionDigits = 2 } = {}) {
  const n = toNumber(value);
  return `${n.toFixed(fractionDigits)}%`;
}

export function formatNumber(value, { fractionDigits = 0 } = {}) {
  const n = toNumber(value);
  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits,
  }).format(n);
}

export function formatRatio(value, { fractionDigits = 2 } = {}) {
  const n = toNumber(value);
  return `${n.toFixed(fractionDigits)}x`;
}

/* ---------- Commercial helpers ---------- */

/**
 * LVR caps by property class. Used by Servicing and Security.
 * Single source of truth so free + Pro never diverge.
 */
export const LVR_CAPS = {
  residential: 0.80,
  'residential-investment': 0.80,
  'commercial-standard': 0.65,
  'commercial-office': 0.65,
  'commercial-retail': 0.65,
  'commercial-industrial': 0.65,
  'specialised': 0.50,
  'rural': 0.50,
  'development': 0.65,
};

export function lvrCapFor(propertyType) {
  return LVR_CAPS[propertyType] ?? 0.65;
}

/**
 * Net Operating Income from passing rent and outgoings.
 */
export function calcNOI({ grossAnnualRent, annualOutgoings }) {
  return Math.max(0, toNumber(grossAnnualRent) - toNumber(annualOutgoings));
}

/**
 * Weighted Average Lease Expiry (years) from a tenant schedule.
 * tenants: [{ annualRent, leaseExpiryYears }]
 */
export function calcWALE(tenants) {
  if (!Array.isArray(tenants) || !tenants.length) return 0;
  const totalRent = tenants.reduce((sum, t) => sum + toNumber(t.annualRent), 0);
  if (!totalRent) return 0;
  const weighted = tenants.reduce((sum, t) => sum + toNumber(t.annualRent) * toNumber(t.leaseExpiryYears), 0);
  return weighted / totalRent;
}

/* ---------- Status helper ---------- */

/**
 * Compare a metric to two thresholds and return a status string.
 * `higherIsBetter` controls direction.
 */
export function statusBand(value, { passAbove, warnAbove, higherIsBetter = true }) {
  const n = toNumber(value);
  if (higherIsBetter) {
    if (n >= passAbove) return 'pass';
    if (n >= warnAbove) return 'warn';
    return 'fail';
  }
  if (n <= passAbove) return 'pass';
  if (n <= warnAbove) return 'warn';
  return 'fail';
}

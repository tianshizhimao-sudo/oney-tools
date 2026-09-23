/* =========================================================
   Oney Coach — shared test scoring layer (TEST ONLY, noindex page)

   ONE deterministic engine shared by BOTH entry modes (Quick Check and
   Tell Oney). Identical confirmed inputs always produce an identical score,
   result band and action plan, no matter which path produced them.

   The score is a faithful mirror of the repository's existing approved
   Bank-Ready Score rubric in
   `assets/js/tools/bank-ready-score.config.js` (band* functions + WEIGHTS).
   That production file is NOT modified or imported at runtime — the bands are
   mirrored here so the test page stays a self-contained static file.

   This is NOT the production Bank-Ready Score and is not presented as one.
   ========================================================= */

// Single relative specifier: Node resolves it on disk, the browser resolves the
// same file over HTTP. Keeps one import path for tests and the page.
import {
  parseTellOney,
  NOT_UNDERSTOOD,
  PARSER_FIELDS,
  SAMPLE_TELL_ONEY_TEXT,
  AMBIGUOUS_TELL_ONEY_TEXT,
} from './oney-coach-parse.js';

export {
  parseTellOney,
  NOT_UNDERSTOOD,
  PARSER_FIELDS,
  SAMPLE_TELL_ONEY_TEXT,
  AMBIGUOUS_TELL_ONEY_TEXT,
};

/* ---------- Field metadata ---------- */

/*
 * Every field is expressed in the SAME internal vocabulary the mirrored rubric
 * uses, so both entry modes land on one canonical shape.
 */
export const FIELD_DEFS = {
  turnover: {
    label: 'Annual turnover',
    help: 'Revenue before expenses, most recent financial year.',
    kind: 'money',
    required: true,
  },
  profitMargin: {
    label: 'Net profit margin',
    help: 'After-tax net profit divided by revenue.',
    kind: 'percent',
    required: true,
  },
  yearsInBusiness: {
    label: 'Years in business',
    help: 'How long the business has been trading.',
    kind: 'number',
    required: true,
  },
  atoStatus: {
    label: 'ATO status',
    help: 'Your standing with the ATO.',
    kind: 'enum',
    required: true,
    options: [
      { value: 'clean', label: 'No debt, BAS lodged on time' },
      { value: 'plan', label: 'Has debt, on an ATO payment plan' },
      { value: 'small', label: 'Has debt under $25K, no plan' },
      { value: 'large', label: 'Has debt over $25K, no plan' },
    ],
  },
  totalDebt: {
    label: 'Business debt load',
    help: 'Total business borrowings and liabilities.',
    kind: 'money',
    required: true,
  },
  industryRisk: {
    label: 'Industry risk',
    help: 'Risk band for your core industry.',
    kind: 'enum',
    required: true,
    options: [
      { value: 'low', label: 'Low risk (professional services, healthcare)' },
      { value: 'medium', label: 'Medium risk (retail, hospitality, transport)' },
      { value: 'high', label: 'High risk (construction, mining, restricted)' },
    ],
  },
  creditScore: {
    label: 'Credit score',
    help: 'Personal/director credit score (Equifax, illion or Experian).',
    kind: 'number',
    required: true,
  },
  cashflowStability: {
    label: 'Cash-flow stability',
    help: 'How predictable your cash flow is.',
    kind: 'enum',
    required: true,
    options: [
      { value: 'stable', label: 'Stable year-round, no major fluctuations' },
      { value: 'seasonal', label: 'Seasonal but predictable' },
      { value: 'lumpy', label: 'Project-based, irregular' },
      { value: 'volatile', label: 'Irregular and highly volatile' },
    ],
  },
  loanPurpose: {
    label: 'Loan purpose',
    help: 'What the finance is for. Not scored — used for the action plan.',
    kind: 'enum',
    required: false,
    options: [
      { value: 'workingCapital', label: 'Working capital loan' },
      { value: 'equipment', label: 'Equipment / asset finance' },
      { value: 'property', label: 'Commercial property loan' },
      { value: 'refinance', label: 'Refinancing' },
      { value: 'other', label: 'Other' },
    ],
  },
  incomeResilience: {
    label: 'Income resilience',
    help: 'How resilient your income is if unemployment rises to around 4.5%.',
    kind: 'enum',
    required: false,
    options: [
      { value: 'strong', label: 'Very resilient — essential sector, stable contracts' },
      { value: 'moderate', label: 'Reasonably stable — steady clients, some cycle exposure' },
      { value: 'variable', label: 'Variable — overtime, bonuses, casual shifts, few customers' },
      { value: 'exposed', label: 'Exposed — recent income drop, weak cash buffer' },
    ],
  },
};

export const FIELD_ORDER = [
  'turnover',
  'profitMargin',
  'yearsInBusiness',
  'atoStatus',
  'totalDebt',
  'industryRisk',
  'creditScore',
  'cashflowStability',
  'loanPurpose',
  'incomeResilience',
];

/* Fields that must be resolved before the score can be calculated. */
export const REQUIRED_FIELDS = FIELD_ORDER.filter((id) => FIELD_DEFS[id].required);

/* ---------- Mirrored rubric (same bands as bank-ready-score.config.js) ---------- */

export const WEIGHTS = {
  turnover: 0.05,
  profit: 0.05,
  years: 0.20,
  ato: 0.20,
  gearing: 0.05,
  industry: 0.20,
  credit: 0.20,
  cashflow: 0.05,
};

function bandTurnover(v) {
  if (v >= 10_000_000) return 100;
  if (v >= 2_000_000) return 80;
  if (v >= 500_000) return 60;
  return 40;
}
function bandProfitMargin(marginPct) {
  if (marginPct >= 20) return 100;
  if (marginPct >= 10) return 80;
  if (marginPct >= 5) return 60;
  return 30;
}
function bandYears(y) {
  if (y >= 3) return 100;
  if (y >= 2) return 75;
  if (y >= 1) return 50;
  return 20;
}
function bandATO(status) {
  switch (status) {
    case 'clean': return 100;
    case 'plan': return 65;
    case 'small': return 45;
    case 'large': return 15;
    default: return 100;
  }
}
function bandGearing(totalDebt, totalAssets) {
  const g = totalAssets > 0 ? totalDebt / totalAssets : 0;
  if (g <= 0.3) return 90;
  if (g <= 0.5) return 70;
  if (g <= 0.7) return 50;
  return 30;
}
/*
 * The mirrored rubric derives gearing from debt AND assets. The test page
 * asks only for debt, so gearing is expressed against a documented fixed
 * reference asset base rather than an invented per-user figure. This is a
 * stated simplification, not an inference about the user.
 */
export const GEARING_REFERENCE_ASSETS = 2_000_000;

function bandIndustry(level) {
  if (level === 'low') return 100;
  if (level === 'medium') return 60;
  return 25;
}
function bandCredit(score) {
  if (score >= 800) return 100;
  if (score >= 700) return 85;
  if (score >= 600) return 55;
  if (score >= 500) return 30;
  return 10;
}
function bandCashflow(stability) {
  if (stability === 'stable') return 100;
  if (stability === 'seasonal') return 70;
  if (stability === 'lumpy') return 45;
  return 20;
}

export function gradeBand(score) {
  if (score >= 80) return { label: 'Healthy', tone: 'pass', text: 'Most of the criteria banks look for are in place. The next step is getting the file lender-ready.' };
  if (score >= 65) return { label: 'Fine', tone: 'pass', text: 'A reasonable starting position, with some criteria lenders may condition on.' };
  if (score >= 50) return { label: 'Borderline', tone: 'warn', text: 'Selective lenders, and more likely a tier-2 or specialist pathway.' };
  if (score >= 35) return { label: 'Action Required', tone: 'warn', text: 'Improvements are likely needed before applying. Several can be done in months.' };
  return { label: 'Not Ready', tone: 'fail', text: 'Material weaknesses across dimensions. Rebuild the position before applying.' };
}

const DIMENSION_LABELS = {
  turnover: 'Annual turnover',
  profit: 'Profit margin',
  years: 'Years in business',
  ato: 'ATO standing',
  gearing: 'Debt load',
  industry: 'Industry risk',
  credit: 'Credit score',
  cashflow: 'Cash-flow stability',
};

/* ---------- Deterministic actions ---------- */

const ACTION_LIBRARY = {
  ato: {
    clean: 'Keep BAS and ATO lodgements current and documented — this is already a strength.',
    plan: 'Keep the ATO payment plan current in writing and hold proof of each instalment before applying.',
    small: 'Clear the ATO balance or move it onto a formal payment plan — arrears under $25K are usually fixable quickly.',
    large: 'Prioritise the ATO debt over new borrowing and put a formal, documented payment plan in place.',
  },
  credit: {
    high: 'Keep the credit file untouched — avoid new credit enquiries in the 6 months before applying.',
    mid: 'Reduce card limits and correct any credit file errors before applying.',
    low: 'Rebuild credit before applying: clear arrears, keep limits low and avoid new enquiries.',
  },
  years: {
    new: 'Build more trading history — additional lenders open up once the business passes the 2-year mark.',
    established: 'Keep two or more years of financials and BAS ready as evidence of trading history.',
  },
  gearing: {
    light: 'Hold existing debt levels steady while the application is prepared.',
    heavy: 'Reduce total business debt before adding new facilities — lower gearing materially improves the position.',
  },
  cashflow: {
    strong: 'Keep 6+ months of clean bank statements ready as evidence of stable cash flow.',
    weak: 'Build a documented cash buffer and reduce volatility with contracted or recurring revenue.',
  },
  turnover: {
    large: 'Ensure turnover is fully evidenced across BAS, financials and bank statements.',
    small: 'Growing and documenting revenue above $500K opens up materially more lending options.',
  },
  profit: {
    strong: 'Ensure your accountant presents net profit clearly, separate from revenue.',
    weak: 'Improve documented net margin — banks assess after-tax net profit, not revenue.',
  },
  industry: {
    low: 'No industry-specific constraint identified.',
    high: 'Some lenders have hard policy restrictions on this sector — a specialist broker can match an appropriate lender.',
    medium: 'Confirm which lenders are currently open to this sector before applying.',
  },
};

function actionsFor(values, dims) {
  const actions = [];

  actions.push(ACTION_LIBRARY.ato[values.atoStatus] || ACTION_LIBRARY.ato.small);

  if (dims.credit >= 85) actions.push(ACTION_LIBRARY.credit.high);
  else if (dims.credit >= 55) actions.push(ACTION_LIBRARY.credit.mid);
  else actions.push(ACTION_LIBRARY.credit.low);

  if (dims.years < 75) actions.push(ACTION_LIBRARY.years.new);
  else actions.push(ACTION_LIBRARY.years.established);

  if (dims.gearing >= 70) actions.push(ACTION_LIBRARY.gearing.light);
  else actions.push(ACTION_LIBRARY.gearing.heavy);

  if (dims.cashflow >= 70) actions.push(ACTION_LIBRARY.cashflow.strong);
  else actions.push(ACTION_LIBRARY.cashflow.weak);

  if (dims.turnover >= 60) actions.push(ACTION_LIBRARY.turnover.large);
  else actions.push(ACTION_LIBRARY.turnover.small);

  if (dims.profit >= 60) actions.push(ACTION_LIBRARY.profit.strong);
  else actions.push(ACTION_LIBRARY.profit.weak);

  if (dims.industry >= 100) actions.push(ACTION_LIBRARY.industry.low);
  else if (dims.industry >= 60) actions.push(ACTION_LIBRARY.industry.medium);
  else actions.push(ACTION_LIBRARY.industry.high);

  return actions;
}

function loanPurposeNote(values) {
  switch (values.loanPurpose) {
    case 'workingCapital': return 'Working capital: prepare recent management accounts and 3–6 months of bank statements.';
    case 'equipment': return 'Equipment finance: get a written quote and asset details ready.';
    case 'property': return 'Commercial property: prepare a valuation position and clear source-of-funds evidence.';
    case 'refinance': return 'Refinance: gather current statements, payout figures and any exit or break costs.';
    case 'other': return 'Prepare a written purpose statement and the supporting evidence for it.';
    default: return null;
  }
}

/* ---------- The one shared deterministic scorer ---------- */

/**
 * Deterministic readiness score. Same confirmed inputs -> same output, always.
 * Pure function: no DOM, no timers, no network, no randomness.
 */
export function scoreReadiness(values) {
  const turnover = Number(values.turnover) || 0;
  const profitMargin = Number(values.profitMargin) || 0;
  const totalDebt = Number(values.totalDebt) || 0;
  const totalAssets = GEARING_REFERENCE_ASSETS;

  const dims = {
    turnover: bandTurnover(turnover),
    profit: bandProfitMargin(profitMargin),
    years: bandYears(Number(values.yearsInBusiness) || 0),
    ato: bandATO(values.atoStatus),
    gearing: bandGearing(totalDebt, totalAssets),
    industry: bandIndustry(values.industryRisk),
    credit: bandCredit(Number(values.creditScore) || 0),
    cashflow: bandCashflow(values.cashflowStability),
  };

  let weighted = 0;
  for (const k of Object.keys(WEIGHTS)) weighted += dims[k] * WEIGHTS[k];
  const score = Math.max(0, Math.min(100, Math.round(weighted)));
  const grade = gradeBand(score);

  const entries = Object.entries(dims);
  const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const worst = entries.reduce((a, b) => (b[1] < a[1] ? b : a));

  const drivers = entries
    .slice()
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([k, v]) => ({ dimension: DIMENSION_LABELS[k], score: v }));

  const purposeNote = loanPurposeNote(values);
  const actions = actionsFor(values, dims);
  if (purposeNote) actions.push(purposeNote);

  return {
    score,
    gradeLabel: grade.label,
    gradeTone: grade.tone,
    gradeText: grade.text,
    dimensions: dims,
    dimensionLabels: DIMENSION_LABELS,
    strongest: { key: best[0], label: DIMENSION_LABELS[best[0]], value: best[1] },
    weakest: { key: worst[0], label: DIMENSION_LABELS[worst[0]], value: worst[1] },
    drivers,
    actions,
    disclosure: 'General information only. This is not financial advice, not an approval, approval promise, lending decision or guarantee. Any financing remains subject to applicable assessment and eligibility requirements.',
  };
}

/* ---------- Confirmation stage (shared by BOTH modes) ---------- */

/**
 * Builds the editable confirmation rows for a set of proposed values.
 * `source` records where each value came from so parsed and user-confirmed
 * values are always distinguishable in the UI.
 *
 * A value that is missing/ambiguous/conflicting arrives as `null` and renders
 * as "Not understood" — it is never pre-filled with a guess.
 */
export function buildConfirmation(proposed = {}, source = 'quick') {
  return FIELD_ORDER.map((id) => {
    const def = FIELD_DEFS[id];
    const raw = proposed[id];
    const hasValue = raw !== null && raw !== undefined && raw !== '' && raw !== NOT_UNDERSTOOD;
    return {
      id,
      ...def,
      proposed: hasValue ? raw : null,
      confirmed: null,
      source: hasValue ? source : null,
      status: hasValue ? 'parsed' : 'not_understood',
      display: hasValue ? String(raw) : NOT_UNDERSTOOD,
    };
  });
}

/**
 * Which fields still block calculation.
 * A field blocks when it is required and has no confirmed value.
 */
export function blockingFields(rows) {
  return rows
    .filter((r) => r.required)
    .filter((r) => r.confirmed === null || r.confirmed === undefined || r.confirmed === '' || r.confirmed === NOT_UNDERSTOOD)
    .map((r) => r.id);
}

/**
 * True only when every required field has an explicit user confirmation.
 * This is the gate that keeps the result hidden until the user confirms.
 */
export function canCalculate(rows) {
  return blockingFields(rows).length === 0;
}

/** Collapses confirmed rows into the canonical values object for the scorer. */
export function confirmedValues(rows) {
  const out = {};
  for (const r of rows) {
    out[r.id] = r.confirmed === undefined ? null : r.confirmed;
  }
  return out;
}

/* ---------- Quick Check -> canonical internal values ---------- */

/*
 * Quick Check collects raw facts (turnover in dollars, profit in dollars) and
 * converts them with explicit, documented arithmetic so both modes express the
 * same field in the same unit (margin as a percentage).
 */
export function quickCheckToFields(input) {
  const turnover = toNumber(input.turnover);
  const profit = toNumber(input.profit);
  const margin = turnover > 0 ? Math.round((profit / turnover) * 1000) / 10 : null;

  return {
    turnover: turnover || null,
    profitMargin: margin,
    yearsInBusiness: input.yearsInBusiness === '' ? null : toNumber(input.yearsInBusiness),
    atoStatus: input.atoStatus || null,
    totalDebt: input.totalDebt === '' ? null : toNumber(input.totalDebt),
    industryRisk: input.industryRisk || null,
    creditScore: input.creditScore === '' ? null : toNumber(input.creditScore),
    cashflowStability: input.cashflowStability || null,
    loanPurpose: input.loanPurpose || null,
    incomeResilience: input.incomeResilience || null,
  };
}

export function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[, _]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/* ---------- Tell Oney -> canonical internal values ---------- */

/**
 * Maps parser output onto the same canonical field vocabulary Quick Check
 * uses. Anything the parser marked Not understood becomes null so the
 * confirmation stage forces an explicit user choice.
 */
export function tellOneyToFields(parsedFacts) {
  const out = {};
  for (const id of FIELD_ORDER) {
    const fact = parsedFacts[id];
    out[id] = fact && fact.status === 'parsed' && fact.value !== null ? fact.value : null;
  }
  return out;
}

/* ---------- Entry points used by the page ---------- */

export function confirmationFromQuickCheck(input) {
  return buildConfirmation(quickCheckToFields(input), 'quick');
}

export function confirmationFromTellOney(text) {
  const parsed = parseTellOney(text);
  return { rows: buildConfirmation(tellOneyToFields(parsed.facts), 'parsed'), parsed };
}


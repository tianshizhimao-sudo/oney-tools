/* =========================================================
   Oney Credit Framework — MVP wrapper engine (pure, deterministic, no DOM)
   INTERNAL PROTOTYPE ONLY — synthetic data, noindex page, no network calls.

   Implements mvp-wrapper-spec-v0.1.md (2026-08-22):
     intake -> scenario tags -> rating + confidence -> Deferral Follow-Up Engine
     -> Simple / Comprehensive output -> re-rate loop (Comprehensive only)

   generateFollowUps() is a line-for-line port of
   assets/follow-up-engine/generate_followups.py (v0.2): same sort order
   (priority -> category -> id), Simple tier = first 5 questions,
   same engine-view and re-rate strings.

   Every output item carries a `kind` so the UI and copied text can separate
   facts, calculations, assumptions, deterministic rules and model judgement.
   ========================================================= */

import { RULES, RULE_LIBRARY } from './rules.js';
import { CASES, CASE_ORDER } from './cases.js';
import { DEFERRAL_REASONS, DEFERRAL_LIBRARY_VERSION, EXACT_DOCUMENT_RULE } from './deferral-reasons.js';

export { RULES, RULE_LIBRARY, CASES, CASE_ORDER, DEFERRAL_REASONS, DEFERRAL_LIBRARY_VERSION, EXACT_DOCUMENT_RULE };

export const ENGINE_VERSION = 'credit-framework-mvp-wrapper v0.1 (prototype)';

export const KIND = Object.freeze({
  FACT: 'fact',
  CALC: 'calculation',
  ASSUMPTION: 'assumption',
  RULE: 'rule',
  JUDGEMENT: 'judgement',
});

export const KIND_LABEL = Object.freeze({
  fact: 'Fact',
  calculation: 'Calculation',
  assumption: 'Assumption',
  rule: 'Rule',
  judgement: 'Judgement',
});

export const KIND_HELP = Object.freeze({
  fact: 'Provided by broker/client or case source document (synthetic).',
  calculation: 'Derived deterministically from facts, formula disclosed.',
  assumption: 'Temporary placeholder that must be confirmed.',
  rule: 'Deterministic Oney framework rule — same input, same output.',
  judgement: 'Model/banker judgement — pre-generated sample, not a live AI call.',
});

/* mvp-wrapper-spec-v0.1.md §3 — required wording on every output. */
export const BOUNDARY_TEXT = 'This is a lender-readiness and deal-packaging review. It does not approve credit, predict lender acceptance, or replace licensed credit assessment.';
/* generate_followups.py compliance footer (verbatim). */
export const ENGINE_BOUNDARY_TEXT = 'This checklist is designed to improve lender-readiness. It does not promise approval or lender acceptance.';

export const TIERS = Object.freeze({
  simple: { id: 'simple', name: 'Deal Readiness Snapshot', engineName: 'Simple — Deal Readiness Snapshot' },
  comprehensive: { id: 'comprehensive', name: 'Deal Coaching Report + Follow-Up Plan', engineName: 'Comprehensive — Deal Coaching Follow-Up Plan' },
});

export const DEAL_TYPES = Object.freeze({
  sme: 'SME',
  commercial_property: 'Commercial property',
  ato_debt: 'ATO debt',
  refinance: 'Refinance',
  working_capital: 'Working capital',
  equipment: 'Equipment',
  resi_investor_complex: 'Residential-investor complex',
});

export const BORROWER_TYPES = Object.freeze({
  individual: 'Individual',
  company: 'Company',
  trust: 'Trust',
  group: 'Group',
});

export const RATING_OPTIONS = Object.freeze([
  'Green — Package Ready',
  'Amber — Package Better',
  'Red — Rework First',
  'Black — Do Not Proceed',
]);

const RATING_LEVELS = ['green', 'amber', 'red', 'black'];
const RATING_NAME = {
  green: 'Green — Package Ready',
  amber: 'Amber — Package Better',
  red: 'Red — Rework First',
  black: 'Black — Do Not Proceed',
};
/* mvp-wrapper-spec §8 "Product action" column; Black reworded per §3 wording table. */
const RATING_ACTION = {
  green: 'Prepare lender-ready summary.',
  amber: 'Collect targeted evidence first.',
  red: 'Fix blockers before any lender path.',
  black: 'Do not proceed under current facts — refer or pause.',
};

const CONFIDENCE_ORDER = ['Low', 'Medium', 'Medium-High', 'High'];

const PRIORITY_ORDER = { Critical: 0, Important: 1, Helpful: 2 };

/* ---------------------------------------------------------
   Follow-up engine (port of generate_followups.py)
   --------------------------------------------------------- */

const QUESTION_KEYS = ['id', 'category', 'priority', 'triggerLabel', 'question', 'whyItMatters', 'evidence', 'ifStrong', 'ifWeak', 'owner', 'clientWording'];

function pyCompare(a, b) {
  // Python tuple comparison on (priority rank, category, id) — plain code-unit order.
  const pa = PRIORITY_ORDER[a.priority] ?? 99;
  const pb = PRIORITY_ORDER[b.priority] ?? 99;
  if (pa !== pb) return pa - pb;
  if (a.category !== b.category) return a.category < b.category ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function defaultEngineView(rating, tier) {
  if (tier === 'simple') return 'Quick readiness snapshot: identify the highest-impact questions only.';
  if (!rating) return 'Generate targeted broker follow-up questions.';
  const r = rating.toLowerCase();
  if (r.includes('green')) return 'Confirm final evidence and avoid weakening a strong package.';
  if (r.includes('amber')) return 'Resolve the few issues that decide lender strategy and confidence.';
  if (r.includes('red')) return 'Rework first before lender submission; focus only on critical blockers.';
  return 'Generate targeted broker follow-up questions.';
}

export function rerateNote(rating) {
  const r = (rating || '').toLowerCase();
  if (r.includes('green')) return 'If final evidence is confirmed, keep Green/package-ready. If valuation, contract or use-of-funds evidence weakens, move to Amber/package-better.';
  if (r.includes('amber')) return 'If critical evidence supports the story, consider moving toward Green/package-ready. If property, servicing or conduct evidence is weak, remain Amber or move to Red.';
  if (r.includes('red')) return 'Only improve from Red if critical blockers are resolved. If ATO/SG/conduct/security evidence is weak, remain Red and pause mainstream submission.';
  return 'Re-rate after evidence is collected; rating movement depends on whether critical blockers are resolved.';
}

export function generateFollowUps(caseInput, tier) {
  const ruleById = Object.fromEntries(RULES.map((r) => [r.id, r]));
  let questions = [];
  const unknown = [];
  for (const trigger of caseInput.triggers || []) {
    const rule = ruleById[trigger];
    if (!rule) { unknown.push(trigger); continue; }
    const q = {};
    for (const k of QUESTION_KEYS) q[k] = Array.isArray(rule[k]) ? [...rule[k]] : rule[k];
    questions.push(q);
  }
  questions.sort(pyCompare);
  if (tier === 'simple') questions = questions.slice(0, 5);
  return {
    dealId: caseInput.dealId,
    dealName: caseInput.dealName,
    currentRating: caseInput.currentRating,
    scenario: caseInput.scenario,
    engineView: caseInput.engineView ?? defaultEngineView(caseInput.currentRating, tier),
    tier,
    questions,
    unknownTriggers: unknown,
  };
}

/* ---------------------------------------------------------
   Scenario classification (mvp-wrapper-spec §6) — deterministic tag map
   --------------------------------------------------------- */

export const SCENARIO_TAGS = Object.freeze({
  clean_sme_refi: 'Clean SME refinance',
  ato_debt_restructure: 'ATO debt restructure',
  commercial_property: 'Commercial property',
  high_dti_resi_investor: 'High-DTI residential investor',
  working_capital_growth: 'Working-capital growth',
  weak_security_private_path: 'Weak security / private path',
  turnaround_case: 'Turnaround case',
  deferral_recovery: 'Deferral recovery',
});

const TRIGGER_TAG_MAP = {
  ato_debt: 'ato_debt_restructure',
  missed_ato_plan: 'ato_debt_restructure',
  sg_unevidenced: 'ato_debt_restructure',
  high_lvr_second_mortgage: 'weak_security_private_path',
  short_wale: 'commercial_property',
  zoning_environmental_missing: 'commercial_property',
  high_dti: 'high_dti_resi_investor',
  stale_preapproval: 'high_dti_resi_investor',
  contract_growth: 'working_capital_growth',
  turnaround_claim: 'turnaround_case',
};

const STRESS_CATEGORIES = new Set(['tax_compliance', 'conduct', 'conduct_capacity', 'capacity_leverage']);

export function classifyScenario(intake, triggers) {
  const tags = new Map();
  const add = (tag, because) => {
    if (!tags.has(tag)) tags.set(tag, []);
    tags.get(tag).push(because);
  };
  for (const t of triggers) if (TRIGGER_TAG_MAP[t]) add(TRIGGER_TAG_MAP[t], `trigger ${t}`);
  if (intake.dealType === 'commercial_property') add('commercial_property', 'deal type = commercial property');
  if (intake.dealType === 'ato_debt') add('ato_debt_restructure', 'deal type = ATO debt');
  if (intake.dealType === 'resi_investor_complex' && triggers.includes('high_dti')) add('high_dti_resi_investor', 'deal type = residential-investor complex');
  if ((intake.deferralReason || '').trim()) add('deferral_recovery', 'lender deferral / concern reason entered');
  for (const code of intake.deferralCodes || []) add('deferral_recovery', `lender deferral: ${code}`);
  const ruleById = Object.fromEntries(RULES.map((r) => [r.id, r]));
  const stressed = triggers.some((t) => ruleById[t] && (STRESS_CATEGORIES.has(ruleById[t].category) || t === 'high_lvr_second_mortgage'));
  if (!stressed && (intake.dealType === 'refinance' || intake.dealType === 'sme')) add('clean_sme_refi', 'refinance/SME deal with no tax, conduct or leverage stress triggers');
  const order = Object.keys(SCENARIO_TAGS);
  return [...tags.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([tag, because]) => ({ tag, label: SCENARIO_TAGS[tag], because, kind: KIND.RULE }));
}

/* ---------------------------------------------------------
   Calculations
   --------------------------------------------------------- */

export function formatMoney(n) {
  if (n === null || n === undefined || n === '' || !Number.isFinite(Number(n))) return '—';
  return '$' + Math.round(Number(n)).toLocaleString('en-AU');
}

export function calculations(intake) {
  const out = [];
  const v = Number(intake.securityValue);
  const d = Number(intake.totalSecuredDebt);
  if (v > 0 && d >= 0 && Number.isFinite(v) && Number.isFinite(d) && intake.securityValue !== '' && intake.totalSecuredDebt !== '') {
    const lvr = Math.round((d / v) * 1000) / 10;
    out.push({ id: 'lvr', label: 'Estimated total LVR (before costs)', value: `${lvr.toFixed(1)}%`, numeric: lvr, formula: `${formatMoney(d)} total secured debt ÷ ${formatMoney(v)} security value`, kind: KIND.CALC });
  }
  return out;
}


/* ---------------------------------------------------------
   Trigger suggestions from intake (deterministic, keyword + number rules).
   Suggestions never change the selection by themselves: the broker confirms.
   Calibrated so each untouched sample case suggests exactly its Obsidian
   case-JSON triggers (see tests).
   --------------------------------------------------------- */

const NEGATION = /\b(no|nil|zero|without|clean|nor)\b[^.;]{0,20}$/i;

function findUnnegated(text, re) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  for (const m of String(text || '').matchAll(g)) {
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    if (!NEGATION.test(before)) return m[0];
  }
  return null;
}

const quote = (s) => `“${String(s).trim()}”`;

export function suggestTriggers(intake) {
  const f = (k) => String(intake[k] ?? '');
  const all = ['purpose', 'security', 'income', 'existingDebts', 'conduct', 'documents', 'urgency', 'deferralReason', 'borrower'].map(f).join(' | ');
  const lvrCalc = calculations(intake).find((c) => c.id === 'lvr');
  const lvr = lvrCalc ? lvrCalc.numeric : null;
  const docs = f('documents');
  const missingDocs = (docs.match(/missing[^)]*|not (yet )?(provided|available)[^)]*/i) || [''])[0];
  const commercial = intake.dealType === 'commercial_property' || /\b(warehouse|industrial|commercial property|retail shop|office)\b/i.test(f('security') + ' ' + f('purpose'));
  const out = [];
  const add = (id, ...reasons) => out.push({ id, reasons: reasons.filter(Boolean), kind: KIND.RULE });
  let m;

  // Tax / compliance
  if ((m = findUnnegated(all, /\b(clear|owing|outstanding|repay)\s+ATO\b|\bATO (debt|integrated client account|balance owing|payment plan entered|plan entered)\b|\btax debt\b/i))) add('ato_debt', `intake mentions ${quote(m)}`);
  if (/\bATO\b/i.test(f('conduct') + f('urgency')) && (m = findUnnegated(f('conduct') + ' ' + f('urgency'), /\bmissed (an? |one )?(ATO )?(instalment|installment|payment)|\bplan (default(ed)?|cancell?ed)\b/i))) add('missed_ato_plan', `conduct mentions ${quote(m)}`);
  if ((m = all.match(/\b(SG|super(annuation)?)\b[^.;|]{0,60}\b(no evidence|not evidenced|unverified|according to (the )?director|director says|claimed)\b/i))) add('sg_unevidenced', `super/SG stated but not evidenced: ${quote(m[0])}`);

  // Conduct
  if ((m = findUnnegated(f('conduct'), /\bdishonou?rs?\b|\bexcess(es)?\b|\bover[- ]?limit\b/i))) add('dishonours_recent', `conduct mentions ${quote(m)}`);
  if ((m = all.match(/\bmerchant cash advance\b|\bMCA\b|\bdaily repayments?\b/i))) add('mca_present', `intake mentions ${quote(m[0])}`);
  if ((m = findUnnegated(all, /\bsupplier arrears\b|\baged creditors?\b[^.;|]{0,30}\b(60|90)\b|\boverdue suppliers?\b/i))) add('supplier_arrears', `intake mentions ${quote(m)}`);

  // Security / property
  const secondMortgage = /\b(second|2nd) mortgage\b|\bcaveat\b/i.test(f('security'));
  if (secondMortgage && lvr !== null && lvr >= 80) add('high_lvr_second_mortgage', 'second-ranking security', `estimated LVR ${lvr.toFixed(1)}%`);
  const valuationMissing = /valuation/i.test(missingDocs);
  if (!secondMortgage && lvr !== null && (lvr >= 78 || valuationMissing)) add('valuation_sensitive', lvr >= 78 ? `estimated LVR ${lvr.toFixed(1)}% is close to common thresholds` : null, valuationMissing ? 'valuation listed as missing' : null);
  const leaseMonths = (all.match(/\b(\d{1,3})\s*months?\s*(remaining|left|to run)\b/i) || [])[1];
  if (/\b(tenant|lease)\b/i.test(all) && ((leaseMonths && Number(leaseMonths) <= 24) || /\bshort WALE\b/i.test(all))) add('short_wale', leaseMonths ? `lease has ${leaseMonths} months remaining` : 'short WALE mentioned');
  if (commercial && (/zoning|environmental/i.test(missingDocs) || !/zoning/i.test(docs) || !/environmental/i.test(docs))) add('zoning_environmental_missing', /zoning|environmental/i.test(missingDocs) ? 'zoning/environmental listed as missing' : 'no zoning/environmental evidence listed');
  if ((m = all.match(/\brelated[- ](party|entity)\b|\bSMSF\b|\bproperty[- ]owning entity\b/i))) add('related_party_security', `intake mentions ${quote(m[0])}`);
  else if (commercial && /\b(used by (the )?borrower|owner[- ]occupi\w*)\b/i.test(f('purpose'))) add('related_party_security', 'owner-occupied commercial purchase: confirm which entity owns the property');

  // Purpose / structure
  const wc = /\bworking[- ]capital\b/i.test(f('purpose'));
  if (wc && !/\b(breakdown|use[- ]of[- ]funds|budget)\b/i.test(f('purpose') + ' ' + docs)) add('working_capital_vague', 'working capital requested without a use-of-funds breakdown');
  if ((m = (f('purpose') + ' ' + f('urgency')).match(/\b(new (service )?contracts?|purchase orders?|\bPOs?\b|tender won|new work)\b/i))) add('contract_growth', `growth linked to ${quote(m[0])}`);

  // Capacity / business
  if ((m = all.match(/\bDTI\b[^0-9]{0,12}(\d+(\.\d+)?)/i)) && Number(m[1]) > 6.5) add('high_dti', `DTI ${m[1]}x above 6.5`);
  if ((m = all.match(/\bpre-?approval\b[^.;|]{0,40}?(\b(\d+)\s*months?\s*(old|ago)\b|\bstale\b|\bexpired\b)/i)) && (!m[2] || Number(m[2]) >= 3)) add('stale_preapproval', `pre-approval ${m[1]}`);
  if ((m = all.match(/\bturn-?around\b|\blost (a |its )?major customer\b|\brecovery (claimed|underway|in progress)\b/i))) add('turnaround_claim', `intake mentions ${quote(m[0])}`);

  const order = RULES.map((r) => r.id);
  return out.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

export function compareTriggers(selected, suggested) {
  const sug = new Set(suggested.map((s) => s.id));
  const sel = new Set(selected);
  return {
    notSelected: [...sug].filter((id) => !sel.has(id)),
    manualOnly: [...sel].filter((id) => !sug.has(id)),
    matched: [...sel].filter((id) => sug.has(id)),
  };
}

/* ---------------------------------------------------------
   Rating + confidence (mvp-wrapper-spec §8, FRAMEWORK §6.3)
   --------------------------------------------------------- */

export function ratingLevel(rating) {
  const r = (rating || '').toLowerCase();
  return RATING_LEVELS.find((l) => r.includes(l)) || null;
}

function minConfidence(a, b) {
  return CONFIDENCE_ORDER[Math.min(CONFIDENCE_ORDER.indexOf(a), CONFIDENCE_ORDER.indexOf(b))];
}

const APPETITE_CATEGORIES = new Set(['tax_compliance', 'conduct', 'conduct_capacity', 'capacity_structure', 'capacity_leverage', 'security']);

/**
 * Evidence-weighted confidence. `outstandingCritical` = Critical triggers whose
 * evidence is not yet received-and-supporting.
 */
export function computeConfidence({ base, questions, tags, outstandingIds }) {
  const rulesApplied = [];
  let ceiling = 'High';
  const outstanding = questions.filter((q) => outstandingIds.has(q.id));
  const outstandingCritical = outstanding.filter((q) => q.priority === 'Critical');
  if (outstandingCritical.length) {
    ceiling = minConfidence(ceiling, 'Medium');
    rulesApplied.push({ id: 'R-CONF-1', text: 'Critical evidence outstanding caps confidence at Medium (see watch points).', kind: KIND.RULE });
  }
  if (tags.some((t) => t.tag === 'weak_security_private_path')) {
    ceiling = minConfidence(ceiling, 'Medium');
    rulesApplied.push({ id: 'R-CONF-3', text: 'Specialist/private pathway in play: confidence cannot be High unless appetite, pricing, LVR, repayment source and exit are evidenced.', kind: KIND.RULE });
  }
  const appetiteGaps = outstandingCritical.filter((q) => APPETITE_CATEGORIES.has(q.category));
  const flags = [];
  if (appetiteGaps.length) {
    // Flag only (Dong 2026-09-26): never applied automatically, no remedy suggested.
    flags.push({ id: 'R-CONF-2', text: `Flag: serviceability/conduct/security/compliance evidence still missing (${appetiteGaps.map((q) => q.triggerLabel).join('; ')}) — may cap confidence at Low.`, kind: KIND.RULE });
  }
  const value = minConfidence(base, ceiling);
  const capped = value !== base;
  return { base, ceiling, value, capped, rulesApplied, flags };
}

/* ---------------------------------------------------------
   Assessment
   --------------------------------------------------------- */

export const INTAKE_FIELDS = Object.freeze([
  { key: 'dealName', label: 'Deal name', section: 'Deal basics' },
  { key: 'scenario', label: 'Scenario summary', section: 'Deal basics' },
  { key: 'dealType', label: 'Deal type', section: 'Deal basics', options: DEAL_TYPES },
  { key: 'borrowerType', label: 'Borrower type', section: 'Borrower / structure', options: BORROWER_TYPES },
  { key: 'borrower', label: 'Borrower / structure', section: 'Borrower / structure' },
  { key: 'loanAmount', label: 'Loan amount', section: 'Purpose and amount', money: true },
  { key: 'purpose', label: 'Purpose', section: 'Purpose and amount' },
  { key: 'security', label: 'Security', section: 'Security' },
  { key: 'securityValue', label: 'Security value (estimate)', section: 'Security', money: true },
  { key: 'totalSecuredDebt', label: 'Proposed total secured debt', section: 'Security', money: true },
  { key: 'income', label: 'Income / revenue summary', section: 'Financial snapshot' },
  { key: 'existingDebts', label: 'Existing debts', section: 'Financial snapshot' },
  { key: 'conduct', label: 'Conduct / compliance', section: 'Conduct / compliance' },
  { key: 'documents', label: 'Key documents available', section: 'Documents available' },
  { key: 'urgency', label: 'Urgency', section: 'Deal basics' },
  { key: 'deferralReason', label: 'Lender deferral / concern reason', section: 'Deferral / concern reason' },
]);

function factValue(field, value) {
  if (field.options) return field.options[value] || value || '—';
  if (field.money) return formatMoney(value);
  const s = (value ?? '').toString().trim();
  return s || '—';
}

export function initialState(caseId = 'CF-002', tier = 'simple') {
  const c = CASES[caseId];
  return {
    caseId,
    edited: false,
    tier,
    intake: { ...c.intake, deferralCodes: [] },
    triggers: [...c.followUpCase.triggers],
    rating: c.followUpCase.currentRating,
    evidence: {},
  };
}

export function blankState(tier = 'simple') {
  const intake = {};
  for (const f of INTAKE_FIELDS) intake[f.key] = '';
  intake.dealType = 'sme';
  intake.deferralCodes = [];
  intake.borrowerType = 'company';
  return { caseId: null, edited: true, tier, intake, triggers: [], rating: 'Amber — Package Better', evidence: {} };
}

/** True when the state still matches the untouched sample case. */
export function isPristine(state) {
  if (!state.caseId || state.edited) return false;
  const c = CASES[state.caseId];
  if (state.rating !== c.followUpCase.currentRating) return false;
  // Deferral codes are an overlay: the sample judgement still applies (the plan notes it predates the deferral).
  const norm = (a) => JSON.stringify([...a].sort());
  if (norm(state.triggers) !== norm(c.followUpCase.triggers)) return false;
  return INTAKE_FIELDS.every((f) => String(state.intake[f.key] ?? '') === String(c.intake[f.key] ?? ''));
}

export const EVIDENCE_STATUS = Object.freeze({
  outstanding: 'Not yet received',
  reply_only: 'Client replied — no document yet',
  supports: 'Received — supports',
  weak: 'Received — weak / contradicted',
});

export function buildAssessment(state) {
  const pristine = isPristine(state);
  const c = pristine ? CASES[state.caseId] : null;
  const followUpCase = {
    dealId: c ? c.id : 'CUSTOM',
    dealName: state.intake.dealName || 'Custom scenario',
    currentRating: state.rating,
    scenario: state.intake.scenario || '',
    triggers: [...state.triggers],
  };
  const simple = generateFollowUps(followUpCase, 'simple');
  const comprehensive = generateFollowUps(followUpCase, 'comprehensive');
  const tags = classifyScenario(state.intake, state.triggers);
  const calcs = calculations(state.intake);

  const facts = INTAKE_FIELDS
    .filter((f) => !['dealName', 'scenario'].includes(f.key))
    .map((f) => ({ label: f.label, value: factValue(f, state.intake[f.key]), kind: KIND.FACT }));

  const assumptions = (c ? c.assumptions : [
    'All inputs are broker-entered and unverified.',
    'No model judgement is available for a custom scenario in this prototype; rating is the broker’s own current view.',
  ]).map((text) => ({ text, kind: KIND.ASSUMPTION }));

  const evidence = state.evidence || {};

  // Initial (pre-evidence) confidence: every triggered item is still outstanding.
  // Post-evidence confidence is produced by the re-rate loop below.
  const base = c ? c.judgement.calibratedConfidence : 'Medium';
  const confidence = computeConfidence({ base, questions: comprehensive.questions, tags, outstandingIds: new Set(comprehensive.questions.map((q) => q.id)) });
  // Watch points: what keeps confidence at Medium (Dong 2026-09-26: show Medium, call out watch points).
  confidence.watch = confidence.rulesApplied.some((r) => r.id === 'R-CONF-1')
    ? (c ? c.judgement.missingEvidence.critical.map((m) => m.item) : comprehensive.questions.filter((q) => q.priority === 'Critical').map((q) => q.triggerLabel))
    : [];
  if (!c) confidence.rulesApplied.push({ id: 'R-CONF-4', text: 'Custom scenario without model judgement: confidence limited to Medium in this prototype.', kind: KIND.RULE });
  if (!c && CONFIDENCE_ORDER.indexOf(confidence.value) > CONFIDENCE_ORDER.indexOf('Medium')) confidence.value = 'Medium';

  const suggested = suggestTriggers(state.intake);
  const triggerCheck = { suggested, ...compareTriggers(state.triggers, suggested), kind: KIND.RULE };

  const level = ratingLevel(state.rating);

  let risks;
  let missing;
  if (c) {
    risks = c.judgement.risks.map((r) => ({ ...r, kind: KIND.JUDGEMENT }));
    missing = {
      critical: c.judgement.missingEvidence.critical.map((m) => ({ ...m, kind: KIND.JUDGEMENT })),
      important: c.judgement.missingEvidence.important.map((m) => ({ ...m, kind: KIND.JUDGEMENT })),
      helpful: c.judgement.missingEvidence.helpful.map((item) => ({ item, kind: KIND.JUDGEMENT })),
    };
  } else {
    risks = comprehensive.questions.map((q) => ({ risk: q.triggerLabel, why: q.whyItMatters, mitigant: '—', status: 'Unresolved — evidence required', kind: KIND.RULE }));
    const byPriority = (p) => comprehensive.questions.filter((q) => q.priority === p)
      .map((q) => ({ item: q.evidence.join('; '), impact: q.whyItMatters, ifWeak: q.ifWeak, kind: KIND.RULE }));
    missing = { critical: byPriority('Critical'), important: byPriority('Important'), helpful: byPriority('Helpful').map((m) => ({ item: m.item, kind: KIND.RULE })) };
  }

  const nextStep = c
    ? { text: c.judgement.nextStep, kind: KIND.JUDGEMENT }
    : { text: comprehensive.questions.length ? `Resolve first: ${comprehensive.questions[0].triggerLabel} — ${comprehensive.questions[0].question}` : 'Select the triggers that apply to generate targeted questions.', kind: KIND.RULE };

  return {
    pristine,
    caseId: c ? c.id : null,
    synthetic: true,
    judgementSource: c ? c.judgement.source : null,
    followUpCase,
    engine: { simple, comprehensive },
    tags,
    calcs,
    triggerCheck,
    facts,
    assumptions,
    rating: { text: state.rating, level, action: level ? RATING_ACTION[level] : '', kind: c ? KIND.JUDGEMENT : KIND.ASSUMPTION },
    confidence,
    oneLineView: c ? { text: c.judgement.oneLineView, kind: KIND.JUDGEMENT } : null,
    risks,
    missing,
    dimensions: c ? c.judgement.dimensions.map((d) => ({ ...d, kind: KIND.JUDGEMENT })) : null,
    packaging: c ? { ...c.judgement.packaging, kind: KIND.JUDGEMENT } : null,
    nextStep,
    deferral: {
      engineView: comprehensive.engineView,
      rerateNote: rerateNote(state.rating),
      plan: buildDeferralPlan(state.intake.deferralCodes || [], comprehensive.questions, evidence),
      kind: KIND.RULE,
    },
    rerate: rerate({ questions: comprehensive.questions, rating: state.rating, tags, evidence }),
  };
}


/* ---------------------------------------------------------
   Deferral recovery plan (deferral-follow-up-engine-spec §4 Mode B)
   Comprehensive only. Status per reason is driven by the evidence status of
   its linked, selected triggers (same guardrail as re-rate: replies ≠ evidence).
   --------------------------------------------------------- */

export const DEFERRAL_STATUS = Object.freeze({
  pause: { rank: 2, short: 'pause', label: 'Pause — evidence received so far does not answer the lender’s question' },
  rework: { rank: 1, short: 'rework, then resubmit', label: 'Rework — collect the first items, then resubmit with the explanation' },
  resubmit: { rank: 0, short: 'ready to resubmit', label: 'Ready to resubmit with the explanation pack' },
});

export function buildDeferralPlan(codes, questions, evidence) {
  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  const label = (id) => (RULES.find((r) => r.id === id) || { triggerLabel: id }).triggerLabel;
  const reasons = DEFERRAL_REASONS.filter((d) => codes.includes(d.id)).map((d) => {
    const linkedSelected = d.linkedTriggers.filter((t) => byId[t]).map((t) => ({ id: t, label: label(t), status: evidence[t] || 'outstanding' }));
    const linkedNotSelected = d.linkedTriggers.filter((t) => !byId[t]).map((t) => ({ id: t, label: label(t) }));
    let status = 'rework';
    if (linkedSelected.some((x) => x.status === 'weak')) status = 'pause';
    else if (linkedSelected.length && linkedSelected.every((x) => x.status === 'supports')) status = 'resubmit';
    return { ...d, linkedSelected, linkedNotSelected, status, kind: KIND.RULE };
  });
  const overall = reasons.reduce((w, r) => (DEFERRAL_STATUS[r.status].rank > DEFERRAL_STATUS[w].rank ? r.status : w), 'resubmit');
  return { version: DEFERRAL_LIBRARY_VERSION, exactDocumentRule: EXACT_DOCUMENT_RULE, reasons, overall: reasons.length ? overall : null };
}

/* ---------------------------------------------------------
   Re-rate loop (mvp-wrapper-spec §10) — Comprehensive only
   Guardrail: never improve because the client replied; only evidence counts.
   --------------------------------------------------------- */

export const RERATE_GUARDRAIL = 'Do not improve the rating because the client replied. Improve only if the evidence proves the relevant credit issue.';

export function rerate({ questions, rating, tags, evidence }) {
  const statusOf = (q) => evidence[q.id] || 'outstanding';
  const critical = questions.filter((q) => q.priority === 'Critical');
  const criticalWeak = critical.filter((q) => statusOf(q) === 'weak');
  const importantWeak = questions.filter((q) => q.priority !== 'Critical' && statusOf(q) === 'weak');
  const supports = questions.filter((q) => statusOf(q) === 'supports');
  const replyOnly = questions.filter((q) => statusOf(q) === 'reply_only');
  const stillMissing = questions.filter((q) => ['outstanding', 'reply_only'].includes(statusOf(q)));
  const allCriticalSupported = critical.length > 0 && critical.every((q) => statusOf(q) === 'supports');
  const specialist = tags.some((t) => t.tag === 'weak_security_private_path');

  const from = ratingLevel(rating);
  let to = from;
  let movement = 'unchanged';
  const reasons = [];

  if (!from) {
    return { from: null, to: null, movement: 'unchanged', ratingText: rating, confidence: 'Low', reasons: ['No readiness rating selected.'], stillMissing: stillMissing.map((q) => q.triggerLabel), strategy: 'Select a rating before re-rating.', nextStep: 'Select a rating.', guardrail: RERATE_GUARDRAIL, kind: KIND.RULE, replyOnly: [] };
  }

  if (from === 'black') {
    reasons.push('Black ratings are never moved automatically; banker review required.');
  } else if (criticalWeak.length) {
    to = from === 'green' ? 'amber' : 'red';
    movement = to === from ? 'unchanged' : 'down';
    for (const q of criticalWeak) reasons.push(`${q.triggerLabel}: evidence weak — ${q.ifWeak}`);
  } else if (allCriticalSupported && importantWeak.length === 0) {
    to = from === 'red' ? 'amber' : 'green';
    movement = to === from ? 'unchanged' : 'up';
    for (const q of supports) reasons.push(`${q.triggerLabel}: evidence supports — ${q.ifStrong}`);
  } else {
    if (importantWeak.length) for (const q of importantWeak) reasons.push(`${q.triggerLabel}: evidence weak — ${q.ifWeak}`);
    const outstandingCritical = critical.filter((q) => statusOf(q) !== 'supports');
    if (outstandingCritical.length) reasons.push(`Rating held: ${outstandingCritical.length} Critical item${outstandingCritical.length > 1 ? 's' : ''} not yet proven by evidence.`);
    if (!critical.length && !importantWeak.length) reasons.push('No Critical triggers selected; rating held pending banker review.');
  }
  if (replyOnly.length) reasons.push(`Guardrail applied: ${replyOnly.length} client repl${replyOnly.length > 1 ? 'ies' : 'y'} without documents treated as still missing.`);

  let confidence;
  if (criticalWeak.length) confidence = 'Low';
  else if (allCriticalSupported) confidence = specialist ? 'Medium' : 'Medium-High';
  else confidence = 'Medium';

  let strategy;
  const lvrWeak = questions.some((q) => q.id === 'high_lvr_second_mortgage' && statusOf(q) === 'weak');
  if (lvrWeak) strategy = 'Pause / refer — no realistic secured-lending pathway is evidenced.';
  else if (to === 'green') strategy = 'Mainstream packaging — prepare the lender-ready summary.';
  else if (to === 'amber') strategy = specialist ? 'Specialist/private testing only, subject to appetite, pricing, LVR, repayment source and exit evidence.' : 'Collect the remaining evidence, then test selected mainstream lenders.';
  else if (to === 'red') strategy = specialist ? 'Pause mainstream submission; specialist/private path only if appetite, pricing and exit are evidenced.' : 'Rework first — fix blockers before any lender path.';
  else strategy = 'Do not proceed under current facts — refer or pause.';

  const firstGap = stillMissing.find((q) => q.priority === 'Critical') || stillMissing[0];
  const nextStep = criticalWeak.length
    ? `Discuss the weak evidence with the client: ${criticalWeak[0].triggerLabel}.`
    : firstGap
      ? `Chase next: ${firstGap.evidence.join(', ')} (${firstGap.owner}).`
      : 'Prepare the package summary and book banker review before any lender contact.';

  return {
    from,
    to,
    movement,
    ratingText: RATING_NAME[to],
    confidence,
    reasons,
    stillMissing: stillMissing.map((q) => q.triggerLabel),
    strategy,
    nextStep,
    guardrail: RERATE_GUARDRAIL,
    replyOnly: replyOnly.map((q) => q.id),
    kind: KIND.RULE,
  };
}

/* ---------------------------------------------------------
   Client email draft (Comprehensive only)
   --------------------------------------------------------- */

export function buildClientEmail(assessment) {
  const qs = assessment.engine.comprehensive.questions.filter((q) => q.priority !== 'Helpful');
  const lines = [];
  lines.push(`Subject: Next documents for ${assessment.followUpCase.dealName}`);
  lines.push('');
  lines.push('Hi [Client name],');
  lines.push('');
  lines.push('Thanks for the information so far. Before we take the file further, these items will help us present it clearly and avoid delays:');
  if (assessment.deferral.plan.reasons.length) {
    lines.push('');
    lines.push('The lender has asked for specific documents. Please send the exact documents listed (or the same type of document) rather than summaries — that is what the lender’s credit policy needs to see.');
  }
  lines.push('');
  qs.forEach((q, i) => lines.push(`${i + 1}. ${q.clientWording}`));
  lines.push('');
  lines.push('If anything is unclear or hard to find, reply and we can work through it together.');
  lines.push('');
  lines.push('Kind regards,');
  lines.push('[Broker name]');
  return { text: lines.join('\n'), kind: KIND.RULE };
}

/* ---------------------------------------------------------
   Tier-gated report model (tiered-output-pricing-logic §4)
   --------------------------------------------------------- */

export const GATED_SECTIONS = Object.freeze({
  dimensions: 'Dimension-by-dimension assessment',
  deferral: 'Deferral recovery strategy',
  email: 'Client email draft',
  rerate: 'Re-rate tracker',
});


/* ---------------------------------------------------------
   One-line section summaries (collapsed view). Derived only from the
   section's own content, so they never add claims the detail lacks.
   --------------------------------------------------------- */

const firstSentence = (t) => String(t || '').split(/(?<=[.!?])\s+/)[0];
const headClause = (t) => { const c = firstSentence(t).split(/[:;]\s/)[0].replace(/[.:;]$/, ''); return `${c}.`; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const WORST_FIRST = ['Black', 'Red', 'Amber', 'Green'];

export function summarizeSection(s, assessment) {
  switch (s.id) {
    case 'snapshot': {
      const f = Object.fromEntries(s.facts.map((x) => [x.label, x.value]));
      const lvr = s.calcs.find((c) => c.id === 'lvr');
      const tags = s.tags.map((t) => t.label).filter((l) => l !== f['Deal type']);
      return { text: `${f['Deal type']} request of ${f['Loan amount']}${lvr ? ` at ${lvr.value} estimated LVR` : ''}${tags.length ? `; ${tags.join(' + ')}` : ''}.`, kind: KIND.FACT };
    }
    case 'rating':
      return { text: `${s.rating.text} · ${s.confidence.value} confidence${s.confidence.watch.length ? ` · ${plural(s.confidence.watch.length, 'watch point')}` : ''}.`, kind: s.rating.kind };
    case 'risks': {
      if (!s.items.length) return { text: 'No risks identified yet — select triggers.', kind: KIND.RULE };
      const extra = s.items.length - 1;
      return { text: `Biggest risk: ${s.items[0].risk}${extra > 0 ? ` (+${extra} more)` : ''}.`, kind: s.items[0].kind };
    }
    case 'missing': {
      const crit = assessment.missing.critical;
      const imp = assessment.missing.important;
      if (!crit.length && !imp.length) return { text: 'No missing evidence flagged.', kind: KIND.RULE };
      const first = (crit[0] || imp[0]).item;
      return { text: `${plural(crit.length, 'Critical item')}, ${imp.length} Important outstanding; start with: ${first}.`, kind: (crit[0] || imp[0]).kind };
    }
    case 'questions': {
      if (!s.items.length) return { text: 'No questions — no triggers selected.', kind: KIND.RULE };
      const crit = s.items.filter((q) => q.priority === 'Critical').length;
      return { text: `${plural(s.items.length, 'question')} (${crit} Critical); ask first about: ${s.items[0].trigger}.`, kind: KIND.RULE };
    }
    case 'packaging':
      return { text: headClause(s.mainstream), kind: s.kind };
    case 'nextStep':
      return { text: headClause(s.nextStep.text), kind: s.nextStep.kind };
    case 'dimensions': {
      if (s.empty) return { text: 'No dimension judgement for a custom scenario.', kind: KIND.RULE };
      const worst = WORST_FIRST.find((c) => s.items.some((d) => d.rating.startsWith(c)));
      const names = s.items.filter((d) => d.rating.startsWith(worst)).map((d) => d.dimension);
      return { text: `Weakest (${worst}): ${names.join(', ')}.`, kind: KIND.JUDGEMENT };
    }
    case 'deferral':
      if (!s.plan.reasons.length) return { text: `No lender deferral entered. ${s.engineView}`, kind: s.kind };
      return { text: `${plural(s.plan.reasons.length, 'lender deferral reason')} · ${DEFERRAL_STATUS[s.plan.overall].short}.`, kind: s.kind };
    case 'email': {
      const n = assessment.engine.comprehensive.questions.filter((q) => q.priority !== 'Helpful').length;
      return { text: `Plain-English draft asking the client for ${plural(n, 'item')}.`, kind: s.email.kind };
    }
    case 'rerate': {
      const r = s.rerate;
      return { text: `Rating ${r.from ?? '—'} → ${r.to ?? '—'} (${r.movement}) · ${r.confidence} confidence · ${r.stillMissing.length} item${r.stillMissing.length === 1 ? '' : 's'} still missing.`, kind: r.kind };
    }
    default:
      return null;
  }
}

export function buildReport(assessment, tier) {
  const isSimple = tier === 'simple';
  const engine = isSimple ? assessment.engine.simple : assessment.engine.comprehensive;
  const sections = [];

  sections.push({ id: 'snapshot', title: 'Deal snapshot', facts: assessment.facts, calcs: assessment.calcs, assumptions: assessment.assumptions, tags: assessment.tags, triggerCheck: assessment.triggerCheck });

  sections.push({
    id: 'rating',
    title: 'Readiness rating + confidence',
    rating: assessment.rating,
    confidence: assessment.confidence,
    oneLineView: assessment.oneLineView,
  });

  sections.push({
    id: 'risks',
    title: isSimple ? 'Top risks' : 'Risks and mitigants',
    items: isSimple
      ? assessment.risks.slice(0, 5).map(({ risk, why, kind }) => ({ risk, why, kind }))
      : assessment.risks,
  });

  if (isSimple) {
    const top = [...assessment.missing.critical, ...assessment.missing.important].slice(0, 5)
      .map((m) => ({ item: m.item, priority: assessment.missing.critical.includes(m) ? 'Critical' : 'Important', kind: m.kind }));
    sections.push({ id: 'missing', title: 'Top missing evidence', items: top, limited: true });
  } else {
    sections.push({ id: 'missing', title: 'Missing evidence — Critical / Important / Helpful', groups: assessment.missing });
  }

  sections.push({
    id: 'questions',
    title: isSimple ? 'Highest-impact broker questions' : 'Prioritised broker follow-up workflow',
    engineView: engine.engineView,
    items: engine.questions.map((q) => (isSimple
      ? { priority: q.priority, trigger: q.triggerLabel, id: q.id, question: q.question, whyItMatters: q.whyItMatters, evidence: q.evidence, kind: KIND.RULE }
      : { priority: q.priority, trigger: q.triggerLabel, id: q.id, question: q.question, whyItMatters: q.whyItMatters, evidence: q.evidence, ifStrong: q.ifStrong, ifWeak: q.ifWeak, owner: q.owner, clientWording: q.clientWording, kind: KIND.RULE })),
    hiddenCount: assessment.engine.comprehensive.questions.length - engine.questions.length,
    unknownTriggers: engine.unknownTriggers,
  });

  if (assessment.packaging) {
    sections.push(isSimple
      ? { id: 'packaging', title: 'Packaging (short)', mainstream: assessment.packaging.mainstream, kind: KIND.JUDGEMENT }
      : { id: 'packaging', title: 'Packaging strategy', mainstream: assessment.packaging.mainstream, specialist: assessment.packaging.specialist, angle: assessment.packaging.angle, kind: KIND.JUDGEMENT });
  }

  sections.push({ id: 'nextStep', title: isSimple ? 'One next step' : 'Recommended next step', nextStep: assessment.nextStep });

  if (isSimple) {
    for (const [id, title] of Object.entries(GATED_SECTIONS)) sections.push({ id, title, locked: true });
  } else {
    sections.push({ id: 'dimensions', title: GATED_SECTIONS.dimensions, items: assessment.dimensions, empty: !assessment.dimensions });
    sections.push({ id: 'deferral', title: GATED_SECTIONS.deferral, ...assessment.deferral });
    sections.push({ id: 'email', title: GATED_SECTIONS.email, email: buildClientEmail(assessment) });
    sections.push({ id: 'rerate', title: GATED_SECTIONS.rerate, rerate: assessment.rerate, questions: engine.questions.map((q) => ({ id: q.id, trigger: q.triggerLabel, priority: q.priority })) });
  }

  sections.push({ id: 'cta', title: isSimple ? 'Upgrade / Banker Review' : 'Banker Review by Dong (add-on)' });

  for (const sec of sections) if (!sec.locked) sec.summary = summarizeSection(sec, assessment);

  // When a lender deferral is entered, the recovery plan is the broker's first question: show it right after the rating.
  if (!isSimple && assessment.deferral.plan.reasons.length) {
    const i = sections.findIndex((x) => x.id === 'deferral');
    const [d] = sections.splice(i, 1);
    sections.splice(sections.findIndex((x) => x.id === 'rating') + 1, 0, d);
  }

  return {
    tier,
    tierName: TIERS[tier].name,
    dealName: assessment.followUpCase.dealName,
    dealId: assessment.followUpCase.dealId,
    pristine: assessment.pristine,
    judgementSource: assessment.judgementSource,
    deferralCount: assessment.deferral.plan.reasons.length,
    boundary: BOUNDARY_TEXT,
    engineBoundary: ENGINE_BOUNDARY_TEXT,
    sections,
  };
}

/* ---------------------------------------------------------
   Plain-text export (copy / tests / lint). Tier gating is enforced here too.
   --------------------------------------------------------- */

const tag = (kind) => `[${KIND_LABEL[kind].toUpperCase()}]`;

export function triggerCheckText(tc) {
  const label = (id) => (RULES.find((r) => r.id === id) || { triggerLabel: id }).triggerLabel;
  const parts = [`${tc.suggested.length} suggested from intake, ${tc.matched.length} selected`];
  if (tc.notSelected.length) parts.push(`suggested but not selected: ${tc.notSelected.map(label).join('; ')}`);
  if (tc.manualOnly.length) parts.push(`selected manually (not suggested): ${tc.manualOnly.map(label).join('; ')}`);
  if (!tc.notSelected.length && !tc.manualOnly.length) parts.push('selection matches intake');
  return `${parts.join(' · ')}.`;
}

export function reportToPlainText(report) {
  const L = [];
  L.push('Oney & Co — Oney Credit Framework (INTERNAL PROTOTYPE · synthetic data)');
  L.push(`${report.tierName} — ${report.dealName} (${report.dealId})`);
  L.push('');
  L.push(report.boundary);
  L.push('');
  L.push('Legend: [FACT] provided · [CALCULATION] derived · [ASSUMPTION] to confirm · [RULE] deterministic framework rule · [JUDGEMENT] pre-generated model/banker judgement');
  if (report.judgementSource) L.push(`Judgement source: ${report.judgementSource} — pre-generated sample, no live AI call.`);
  else L.push('Custom scenario: no model judgement in this prototype; rule output only.');

  for (const s of report.sections) {
    L.push('');
    if (s.locked) { L.push(`## ${s.title} — [LOCKED: Comprehensive only]`); continue; }
    L.push(`## ${s.title}`);
    if (s.summary) L.push(`${tag(s.summary.kind)} Summary: ${s.summary.text}`);
    switch (s.id) {
      case 'snapshot':
        for (const f of s.facts) L.push(`${tag(f.kind)} ${f.label}: ${f.value}`);
        for (const c of s.calcs) L.push(`${tag(c.kind)} ${c.label}: ${c.value} (${c.formula})`);
        for (const a of s.assumptions) L.push(`${tag(a.kind)} ${a.text}`);
        L.push(`${tag(KIND.RULE)} Scenario tags: ${s.tags.length ? s.tags.map((t) => t.tag).join(', ') : 'none'}`);
        L.push(`${tag(KIND.RULE)} Trigger check: ${triggerCheckText(s.triggerCheck)}`);
        break;
      case 'rating':
        L.push(`${tag(s.rating.kind)} Readiness rating: ${s.rating.text}${s.rating.action ? ` — ${s.rating.action}` : ''}`);
        L.push(`${tag(KIND.RULE)} Confidence: ${s.confidence.value}${s.confidence.capped ? ` (capped from ${s.confidence.base})` : ''}`);
        if (s.confidence.watch.length) L.push(`${tag(KIND.RULE)} Watch points (confidence stays ${s.confidence.value} until evidenced): ${s.confidence.watch.join('; ')}`);
        for (const r of s.confidence.rulesApplied) L.push(`${tag(r.kind)} ${r.id}: ${r.text}`);
        for (const r of s.confidence.flags) L.push(`${tag(r.kind)} ${r.id}: ${r.text}`);
        if (s.oneLineView) L.push(`${tag(s.oneLineView.kind)} One-line view: ${s.oneLineView.text}`);
        break;
      case 'risks':
        s.items.forEach((r, i) => {
          L.push(`${tag(r.kind)} ${i + 1}. ${r.risk} — ${r.why}${r.mitigant !== undefined ? ` | Mitigant: ${r.mitigant} | Status: ${r.status}` : ''}`);
        });
        break;
      case 'missing':
        if (s.limited) s.items.forEach((m, i) => L.push(`${tag(m.kind)} ${i + 1}. [${m.priority}] ${m.item}`));
        else {
          L.push('Critical:');
          s.groups.critical.forEach((m) => L.push(`${tag(m.kind)} ${m.item} — Decision impact: ${m.impact} If weak: ${m.ifWeak}`));
          L.push('Important:');
          s.groups.important.forEach((m) => L.push(`${tag(m.kind)} ${m.item}${m.impact ? ` — ${m.impact}` : ''}`));
          L.push('Helpful:');
          s.groups.helpful.forEach((m) => L.push(`${tag(m.kind)} ${m.item}`));
        }
        break;
      case 'questions':
        L.push(`${tag(KIND.RULE)} Engine view: ${s.engineView}`);
        s.items.forEach((q, i) => {
          L.push(`${tag(q.kind)} ${i + 1}. ${q.trigger} — ${q.priority}`);
          L.push(`   Question: ${q.question}`);
          L.push(`   Why it matters: ${q.whyItMatters}`);
          L.push(`   Evidence to request: ${q.evidence.join('; ')}`);
          if (q.ifStrong) {
            L.push(`   If strong: ${q.ifStrong}`);
            L.push(`   If weak: ${q.ifWeak}`);
            L.push(`   Owner: ${q.owner}`);
            L.push(`   Client-friendly wording: ${q.clientWording}`);
          }
        });
        if (s.hiddenCount > 0) L.push(`${s.hiddenCount} further question(s) — [LOCKED: Comprehensive only]`);
        if (s.unknownTriggers.length) L.push(`Unknown triggers: ${s.unknownTriggers.join(', ')}`);
        break;
      case 'packaging':
        L.push(`${tag(s.kind)} Mainstream: ${s.mainstream}`);
        if (s.specialist) L.push(`${tag(s.kind)} Specialist / private: ${s.specialist}`);
        if (s.angle) L.push(`${tag(s.kind)} Packaging angle (evidence-backed only): ${s.angle}`);
        break;
      case 'nextStep':
        L.push(`${tag(s.nextStep.kind)} ${s.nextStep.text}`);
        break;
      case 'dimensions':
        if (s.empty) L.push('No dimension judgement for a custom scenario in this prototype.');
        else s.items.forEach((d) => L.push(`${tag(d.kind)} ${d.dimension}: ${d.rating} — ${d.note}`));
        break;
      case 'deferral':
        L.push(`${tag(s.kind)} Engine view: ${s.engineView}`);
        L.push(`${tag(s.kind)} Re-rate logic: ${s.rerateNote}`);
        if (s.plan.reasons.length) {
          L.push(`${tag(s.kind)} Deferral recovery (${s.plan.version}) — overall: ${DEFERRAL_STATUS[s.plan.overall].label}`);
          L.push(`${tag(s.kind)} KEY: ${s.plan.exactDocumentRule}`);
          for (const r of s.plan.reasons) {
            L.push(`   • ${r.label} — ${DEFERRAL_STATUS[r.status].label}`);
            L.push(`     Lender is testing: ${r.lenderTesting}`);
            L.push(`     Collect first (exact documents credit asked for, or the same type): ${r.collectFirst.join('; ')}`);
            L.push(`     Explanation to include: ${r.explanation}`);
            L.push(`     Linked triggers selected: ${r.linkedSelected.length ? r.linkedSelected.map((x) => x.label).join('; ') : 'none'}${r.linkedNotSelected.length ? ` · not selected: ${r.linkedNotSelected.map((x) => x.label).join('; ')}` : ''}`);
          }
        }
        break;
      case 'email':
        L.push(`${tag(s.email.kind)} Draft (edit before sending; nothing is sent from this page):`);
        L.push(s.email.text);
        break;
      case 'rerate': {
        const r = s.rerate;
        L.push(`${tag(r.kind)} Guardrail: ${r.guardrail}`);
        L.push(`${tag(r.kind)} Rating movement: ${r.from ?? '—'} → ${r.to ?? '—'} (${r.movement}) · Confidence: ${r.confidence}`);
        r.reasons.forEach((x) => L.push(`   Reason: ${x}`));
        L.push(`   Still missing: ${r.stillMissing.length ? r.stillMissing.join('; ') : 'none'}`);
        L.push(`   Strategy: ${r.strategy}`);
        L.push(`   Next step: ${r.nextStep}`);
        break;
      }
      case 'cta':
        L.push(report.tier === 'simple'
          ? 'Upgrade to Comprehensive for the full workflow, client wording, if-strong / if-weak consequences, deferral recovery and re-rate. Banker Review by Dong is an add-on (not active in this prototype).'
            + (report.deferralCount ? ` Lender deferral entered (${report.deferralCount}): the deferral recovery plan is in Comprehensive.` : '')
          : 'Optional Banker Review by Dong — add-on handoff (not active in this prototype; nothing is sent).');
        break;
      default:
        break;
    }
  }
  L.push('');
  L.push('---');
  L.push(report.engineBoundary);
  L.push(report.boundary);
  L.push('Generated locally in the browser. No data was sent or stored.');
  return L.join('\n');
}

/* ---------------------------------------------------------
   Compliance linter (mvp-wrapper-spec §3, FRAMEWORK §3)
   --------------------------------------------------------- */

export const BANNED_PATTERNS = Object.freeze([
  // "pre-approval" names an existing lender document (stale_preapproval rule), not an approval claim.
  { id: 'approval', re: /(?<!pre-)\bapprov(?:e|ed|es|al|als|ing)\b/gi, hint: 'Use "readiness signal" / "evidence currently supports".' },
  { id: 'decline', re: /\bdeclin(?:e|ed|es|ing)\b/gi, hint: 'Use "rework first" / "do not proceed under current facts".' },
  { id: 'bankable', re: /\bbankab(?:le|ility)\b/gi, hint: 'Use "package-ready" / "package-better".' },
  { id: 'viable', re: /\b(?:un)?viab(?:le|ility)\b/gi, hint: 'Use "may be workable if evidence confirms…".' },
  { id: 'financeable', re: /\bfinanceab(?:le|ility)\b/gi, hint: 'Use "lender-ready" / "not lender-ready".' },
  { id: 'fundable', re: /\bfundab(?:le|ility)\b/gi, hint: 'Use "lender-ready" / "not lender-ready".' },
  { id: 'will-pass', re: /\bwill pass\b/gi, hint: 'Use "evidence currently supports / does not support".' },
  { id: 'lender-will-accept', re: /\blenders? will accept\b|\bwill be accepted\b/gi, hint: 'Use "lender strategy can only be tested if evidence supports it".' },
  { id: 'guarantee-outcome', re: /\bguarantee(?:s|d)? (?:approval|success|acceptance|lender)/gi, hint: 'No outcome guarantees.' },
]);

const ALLOWED_EXACT = [BOUNDARY_TEXT, ENGINE_BOUNDARY_TEXT];

export function lintCompliance(text) {
  let t = String(text);
  for (const a of ALLOWED_EXACT) t = t.split(a).join(' ');
  const hits = [];
  for (const p of BANNED_PATTERNS) {
    for (const m of t.matchAll(p.re)) {
      hits.push({ id: p.id, match: m[0], context: t.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40), hint: p.hint });
    }
  }
  return { ok: hits.length === 0, hits };
}

/* ---------------------------------------------------------
   Broker feedback checklist — mvp-wrapper-spec-v0.1.md §14 (verbatim).
   "The MVP is worth continuing if a broker can answer 'yes' to at least 3."
   Stays in the browser; the broker copies the text and sends it back.
   --------------------------------------------------------- */

export const FEEDBACK_QUESTIONS = Object.freeze([
  { id: 'blocking', text: 'Does this tell me what is actually blocking the deal?' },
  { id: 'time', text: 'Does this reduce my next 30 minutes of work?' },
  { id: 'questions', text: 'Does this produce better client follow-up questions than a generic checklist?' },
  { id: 'too_early', text: 'Does this stop me submitting a weak file too early?' },
  { id: 'explain', text: 'Does this help me explain the issue to a client without sounding vague?' },
  { id: 'pay', text: 'Would I pay for the Comprehensive version on a messy file?' },
]);

export const FEEDBACK_ANSWERS = Object.freeze({ yes: 'Yes', no: 'No', unsure: 'Not sure' });
export const FEEDBACK_BAR = 3;

export function scoreFeedback(answers = {}) {
  const vals = FEEDBACK_QUESTIONS.map((q) => answers[q.id]).filter(Boolean);
  const yes = vals.filter((v) => v === 'yes').length;
  const answered = vals.length;
  const meetsBar = yes >= FEEDBACK_BAR;
  const verdict = meetsBar
    ? `${yes}/6 yes — meets the spec §14 bar (at least ${FEEDBACK_BAR}): worth continuing.`
    : answered < 6 && yes + (6 - answered) >= FEEDBACK_BAR
      ? `${yes}/6 yes so far — ${6 - answered} still unanswered.`
      : `${yes}/6 yes — below the spec §14 bar (at least ${FEEDBACK_BAR}).`;
  return { yes, answered, meetsBar, verdict };
}

export function feedbackText({ answers = {}, comment = '', context = {} }) {
  const sc = scoreFeedback(answers);
  const L = ['Oney Credit Framework — broker feedback (internal prototype, synthetic cases)'];
  if (context.caseId || context.tier) L.push(`Viewed: ${context.caseId || 'custom'} · ${context.tier || ''}`.trim());
  L.push('');
  FEEDBACK_QUESTIONS.forEach((q, i) => L.push(`${i + 1}. ${q.text} — ${FEEDBACK_ANSWERS[answers[q.id]] || 'Not answered'}`));
  L.push('', `Result: ${sc.verdict}`);
  if (String(comment).trim()) L.push('', `Comment: ${String(comment).trim()}`);
  return L.join('\n');
}

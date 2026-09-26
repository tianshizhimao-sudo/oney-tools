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

export { RULES, RULE_LIBRARY, CASES, CASE_ORDER };

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
    rulesApplied.push({ id: 'R-CONF-1', text: `Critical evidence outstanding (${outstandingCritical.length} item${outstandingCritical.length > 1 ? 's' : ''}) caps confidence at Medium.`, kind: KIND.RULE });
  }
  if (tags.some((t) => t.tag === 'weak_security_private_path')) {
    ceiling = minConfidence(ceiling, 'Medium');
    rulesApplied.push({ id: 'R-CONF-3', text: 'Specialist/private pathway in play: confidence cannot be High unless appetite, pricing, LVR, repayment source and exit are evidenced.', kind: KIND.RULE });
  }
  const appetiteGaps = outstandingCritical.filter((q) => APPETITE_CATEGORIES.has(q.category));
  const flags = [];
  if (appetiteGaps.length) {
    flags.push({ id: 'R-CONF-2', text: `Review: missing serviceability/conduct/security/compliance evidence (${appetiteGaps.map((q) => q.id).join(', ')}) can cap confidence at Low where it drives lender appetite. Not auto-applied — banker review decides.`, kind: KIND.RULE });
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
    intake: { ...c.intake },
    triggers: [...c.followUpCase.triggers],
    rating: c.followUpCase.currentRating,
    evidence: {},
  };
}

export function blankState(tier = 'simple') {
  const intake = {};
  for (const f of INTAKE_FIELDS) intake[f.key] = '';
  intake.dealType = 'sme';
  intake.borrowerType = 'company';
  return { caseId: null, edited: true, tier, intake, triggers: [], rating: 'Amber — Package Better', evidence: {} };
}

/** True when the state still matches the untouched sample case. */
export function isPristine(state) {
  if (!state.caseId || state.edited) return false;
  const c = CASES[state.caseId];
  if (state.rating !== c.followUpCase.currentRating) return false;
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
  if (!c) confidence.rulesApplied.push({ id: 'R-CONF-4', text: 'Custom scenario without model judgement: confidence limited to Medium in this prototype.', kind: KIND.RULE });
  if (!c && CONFIDENCE_ORDER.indexOf(confidence.value) > CONFIDENCE_ORDER.indexOf('Medium')) confidence.value = 'Medium';

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
      kind: KIND.RULE,
    },
    rerate: rerate({ questions: comprehensive.questions, rating: state.rating, tags, evidence }),
  };
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

export function buildReport(assessment, tier) {
  const isSimple = tier === 'simple';
  const engine = isSimple ? assessment.engine.simple : assessment.engine.comprehensive;
  const sections = [];

  sections.push({ id: 'snapshot', title: 'Deal snapshot', facts: assessment.facts, calcs: assessment.calcs, assumptions: assessment.assumptions, tags: assessment.tags });

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

  return {
    tier,
    tierName: TIERS[tier].name,
    dealName: assessment.followUpCase.dealName,
    dealId: assessment.followUpCase.dealId,
    pristine: assessment.pristine,
    judgementSource: assessment.judgementSource,
    boundary: BOUNDARY_TEXT,
    engineBoundary: ENGINE_BOUNDARY_TEXT,
    sections,
  };
}

/* ---------------------------------------------------------
   Plain-text export (copy / tests / lint). Tier gating is enforced here too.
   --------------------------------------------------------- */

const tag = (kind) => `[${KIND_LABEL[kind].toUpperCase()}]`;

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
    switch (s.id) {
      case 'snapshot':
        for (const f of s.facts) L.push(`${tag(f.kind)} ${f.label}: ${f.value}`);
        for (const c of s.calcs) L.push(`${tag(c.kind)} ${c.label}: ${c.value} (${c.formula})`);
        for (const a of s.assumptions) L.push(`${tag(a.kind)} ${a.text}`);
        L.push(`${tag(KIND.RULE)} Scenario tags: ${s.tags.length ? s.tags.map((t) => t.tag).join(', ') : 'none'}`);
        break;
      case 'rating':
        L.push(`${tag(s.rating.kind)} Readiness rating: ${s.rating.text}${s.rating.action ? ` — ${s.rating.action}` : ''}`);
        L.push(`${tag(KIND.RULE)} Confidence: ${s.confidence.value}${s.confidence.capped ? ` (capped from ${s.confidence.base})` : ''}`);
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

/* Manual presentation state only. Never an input to the credit engine. */
// New IDs deliberately avoid carrying old area judgements into a changed taxonomy.
export const RISK_AREAS = Object.freeze([
  { id: 'risk_management', label: 'Management risk', manualScope: 'Who we lend to: borrower/entity, credit history, tax and account behaviour.', scope: 'Who we lend to: mapped conduct, tax and super issues only; no complete credit-history or management-quality assessment.', triggers: ['ato_debt', 'missed_ato_plan', 'sg_unevidenced', 'dishonours_recent', 'supplier_arrears'] },
  { id: 'risk_transaction', label: 'Transaction risk', manualScope: 'What the funds are for and whether the transaction makes sense.', scope: 'Purpose and rationale: mapped use-of-funds and contract questions only; commercial sense still needs human review.', triggers: ['working_capital_vague', 'contract_growth'] },
  { id: 'risk_servicing', label: 'Servicing risk / capability', manualScope: 'Ability to repay and the current evidence supporting that view.', scope: 'Repayment evidence: mapped cash-flow, leverage and rental-dependency questions only; not a completed servicing test.', triggers: ['mca_present', 'high_dti', 'stale_preapproval', 'turnaround_claim', 'short_wale'] },
  { id: 'risk_security', label: 'Security risk', manualScope: 'Property suitability, GSA needs, security ranking and guarantees.', scope: 'Mapped valuation, property and structure questions only. Lender acceptability, GSA needs, ranking and guarantee adequacy are not automatically assessed.', triggers: ['high_lvr_second_mortgage', 'valuation_sensitive', 'zoning_environmental_missing', 'related_party_security'] },
]);
export const RISK_VIEWS = Object.freeze({ not_assessed: 'Not assessed', green: 'Green', amber: 'Amber', red: 'Red' });
export const RISK_SOURCE = 'Risk view entered by you';
export const RISK_BOUNDARY = 'Four equal navigation areas, not a complete assessment or a risk score. Each trigger has one primary area; issues can cross domains. Colours are your judgement; they do not change the overall rating, confidence or evidence re-rate.';
const blank = () => ({ rating: 'not_assessed', basis: '', nextStep: '' });
export function createRiskView() {
  return { revision: 0, snapshot: null, openArea: null, entries: Object.fromEntries(RISK_AREAS.map(a => [a.id, { draft: blank(), confirmed: null, error: '' }])) };
}
// A monotonic revision deliberately stays stale even if an input is changed back.
// Tier changes and manual chart edits are not deal-input changes.
export function syncRiskInputs(view, snapshot) {
  const serialized = JSON.stringify(snapshot);
  if (view.snapshot !== null && view.snapshot !== serialized) view.revision++;
  view.snapshot = serialized;
}
const sameDraft = (a, b) => a.rating === b.rating && a.basis === b.basis && a.nextStep === b.nextStep;
export function validateRiskDraft(draft) {
  if (!Object.hasOwn(RISK_VIEWS, draft.rating)) return 'Choose one of the listed views.';
  if (draft.rating !== 'not_assessed' && !draft.basis.trim()) return 'Add a brief basis for your chosen view.';
  if (draft.rating === 'red' && !draft.nextStep.trim()) return 'For Red, add a proposed mitigation or next step. Its adequacy is not verified.';
  return '';
}
export function confirmRiskArea(view, id) {
  const entry = view.entries[id];
  entry.error = validateRiskDraft(entry.draft);
  if (entry.error) return false;
  entry.draft = { ...entry.draft, basis: entry.draft.basis.trim(), nextStep: entry.draft.nextStep.trim() };
  entry.confirmed = { ...entry.draft, revision: view.revision };
  return true;
}
export function clearRiskArea(view, id) {
  view.entries[id] = { draft: blank(), confirmed: null, error: '' };
}
export function riskAreaState(view, id) {
  const entry = view.entries[id];
  const stale = Boolean(entry.confirmed && entry.confirmed.revision !== view.revision);
  const pending = !sameDraft(entry.draft, entry.confirmed || blank());
  const rating = entry.confirmed?.rating || 'not_assessed';
  return { ...entry, stale, pending, rating, colour: stale || pending ? 'not_assessed' : rating,
    label: stale ? `Review required — previous ${RISK_VIEWS[rating]}`
      : pending ? 'Draft changes — not confirmed' : RISK_VIEWS[rating] };
}
export function riskAreaNotes(view, id) {
  const area = riskAreaState(view, id);
  const lines = [];
  if (area.stale) lines.push('Deal inputs or evidence changed. Recheck this view and confirm it again.');
  if (area.confirmed?.basis) lines.push(`${area.stale || area.pending ? 'Previous confirmed basis' : 'Basis'}: ${area.confirmed.basis}`);
  if (area.confirmed?.nextStep) lines.push(`${area.stale || area.pending ? 'Previous confirmed proposed' : 'Proposed'} mitigation / next step (not verified): ${area.confirmed.nextStep}`);
  if (area.pending) {
    lines.push(`Unconfirmed draft: ${RISK_VIEWS[area.draft.rating] || 'Unknown view'}.`);
    if (area.draft.basis) lines.push(`Draft basis: ${area.draft.basis}`);
    if (area.draft.nextStep) lines.push(`Draft proposed next step (not verified): ${area.draft.nextStep}`);
  }
  return lines;
}
export function riskViewText(view) {
  return ['Manual four-area risk view', RISK_SOURCE, RISK_BOUNDARY,
    ...RISK_AREAS.flatMap((area, i) => [`${i + 1}. ${area.label}: ${riskAreaState(view, area.id).label}`, `Manual review considerations: ${area.manualScope}`, `Mapped coverage: ${area.scope}`, ...riskAreaNotes(view, area.id)])].join('\n');
}

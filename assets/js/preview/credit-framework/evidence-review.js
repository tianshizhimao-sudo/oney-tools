/* Manual evidence-review records (partial support). Presentation / audit state only.
   The credit engine keeps receiving the existing four-state `state.evidence` value for every
   trigger; a partial record sits BESIDE that value and is never passed to the engine, so no
   engine, rule, re-rate, deferral or guardrail path changes. A partial record therefore cannot
   close a Critical item, release a recorded weak/contradicting review, or move rating or
   confidence. Same draft → confirm → revision/stale pattern as manual-risk-view.js. */

export const PARTIAL_STATUS = 'partial';
export const PARTIAL_LABEL = 'Reviewed — partially supports; gap remains';
export const PARTIAL_BADGE = 'Partial support · gap remains';
export const REVIEW_BOUNDARY = 'Manual evidence-review record, marked by the reviewer. Not a system check of the source, not a lender decision, not "supports": the original gap stays unresolved for the engine and the Critical count.';
export const SOURCE_NOT_OPENED = 'Source is a reference only; it was not opened or checked by this page.';
/** Completeness is about traceability only; it never verifies a source. */
export function provenanceText(rec = {}) {
  const missing = SOURCE_KEYS.filter((key) => !String(rec[key] || '').trim()).map((key) => FIELD_LABELS[key]);
  return missing.length
    ? `Incomplete provenance — missing ${missing.join(', ')}. A source ID is not verification.`
    : 'Citation fields supplied; source identity, contents and authenticity are not verified by this page.';
}
export const ACCESS_RESULTS = Object.freeze({ opened: 'Opened (reviewer reported)', unavailable: 'Could not open (reviewer reported)' });
export const ACCESS_BOUNDARY = 'Access observations are manually reported, not network checks. Opening a source does not verify its contents; inability to open it does not erase historical review evidence.';
export function recordAccessObservation(records, id, { result, observedAt, note = '' }, recordedAt = new Date().toISOString()) {
  const entry = ensureEntry(records, id);
  if (!ACCESS_RESULTS[result] || !String(observedAt || '').trim() || !entry.draft.sourceId.trim()) return false;
  // Capture the exact reference observed. Never mutate a confirmed review or engine state.
  (entry.accessObservations ||= []).push({ result, observedAt: String(observedAt).trim(), note: String(note).trim(), recordedAt,
    citation: Object.fromEntries(SOURCE_KEYS.map((key) => [key, entry.draft[key] || ''])) });
  return true;
}
export function accessObservationText(entry) {
  const observations = entry?.accessObservations || [];
  if (!observations.length) return `Current access: not checked. ${SOURCE_NOT_OPENED}`;
  const currentReferenceChanged = SOURCE_KEYS.some((key) => (observations.at(-1).citation[key] || '') !== (entry.draft[key] || ''));
  return (currentReferenceChanged ? 'Current draft reference: not checked; the observations below refer to earlier citations.\n' : '') + observations.map((o, i) => `${i === observations.length - 1 ? 'Latest reported access' : 'Prior reported access'}: ${ACCESS_RESULTS[o.result]} · Observed: ${o.observedAt} · Recorded: ${o.recordedAt} · Citation at observation: ${citationOf(o.citation)}${o.note ? ` · Note: ${o.note}` : ''}`).join('\n');
}
export const MATERIAL_CLASSIFICATION = 'SYNTHETIC TEST FIXTURE — not an ATO document, not a received client response';
export const WEAK_RETAINED = 'Counterevidence recorded (weak/contradicts) is retained and still drives the engine; this partial record does not release it.';
export const SUPPORTS_CONFLICT = 'The engine status for this item is "supports". Partial support cannot sit beside "supports" — re-review and change the engine status (manual step) before recording partial support.';
export const STALE_TEXT = 'Inputs changed since this record was confirmed. Prior judgement shown for context only; a fresh manual re-review is required before it counts as current.';
export const SOURCE_STALE_TEXT = 'The source reference (ID, version or locator) was changed after this record was confirmed. The confirmed citation is kept below for context; the record is NOT current until you re-review and confirm it against the new reference — typing the original reference back does not restore it.';
export const SOURCE_KEYS = Object.freeze(['sourceId', 'sourceVersion', 'sourceLocator']);
export const FIELD_LABELS = Object.freeze({ sourceId: 'source ID', sourceVersion: 'source version', sourceLocator: 'source locator', supportedScope: 'supported scope', remainingGap: 'remaining gap', note: 'reviewer note', reviewerLabel: 'reviewer label', ownerReviewDate: 'owner review date', classification: 'classification' });
export const PENDING_TEXT = 'Unconfirmed draft edits pending — not applied. The confirmed record above is unchanged until you use "Re-review and confirm (manual)"; Close keeps the draft without applying it.';
/** Non-source fields whose draft differs from the confirmed record (source fields are reported as a changed citation). */
export const dirtyFields = (state) => !state.confirmed ? [] : Object.keys(FIELD_LABELS).filter((k) => !SOURCE_KEYS.includes(k) && String(state.draft[k] ?? '') !== String(state.confirmed[k] ?? '')).map((k) => ({ key: k, label: FIELD_LABELS[k], draft: String(state.draft[k] ?? ''), confirmed: String(state.confirmed[k] ?? '') }));
export const citationOf = (rec) => `${rec.sourceId || '—'}${rec.sourceVersion ? ` · ${rec.sourceVersion}` : ''}${rec.sourceLocator ? ` · ${rec.sourceLocator}` : ''}`;
export const CONFLICT_ACTIVE_TEXT = 'The engine status for this item is currently "supports", set after this partial record was confirmed. Partial support and "supports" cannot both be current: this record is NOT current until you re-review it (the engine keeps applying its existing "supports" rule in the meantime).';
/** Historical conflict: the engine status was "supports" at some point after confirmation and has since
    been changed by the reviewer. The record stays NOT current until an explicit manual re-confirm. */
export const conflictHistoricalText = (engineStatusLabel) => `A prior conflict is recorded: the engine status for this item was set to "supports" after this partial record was confirmed and has since been changed to "${engineStatusLabel}". The record is NOT current until you re-review and confirm it; the engine applies its existing rule for the current status.`;
/** @deprecated kept for callers that only know the active case */
export const CONFLICT_TEXT = CONFLICT_ACTIVE_TEXT;

const blankDraft = () => ({
  sourceId: '', sourceVersion: '', sourceLocator: '',
  supportedScope: '', remainingGap: '',
  reviewerLabel: '', ownerReviewDate: '', note: '',
  classification: MATERIAL_CLASSIFICATION,
});

export function createReviewRecords() {
  return { revision: 0, snapshot: null, entries: {} };
}

/** Case-input snapshot (intake, triggers, rating, case id). Tier and other triggers' engine
    statuses are not deal-input changes. Monotonic: changing an input back does not un-stale. */
export function syncReviewInputs(records, snapshot) {
  const serialized = JSON.stringify(snapshot);
  if (records.snapshot !== null && records.snapshot !== serialized) records.revision++;
  records.snapshot = serialized;
}

export function ensureEntry(records, id) {
  if (!records.entries[id]) records.entries[id] = { draft: blankDraft(), confirmed: null, error: '', open: false };
  return records.entries[id];
}

export function validateReviewDraft(draft, engineStatus) {
  const missing = [];
  if (!draft.sourceId.trim()) missing.push('source ID');
  if (!draft.supportedScope.trim()) missing.push('supported scope');
  if (!draft.remainingGap.trim()) missing.push('remaining gap');
  if (missing.length) return `Draft only — add ${missing.join(', ')} before confirming. Partial support must name what is still unproven.`;
  if (engineStatus === 'supports') return SUPPORTS_CONFLICT;
  return '';
}

const sameDraft = (a, b) => Object.keys(blankDraft()).every((k) => (a[k] || '') === (b[k] || ''));

/** Explicit manual confirmation. `engineStatus` is the existing four-state value for the trigger. */
export function confirmPartial(records, id, engineStatus, recordedAt = new Date().toISOString()) {
  const entry = ensureEntry(records, id);
  entry.error = validateReviewDraft(entry.draft, engineStatus);
  if (entry.error) return false;
  const trimmed = Object.fromEntries(Object.entries(entry.draft).map(([k, v]) => [k, String(v ?? '').trim()]));
  entry.draft = trimmed;
  entry.confirmed = { ...trimmed, status: PARTIAL_STATUS, revision: records.revision, recordedAt, engineStatusAtConfirm: engineStatus || 'outstanding' };
  return true;
}

export function clearPartial(records, id) {
  delete records.entries[id];
}

/** Editor writes go through here. A change to any source-reference field on a confirmed record
    invalidates the confirmation (sticky, like input-stale): the prior citation stays on `confirmed`,
    the new one on `draft`, and only an explicit confirmPartial() clears it. Other fields are drafts. */
export function noteDraftEdit(records, id, key, value) {
  const entry = ensureEntry(records, id);
  entry.draft[key] = value;
  if (entry.confirmed && SOURCE_KEYS.includes(key) && String(value ?? '') !== String(entry.confirmed[key] ?? '')) entry.confirmed.sourceChanged = true;
}

/** Called on every render with the trigger's current engine status. A confirmed partial record that
    sees `supports` is flagged as conflicting; the flag is sticky (like stale) and only an explicit
    manual re-confirm — which validateReviewDraft refuses while the status is still `supports` — clears it.
    Reads engine state; never writes it. */
export function noteEngineStatus(records, id, engineStatus) {
  const entry = records.entries[id];
  if (entry && entry.confirmed && engineStatus === 'supports') entry.confirmed.conflict = true;
}

/** Derived display state. Never consulted by the engine. */
export function reviewState(records, id, engineStatus) {
  const entry = records.entries[id];
  if (!entry) return { exists: false, validity: 'none', label: '', confirmed: null, draft: null, error: '', open: false, weakRetained: engineStatus === 'weak' };
  const inputStale = Boolean(entry.confirmed && entry.confirmed.revision !== records.revision);
  const sourceStale = Boolean(entry.confirmed && entry.confirmed.sourceChanged);
  const stale = inputStale || sourceStale;
  const conflict = Boolean(entry.confirmed && (entry.confirmed.conflict || engineStatus === 'supports'));
  const conflictActive = conflict && engineStatus === 'supports';
  const pending = !sameDraft(entry.draft, entry.confirmed || blankDraft());
  const validity = !entry.confirmed ? 'draft' : conflict ? 'conflict' : stale ? 'stale' : pending ? 'draft-edits' : 'current';
  const label = validity === 'current' ? `${PARTIAL_BADGE} · CURRENT`
    : validity === 'conflict' ? (conflictActive ? 'Partial support · NOT CURRENT — engine status is supports; re-review required' : 'Partial support · NOT CURRENT — prior supports conflict, not yet re-reviewed')
    : validity === 'stale' ? (sourceStale ? `${PARTIAL_BADGE} · STALE — source reference changed; re-review required` : `${PARTIAL_BADGE} · STALE — re-review required`)
    : validity === 'draft-edits' ? `${PARTIAL_BADGE} · CURRENT (unconfirmed draft edits pending)`
    : 'Partial support · DRAFT — not confirmed';
  return { exists: true, validity, stale, inputStale, sourceStale, conflict, conflictActive, conflictHistorical: conflict && !conflictActive, pending, label, confirmed: entry.confirmed, draft: entry.draft, error: entry.error, open: entry.open, weakRetained: engineStatus === 'weak' };
}

export function partialCounts(records, engineStatusOf = () => undefined) {
  let current = 0, stale = 0, draft = 0, conflict = 0;
  for (const id of Object.keys(records.entries)) {
    const s = reviewState(records, id, engineStatusOf(id));
    if (s.validity === 'current' || s.validity === 'draft-edits') current++; else if (s.validity === 'conflict') conflict++; else if (s.validity === 'stale') stale++; else draft++;
  }
  return { current, stale, draft, conflict, total: current + stale + draft + conflict };
}

/** Plain-text block for Copy report / Print. `labelOf(id)` → trigger label; `gapOf(id)` → original
    gap text (question) or ''. `engineStatusLabel(id)` → existing four-state label. */
export function reviewRecordsText(records, { labelOf, gapOf, engineStatusLabel, engineStatusOf = () => 'outstanding' }) {
  const ids = Object.keys(records.entries);
  if (!ids.length) return '';
  const L = ['Manual evidence-review records (partial support)', REVIEW_BOUNDARY];
  for (const id of ids) {
    const s = reviewState(records, id, engineStatusOf(id));
    const rec = s.confirmed || s.draft;
    const tag = s.validity === 'current' ? '[CURRENT]' : s.validity === 'conflict' ? (s.conflictActive ? '[CONFLICT — engine status is supports; partial record not current; re-review required]' : `[NOT CURRENT — prior supports conflict; engine status now "${engineStatusLabel(id)}"; re-review required]`) : s.validity === 'stale' ? (s.sourceStale ? '[STALE — source reference changed; re-review required]' : '[STALE — inputs changed; re-review required]') : s.validity === 'draft-edits' ? '[CURRENT — unconfirmed draft edits pending]' : '[DRAFT — not confirmed]';
    L.push(`- ${labelOf(id)} — ${PARTIAL_LABEL} ${tag}`);
    const gap = gapOf(id); if (gap) L.push(`  Original gap: ${gap}`);
    L.push(`  Engine status (unchanged): ${engineStatusLabel(id)}`);
    if (s.sourceStale) { L.push(`  Confirmed citation: ${citationOf(s.confirmed)} · ${s.confirmed.classification || MATERIAL_CLASSIFICATION}`); L.push(`  Draft citation: ${citationOf(s.draft)} (not confirmed)`); }
    else L.push(`  Source: ${citationOf(rec)} · ${rec.classification || MATERIAL_CLASSIFICATION}`);
    L.push(`  ${provenanceText(rec)}`);
    if (s.sourceStale) L.push(`  Draft: ${provenanceText(s.draft)}`);
    L.push(`  ${accessObservationText(records.entries[id])}`);
    L.push(`  ${ACCESS_BOUNDARY}`);
    L.push(`  Supports: ${rec.supportedScope || '—'}`);
    L.push(`  Still unproven: ${rec.remainingGap || '—'}`);
    if (rec.note) L.push(`  Reviewer note: ${rec.note}`);
    L.push(`  Reviewer: ${rec.reviewerLabel || '—'} · Historical owner review date (as supplied, not system verified): ${rec.ownerReviewDate || 'not provided'} · Recorded: ${s.confirmed ? s.confirmed.recordedAt : 'not confirmed'}`);
    for (const f of dirtyFields(s)) L.push(`  Unconfirmed draft edit (not applied) — ${f.label}: "${f.draft}" (confirmed: "${f.confirmed}")`);
    if (s.pending && s.confirmed) L.push(`  ${PENDING_TEXT}`);
    if (s.weakRetained) L.push(`  ${WEAK_RETAINED}`);
    if (s.validity === 'conflict') L.push(`  ${s.conflictActive ? CONFLICT_ACTIVE_TEXT : conflictHistoricalText(engineStatusLabel(id))}`);
    if (s.sourceStale) L.push(`  ${SOURCE_STALE_TEXT}`);
    if (s.inputStale) L.push(`  ${STALE_TEXT}`);
    L.push(s.conflictActive ? '  Engine currently treats this item as supported under its existing rule; this partial record does not count and must be re-reviewed.'
      : s.validity === 'conflict' ? '  Gap remains unresolved for the engine under its current status; this partial record does not count until re-reviewed.'
      : '  Gap remains unresolved; Critical count unchanged.');
  }
  return L.join('\n');
}

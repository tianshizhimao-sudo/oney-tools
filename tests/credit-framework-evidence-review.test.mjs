// Partial-support review records: engine isolation (A03 control I), coexistence with weak (A04),
// four-state regression (A05), draft validation (A06), stale on input change (A07), both tiers (A08),
// Blank / example reset (A09), copy text (A10), baseline untouched (A13), unknown status guard (A14).
// CF_JSDOM_MODULE=/absolute/path/to/jsdom/lib/api.js node --test tests/credit-framework-evidence-review.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, blankState, buildAssessment, buildReport, EVIDENCE_STATUS } from '../assets/js/preview/credit-framework/engine.js';
import { createReviewRecords, syncReviewInputs, ensureEntry, confirmPartial, clearPartial, reviewState, partialCounts, reviewRecordsText,
  validateReviewDraft, PARTIAL_LABEL, SUPPORTS_CONFLICT } from '../assets/js/preview/credit-framework/evidence-review.js';

// F-SG-01 synthetic fixture (2026-10-23). Not an ATO document, not a client response.
const FIXTURE = {
  sourceId: 'F-SG-01-CF002-20261023', sourceVersion: '2026-10-23', sourceLocator: 'F06–F10; F11–F13',
  supportedScope: 'Synthetic summary shows no Super balance / overdue (AUD 0.00) at 2026-10-23 (synthetic).',
  remainingGap: 'Per-period SG liability, on-time payment to fund and fund receipt / payroll-to-fund reconciliation unknown.',
  reviewerLabel: 'owner', ownerReviewDate: '2026-10-23 (time not provided)', note: '部分支持',
};
const SG = 'sg_unevidenced';
const evalOf = (s) => { const a = buildAssessment(s); return { rating: a.rating.text, confidence: a.confidence.value, rerateTo: a.rerate.to, rerateConf: a.rerate.confidence, movement: a.rerate.movement, stillMissing: a.rerate.stillMissing, reasons: a.rerate.reasons, deferral: a.deferral.plan.overall }; };

test('EVIDENCE_STATUS is unchanged: exactly the four existing keys, no partial key', () => {
  assert.deepEqual(Object.keys(EVIDENCE_STATUS), ['outstanding', 'reply_only', 'supports', 'weak']);
  assert.equal(EVIDENCE_STATUS.weak, 'Reviewed evidence — weak/contradicts');
});

test('A06 — draft only until source, supported scope and remaining gap are present', () => {
  const r = createReviewRecords(); syncReviewInputs(r, { a: 1 });
  const e = ensureEntry(r, SG);
  assert.equal(confirmPartial(r, SG, 'outstanding'), false);
  assert.match(e.error, /source ID, supported scope, remaining gap/);
  assert.equal(reviewState(r, SG, 'outstanding').validity, 'draft');
  e.draft = { ...e.draft, ...FIXTURE, remainingGap: '' };
  assert.equal(confirmPartial(r, SG, 'outstanding'), false);
  assert.match(e.error, /remaining gap/);
  e.draft.remainingGap = FIXTURE.remainingGap;
  assert.equal(confirmPartial(r, SG, 'outstanding', '2026-10-24T02:00:00.000Z'), true);
  const s = reviewState(r, SG, 'outstanding');
  assert.equal(s.validity, 'current'); assert.equal(s.confirmed.status, 'partial'); assert.equal(s.confirmed.recordedAt, '2026-10-24T02:00:00.000Z');
  assert.equal(s.confirmed.ownerReviewDate, FIXTURE.ownerReviewDate, 'owner review date is kept as given, not replaced by recording time');
});

test('A02 — partial cannot sit beside an engine status of supports', () => {
  assert.equal(validateReviewDraft({ ...FIXTURE }, 'supports'), SUPPORTS_CONFLICT);
  assert.equal(validateReviewDraft({ ...FIXTURE }, 'weak'), '');
  assert.equal(validateReviewDraft({ ...FIXTURE }, 'reply_only'), '');
});

test('A03 control I — equal facts: a partial record never changes rating, confidence, re-rate or deferral (partial, weak+partial, partial+stale, weak+stale, all three; single-Critical control)', () => {
  const cases = [
    { name: 'CF-002 pristine, SG outstanding', make: () => initialState('CF-002', 'comprehensive'), status: 'outstanding' },
    { name: 'CF-002 pristine, SG reply_only', make: () => { const s = initialState('CF-002', 'comprehensive'); s.evidence[SG] = 'reply_only'; return s; }, status: 'reply_only' },
    { name: 'CF-002 weak+partial', make: () => { const s = initialState('CF-002', 'comprehensive'); s.evidence[SG] = 'weak'; return s; }, status: 'weak' },
    { name: 'single Critical (blank, only SG selected, Amber)', make: () => { const s = blankState('comprehensive'); s.triggers = [SG]; s.rating = 'Amber — Package Better'; return s; }, status: 'outstanding' },
    { name: 'single Critical weak', make: () => { const s = blankState('comprehensive'); s.triggers = [SG]; s.rating = 'Green — Package Ready'; s.evidence[SG] = 'weak'; return s; }, status: 'weak' },
  ];
  for (const c of cases) {
    const s = c.make();
    const before = evalOf(s);
    const r = createReviewRecords(); syncReviewInputs(r, { intake: s.intake, triggers: s.triggers, rating: s.rating });
    ensureEntry(r, SG).draft = { ...ensureEntry(r, SG).draft, ...FIXTURE };
    assert.equal(confirmPartial(r, SG, c.status), true, c.name);
    // The record lives beside state.evidence; the engine input is byte-identical.
    assert.deepEqual(evalOf(s), before, `${c.name}: partial record changed evaluation`);
    assert.equal(s.evidence[SG], c.status === 'outstanding' ? undefined : c.status, `${c.name}: engine status untouched`);
    if (c.status === 'weak') assert.ok(before.reasons.some((x) => /weak/.test(x)), `${c.name}: weak reasoning still present`);
    // + stale (input change) — record goes stale, evaluation of the SAME facts still unchanged by the record.
    syncReviewInputs(r, { intake: { ...s.intake, dealName: 'changed' }, triggers: s.triggers, rating: s.rating });
    assert.equal(reviewState(r, SG, c.status).validity, 'stale', `${c.name}: stale after input change`);
    assert.deepEqual(evalOf(s), before, `${c.name}: stale record changed evaluation`);
    assert.equal(partialCounts(r).current, 0); assert.equal(partialCounts(r).stale, 1);
  }
});

test('A03 control II — a real fact change is handled by the existing rules identically with or without a partial/stale record', () => {
  const withRecord = initialState('CF-002', 'comprehensive'); const without = initialState('CF-002', 'comprehensive');
  const r = createReviewRecords(); syncReviewInputs(r, { intake: withRecord.intake, triggers: withRecord.triggers, rating: withRecord.rating });
  ensureEntry(r, SG).draft = { ...ensureEntry(r, SG).draft, ...FIXTURE }; assert.equal(confirmPartial(r, SG, 'outstanding'), true);
  for (const s of [withRecord, without]) { s.evidence.ato_debt = 'weak'; s.intake.dealName = 'S-A03-II synthetic fact change'; }
  syncReviewInputs(r, { intake: withRecord.intake, triggers: withRecord.triggers, rating: withRecord.rating });
  assert.equal(reviewState(r, SG, 'outstanding').validity, 'stale');
  assert.deepEqual(evalOf(withRecord), evalOf(without), 'result difference must be attributable to facts + existing rules only');
  assert.notEqual(evalOf(without).rerateConf, 'High');
});

test('A04 — weak is retained and visible beside partial; clearing the record does not touch the engine status', () => {
  const s = initialState('CF-002', 'comprehensive'); s.evidence[SG] = 'weak';
  const r = createReviewRecords(); syncReviewInputs(r, { x: 1 });
  ensureEntry(r, SG).draft = { ...ensureEntry(r, SG).draft, ...FIXTURE }; assert.equal(confirmPartial(r, SG, 'weak'), true);
  const st = reviewState(r, SG, s.evidence[SG]);
  assert.equal(st.weakRetained, true);
  const text = reviewRecordsText(r, { labelOf: () => 'SG', gapOf: () => 'SG position is unevidenced', engineStatusLabel: () => EVIDENCE_STATUS[s.evidence[SG]], engineStatusOf: () => s.evidence[SG] });
  assert.match(text, /Engine status \(unchanged\): Reviewed evidence — weak\/contradicts/);
  assert.match(text, /Counterevidence recorded .* is retained/);
  clearPartial(r, SG);
  assert.equal(s.evidence[SG], 'weak');
});

test('A07 — stale requires an explicit re-confirm; prior judgement and citation stay visible as stale', () => {
  const r = createReviewRecords(); syncReviewInputs(r, { v: 1 });
  ensureEntry(r, SG).draft = { ...ensureEntry(r, SG).draft, ...FIXTURE }; assert.equal(confirmPartial(r, SG, 'outstanding'), true);
  syncReviewInputs(r, { v: 2 });
  let st = reviewState(r, SG, 'outstanding');
  assert.equal(st.validity, 'stale'); assert.equal(st.confirmed.sourceId, FIXTURE.sourceId);
  syncReviewInputs(r, { v: 1 });
  assert.equal(reviewState(r, SG, 'outstanding').validity, 'stale', 'changing inputs back does not un-stale');
  const text = reviewRecordsText(r, { labelOf: () => 'SG', gapOf: () => '', engineStatusLabel: () => 'x' });
  assert.match(text, /\[STALE — inputs changed; re-review required\]/);
  assert.equal(confirmPartial(r, SG, 'outstanding'), true, 'explicit manual re-confirm');
  assert.equal(reviewState(r, SG, 'outstanding').validity, 'current');
});

test('A10 — copy text distinguishes current / draft / stale and carries gap, source, synthetic tag', () => {
  const r = createReviewRecords(); syncReviewInputs(r, { v: 1 });
  ensureEntry(r, 'ato_debt').draft.sourceId = 'DRAFT-ONLY';
  ensureEntry(r, SG).draft = { ...ensureEntry(r, SG).draft, ...FIXTURE }; confirmPartial(r, SG, 'outstanding', 'T0');
  ensureEntry(r, 'mca_present').draft = { ...ensureEntry(r, 'mca_present').draft, ...FIXTURE, sourceId: 'F-MCA-SYN' }; confirmPartial(r, 'mca_present', 'outstanding', 'T1');
  syncReviewInputs(r, { v: 2 }); // all confirmed → stale
  ensureEntry(r, SG).draft = { ...ensureEntry(r, SG).draft }; confirmPartial(r, SG, 'outstanding', 'T2'); // re-confirm one → current
  const text = reviewRecordsText(r, { labelOf: (id) => id, gapOf: (id) => `gap ${id}`, engineStatusLabel: () => EVIDENCE_STATUS.outstanding });
  assert.match(text, /ato_debt — Reviewed — partially supports; gap remains \[DRAFT — not confirmed\]/);
  assert.match(text, /sg_unevidenced — .* \[CURRENT\]/);
  assert.match(text, /mca_present — .* \[STALE — inputs changed; re-review required\]/);
  assert.match(text, /Original gap: gap sg_unevidenced/); assert.match(text, /Source: F-SG-01-CF002-20261023 · 2026-10-23 · F06–F10; F11–F13 · SYNTHETIC TEST FIXTURE/);
  assert.match(text, /Still unproven: Per-period SG liability/); assert.match(text, /Source is a reference only; it was not opened or checked by this page/);
  assert.doesNotMatch(text, /verified|BUILD_LINE|Build cf-/);
});

let JSDOM; try { ({ JSDOM } = await import(process.env.CF_JSDOM_MODULE || 'jsdom')); } catch {}

(JSDOM ? test : test.skip)('A01/A02/A05/A08/A09/A13/A14 mounted: both tiers show the same record, Blank clears it, baseline untouched, unknown status guarded', async () => {
  const html = await readFile(new URL('../preview/credit-framework.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.test/preview/credit-framework.html?tier=comprehensive', pretendToBeVisual: true });
  const { window } = dom; window.matchMedia = () => ({ matches: false }); window.HTMLElement.prototype.scrollIntoView = function () {};
  for (const k of ['window', 'document', 'Node', 'location']) globalThis[k] = window[k];
  document.execCommand = () => true;
  await import('../assets/js/preview/credit-framework/app.js');
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const click = (s) => { const n = $(s); assert.ok(n, `missing ${s}`); n.click(); };
  const type = (s, v) => { const n = $(s); assert.ok(n, `missing ${s}`); n.value = v; n.dispatchEvent(new window.Event('input', { bubbles: true })); };
  const snapshot = () => ({ movement: $('#rerate-movement').textContent, conf: $('#rerate-confidence').textContent, strategy: $('#rerate-strategy').textContent,
    critical: $('#overview-critical-count').textContent, triggers: $$('#intake input[type="checkbox"]:checked').map((n) => n.id).sort(), rating: $('#f-rating')?.value ?? null,
    manual: $$('[data-risk-readout]').map((n) => n.dataset.status).join(','), title: $('#out-sub').textContent });
  // A05: the tracker select still has exactly the four engine options.
  const sgSelect = $('[data-rerate="sg_unevidenced"]');
  assert.deepEqual([...sgSelect.options].map((o) => o.value), ['outstanding', 'reply_only', 'supports', 'weak']);
  assert.equal($$('[data-review-badge]').length, 0); assert.match($('#sec-evidence-review').textContent, /No partial-support records/);
  const before = snapshot();
  // A06 in the DOM: open editor, confirm without required fields → stays draft, error shown.
  click('[data-open-review="sg_unevidenced"]');
  assert.ok($('#review-editor-sg_unevidenced'));
  click('[data-confirm-review="sg_unevidenced"]');
  assert.match($('#review-error-sg_unevidenced').textContent, /Draft only/);
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'draft');
  assert.deepEqual(snapshot(), before, 'draft changed nothing');
  // A01: fill F-SG-01 and confirm (manual).
  type('#review-sourceId-sg_unevidenced', FIXTURE.sourceId); type('#review-sourceVersion-sg_unevidenced', FIXTURE.sourceVersion); type('#review-sourceLocator-sg_unevidenced', FIXTURE.sourceLocator);
  type('#review-supportedScope-sg_unevidenced', FIXTURE.supportedScope); type('#review-remainingGap-sg_unevidenced', FIXTURE.remainingGap);
  type('#review-note-sg_unevidenced', FIXTURE.note); type('#review-reviewerLabel-sg_unevidenced', FIXTURE.reviewerLabel); type('#review-ownerReviewDate-sg_unevidenced', FIXTURE.ownerReviewDate);
  click('[data-confirm-review="sg_unevidenced"]');
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'current');
  assert.match($('[data-review-badge="sg_unevidenced"]').textContent, /Partial support · gap remains · CURRENT/);
  assert.equal($('[data-rerate="sg_unevidenced"]').value, 'outstanding', 'engine status untouched');
  const rec = $('[data-review-record="sg_unevidenced"]');
  assert.match(rec.textContent, /Original gap:/); assert.match(rec.textContent, /F-SG-01-CF002-20261023/); assert.match(rec.textContent, /Still unproven: Per-period SG liability/); assert.match(rec.textContent, /SYNTHETIC TEST FIXTURE/);
  assert.doesNotMatch(rec.textContent, /\bverified\b/i);
  // A13 / A03: nothing else moved.
  assert.deepEqual(snapshot(), before, 'confirming partial changed rating/confidence/triggers/manual/baseline');
  assert.equal(document.body.dataset.lint, 'pass');
  // A10: copy text carries the block.
  click('#copy-btn'); const copied = $('#copy-buffer').value;
  assert.match(copied, /Manual evidence-review records \(partial support\)/); assert.match(copied, /\[CURRENT\]/); assert.match(copied, /Engine status \(unchanged\): Not received \/ not yet reviewed/);
  // A08: Simple shows the same record (badge + details), no "not yet reviewed" mislabel on the record, and switching back keeps it.
  click('#tier-output [data-tier="simple"]');
  assert.ok($('[data-review-badge="sg_unevidenced"]'), 'badge visible in Simple');
  assert.equal($('[data-review-record="sg_unevidenced"]').dataset.validity, 'current');
  assert.match($('#sec-evidence-review').textContent, /1 current · 0 stale · 0 conflict · 0 draft/);
  assert.equal($('[data-rerate="sg_unevidenced"]'), null, 'editor/tracker remains Comprehensive-only');
  click('#tier-output [data-tier="comprehensive"]');
  assert.equal($('[data-review-record="sg_unevidenced"]').dataset.validity, 'current');
  assert.deepEqual(snapshot(), before);
  // A04 in the DOM: set weak on SG → engine reacts (existing rule), record stays and flags retained counterevidence.
  const sel = $('[data-rerate="sg_unevidenced"]'); sel.value = 'weak'; sel.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.ok($('[data-weak-retained="sg_unevidenced"]'), 'weak retained notice');
  assert.equal($('[data-review-record="sg_unevidenced"]').dataset.validity, 'current', 'engine-status change of the same trigger is a review action, not an input change');
  assert.match($('#rerate-confidence').textContent, /Low/);
  const afterWeak = snapshot();
  // Removing the record does not release weak.
  click('[data-open-review="sg_unevidenced"]'); click('[data-clear-review="sg_unevidenced"]');
  assert.equal($$('[data-review-badge]').length, 0); assert.equal($('[data-rerate="sg_unevidenced"]').value, 'weak'); assert.deepEqual(snapshot(), afterWeak);
  // A07 in the DOM: re-create, then edit an input → stale; re-confirm needs the button.
  click('[data-open-review="sg_unevidenced"]'); type('#review-sourceId-sg_unevidenced', FIXTURE.sourceId); type('#review-supportedScope-sg_unevidenced', FIXTURE.supportedScope); type('#review-remainingGap-sg_unevidenced', FIXTURE.remainingGap); click('[data-confirm-review="sg_unevidenced"]');
  type('#f-dealName', 'S-A07 synthetic label change');
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'stale'); assert.ok($('[data-stale="sg_unevidenced"]'));
  click('#copy-btn'); assert.match($('#copy-buffer').value, /\[STALE — inputs changed; re-review required\]/);
  click('[data-open-review="sg_unevidenced"]'); assert.match($('[data-confirm-review="sg_unevidenced"]').textContent, /Re-review and confirm/); click('[data-confirm-review="sg_unevidenced"]');
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'current');
  // A09: Blank clears records, drafts and copy buffer.
  click('#case-picker [data-case="custom"]');
  assert.equal($$('[data-review-badge]').length, 0); assert.equal($$('[data-review-record]').length, 0); assert.equal($('#copy-buffer').value, '');
  assert.match($('#sec-evidence-review').textContent, /No partial-support records/);
  assert.doesNotMatch($('#report').textContent, /F-SG-01/);
  // A14: an unsupported status string injected into engine state is reset and surfaced, never optimistic.
  click('#case-picker [data-case="CF-002"]');
  const picker = $('[data-rerate="ato_debt"]'); const bogus = window.document.createElement('option'); bogus.value = 'partial'; picker.append(bogus); picker.value = 'partial'; picker.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.ok($('#evidence-status-unsupported'), 'unsupported status notice'); assert.match($('#evidence-status-unsupported').textContent, /"partial"/);
  assert.equal($('[data-rerate="ato_debt"]').value, 'outstanding'); assert.doesNotMatch($('#rerate-movement').textContent, /up/);
  assert.equal(document.body.dataset.lint, 'pass');
  dom.window.close();
});

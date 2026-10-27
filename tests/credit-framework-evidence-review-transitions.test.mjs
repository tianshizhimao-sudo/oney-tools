// Engine-status transitions AFTER a partial record is confirmed (A02 reverse path, A04, A07).
// Rule under test (approved design): a partial record can never be presented as CURRENT while the
// engine status for the same trigger is `supports`; returning from that state requires an explicit
// manual re-confirm. Engine behaviour for `supports` / `weak` is the existing rule and is not changed.
// CF_JSDOM_MODULE=/absolute/path/to/jsdom/lib/api.js node --test tests/credit-framework-evidence-review-transitions.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, buildAssessment } from '../assets/js/preview/credit-framework/engine.js';
import { createReviewRecords, syncReviewInputs, ensureEntry, confirmPartial, reviewState, noteEngineStatus, partialCounts, reviewRecordsText } from '../assets/js/preview/credit-framework/evidence-review.js';

const SG = 'sg_unevidenced';
const FIXTURE = { sourceId: 'F-SG-01-CF002-20261023', sourceVersion: '2026-10-23', sourceLocator: 'F06–F10; F11–F13', supportedScope: 'Synthetic summary shows no Super balance (synthetic).', remainingGap: 'Per-period SG liability, payment timing and fund receipt unknown.', reviewerLabel: 'owner', ownerReviewDate: '2026-10-23', note: '部分支持' };
const setup = (engineStatus = 'outstanding') => {
  const r = createReviewRecords(); syncReviewInputs(r, { v: 1 });
  ensureEntry(r, SG).draft = { ...ensureEntry(r, SG).draft, ...FIXTURE };
  assert.equal(confirmPartial(r, SG, engineStatus, 'T0'), true);
  return r;
};

test('reverse path: engine status changed to supports after confirm → record is CONFLICT, not CURRENT', () => {
  const r = setup('outstanding');
  assert.equal(reviewState(r, SG, 'outstanding').validity, 'current');
  noteEngineStatus(r, SG, 'supports');
  const s = reviewState(r, SG, 'supports');
  assert.equal(s.validity, 'conflict');
  assert.ok(s.label.startsWith('Partial support · NOT CURRENT'), s.label); assert.doesNotMatch(s.label, /gap remains · CURRENT/);
  assert.match(s.label, /supports/); assert.match(s.label, /re-review/i);
  assert.equal(partialCounts(r).current, 0); assert.equal(partialCounts(r).conflict, 1);
  const text = reviewRecordsText(r, { labelOf: () => 'SG', gapOf: () => '', engineStatusLabel: () => 'Reviewed evidence — supports', engineStatusOf: () => 'supports' });
  assert.match(text, /\[CONFLICT — engine status is supports; partial record not current; re-review required\]/);
  assert.doesNotMatch(text, /\[CURRENT\]/);
  assert.doesNotMatch(text, /Gap remains unresolved; Critical count unchanged/); assert.match(text, /treats this item as supported under its existing rule/);
});

test('conflict is sticky: moving the engine status back does not restore CURRENT without a manual re-confirm', () => {
  const r = setup('outstanding');
  noteEngineStatus(r, SG, 'supports'); noteEngineStatus(r, SG, 'outstanding');
  assert.equal(reviewState(r, SG, 'outstanding').validity, 'conflict');
  assert.equal(confirmPartial(r, SG, 'supports'), false, 're-confirm is still refused while engine says supports');
  assert.equal(confirmPartial(r, SG, 'outstanding', 'T1'), true, 'explicit manual re-confirm after the engine status was reviewed');
  assert.equal(reviewState(r, SG, 'outstanding').validity, 'current');
});

test('conflict and stale can coexist; conflict label wins and both facts are in the copy text', () => {
  const r = setup('outstanding');
  noteEngineStatus(r, SG, 'supports'); syncReviewInputs(r, { v: 2 });
  const s = reviewState(r, SG, 'supports');
  assert.equal(s.validity, 'conflict'); assert.equal(s.stale, true);
  const text = reviewRecordsText(r, { labelOf: () => 'SG', gapOf: () => '', engineStatusLabel: () => 'x', engineStatusOf: () => 'supports' });
  assert.match(text, /\[CONFLICT/); assert.match(text, /Inputs changed since this record was confirmed/);
});

test('weak after confirm is NOT a conflict: record stays current with counterevidence retained; the engine still reacts to weak', () => {
  const r = setup('outstanding');
  noteEngineStatus(r, SG, 'weak');
  const s = reviewState(r, SG, 'weak');
  assert.equal(s.validity, 'current'); assert.equal(s.weakRetained, true);
  const st = initialState('CF-002', 'comprehensive'); st.evidence[SG] = 'weak';
  assert.equal(buildAssessment(st).rerate.confidence, 'Low');
});

test('reply_only / outstanding transitions after confirm keep the record current (both are unresolved for the engine)', () => {
  const r = setup('outstanding');
  noteEngineStatus(r, SG, 'reply_only'); assert.equal(reviewState(r, SG, 'reply_only').validity, 'current');
  noteEngineStatus(r, SG, 'outstanding'); assert.equal(reviewState(r, SG, 'outstanding').validity, 'current');
});

test('engine rule for supports is unchanged by the record layer', () => {
  const st = initialState('CF-002', 'comprehensive');
  const base = buildAssessment(st).rerate;
  st.evidence[SG] = 'supports';
  const withSupports = buildAssessment(st).rerate;
  assert.notDeepEqual(withSupports.stillMissing, base.stillMissing, 'supports removes SG from still-missing exactly as before (existing rule)');
  const r = setup('outstanding'); noteEngineStatus(r, SG, 'supports');
  assert.deepEqual(buildAssessment(st).rerate, withSupports, 'conflict record does not alter the engine result');
});

let JSDOM; try { ({ JSDOM } = await import(process.env.CF_JSDOM_MODULE || 'jsdom')); } catch {}
(JSDOM ? test : test.skip)('mounted: tracker select → supports flips badge to conflict; back to outstanding stays conflict until re-confirm', async () => {
  const html = await readFile(new URL('../preview/credit-framework.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.test/preview/credit-framework.html?tier=comprehensive', pretendToBeVisual: true });
  const { window } = dom; window.matchMedia = () => ({ matches: false }); window.HTMLElement.prototype.scrollIntoView = function () {};
  for (const k of ['window', 'document', 'Node', 'location']) globalThis[k] = window[k]; document.execCommand = () => true;
  await import('../assets/js/preview/credit-framework/app.js');
  const $ = (s) => document.querySelector(s);
  const type = (s, v) => { $(s).value = v; $(s).dispatchEvent(new window.Event('input', { bubbles: true })); };
  const select = (v) => { const n = $('[data-rerate="sg_unevidenced"]'); n.value = v; n.dispatchEvent(new window.Event('change', { bubbles: true })); };
  $('[data-open-review="sg_unevidenced"]').click();
  type('#review-sourceId-sg_unevidenced', FIXTURE.sourceId); type('#review-supportedScope-sg_unevidenced', FIXTURE.supportedScope); type('#review-remainingGap-sg_unevidenced', FIXTURE.remainingGap);
  $('[data-confirm-review="sg_unevidenced"]').click();
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'current');
  const movementBefore = $('#rerate-movement').textContent;
  select('supports');
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'conflict');
  assert.ok($('[data-review-badge="sg_unevidenced"]').textContent.startsWith('Partial support · NOT CURRENT')); assert.doesNotMatch($('[data-review-badge="sg_unevidenced"]').textContent, /gap remains · CURRENT/);
  assert.ok($('[data-conflict="sg_unevidenced"]'), 'conflict notice rendered');
  assert.match($('#sec-evidence-review').textContent, /1 conflict/);
  $('#copy-btn').click(); assert.match($('#copy-buffer').value, /\[CONFLICT — engine status is supports/);
  // The engine's own supports rule still applies (existing behaviour) — the record layer did not block it.
  assert.notEqual($('#rerate-movement').textContent + $('#rerate-out').textContent, movementBefore + '', 'engine output reflects supports as before');
  select('outstanding');
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'conflict', 'sticky until manual re-confirm');
  $('[data-open-review="sg_unevidenced"]').click(); assert.match($('[data-confirm-review="sg_unevidenced"]').textContent, /Re-review and confirm/);
  $('[data-confirm-review="sg_unevidenced"]').click();
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'current');
  assert.equal(document.body.dataset.lint, 'pass');
  dom.window.close();
});

// ---- r3: wording must track the CURRENT engine status after a supports conflict ----
const ENGINE_LABEL = { outstanding: 'Not received / not yet reviewed', reply_only: 'Client reply only — does not count', supports: 'Reviewed evidence — supports', weak: 'Reviewed evidence — weak/contradicts' };
const textFor = (r, eng) => reviewRecordsText(r, { labelOf: () => 'SG', gapOf: () => '', engineStatusLabel: () => ENGINE_LABEL[eng], engineStatusOf: () => eng });
const PRESENT_TENSE_SUPPORTS = /engine status is supports|keeps applying|currently treats this item as supported|is currently "supports"/;

test('r3 sequence: confirm → supports → outstanding: still NOT CURRENT, but no present-tense "supports" wording; engine field shows outstanding', () => {
  const r = setup('outstanding');
  noteEngineStatus(r, SG, 'supports'); noteEngineStatus(r, SG, 'outstanding');
  const s = reviewState(r, SG, 'outstanding');
  assert.equal(s.validity, 'conflict'); assert.equal(s.conflictActive, false); assert.equal(s.conflictHistorical, true);
  assert.ok(s.label.startsWith('Partial support · NOT CURRENT'), s.label); assert.doesNotMatch(s.label, PRESENT_TENSE_SUPPORTS); assert.match(s.label, /prior supports conflict/);
  const text = textFor(r, 'outstanding');
  assert.doesNotMatch(text, PRESENT_TENSE_SUPPORTS);
  assert.match(text, /\[NOT CURRENT — prior supports conflict; engine status now "Not received \/ not yet reviewed"; re-review required\]/);
  assert.match(text, /Engine status \(unchanged\): Not received \/ not yet reviewed/);
  assert.match(text, /has since been changed to "Not received \/ not yet reviewed"/);
  assert.match(text, /Gap remains unresolved for the engine under its current status/);
  assert.doesNotMatch(text, /\[CURRENT\]/);
});

test('r3 sequence: confirm → supports → weak (+ stale): NOT CURRENT, counterevidence retained, engine Low, no present-tense supports; stale also stated', () => {
  const r = setup('outstanding');
  noteEngineStatus(r, SG, 'supports'); noteEngineStatus(r, SG, 'weak');
  let s = reviewState(r, SG, 'weak');
  assert.equal(s.validity, 'conflict'); assert.equal(s.weakRetained, true); assert.equal(s.conflictActive, false);
  let text = textFor(r, 'weak');
  assert.doesNotMatch(text, PRESENT_TENSE_SUPPORTS); assert.match(text, /Counterevidence recorded .* is retained/); assert.match(text, /engine status now "Reviewed evidence — weak\/contradicts"/);
  // engine (existing rule) reacts to weak; the record changes nothing
  const st = initialState('CF-002', 'comprehensive'); st.evidence[SG] = 'weak';
  const a = buildAssessment(st); assert.equal(a.rerate.confidence, 'Low'); assert.ok(a.rerate.reasons.some((x) => /weak/.test(x)));
  syncReviewInputs(r, { v: 2 }); s = reviewState(r, SG, 'weak');
  assert.equal(s.validity, 'conflict'); assert.equal(s.stale, true);
  text = textFor(r, 'weak'); assert.match(text, /Inputs changed since this record was confirmed/); assert.doesNotMatch(text, PRESENT_TENSE_SUPPORTS);
  assert.equal(confirmPartial(r, SG, 'weak', 'T2'), true, 'manual re-confirm allowed beside weak'); assert.equal(reviewState(r, SG, 'weak').validity, 'current');
});

test('r3: while engine status is still supports the active wording is used (present tense is correct there)', () => {
  const r = setup('outstanding'); noteEngineStatus(r, SG, 'supports');
  const s = reviewState(r, SG, 'supports'); assert.equal(s.conflictActive, true); assert.match(s.label, /engine status is supports/);
  assert.match(textFor(r, 'supports'), /currently treats this item as supported/);
});

test('r3: fixed facts — a historical-conflict record does not change rating / confidence / still-missing', () => {
  for (const eng of ['outstanding', 'reply_only', 'weak']) {
    const st = initialState('CF-002', 'comprehensive'); if (eng !== 'outstanding') st.evidence[SG] = eng;
    const before = JSON.stringify(buildAssessment(st).rerate);
    const r = setup('outstanding'); noteEngineStatus(r, SG, 'supports'); noteEngineStatus(r, SG, eng);
    assert.equal(reviewState(r, SG, eng).validity, 'conflict');
    assert.equal(JSON.stringify(buildAssessment(st).rerate), before, eng);
  }
});

(JSDOM ? test : test.skip)('r3 mounted: badge / notice / closing line / copy track the current engine status through supports → outstanding → weak → stale → re-confirm', async () => {
  const html = await readFile(new URL('../preview/credit-framework.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.test/preview/credit-framework.html?tier=comprehensive', pretendToBeVisual: true });
  const { window } = dom; window.matchMedia = () => ({ matches: false }); window.HTMLElement.prototype.scrollIntoView = function () {};
  for (const k of ['window', 'document', 'Node', 'location']) globalThis[k] = window[k]; document.execCommand = () => true;
  // Second mounted test in this file: ES-module cache would skip app.js' top-level mount, so bust the cache.
  await import('../assets/js/preview/credit-framework/app.js?mount=r3');
  const $ = (s) => document.querySelector(s);
  const type = (s, v) => { $(s).value = v; $(s).dispatchEvent(new window.Event('input', { bubbles: true })); };
  const select = (v) => { const n = $('[data-rerate="sg_unevidenced"]'); n.value = v; n.dispatchEvent(new window.Event('change', { bubbles: true })); };
  const copy = () => { $('#copy-btn').click(); return $('#copy-buffer').value; };
  const closing = () => [...$('[data-review-record="sg_unevidenced"]').querySelectorAll('p.hint')].pop().textContent;
  $('[data-open-review="sg_unevidenced"]').click(); type('#review-sourceId-sg_unevidenced', FIXTURE.sourceId); type('#review-supportedScope-sg_unevidenced', FIXTURE.supportedScope); type('#review-remainingGap-sg_unevidenced', FIXTURE.remainingGap); $('[data-confirm-review="sg_unevidenced"]').click();
  select('supports');
  assert.equal($('[data-conflict="sg_unevidenced"]').dataset.conflictKind, 'active'); assert.match(closing(), /currently treats/);
  select('outstanding');
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'conflict');
  assert.equal($('[data-conflict="sg_unevidenced"]').dataset.conflictKind, 'historical');
  assert.doesNotMatch($('[data-review-badge="sg_unevidenced"]').textContent, PRESENT_TENSE_SUPPORTS);
  assert.doesNotMatch($('[data-conflict="sg_unevidenced"]').textContent, PRESENT_TENSE_SUPPORTS); assert.match($('[data-conflict="sg_unevidenced"]').textContent, /has since been changed to "Not received \/ not yet reviewed"/);
  assert.doesNotMatch(closing(), /currently treats/);
  assert.match($('[data-review-record="sg_unevidenced"]').textContent, /Engine status \(unchanged\): Not received \/ not yet reviewed/);
  let c = copy(); assert.doesNotMatch(c, PRESENT_TENSE_SUPPORTS); assert.match(c, /\[NOT CURRENT — prior supports conflict; engine status now "Not received \/ not yet reviewed"; re-review required\]/);
  const confBefore = $('#rerate-confidence').textContent;
  select('weak');
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'conflict'); assert.ok($('[data-weak-retained="sg_unevidenced"]'));
  assert.match($('#rerate-confidence').textContent, /Low/); assert.notEqual($('#rerate-confidence').textContent, confBefore, 'engine reacted to weak (existing rule)');
  c = copy(); assert.doesNotMatch(c, PRESENT_TENSE_SUPPORTS); assert.match(c, /engine status now "Reviewed evidence — weak\/contradicts"/); assert.match(c, /Counterevidence recorded .* is retained/);
  type('#f-dealName', 'S-r3 synthetic label change');
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'conflict'); assert.ok($('[data-stale="sg_unevidenced"]'), 'stale notice shown alongside');
  c = copy(); assert.match(c, /Inputs changed since this record was confirmed/); assert.doesNotMatch(c, PRESENT_TENSE_SUPPORTS);
  $('[data-open-review="sg_unevidenced"]').click(); assert.match($('[data-confirm-review="sg_unevidenced"]').textContent, /Re-review and confirm/); $('[data-confirm-review="sg_unevidenced"]').click();
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'current'); assert.equal($('[data-rerate="sg_unevidenced"]').value, 'weak', 'weak untouched by re-confirm');
  assert.match($('#rerate-confidence').textContent, /Low/);
  assert.equal(document.body.dataset.lint, 'pass');
  dom.window.close();
});

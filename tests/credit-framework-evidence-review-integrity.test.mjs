// A07 (source-reference change) and A14 (unknown engine status must not swallow weak) — fail-closed rules.
// CF_JSDOM_MODULE=/absolute/path/to/jsdom/lib/api.js node --test tests/credit-framework-evidence-review-integrity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, blankState, buildAssessment } from '../assets/js/preview/credit-framework/engine.js';
import { createReviewRecords, syncReviewInputs, ensureEntry, confirmPartial, reviewState, noteDraftEdit, reviewRecordsText } from '../assets/js/preview/credit-framework/evidence-review.js';

const SG = 'sg_unevidenced';
const FIXTURE = { sourceId: 'F-SG-01-CF002-20261023', sourceVersion: '2026-10-23', sourceLocator: 'F06–F10; F11–F13', supportedScope: 'Synthetic summary shows no Super balance (synthetic).', remainingGap: 'Per-period SG liability, payment timing and fund receipt unknown.', reviewerLabel: 'owner', ownerReviewDate: '2026-10-23', note: '部分支持' };
const setup = () => { const r = createReviewRecords(); syncReviewInputs(r, { v: 1 }); ensureEntry(r, SG).draft = { ...ensureEntry(r, SG).draft, ...FIXTURE }; assert.equal(confirmPartial(r, SG, 'outstanding', 'T0'), true); return r; };
const LABELS = { outstanding: 'Not received / not yet reviewed', weak: 'Reviewed evidence — weak/contradicts' };
const text = (r, eng = 'outstanding') => reviewRecordsText(r, { labelOf: () => 'SG', gapOf: () => '', engineStatusLabel: () => LABELS[eng], engineStatusOf: () => eng });

test('A07 unit: changing the source version invalidates the confirmed record (not CURRENT), keeps the prior citation, and does not auto-restore when typed back', () => {
  const r = setup();
  noteDraftEdit(r, SG, 'sourceVersion', '2026-10-24');
  let s = reviewState(r, SG, 'outstanding');
  assert.notEqual(s.validity, 'current'); assert.equal(s.validity, 'stale'); assert.equal(s.sourceStale, true);
  assert.doesNotMatch(s.label, /CURRENT/); assert.match(s.label, /source reference changed/i);
  assert.equal(s.confirmed.sourceVersion, '2026-10-23', 'prior citation preserved on the confirmed record');
  assert.equal(s.draft.sourceVersion, '2026-10-24');
  let t = text(r); assert.match(t, /\[STALE — source reference changed; re-review required\]/); assert.match(t, /Confirmed citation: F-SG-01-CF002-20261023 · 2026-10-23/); assert.match(t, /Draft citation: F-SG-01-CF002-20261023 · 2026-10-24/); assert.doesNotMatch(t, /\[CURRENT/);
  noteDraftEdit(r, SG, 'sourceVersion', '2026-10-23'); // typed back
  s = reviewState(r, SG, 'outstanding'); assert.equal(s.validity, 'stale', 'no automatic restore after typing the original back');
  assert.equal(confirmPartial(r, SG, 'outstanding', 'T1'), true, 'explicit manual re-confirm');
  assert.equal(reviewState(r, SG, 'outstanding').validity, 'current');
});

test('A07 unit: source ID and locator changes behave the same; note / reviewer-label edits remain pending drafts on a CURRENT record', () => {
  for (const [key, value] of [['sourceId', 'F-SG-02-OTHER'], ['sourceLocator', 'F01']]) {
    const r = setup(); noteDraftEdit(r, SG, key, value);
    assert.equal(reviewState(r, SG, 'outstanding').validity, 'stale', key);
  }
  const r = setup(); noteDraftEdit(r, SG, 'note', 'extra wording');
  const s = reviewState(r, SG, 'outstanding'); assert.equal(s.validity, 'draft-edits'); assert.equal(s.sourceStale, false);
});

test('A07 unit: source change + input change + engine weak all coexist and are all stated; no auto uplift', () => {
  const r = setup(); noteDraftEdit(r, SG, 'sourceVersion', 'v2'); syncReviewInputs(r, { v: 2 });
  const s = reviewState(r, SG, 'weak'); assert.equal(s.validity, 'stale'); assert.equal(s.sourceStale, true); assert.equal(s.inputStale, true); assert.equal(s.weakRetained, true);
  const t = text(r, 'weak'); assert.match(t, /source reference changed/); assert.match(t, /Inputs changed since this record was confirmed/); assert.match(t, /Counterevidence recorded .* is retained/);
  const st = initialState('CF-002', 'comprehensive'); st.evidence[SG] = 'weak'; assert.equal(buildAssessment(st).rerate.confidence, 'Low');
});

let JSDOM; try { ({ JSDOM } = await import(process.env.CF_JSDOM_MODULE || 'jsdom')); } catch {}
async function mount(query = 'tier=comprehensive', bust = '') {
  const html = await readFile(new URL('../preview/credit-framework.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: `https://example.test/preview/credit-framework.html?${query}`, pretendToBeVisual: true });
  const { window } = dom; window.matchMedia = () => ({ matches: false }); window.HTMLElement.prototype.scrollIntoView = function () {};
  for (const k of ['window', 'document', 'Node', 'location']) globalThis[k] = window[k]; document.execCommand = () => true;
  await import(`../assets/js/preview/credit-framework/app.js${bust}`);
  const $ = (s) => document.querySelector(s);
  const type = (s, v) => { $(s).value = v; $(s).dispatchEvent(new window.Event('input', { bubbles: true })); };
  const select = (id, v) => { const n = $(`[data-rerate="${id}"]`); n.value = v; n.dispatchEvent(new window.Event('change', { bubbles: true })); };
  const copy = () => { $('#copy-btn').click(); return $('#copy-buffer').value; };
  const confirmSG = () => { $('[data-open-review="sg_unevidenced"]').click(); type('#review-sourceId-sg_unevidenced', FIXTURE.sourceId); type('#review-sourceVersion-sg_unevidenced', FIXTURE.sourceVersion); type('#review-supportedScope-sg_unevidenced', FIXTURE.supportedScope); type('#review-remainingGap-sg_unevidenced', FIXTURE.remainingGap); $('[data-confirm-review="sg_unevidenced"]').click(); };
  return { dom, window, $, type, select, copy, confirmSG };
}

(JSDOM ? test : test.skip)('A07 mounted: edit source version → not CURRENT; Close keeps it; typing back does not restore; tier switch keeps it; copy shows prior + draft citation; manual re-confirm restores', async () => {
  const m = await mount('tier=comprehensive', '?mount=a07'); const { $, type, copy } = m;
  m.confirmSG(); assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'current');
  const confBefore = $('#rerate-confidence').textContent + $('#rerate-movement').textContent;
  $('[data-open-review="sg_unevidenced"]').click(); type('#review-sourceVersion-sg_unevidenced', '2026-10-24');
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'stale'); assert.doesNotMatch($('[data-review-badge="sg_unevidenced"]').textContent, /CURRENT/);
  $('[data-cancel-review="sg_unevidenced"]').click();
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'stale', 'Close does not restore');
  let c = copy(); assert.match(c, /\[STALE — source reference changed; re-review required\]/); assert.match(c, /Confirmed citation: .*2026-10-23/); assert.match(c, /Draft citation: .*2026-10-24/);
  $('[data-open-review="sg_unevidenced"]').click(); type('#review-sourceVersion-sg_unevidenced', '2026-10-23');
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'stale', 'typing the original back does not restore');
  $('#tier-output [data-tier="simple"]').click(); assert.equal($('[data-review-record="sg_unevidenced"]').dataset.validity, 'stale'); $('#tier-output [data-tier="comprehensive"]').click();
  assert.equal($('#rerate-confidence').textContent + $('#rerate-movement').textContent, confBefore, 'no evaluation change from citation edits');
  $('[data-open-review="sg_unevidenced"]').click(); $('[data-confirm-review="sg_unevidenced"]').click();
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'current');
  assert.equal(document.body.dataset.lint, 'pass'); m.dom.window.close();
});

// ---------- A14: unknown status must not swallow weak ----------
const inject = (m, id, value) => { const picker = m.$(`[data-rerate="${id}"]`); const o = m.window.document.createElement('option'); o.value = value; picker.append(o); picker.value = value; picker.dispatchEvent(new m.window.Event('change', { bubbles: true })); };

(JSDOM ? test : test.skip)('A14 mounted, single Critical fixed facts: weak (Green→Amber, Low) overwritten by an unknown value must stay weak-constrained, never Medium / Green', async () => {
  const m = await mount('tier=comprehensive', '?mount=a14a'); const { $, select } = m;
  $('#case-picker [data-case="custom"]').click();
  $('#t-sg_unevidenced').click(); $('#f-rating').value = 'Green — Package Ready'; $('#f-rating').dispatchEvent(new m.window.Event('change', { bubbles: true }));
  select('sg_unevidenced', 'weak');
  const weakOut = { mv: $('#rerate-movement').textContent, conf: $('#rerate-confidence').textContent };
  assert.match(weakOut.conf, /Low/); assert.match(weakOut.mv, /green → amber/);
  inject(m, 'sg_unevidenced', 'partial');
  assert.ok($('#evidence-status-unsupported'), 'guard notice shown');
  assert.equal($('#rerate-confidence').textContent, weakOut.conf, 'confidence must not rise from Low');
  assert.equal($('#rerate-movement').textContent, weakOut.mv, 'downgrade must not be erased');
  assert.equal($('[data-rerate="sg_unevidenced"]').value, 'weak', 'tracker shows the retained weak, not outstanding');
  assert.match($('#copy-buffer').value || ($('#copy-btn').click(), $('#copy-buffer').value), /weak\/contradicts/);
  // explicit manual choice of a normal four-state value still works as before
  select('sg_unevidenced', 'reply_only'); assert.equal($('[data-rerate="sg_unevidenced"]').value, 'reply_only'); assert.equal($('#evidence-status-unsupported'), null, 'notice clears after a manual choice');
  m.dom.window.close();
});

(JSDOM ? test : test.skip)('A14 mounted, CF-002: weak + partial + stale overwritten by unknown → weak retained, record still beside it, no uplift; non-weak unknown → outstanding (conservative)', async () => {
  const m = await mount('tier=comprehensive', '?mount=a14b'); const { $, select, type, copy } = m;
  m.confirmSG(); select('sg_unevidenced', 'weak'); type('#f-dealName', 'S-A14 synthetic label change');
  const before = { mv: $('#rerate-movement').textContent, conf: $('#rerate-confidence').textContent, crit: $('#overview-critical-count').textContent };
  assert.match(before.conf, /Low/);
  inject(m, 'sg_unevidenced', 'bogus-status');
  assert.deepEqual({ mv: $('#rerate-movement').textContent, conf: $('#rerate-confidence').textContent, crit: $('#overview-critical-count').textContent }, before, 'fixed facts: nothing improves');
  assert.equal($('[data-rerate="sg_unevidenced"]').value, 'weak'); assert.ok($('[data-weak-retained="sg_unevidenced"]')); assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'stale');
  const c = copy(); assert.match(c, /Engine status \(unchanged\): Reviewed evidence — weak\/contradicts/); assert.match(c, /Unsupported review status/);
  // a trigger whose last valid status was not weak falls back conservatively to outstanding
  inject(m, 'ato_debt', 'bogus-status'); assert.equal($('[data-rerate="ato_debt"]').value, 'outstanding'); assert.doesNotMatch($('#rerate-movement').textContent, /up/);
  assert.equal(document.body.dataset.lint, 'pass'); m.dom.window.close();
});

// Unconfirmed draft vs confirmed content must be separated immediately (badge, record block, copy/print),
// focus kept while editing, only "Re-review and confirm" applies a valid draft, Close keeps the draft.
// CF_JSDOM_MODULE=/absolute/path/to/jsdom/lib/api.js node --test tests/credit-framework-evidence-review-drafts.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createReviewRecords, syncReviewInputs, ensureEntry, confirmPartial, reviewState, noteDraftEdit, reviewRecordsText, dirtyFields } from '../assets/js/preview/credit-framework/evidence-review.js';

const SG = 'sg_unevidenced';
const S0 = 'SCOPE-S0 synthetic summary shows no Super balance', G0 = 'GAP-G0 per-period liability and fund receipt unknown';
const S1 = 'SCOPE-S1 EDITED DRAFT TEXT', G1 = 'GAP-G1 EDITED DRAFT TEXT';
const BASE = { sourceId: 'F-SG-01-CF002-20261023', sourceVersion: '2026-10-23', supportedScope: S0, remainingGap: G0, reviewerLabel: 'owner' };
const setup = () => { const r = createReviewRecords(); syncReviewInputs(r, { v: 1 }); ensureEntry(r, SG).draft = { ...ensureEntry(r, SG).draft, ...BASE }; assert.equal(confirmPartial(r, SG, 'outstanding', 'T0'), true); return r; };
const text = (r) => reviewRecordsText(r, { labelOf: () => 'SG', gapOf: () => '', engineStatusLabel: () => 'Not received / not yet reviewed', engineStatusOf: () => 'outstanding' });

test('unit: scope/gap draft edits are pending on a CURRENT record; copy lists them as not applied while confirmed lines keep S0/G0', () => {
  const r = setup(); noteDraftEdit(r, SG, 'supportedScope', S1); noteDraftEdit(r, SG, 'remainingGap', G1);
  const s = reviewState(r, SG, 'outstanding');
  assert.equal(s.validity, 'draft-edits'); assert.equal(s.sourceStale, false); assert.equal(s.confirmed.supportedScope, S0); assert.equal(s.confirmed.remainingGap, G0);
  assert.deepEqual(dirtyFields(s).map((f) => [f.label, f.draft, f.confirmed]), [['supported scope', S1, S0], ['remaining gap', G1, G0]]);
  const t = text(r);
  assert.match(t, /\[CURRENT — unconfirmed draft edits pending\]/);
  assert.match(t, new RegExp(`Supports: ${S0}`)); assert.match(t, new RegExp(`Still unproven: ${G0}`));
  assert.match(t, new RegExp(`Unconfirmed draft edit \\(not applied\\) — supported scope: "${S1}" \\(confirmed: "${S0}"\\)`));
  assert.match(t, new RegExp(`Unconfirmed draft edit \\(not applied\\) — remaining gap: "${G1}"`));
  assert.match(t, /Unconfirmed draft edits pending — not applied/);
  assert.doesNotMatch(t, new RegExp(`Supports: ${S1}`));
});

test('unit: an invalid draft cannot be applied; a valid re-confirm applies S1/G1 and clears pending', () => {
  const r = setup(); noteDraftEdit(r, SG, 'supportedScope', ''); noteDraftEdit(r, SG, 'remainingGap', G1);
  assert.equal(confirmPartial(r, SG, 'outstanding'), false); assert.equal(reviewState(r, SG, 'outstanding').confirmed.supportedScope, S0, 'invalid draft never applied');
  noteDraftEdit(r, SG, 'supportedScope', S1); assert.equal(confirmPartial(r, SG, 'outstanding', 'T1'), true);
  const s = reviewState(r, SG, 'outstanding'); assert.equal(s.validity, 'current'); assert.equal(s.confirmed.supportedScope, S1); assert.equal(s.confirmed.remainingGap, G1); assert.equal(dirtyFields(s).length, 0);
  assert.doesNotMatch(text(r), /Unconfirmed draft/);
});

let JSDOM; try { ({ JSDOM } = await import(process.env.CF_JSDOM_MODULE || 'jsdom')); } catch {}
(JSDOM ? test : test.skip)('mounted: while editing (not closed) badge/record/copy show pending with S0 confirmed and S1 as unapplied draft; focus kept; Close keeps draft; invalid confirm rejected; valid confirm applies', async () => {
  const html = await readFile(new URL('../preview/credit-framework.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.test/preview/credit-framework.html?tier=comprehensive', pretendToBeVisual: true });
  const { window } = dom; window.matchMedia = () => ({ matches: false }); window.HTMLElement.prototype.scrollIntoView = function () {};
  for (const k of ['window', 'document', 'Node', 'location']) globalThis[k] = window[k]; document.execCommand = () => true;
  await import('../assets/js/preview/credit-framework/app.js?mount=drafts');
  const $ = (s) => document.querySelector(s);
  const type = (s, v) => { const n = $(s); n.focus(); n.value = v; n.setSelectionRange(v.length, v.length); n.dispatchEvent(new window.Event('input', { bubbles: true })); };
  const copy = () => { $('#copy-btn').click(); return $('#copy-buffer').value; };
  const rec = () => $('[data-review-record="sg_unevidenced"]').textContent;
  $('[data-open-review="sg_unevidenced"]').click(); type('#review-sourceId-sg_unevidenced', BASE.sourceId); type('#review-supportedScope-sg_unevidenced', S0); type('#review-remainingGap-sg_unevidenced', G0); $('[data-confirm-review="sg_unevidenced"]').click();
  const fixed = () => `${$('#rerate-movement').textContent}|${$('#rerate-confidence').textContent}|${$('#overview-critical-count').textContent}|${$('[data-rerate="sg_unevidenced"]').value}`;
  const before = fixed();
  $('[data-open-review="sg_unevidenced"]').click(); type('#review-supportedScope-sg_unevidenced', S1);
  // immediate, without Close
  assert.equal(document.activeElement.id, 'review-supportedScope-sg_unevidenced', 'focus kept on the edited field after re-render');
  assert.equal($('#review-supportedScope-sg_unevidenced').selectionStart, S1.length, 'caret kept at end');
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'draft-edits'); assert.match($('[data-review-badge="sg_unevidenced"]').textContent, /unconfirmed draft edits pending/);
  assert.ok($('[data-draft-dirty="supportedScope"]'), 'field flagged as unconfirmed draft'); assert.match($('[data-draft-dirty="supportedScope"]').textContent, /Unconfirmed draft/); assert.match($('[data-draft-dirty="supportedScope"]').textContent, new RegExp(`Confirmed value: "${S0}"`));
  assert.equal($('[data-draft-dirty="remainingGap"]'), null, 'untouched field not flagged');
  assert.ok($('[data-pending-drafts="sg_unevidenced"]')); assert.match($('[data-pending-drafts="sg_unevidenced"]').textContent, new RegExp(`supported scope: "${S1}" \\(confirmed: "${S0}"\\)`));
  assert.match(rec(), new RegExp(`Supports: ${S0}`)); assert.doesNotMatch(rec(), new RegExp(`Supports: ${S1}`));
  let c = copy(); assert.match(c, /\[CURRENT — unconfirmed draft edits pending\]/); assert.match(c, new RegExp(`Supports: ${S0}`)); assert.match(c, new RegExp(`Unconfirmed draft edit \\(not applied\\) — supported scope: "${S1}"`)); assert.doesNotMatch(c, new RegExp(`Supports: ${S1}`));
  type('#review-remainingGap-sg_unevidenced', G1); assert.ok($('[data-draft-dirty="remainingGap"]')); assert.equal(fixed(), before, 'fixed facts: evaluation unchanged by drafts');
  // Close keeps the draft (there is no cancel/discard control)
  $('[data-cancel-review="sg_unevidenced"]').click();
  assert.equal($('#review-editor-sg_unevidenced'), null); assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'draft-edits'); assert.match(copy(), /Unconfirmed draft edit \(not applied\) — remaining gap/);
  $('[data-open-review="sg_unevidenced"]').click(); assert.equal($('#review-supportedScope-sg_unevidenced').value, S1, 'draft kept after Close/reopen'); assert.ok($('[data-draft-dirty="supportedScope"]'));
  // invalid draft rejected, confirmed unchanged
  type('#review-supportedScope-sg_unevidenced', ''); $('[data-confirm-review="sg_unevidenced"]').click();
  assert.match($('#review-error-sg_unevidenced').textContent, /Draft only/); assert.match(rec(), new RegExp(`Supports: ${S0}`)); assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'draft-edits');
  // valid re-confirm applies
  type('#review-supportedScope-sg_unevidenced', S1); assert.match($('[data-confirm-review="sg_unevidenced"]').textContent, /Re-review and confirm/); $('[data-confirm-review="sg_unevidenced"]').click();
  assert.equal($('[data-review-badge="sg_unevidenced"]').dataset.validity, 'current'); assert.match(rec(), new RegExp(`Supports: ${S1}`)); assert.match(rec(), new RegExp(`Still unproven: ${G1}`)); assert.doesNotMatch(rec(), /Unconfirmed draft/);
  c = copy(); assert.match(c, /\[CURRENT\]/); assert.doesNotMatch(c, /Unconfirmed draft|S0 synthetic/);
  assert.equal(fixed(), before); assert.equal(document.body.dataset.lint, 'pass');
  dom.window.close();
});

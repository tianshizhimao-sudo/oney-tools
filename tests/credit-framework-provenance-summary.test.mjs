import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createReviewRecords, ensureEntry, confirmPartial, noteDraftEdit, reviewState, provenanceText, recordAccessObservation, accessObservationText, reviewRecordsText } from '../assets/js/preview/credit-framework/evidence-review.js';
import { initialState, blankState, buildAssessment, buildReport, RULES, CASE_ORDER } from '../assets/js/preview/credit-framework/engine.js';
import { buildOverview } from '../assets/js/preview/credit-framework/overview.js';
const fixture = { sourceId: 'SYNTHETIC-01', sourceVersion: 'v1', sourceLocator: 'p2', supportedScope: 'Limited finding', remainingGap: 'Other facts remain unproven', ownerReviewDate: '2026-10-23', note: 'Historical judgement' };
const text = (records) => reviewRecordsText(records, { labelOf: x => x, gapOf: () => 'Original gap', engineStatusLabel: () => 'weak', engineStatusOf: () => 'weak' });

test('provenance: ID alone, whitespace, version-only, locator-only and complete citation have explicit boundaries', () => {
  for (const sourceVersion of ['', '  ', 'v1']) for (const sourceLocator of ['', '  ', 'p2']) {
    const rec = { ...fixture, sourceVersion, sourceLocator };
    const warning = provenanceText(rec);
    if (!sourceVersion.trim() || !sourceLocator.trim()) {
      assert.match(warning, /Incomplete provenance/);
      if (!sourceVersion.trim()) assert.match(warning, /source version/);
      if (!sourceLocator.trim()) assert.match(warning, /source locator/);
      assert.match(warning, /source ID is not verification/);
    } else assert.match(warning, /not verified by this page/);
  }
  const records = createReviewRecords(); Object.assign(ensureEntry(records, 'sg_unevidenced').draft, fixture, { sourceVersion: '', sourceLocator: '' });
  assert.equal(confirmPartial(records, 'sg_unevidenced', 'weak', 'T0'), true, 'allow existing manual confirmation without inventing verification');
  assert.match(text(records), /Incomplete provenance/);
});

test('failed and successful access preserve confirmed history, partial state, counterevidence, engine and citation history', () => {
  const state = initialState('CF-002', 'comprehensive'); state.evidence.sg_unevidenced = 'weak';
  const baseline = buildAssessment(state); const records = createReviewRecords();
  const entry = ensureEntry(records, 'sg_unevidenced'); Object.assign(entry.draft, fixture);
  confirmPartial(records, 'sg_unevidenced', 'weak', 'HISTORICAL-CONFIRM');
  const confirmed = structuredClone(entry.confirmed);
  assert.match(accessObservationText(entry), /not checked/);
  assert.equal(recordAccessObservation(records, 'sg_unevidenced', { result: 'unavailable', observedAt: '' }), false);
  for (const result of ['unavailable', 'opened']) {
    assert.equal(recordAccessObservation(records, 'sg_unevidenced', { result, observedAt: '2026-10-31', note: 'Reported manually' }, 'ACCESS-RECORDED'), true);
    assert.deepEqual(entry.confirmed, confirmed);
    assert.equal(reviewState(records, 'sg_unevidenced', 'weak').validity, 'current');
    assert.deepEqual(buildAssessment(state), baseline);
  }
  assert.match(text(records), /Historical owner review date.*2026-10-23/);
  assert.match(text(records), /Prior reported access: Could not open/);
  assert.match(text(records), /Latest reported access: Opened/);
  assert.match(text(records), /Counterevidence recorded/);
  noteDraftEdit(records, 'sg_unevidenced', 'sourceVersion', 'v2');
  assert.match(accessObservationText(entry), /Current draft reference: not checked/);
  assert.match(accessObservationText(entry), /SYNTHETIC-01 · v1 · p2/);
  assert.equal(reviewState(records, 'sg_unevidenced', 'weak').validity, 'stale');
});

test('whole case: every open Critical is in the overview across tiers, samples and mixed statuses; no judgement mutation', () => {
  const all = blankState('comprehensive'); all.triggers = RULES.map(q => q.id);
  const states = [all, ...CASE_ORDER.map(id => initialState(id, 'comprehensive'))];
  for (const state of states) for (const tier of ['simple', 'comprehensive']) {
    state.tier = tier;
    for (const statuses of [['outstanding'], ['weak', 'reply_only', 'supports', 'outstanding']]) {
      state.evidence = Object.fromEntries(state.triggers.map((id, i) => [id, statuses[i % statuses.length]]));
      const before = structuredClone(state); const assessment = buildAssessment(state); const report = buildReport(assessment, tier);
      const view = buildOverview(assessment, report, state.evidence);
      const expected = report.sections.find(s => s.id === 'questions').items.filter(q => q.priority === 'Critical' && (tier === 'simple' || state.evidence[q.id] !== 'supports'));
      assert.deepEqual(new Set(view.issues.filter(q => q.priority === 'Critical').map(q => q.id)), new Set(expected.map(q => q.id)));
      assert.deepEqual(state, before);
      assert.deepEqual(buildAssessment(state), assessment);
      if (state === all && statuses.length === 1) assert.ok(expected.length > 3);
    }
  }
});

let JSDOM; try { ({ JSDOM } = await import(process.env.CF_JSDOM_MODULE || 'jsdom')); } catch {}
(JSDOM ? test : test.skip)('mounted UI: provenance, manual access, historical date, copy and all Critical rows survive tier switch', async () => {
  const html = await readFile(new URL('../preview/credit-framework.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.test/preview/credit-framework.html', pretendToBeVisual: true });
  const { window } = dom; window.matchMedia = () => ({ matches: false }); window.HTMLElement.prototype.scrollIntoView = function () {};
  for (const key of ['window', 'document', 'Node', 'location']) globalThis[key] = window[key];
  await import('../assets/js/preview/credit-framework/app.js');
  const $ = x => document.querySelector(x);
  const enter = (selector, value, event = 'input') => { const c = $(selector); assert.ok(c, selector); c.value = value; c.dispatchEvent(new window.Event(event, { bubbles: true })); };
  $('#case-picker [data-case="CF-002"]').click();
  $('#tier-output [data-tier="comprehensive"]').click();
  $('[data-open-review="sg_unevidenced"]').click();
  for (const [key, value] of Object.entries(fixture)) enter(`#review-${key}-sg_unevidenced`, value);
  enter('#review-sourceVersion-sg_unevidenced', ''); enter('#review-sourceLocator-sg_unevidenced', '');
  assert.match($('[data-draft-provenance="sg_unevidenced"]').textContent, /Incomplete provenance/);
  $('[data-confirm-review="sg_unevidenced"]').click();
  const original = $('[data-review-record="sg_unevidenced"]').textContent;
  assert.match(original, /Historical owner review date.*2026-10-23/);
  $('[data-open-review="sg_unevidenced"]').click();
  enter('#access-result-sg_unevidenced', 'unavailable', 'change'); enter('#access-observedAt-sg_unevidenced', '2026-10-31');
  $('[data-record-access="sg_unevidenced"]').click();
  const updated = $('[data-review-record="sg_unevidenced"]').textContent;
  assert.match(updated, /Could not open/); assert.match(updated, /Historical judgement/); assert.match(updated, /Historical owner review date.*2026-10-23/);
  assert.match(updated, /Incomplete provenance/);
  document.execCommand = () => true; $('#copy-btn').click();
  assert.match($('#copy-buffer').value, /Could not open/);
  for (const tier of ['simple', 'comprehensive']) {
    $(`#tier-output [data-tier="${tier}"]`).click();
    assert.match($('[data-review-record="sg_unevidenced"]').textContent, /Could not open/);
    const critical = [...document.querySelectorAll('#sec-questions .prio.Critical')];
    assert.ok(critical.length > 3);
    assert.equal(document.querySelectorAll('#review-overview .priority-issue .prio.Critical').length, critical.length);
  }
  dom.window.close();
});

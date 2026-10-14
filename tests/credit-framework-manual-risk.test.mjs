import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RULES, initialState, buildAssessment, buildReport, reportToPlainText } from '../assets/js/preview/credit-framework/engine.js';
import { RISK_AREAS, createRiskView, syncRiskInputs, validateRiskDraft, confirmRiskArea, clearRiskArea, riskAreaState, riskViewText } from '../assets/js/preview/credit-framework/manual-risk-view.js';

test('manual areas cover all existing triggers exactly once; no weights or inferred ratings', () => {
  const ids = RISK_AREAS.flatMap(a => a.triggers);
  assert.equal(RISK_AREAS.length, 4); assert.equal(ids.length, 16);
  assert.equal(new Set(ids).size, 16);
  assert.deepEqual([...ids].sort(), RULES.map(r => r.id).sort());
  const view = createRiskView();
  for (const area of RISK_AREAS) assert.equal(riskAreaState(view, area.id).colour, 'not_assessed');
  assert.match(riskViewText(view), /Risk view entered by you/);
  assert.doesNotMatch(riskViewText(view), /\d+%|overall score/i);
});

test('manual colours require trimmed basis and Red proposed next step before confirmation', () => {
  for (const rating of ['green', 'amber', 'red']) {
    const view = createRiskView(); const entry = view.entries.purpose;
    entry.draft.rating = rating; entry.draft.basis = ' \n ';
    assert.equal(confirmRiskArea(view, 'purpose'), false);
    assert.equal(riskAreaState(view, 'purpose').colour, 'not_assessed');
    entry.draft.basis = ' Evidence checked by me. ';
    if (rating === 'red') {
      entry.draft.nextStep = '  ';
      assert.equal(confirmRiskArea(view, 'purpose'), false);
      entry.draft.nextStep = ' Request revised breakdown. ';
    }
    assert.equal(confirmRiskArea(view, 'purpose'), true);
    assert.equal(entry.confirmed.basis, 'Evidence checked by me.');
    assert.equal(riskAreaState(view, 'purpose').colour, rating);
  }
  assert.match(validateRiskDraft({ rating: 'blue', basis: '', nextStep: '' }), /listed views/);
});

test('stale revisions remain gray after inputs are reverted and preserve previous notes', () => {
  const view = createRiskView(); syncRiskInputs(view, { amount: 100 });
  view.entries.cashflow.draft = { rating: 'red', basis: 'Cover not established.', nextStep: 'Request updated servicing.' };
  confirmRiskArea(view, 'cashflow');
  syncRiskInputs(view, { amount: 101 }); syncRiskInputs(view, { amount: 100 });
  let area = riskAreaState(view, 'cashflow');
  assert.equal(area.stale, true); assert.equal(area.colour, 'not_assessed');
  assert.match(area.label, /Review required — previous Red/);
  assert.match(riskViewText(view), /Previous confirmed basis: Cover not established/);
  assert.match(riskViewText(view), /Previous confirmed proposed mitigation/);
  confirmRiskArea(view, 'cashflow'); area = riskAreaState(view, 'cashflow');
  assert.equal(area.stale, false); assert.equal(area.colour, 'red');
});

test('draft edits gray an earlier view; copy distinguishes confirmed and unconfirmed text', () => {
  const view = createRiskView(); view.entries.security.draft = { rating: 'green', basis: 'Title reviewed.', nextStep: '' };
  confirmRiskArea(view, 'security'); view.entries.security.draft.basis = 'Rechecking title.';
  assert.equal(riskAreaState(view, 'security').colour, 'not_assessed');
  const text = riskViewText(view);
  assert.match(text, /Draft changes — not confirmed/);
  assert.match(text, /Previous confirmed basis: Title reviewed/);
  assert.match(text, /Draft basis: Rechecking title/);
  clearRiskArea(view, 'security');
  assert.equal(riskAreaState(view, 'security').label, 'Not assessed');
  assert.doesNotMatch(riskViewText(view), /Title reviewed|Rechecking title/);
});

test('manual chart is independent of assessment, rating, confidence and evidence', () => {
  const state = initialState('CF-002', 'comprehensive'); const before = structuredClone(state);
  const assessment = buildAssessment(state); const report = reportToPlainText(buildReport(assessment, state.tier));
  const view = createRiskView(); syncRiskInputs(view, state.intake);
  for (const a of RISK_AREAS) { view.entries[a.id].draft = { rating: 'green', basis: 'My entered view.', nextStep: '' }; confirmRiskArea(view, a.id); }
  assert.deepEqual(state, before); assert.deepEqual(buildAssessment(state), assessment);
  assert.equal(reportToPlainText(buildReport(buildAssessment(state), state.tier)), report);
});

test('manual chart source remains local-only and has SVG labels, text alternative and print styles', async () => {
  const dir = new URL('../assets/js/preview/credit-framework/', import.meta.url);
  for (const file of ['manual-risk-view.js', 'manual-risk-view-ui.js']) {
    const source = await readFile(new URL(file, dir), 'utf8');
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|sendBeacon|innerHTML/);
  }
  const ui = await readFile(new URL('manual-risk-view-ui.js', dir), 'utf8');
  assert.match(ui, /createElementNS/); assert.match(ui, /aria-labelledby/); assert.match(ui, /keydown/);
  const html = await readFile(new URL('../preview/credit-framework.html', import.meta.url), 'utf8');
  assert.match(html, /manual-risk-buttons button,.risk-readouts button\{min-height:44px/);
  assert.match(html, /@media print[\s\S]*manual-risk-view[\s\S]*risk-readouts/);
  const app = await readFile(new URL('app.js', dir), 'utf8');
  assert.ok(app.indexOf('out.append(renderOverview') < app.indexOf('out.append(renderManualRiskView'));
  const version = html.match(/app\.js\?v=([a-z0-9-]+)/)[1];
  for (const module of ['manual-risk-view', 'manual-risk-view-ui']) assert.ok(app.includes(`./${module}.js?v=${version}`));
  assert.ok(ui.includes(`./manual-risk-view.js?v=${version}`));
});

let JSDOM;
try { ({ JSDOM } = await import(process.env.CF_JSDOM_MODULE || 'jsdom')); } catch {}
(JSDOM ? test : test.skip)('mounted manual chart: validation, keyboard/focus, copy, stale changes, tier gates and resets', async () => {
  const dom = new JSDOM(await readFile(new URL('../preview/credit-framework.html', import.meta.url), 'utf8'), { url: 'https://example.test/preview/credit-framework.html', pretendToBeVisual: true });
  const { window } = dom; window.matchMedia = () => ({ matches: false });
  window.HTMLElement.prototype.scrollIntoView = function () {};
  for (const key of ['window', 'document', 'Node', 'location']) globalThis[key] = window[key];
  document.execCommand = () => true;
  await import('../assets/js/preview/credit-framework/app.js');
  const $ = s => document.querySelector(s); const click = s => $(s).click();
  const input = (s, value, type = 'input') => { const f = $(s); f.value = value; f.focus(); f.dispatchEvent(new window.Event(type, { bubbles: true })); };
  const readout = id => $(`[data-risk-readout="${id}"]`);
  const segment = id => $(`[data-risk-segment="${id}"]`);
  const confirm = id => click(`[data-confirm-risk="${id}"]`);
  const core = () => [...document.querySelectorAll('#report > section.out')].map(s => s.textContent).join('\n');
  const copy = () => { click('#copy-btn'); return $('#copy-buffer').value; };
  assert.equal(document.querySelectorAll('[data-risk-segment]').length, 4);
  assert.equal(new Set([...document.querySelectorAll('.risk-fill')].map(p => p.getAttribute('d'))).size, 4);
  assert.match($('#risk-svg-desc').textContent, /Equal sizes do not represent proportions/);
  for (const id of ['CF-001', 'CF-002', 'CF-004', 'custom']) {
    click(`#case-picker [data-case="${id}"]`);
    for (const area of RISK_AREAS) assert.equal(segment(area.id).dataset.colour, 'not_assessed');
  }
  click('#tier-output [data-tier="comprehensive"]');
  segment('purpose').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal($('#risk-editor-purpose').open, true); assert.equal(document.activeElement.id, 'risk-rating-purpose');
  const before = core(); const ratingBefore = $('#f-rating').value;
  input('#risk-rating-purpose', 'green', 'change'); confirm('purpose');
  assert.match($('#risk-error-purpose').textContent, /brief basis/); assert.equal(document.activeElement.id, 'risk-error-purpose');
  input('#risk-basis-purpose', 'Purpose supported by reviewed breakdown.');
  assert.equal(document.activeElement.id, 'risk-basis-purpose');
  assert.equal(segment('purpose').dataset.colour, 'not_assessed');
  confirm('purpose'); assert.equal(segment('purpose').dataset.colour, 'green');
  assert.equal(core(), before); assert.equal($('#f-rating').value, ratingBefore);
  click('[data-edit-risk="cashflow"]'); input('#risk-rating-cashflow', 'red', 'change');
  input('#risk-basis-cashflow', 'Cover needs further work.'); confirm('cashflow');
  assert.match($('#risk-error-cashflow').textContent, /proposed mitigation/);
  input('#risk-next-cashflow', 'Request revised servicing.'); confirm('cashflow');
  assert.equal(segment('cashflow').dataset.colour, 'red');
  assert.match(copy(), /Risk view entered by you[\s\S]*Cover needs further work[\s\S]*not verified.*Request revised servicing/);
  // Multiple opened native details must not hide the field being edited.
  $('#risk-editor-purpose').open = true; $('#risk-editor-cashflow').open = true;
  $('#risk-editor-cashflow').dispatchEvent(new window.Event('toggle'));
  input('#risk-basis-purpose', 'Rechecked use of funds.');
  assert.equal($('#risk-editor-purpose').open, true); assert.equal(document.activeElement.id, 'risk-basis-purpose');
  assert.equal(segment('purpose').dataset.colour, 'not_assessed');
  assert.match(readout('purpose').textContent, /Draft changes — not confirmed/); confirm('purpose');
  const composing = $('#risk-basis-purpose'); composing.focus();
  composing.dispatchEvent(new window.CompositionEvent('compositionstart', { bubbles: true }));
  composing.value = '用途依据';
  composing.dispatchEvent(new window.InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', isComposing: true, data: '据' }));
  assert.equal($('#risk-basis-purpose'), composing, 'IME target remains the same DOM node');
  assert.equal(document.activeElement, composing); assert.equal($('#risk-editor-purpose').open, true);
  assert.equal(segment('purpose').dataset.colour, 'not_assessed');
  composing.dispatchEvent(new window.CompositionEvent('compositionend', { bubbles: true, data: '用途依据' }));
  assert.equal($('#risk-basis-purpose'), composing);
  input('#risk-basis-purpose', 'Rechecked use of funds.'); confirm('purpose');
  // Tier-only/navigation changes preserve the manual view, with no premium data.
  click('#tier-output [data-tier="simple"]');
  assert.equal(segment('purpose').dataset.colour, 'green'); assert.equal(segment('cashflow').dataset.colour, 'red');
  assert.equal($('.overview-rerate'), null);
  assert.doesNotMatch($('#manual-risk-view').textContent, /Client reply only|Reviewed evidence — supports/);
  assert.match(copy(), /Risk view entered by you/);
  assert.doesNotMatch(copy(), /Reviewed evidence — supports|Rating movement:|Custom-scenario guardrail:/);
  assert.match(copy(), /Re-rate tracker — \[LOCKED: Comprehensive only\]/);
  click('#tier-output [data-tier="comprehensive"]');
  const mutations = [
    () => input('#f-scenario', 'Synthetic scenario update.'),
    () => click('[data-preset-field="purpose"][data-preset="working_capital"]'),
    () => click('[data-preset-field="purpose"][data-preset="other"]'),
    () => input('#f-purpose', 'Other purpose detail.'),
    () => input('#f-loanAmount', '1,50'), // invalid draft, even when numerical value remains blank
    () => input('#f-loanAmount', '1,5'),
    () => click('#t-ato_debt'),
    () => click('#d-ato_position'),
    () => input('[data-rerate="ato_debt"]', 'supports', 'change'),
    () => input('#f-rating', 'Black — Do Not Proceed', 'change'),
  ];
  for (const mutate of mutations) {
    confirm('purpose'); assert.equal(segment('purpose').dataset.colour, 'green');
    mutate(); assert.equal(segment('purpose').dataset.colour, 'not_assessed');
    assert.match(readout('purpose').textContent, /Review required — previous Green/);
    assert.match(copy(), /Review required — previous Green[\s\S]*Previous confirmed basis: Rechecked use of funds/);
  }
  assert.equal($('.overview-action').querySelector('button').dataset.openSection, 'rating');
  assert.ok($('#review-overview').compareDocumentPosition($('#manual-risk-view')) & window.Node.DOCUMENT_POSITION_FOLLOWING);
  const textAlternative = $('.risk-readouts');
  assert.equal(textAlternative.closest('.no-print'), null); assert.match(textAlternative.textContent, /Review required/);
  assert.ok($('#risk-editor-purpose').closest('.no-print'));
  click('[data-clear-risk="purpose"]'); assert.match(readout('purpose').textContent, /Not assessed/);
  assert.doesNotMatch(readout('purpose').textContent, /Rechecked use/);
  for (const id of ['CF-001', 'custom']) {
    click(`#case-picker [data-case="${id}"]`);
    for (const area of RISK_AREAS) assert.equal(segment(area.id).dataset.colour, 'not_assessed');
    assert.doesNotMatch(copy(), /Cover needs further work|Rechecked use of funds/);
  }
  dom.window.close();
});

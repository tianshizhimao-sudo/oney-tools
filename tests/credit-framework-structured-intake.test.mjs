// No application dependencies. DOM test uses an optional existing jsdom installation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { INTAKE_PRESETS, TRIGGER_GROUPS, composeIntakeValue } from '../assets/js/preview/credit-framework/intake-options.js';
import { RULES, initialState, blankState, buildAssessment, suggestTriggers, lintCompliance } from '../assets/js/preview/credit-framework/engine.js';

test('risk categories cover each original trigger exactly once without modifying rules', () => {
  const ids = TRIGGER_GROUPS.flatMap(group => group.rules);
  assert.equal(TRIGGER_GROUPS.length, 6);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), RULES.map(rule => rule.id).sort());
  assert.ok(TRIGGER_GROUPS.every(group => group.label && group.hint));
});

test('quick choices preserve manual narrative exactly, including Unknown and Other', () => {
  const manual = '  Existing detail.\nDo not lose this narrative.  ';
  for (const [key, config] of Object.entries(INTAKE_PRESETS)) {
    assert.equal(composeIntakeValue(key, manual, []), manual);
    assert.equal(composeIntakeValue(key, manual, ['unknown']), manual);
    assert.equal(composeIntakeValue(key, manual, ['other']), manual);
    const selected = composeIntakeValue(key, manual, [config.options[0].id]);
    assert.ok(selected.startsWith(manual + '\n'));
    assert.match(selected, /Broker-selected options \(unverified\):/);
    assert.equal(composeIntakeValue(key, manual, []), manual);
    assert.equal(composeIntakeValue(key, '', ['unknown']), '');
  }
});

test('presets feed only the existing parser and do not invent safe/verified findings', () => {
  const cases = [
    ['purpose', 'working_capital', 'working_capital_vague'],
    ['purpose', 'contract', 'contract_growth'],
    ['security', 'commercial', 'zoning_environmental_missing'],
    ['security', 'related', 'related_party_security'],
    ['existingDebts', 'mca', 'mca_present'],
    ['existingDebts', 'ato', 'ato_debt'],
    ['conduct', 'dishonours', 'dishonours_recent'],
    ['conduct', 'suppliers', 'supplier_arrears'],
    ['conduct', 'ato_missed', 'missed_ato_plan'],
    ['conduct', 'sg', 'sg_unevidenced'],
    ['income', 'turnaround', 'turnaround_claim'],
    ['income', 'lost_customer', 'turnaround_claim'],
  ];
  for (const [key, id, expected] of cases) {
    const state = blankState(); state.intake[key] = composeIntakeValue(key, '', [id]);
    assert.ok(suggestTriggers(state.intake).some(rule => rule.id === expected), `${key}/${id}`);
    assert.deepEqual(state.triggers, [], 'a preset never selects a trigger');
  }
  for (const [key, config] of Object.entries(INTAKE_PRESETS)) {
    assert.ok(!config.options.some(option => /\bnone\b|no concerns|no debt|verified evidence/i.test(option.label)));
    for (const option of config.options) assert.equal(lintCompliance(option.text).ok, true);
    assert.deepEqual(suggestTriggers({ [key]: composeIntakeValue(key, '', ['unknown']) }), []);
  }
});

test('availability choices do not create evidence-review status or numeric amounts', () => {
  const state = blankState('comprehensive'); state.triggers = ['valuation_sensitive'];
  state.intake.documents = composeIntakeValue('documents', '', INTAKE_PRESETS.documents.options.map(x => x.id));
  const a = buildAssessment(state);
  assert.deepEqual(state.evidence, {});
  assert.equal(state.intake.loanAmount, ''); assert.equal(state.intake.securityValue, '');
  assert.equal(a.rerate.movement, 'unchanged'); assert.equal(a.rerate.confidence, 'Medium');
  assert.match(a.rerate.reasons.join(' '), /not yet proven/);
});

test('changed sample choices withdraw sample judgement and preserve no-auto-upgrade', () => {
  const state = initialState('CF-004', 'comprehensive');
  const old = structuredClone(state.intake);
  state.edited = true; state.intake.purpose = composeIntakeValue('purpose', old.purpose, ['refinance']);
  state.evidence = Object.fromEntries(state.triggers.map(id => [id, 'supports']));
  const a = buildAssessment(state);
  assert.equal(a.pristine, false); assert.equal(a.rerate.movement, 'unchanged'); assert.equal(a.rerate.to, 'amber');
  assert.equal(a.rerate.upwardBlocked, true);
  for (const key of ['loanAmount', 'securityValue', 'totalSecuredDebt']) assert.equal(state.intake[key], old[key]);
});

let JSDOM;
try { ({ JSDOM } = await import(process.env.CF_JSDOM_MODULE || 'jsdom')); } catch {}
(JSDOM ? test : test.skip)('mounted choices/categories: preservation, exclusivity, explicit trigger selection, reset and gating', async () => {
  const dom = new JSDOM(await readFile(new URL('../preview/credit-framework.html', import.meta.url), 'utf8'), { url: 'https://example.test/preview/credit-framework.html', pretendToBeVisual: true });
  const { window } = dom; window.matchMedia = () => ({ matches: true });
  window.HTMLElement.prototype.scrollIntoView = function () {};
  for (const key of ['window', 'document', 'Node', 'location']) globalThis[key] = window[key];
  await import('../assets/js/preview/credit-framework/app.js');
  const $ = s => document.querySelector(s); const click = s => $(s).click();
  const choice = (key, id) => `[data-preset-field="${key}"][data-preset="${id}"]`;
  assert.equal(document.body.dataset.pristine, 'true');
  assert.equal(document.querySelectorAll('.risk-group').length, 6);
  assert.ok([...document.querySelectorAll('.risk-group')].every(group => !group.open));
  assert.match($('#selected-risk-summary').textContent, /7 triggers selected/);
  click('[data-review-trigger="ato_debt"]');
  assert.equal($('#risk-group-tax').open, true); assert.equal(document.activeElement.id, 't-ato_debt');
  const original = $('#f-purpose').value; const amount = $('#f-loanAmount').value;
  click(choice('purpose', 'refinance'));
  assert.equal($('[data-structured-field="purpose"] .preset-review-note').hidden, false);
  assert.equal($('#f-purpose').value, original); assert.equal($('#f-loanAmount').value, amount);
  assert.equal(document.body.dataset.pristine, 'false');
  assert.match($('#sec-snapshot').textContent, /Broker-selected options \(unverified\)/);
  click(choice('purpose', 'unknown'));
  assert.equal($(choice('purpose', 'refinance')).getAttribute('aria-pressed'), 'false');
  assert.equal($(choice('purpose', 'unknown')).getAttribute('aria-pressed'), 'true');
  assert.equal($('#f-purpose').value, original);
  assert.doesNotMatch($('#sec-snapshot').textContent, /Broker-selected options \(unverified\)/);
  assert.equal($('[data-structured-field="purpose"] .preset-review-note').hidden, true);
  click(choice('purpose', 'working_capital'));
  assert.equal($(choice('purpose', 'unknown')).getAttribute('aria-pressed'), 'false');
  click(choice('purpose', 'other')); assert.equal($('#f-purpose').closest('details').open, true);
  assert.equal(document.activeElement.id, 'f-purpose');
  const narrative = original + '\nKeep my extra sentence.';
  $('#f-purpose').value = narrative; $('#f-purpose').dispatchEvent(new window.Event('input', { bubbles: true }));
  click(choice('purpose', 'working_capital')); assert.equal($('#f-purpose').value, narrative);
  click('#tier-output [data-tier="comprehensive"]'); assert.equal($('#f-purpose').value, narrative);
  assert.equal($(choice('purpose', 'other')).getAttribute('aria-pressed'), 'true');
  click('#case-picker [data-case="custom"]');
  assert.equal($('#f-purpose').value, ''); assert.equal($('#f-loanAmount').value, '');
  assert.match($('#selected-risk-summary').textContent, /None selected yet.*does not mean there are no risks/);
  click(choice('existingDebts', 'mca'));
  assert.equal($('#t-mca_present').checked, false);
  assert.match($('[data-group-count="cashflow"]').textContent, /0 selected · 1 suggested/);
  assert.equal($('#risk-group-cashflow').open, false);
  click('#apply-suggestions'); assert.equal($('#t-mca_present').checked, true);
  assert.match($('#selected-risk-summary').textContent, /1 trigger selected/);
  click('[data-review-trigger="mca_present"]'); assert.equal($('#risk-group-cashflow').open, true);
  click(choice('documents', 'statements'));
  assert.equal($('[data-rerate="mca_present"]').value, 'outstanding');
  assert.equal(document.body.dataset.lint, 'pass');
  click('#tier-output [data-tier="simple"]');
  assert.equal(document.querySelector('.overview-rerate'), null);
  click('#case-picker [data-case="CF-004"]');
  assert.equal(document.body.dataset.pristine, 'true');
  assert.ok([...document.querySelectorAll('[data-preset][aria-pressed="true"]')].length === 0);
  dom.window.close();
});

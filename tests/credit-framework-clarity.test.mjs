// Presentation regression tests. No dependencies. Run: node --test tests/credit-framework-clarity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, blankState, buildAssessment, buildReport, reportToPlainText, calculations, CASE_ORDER, EVIDENCE_STATUS, RULES, lintCompliance } from '../assets/js/preview/credit-framework/engine.js';
import { parseMoneyInput, formatMoneyEdit, deleteMoneySeparator } from '../assets/js/preview/credit-framework/money-input.js';
import { buildOverview } from '../assets/js/preview/credit-framework/overview.js';
const overview = (s) => { const a = buildAssessment(s); return buildOverview(a, buildReport(a, s.tier), s.evidence); };

test('amounts: commas, currency paste, whitespace, blanks, zero and unrounded decimals', () => {
  for (const [text, number, formatted] of [
    ['', '', ''], ['  ', '', ''], ['0', 0, '0'], ['1000', 1000, '1,000'], ['1234567.89', 1234567.89, '1,234,567.89'],
    ['1,234,567.89', 1234567.89, '1,234,567.89'], ['$ 1,000.50 ', 1000.5, '1,000.50'], ['.5', .5, '.5'], ['1000.', 1000, '1,000.'], ['000.00', 0, '000.00'], ['1234.5678', 1234.5678, '1,234.5678'],
  ]) {
    assert.deepEqual(parseMoneyInput(text), { valid: true, value: number }, text);
    const edit = formatMoneyEdit(text, text.length, text.length, { paste: true });
    assert.equal(edit.valid, true, text); assert.equal(edit.text, formatted, text); assert.equal(edit.value, number, text);
  }
  for (const text of ['$', '1,50', '12,34.50', '1,,000', '1.000,50', '1 000', 'abc', '1e6', '-100', 'Infinity', '.', '1.2.3', '9007199254740993']) {
    assert.equal(parseMoneyInput(text).valid, false, text);
    const result = formatMoneyEdit(text, text.length, text.length, { paste: true });
    assert.equal(result.valid, false, text); assert.equal(result.value, '', text); assert.equal(result.text, text, 'invalid text remains visible');
  }
});

test('amount editing: digit grouping, middle caret, selection and separator deletion', () => {
  assert.deepEqual(formatMoneyEdit('1000', 4), { valid: true, value: 1000, text: '1,000', start: 5, end: 5 });
  assert.deepEqual(formatMoneyEdit('12,34', 3), { valid: true, value: 1234, text: '1,234', start: 3, end: 3 });
  const selection = formatMoneyEdit('1234567.50', 2, 6);
  assert.equal(selection.text, '1,234,567.50'); assert.equal(selection.start, 3); assert.equal(selection.end, 8);
  const back = deleteMoneySeparator('12,345', 3, 3, 'deleteContentBackward');
  assert.deepEqual(back, { text: '1345', caret: 1 }); assert.equal(formatMoneyEdit(back.text, back.caret).text, '1,345');
  const forward = deleteMoneySeparator('12,345', 2, 2, 'deleteContentForward');
  assert.deepEqual(forward, { text: '1245', caret: 2 }); assert.equal(formatMoneyEdit(forward.text, forward.caret).text, '1,245');
  assert.equal(deleteMoneySeparator('1,000', 1, 3, 'deleteContentBackward'), null);
  assert.equal(formatMoneyEdit('0', 1).value, 0); assert.equal(formatMoneyEdit('', 0).value, '');
});

test('comma display preserves numerical calculations and pristine sample judgement', () => {
  for (const id of CASE_ORDER) {
    const s = initialState(id);
    const before = buildAssessment(s);
    for (const key of ['loanAmount', 'securityValue', 'totalSecuredDebt']) s.intake[key] = parseMoneyInput(formatMoneyEdit(s.intake[key]).text).value;
    assert.deepEqual(buildAssessment(s), before, id);
  }
  for (const intake of [{ securityValue: 1200000.5, totalSecuredDebt: 840000.25 }, { securityValue: 100, totalSecuredDebt: 0 }, { securityValue: '', totalSecuredDebt: 0 }]) {
    const values = Object.fromEntries(Object.entries(intake).map(([key, value]) => [key, parseMoneyInput(formatMoneyEdit(value).text).value]));
    assert.deepEqual(calculations(values), calculations(intake));
  }
});

test('blank overview communicates uncertainty and does not claim safety', () => {
  for (const tier of ['simple', 'comprehensive']) {
    const v = overview(blankState(tier));
    assert.equal(v.empty, true); assert.equal(v.total, 0); assert.equal(v.criticalTotal, 0);
    assert.match(v.emptyText, /No triggers selected.*have not been assessed/);
    assert.equal(v.ratingSource, 'Current input rating (manual)');
    assert.match(v.nextStep, /^Confirm the triggers/);
    assert.match(v.evidenceScope, /not confirmed missing documents/);
    assert.doesNotMatch(v.emptyText, /no risks|no blockers|safe|ready to submit/i);
  }
});

test('overview uses exact rule question/evidence/why and discloses limited selection', () => {
  for (const id of CASE_ORDER) for (const tier of ['simple', 'comprehensive']) {
    const s = initialState(id, tier); const v = overview(s);
    const r = buildReport(buildAssessment(s), tier); const qs = r.sections.find(x => x.id === 'questions').items;
    assert.equal(v.criticalTotal, qs.filter(x => x.priority === 'Critical').length);
    assert.equal(v.criticalOpen, v.criticalTotal);
    assert.equal(v.first.question, qs[0].question); assert.deepEqual(v.first.evidence, qs[0].evidence);
    assert.equal(v.first.whyItMatters, qs[0].whyItMatters);
    assert.match(v.scope, /potential issues.*not verified/);
    assert.match(v.evidenceScope, /does not update/);
    assert.equal(lintCompliance(JSON.stringify(v)).ok, true);
    if (tier === 'simple') {
      assert.equal(v.reRate, null);
      assert.ok(v.issues.every(q => !('clientWording' in q) && !('owner' in q) && !('ifWeak' in q)));
    }
  }
  const s = blankState(); s.intake.conduct = 'ATO debt outstanding';
  assert.ok(overview(s).suggestions.length > 0); assert.equal(overview(s).empty, true);
});

test('Comprehensive counts review statuses, never treats a reply as supporting', () => {
  const s = initialState('CF-002', 'comprehensive');
  for (const status of Object.keys(EVIDENCE_STATUS)) {
    s.evidence = Object.fromEntries(s.triggers.map(id => [id, status]));
    const v = overview(s);
    assert.equal(v.reviewCounts[status], s.triggers.length);
    assert.equal(v.criticalOpen, status === 'supports' ? 0 : v.criticalTotal);
    if (status === 'supports') assert.match(v.emptyText, /does not establish overall readiness/);
  }
  s.evidence = Object.fromEntries(s.triggers.map(id => [id, 'supports']));
  s.evidence.sg_unevidenced = 'weak';
  const v = overview(s);
  assert.equal(v.first.id, 'sg_unevidenced'); assert.equal(v.first.status, 'weak');
  assert.equal(v.reRate.confidence, 'Low'); assert.equal(v.criticalOpen, 1);
  // Switching to Simple does not leak the Comprehensive evidence re-rate.
  s.tier = 'simple'; const simple = overview(s);
  assert.equal(simple.reRate, null); assert.equal(simple.criticalOpen, simple.criticalTotal);
});

test('custom all-supported overview preserves manual rating, Medium cap and banker-review guardrail', () => {
  const s = blankState('comprehensive'); s.triggers = ['valuation_sensitive'];
  s.evidence.valuation_sensitive = 'supports';
  const v = overview(s);
  assert.equal(v.rating.text, s.rating); assert.equal(v.reRate.to, 'amber'); assert.equal(v.reRate.movement, 'unchanged');
  assert.equal(v.reRate.confidence, 'Medium'); assert.equal(v.reRate.upwardBlocked, true);
  assert.match(v.nextStep, /Book banker review/); assert.ok(v.reRate.customGuardrail);
  s.rating = 'Black — Do Not Proceed'; s.evidence = {};
  assert.match(overview(s).nextStep, /Do not proceed.*refer or pause/);
  s.tier = 'simple'; assert.match(overview(s).nextStep, /Do not proceed.*refer or pause/);
});

test('lender deferrals take overview precedence with absent or unrelated triggers, respecting tier gates and Black pause', () => {
  for (const tier of ['simple', 'comprehensive']) for (const triggers of [[], ['valuation_sensitive']]) {
    const s = blankState(tier); s.intake.deferralCodes = ['ato_position']; s.triggers = triggers;
    const before = structuredClone(s); const a = buildAssessment(s); const v = overview(s);
    assert.equal(v.deferralCount, 1);
    assert.match(v.nextStep, /deferral recovery plan/);
    assert.doesNotMatch(v.nextStep, /Confirm the triggers|Ask the client about Valuation/);
    if (tier === 'comprehensive') assert.deepEqual(v.deferral, a.deferral.plan);
    else {
      assert.equal(v.deferral, null); assert.equal(v.reRate, null);
      assert.match(v.nextStep, /Switch to Comprehensive/);
      assert.doesNotMatch(JSON.stringify(v), /ATO integrated client account|exact documents credit asked for|collectFirst|lenderTesting/);
    }
    assert.deepEqual(s, before, 'presentation does not select linked triggers or change evidence');
    assert.equal(lintCompliance(JSON.stringify(v)).ok, true);
    s.rating = 'Black — Do Not Proceed';
    assert.equal(overview(s).nextStep, buildAssessment(s).rating.action);
    assert.equal(overview(s).pauseFirst, true);
  }
});

test('deferral overview copies existing worst status and custom/sample guardrails without recalculation', () => {
  const s = blankState('comprehensive');
  s.triggers = ['valuation_sensitive', 'ato_debt'];
  s.intake.deferralCodes = ['valuation_shortfall', 'ato_position'];
  for (const [status, expected] of [['outstanding', 'rework'], ['reply_only', 'rework'], ['supports', 'banker_review'], ['weak', 'pause']]) {
    s.evidence = { valuation_sensitive: 'supports', ato_debt: status };
    const v = overview(s);
    assert.equal(v.deferral.overall, expected);
    assert.deepEqual(v.deferral, buildAssessment(s).deferral.plan);
    assert.match(v.nextStep, /deferral recovery plan/);
    assert.equal(v.rating.text, s.rating);
  }
  const sample = initialState('CF-002', 'comprehensive'); sample.intake.deferralCodes = ['ato_position'];
  sample.evidence = { ato_debt: 'supports', missed_ato_plan: 'supports', sg_unevidenced: 'supports' };
  assert.equal(overview(sample).deferral.overall, 'resubmit');
  sample.rating = 'Black — Do Not Proceed';
  assert.match(overview(sample).nextStep, /Do not proceed/);
});

test('new modules remain local-only and the overview is inserted before detail sections', async () => {
  const dir = new URL('../assets/js/preview/credit-framework/', import.meta.url);
  for (const file of ['money-input.js', 'overview.js']) {
    const source = await readFile(new URL(file, dir), 'utf8');
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|sendBeacon/);
  }
  const app = await readFile(new URL('app.js', dir), 'utf8');
  assert.ok(app.indexOf('out.append(renderOverview') < app.indexOf('for (const s of report.sections)'));
  assert.match(app, /type: 'text', inputmode: 'decimal'/);
  assert.match(app, /Invalid entries are treated as not provided/);
  const html = await readFile(new URL('../preview/credit-framework.html', import.meta.url), 'utf8');
  assert.match(html, /src="\/assets\/js\/preview\/credit-framework\/app\.js\?v=[a-z0-9-]+"/, 'entry script is versioned for static-host cache refresh');
  const version = html.match(/app\.js\?v=([a-z0-9-]+)/)[1];
  assert.ok(app.includes(`from './overview.js?v=${version}'`), 'changed overview dependency and app entry share release cache version');
  assert.ok(app.includes(`from './engine.js?v=${version}'`), 'changed report-label module is also versioned');
  const viewSource = await readFile(new URL('overview.js', dir), 'utf8');
  assert.ok(viewSource.includes(`from './engine.js?v=${version}'`), 'overview shares the same engine module URL');
});

test('Banker Review labels and text export omit the personal name while remaining inactive', () => {
  for (const tier of ['simple', 'comprehensive']) for (const state of [blankState(tier), ...CASE_ORDER.map(id => initialState(id, tier))]) {
    const report = buildReport(buildAssessment(state), tier);
    assert.equal(report.sections.find(s => s.id === 'cta').title, tier === 'simple' ? 'Upgrade / Banker Review' : 'Banker Review (add-on)');
    const text = reportToPlainText(report);
    assert.doesNotMatch(text, /Banker Review by Dong|Request Dong review/);
    assert.match(text, /Banker Review/);
    assert.match(text, /not active in this prototype/);
  }
});

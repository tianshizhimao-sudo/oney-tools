import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, initialState, buildAssessment, buildReport, RULES, lintCompliance } from '../assets/js/preview/credit-framework/engine.js';
import { buildMaterials, materialKey, createMaterialReceipts, syncMaterialReceipts, applicantMaterials, applicantMaterialsText, brokerMaterialsText } from '../assets/js/preview/credit-framework/materials.js';
const assessment = (ids = []) => { const s = blankState('comprehensive'); s.triggers = ids; return buildAssessment(s); };
test('materials deduplicate exact normalized names and retain highest priority and all reasons', () => {
  const a = assessment(RULES.map(q => q.id));
  const m = buildMaterials(a, 'comprehensive');
  assert.equal(m.items.length, new Set(RULES.flatMap(q => q.evidence.map(materialKey))).size);
  const forecast = m.items.find(i => i.key === 'cash-flow forecast');
  assert.ok(forecast.links.length > 1);
  assert.equal(new Set(forecast.links.map(l => l.id)).size, forecast.links.length);
  const priority = { Critical:0, Important:1, Helpful:2 };
  for (const item of m.items) assert.equal(priority[item.priority], Math.min(...item.links.map(l => priority[RULES.find(q => q.id === l.id).priority])));
});
test('receipt is separate from review, rating, confidence and assessment; unknown status stays unresolved', () => {
  const s = initialState('CF-004', 'comprehensive'); const before = JSON.stringify(s);
  const a = buildAssessment(s); const report = buildReport(a, s.tier);
  const m = buildMaterials(a, s.tier, s.evidence);
  const receipts = new Set(m.items.filter(i => !i.conditional).map(i => i.key));
  const next = buildMaterials(a, s.tier, { ...s.evidence, [s.triggers[0]]:'unsupported' }, receipts);
  assert.ok(next.items.some(i => i.group === 'received'));
  assert.ok(next.items.every(i => !i.verified));
  assert.equal(JSON.stringify(s), before); assert.deepEqual(buildReport(buildAssessment(s), s.tier), report);
  assert.ok(next.items.flatMap(i => i.links).some(l => l.review === 'Not received / not yet reviewed'));
});
test('conditional comes only from existing not-selected suggestions; selected dominates duplicate', () => {
  const a = assessment(['turnaround_claim']);
  a.triggerCheck.notSelected = ['working_capital_vague', 'not-a-rule'];
  const expected = RULES.filter(q => ['turnaround_claim','working_capital_vague'].includes(q.id));
  const m = buildMaterials(a, 'comprehensive', {}, new Set(expected.flatMap(q => q.evidence.map(materialKey))));
  for (const item of m.items) {
    assert.ok(expected.some(q => q.evidence.some(e => materialKey(e) === item.key)));
    if (item.links.every(l => l.conditional)) assert.equal(item.group, 'conditional');
    else assert.equal(item.group, 'received');
  }
});
test('empty, unknown triggers and unrecorded availability never imply completeness', () => {
  const m = buildMaterials(assessment(['not-a-rule']), 'comprehensive');
  assert.equal(m.items.length, 0); assert.equal(m.unknownCount,1);
  assert.match(applicantMaterialsText(m), /does not mean no documents/);
  assert.match(applicantMaterialsText(m), /could not be mapped/);
  assert.match(brokerMaterialsText(m), /unrecognised/);
  const populated = buildMaterials(assessment(['ato_debt']), 'comprehensive');
  assert.ok(populated.items.every(i => i.group === 'needed' && i.receipt.includes('unknown')));
});
test('receipt notes clear irreversibly on input changes and reset, not unchanged render', () => {
  const r = createMaterialReceipts(); syncMaterialReceipts(r,{case:'A',value:1}); r.received.add('a');
  syncMaterialReceipts(r,{case:'A',value:1}); assert.equal(r.received.size,1);
  syncMaterialReceipts(r,{case:'A',value:2}); assert.equal(r.received.size,0); assert.equal(r.resetNotice,true);
  syncMaterialReceipts(r,{case:'A',value:1}); assert.equal(r.received.size,0);
  r.received.add('a'); syncMaterialReceipts(r,{case:'B',value:1}); assert.equal(r.received.size,0);
  assert.equal(createMaterialReceipts().received.size,0);
});
test('Simple keeps tier scope and no applicant projection, copy, review labels or conditional expansion', () => {
  const a = assessment(RULES.map(q => q.id));
  const m = buildMaterials(a,'simple');
  assert.equal(applicantMaterials(m),null); assert.equal(applicantMaterialsText(m),'');
  assert.ok(m.omittedTriggers > 0); assert.ok(m.items.every(i => !i.conditional && i.links.every(l => l.review === null)));
  assert.doesNotMatch(brokerMaterialsText(m),/Trigger review:/);
  for (const item of m.items) assert.ok(a.engine.simple.questions.some(q => q.evidence.some(e => materialKey(e) === item.key)));
});
test('applicant is allowlisted, de-identified, plain-English and compliance-safe for every sample', () => {
  for (const id of ['CF-001','CF-002','CF-004']) {
    const s = initialState(id,'comprehensive'); const a = buildAssessment(s);
    const m = buildMaterials(a,s.tier,s.evidence); const text = applicantMaterialsText(m);
    assert.match(text,new RegExp(id)); assert.match(text,/Requirements vary by lender and case/);
    assert.doesNotMatch(text,/Critical|Important|Helpful|ifWeak|ifStrong|Trigger review|confidence|rating|Green|Amber|Red|Black|whyItMatters/);
    for (const q of a.engine.comprehensive.questions) assert.ok(!text.includes(q.whyItMatters));
    assert.equal(lintCompliance(text).ok,true); assert.equal(lintCompliance(brokerMaterialsText(m)).ok,true);
  }
});

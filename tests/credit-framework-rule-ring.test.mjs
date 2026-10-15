import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState, initialState, CASE_ORDER, RULES, buildAssessment, buildReport, lintCompliance } from '../assets/js/preview/credit-framework/engine.js';
import { buildRuleRing, ruleRingText } from '../assets/js/preview/credit-framework/rule-ring.js';
import { createRiskView, confirmRiskArea } from '../assets/js/preview/credit-framework/manual-risk-view.js';
const model=(state,tier=state.tier)=>buildRuleRing(buildAssessment(state),tier);
test('inner ring shows existing priorities only; no selection or suggestions alone is never green',()=>{
 const s=blankState('comprehensive');s.intake.conduct='ATO debt';let m=model(s);
 assert.ok(m.areas.every(a=>a.colour==='not_assessed'));assert.ok(m.areas.find(a=>a.id==='conduct').unconfirmed.length);assert.match(m.areas.find(a=>a.id==='conduct').indicator,/unconfirmed suggestion/);
 s.triggers=['ato_debt'];m=model(s);const a=m.areas.find(a=>a.id==='conduct');assert.equal(a.colour,'red');assert.match(a.triggers[0].source,/User-selected/);assert.ok(a.triggers[0].reasons.length);
 s.triggers=['contract_growth'];m=model(s);assert.equal(m.areas.find(a=>a.id==='purpose').colour,'amber');assert.match(m.areas.find(a=>a.id==='purpose').triggers[0].source,/no matching/);
});
test('receipt/supporting/weak evidence and manual mitigations cannot lower inner indicators or alter assessment',()=>{
 const s=initialState('CF-002','comprehensive');const m=model(s);const before=JSON.stringify(s);
 const manual=createRiskView();manual.entries.conduct.draft={rating:'green',basis:'Manual judgement',nextStep:'Proposed action, not verified'};assert.equal(confirmRiskArea(manual,'conduct'),true);
 assert.deepEqual(model(s),m);assert.equal(JSON.stringify(s),before);
 for(const status of ['supports','weak','reply_only']) {s.evidence=Object.fromEntries(s.triggers.map(id=>[id,status]));assert.deepEqual(model(s),m);}
 const assessment=buildAssessment(s),report=buildReport(assessment,s.tier);buildRuleRing(assessment,s.tier);assert.deepEqual(buildReport(assessment,s.tier),report);
});
test('Simple uses only shown questions, discloses omissions, and cannot leak gated reasons or client wording',()=>{
 const s=blankState('simple');s.triggers=RULES.map(q=>q.id);const m=model(s);
 assert.ok(m.omitted>0);assert.equal(m.areas.find(a=>a.id==='purpose').colour,'not_assessed');
 assert.match(ruleRingText(m),/omitted by this tier/);assert.equal(model(s,'comprehensive').areas.find(a=>a.id==='purpose').colour,'amber');
 for(const q of RULES){assert.ok(!ruleRingText(m).includes(q.ifStrong));assert.ok(!ruleRingText(m).includes(q.ifWeak));assert.ok(!ruleRingText(m).includes(q.clientWording));}
});
test('Black pause and unknown triggers remain explicit; copies preserve both sources and boundaries',()=>{
 const s=blankState('comprehensive');s.rating='Black — Do Not Proceed';s.triggers=['unknown'];const m=model(s);
 assert.equal(m.pause,true);assert.equal(m.unknownCount,1);assert.match(ruleRingText(m),/OVERALL PAUSE/);assert.ok(m.areas.every(a=>a.colour==='not_assessed'));
 for(const id of CASE_ORDER){const m=model(initialState(id,'comprehensive'));assert.equal(lintCompliance(ruleRingText(m)).ok,true);assert.match(ruleRingText(m),/not proportions, probabilities or a score/);assert.ok(m.areas.every(a=>a.colour!=='green'));}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {conductReport,composeIntakeValue} from '../assets/js/preview/credit-framework/intake-options.js';
import {blankState,buildAssessment,buildReport,reportToPlainText} from '../assets/js/preview/credit-framework/engine.js';
import {buildMaterials,brokerMaterialsText,applicantMaterialsText} from '../assets/js/preview/credit-framework/materials.js';
test('no-concern statement preserves retained issues and never creates evidence or green',()=>{
  const s=blankState('comprehensive');const before=s.rating;
  s.intake.conduct=composeIntakeValue('conduct','',['no_concerns']);
  let a=buildAssessment(s);assert.deepEqual(a.triggerCheck.notSelected,[]);assert.equal(a.rating.text,before);
  assert.equal(conductReport(['no_concerns']).conflict,false);
  for(const args of [[['no_concerns'],'Prior issue remains'],[['no_concerns','dishonours']], [['no_concerns'],'',['ato_debt']], [['no_concerns'],'',[],['sg_unevidenced']], [['no_concerns'],'',[],[],true]]) assert.equal(conductReport(...args).conflict,true);
  assert.equal(conductReport(['unknown']),null);
  s.intake.conduct=composeIntakeValue('conduct','Recent dishonours reported',['no_concerns']);s.triggers=['ato_debt'];a=buildAssessment(s);
  assert.ok(a.triggerCheck.notSelected.includes('dishonours_recent'));assert.ok(a.engine.comprehensive.questions.some(q=>q.id==='ato_debt'));
  assert.equal(a.rating.text,before);assert.match(reportToPlainText(buildReport(buildAssessment(blankState('comprehensive')),'comprehensive')),/No risk triggers selected/);
});
test('empty materials show only reported document inventory to broker, never invent requirements or leak applicant raw input',()=>{
  const a=buildAssessment(blankState('comprehensive'));const m=buildMaterials(a,'comprehensive',{},new Set(),'Existing statements, SELF-REPORT-ONLY');
  assert.equal(m.items.length,0);assert.match(brokerMaterialsText(m),/SELF-REPORT-ONLY/);assert.match(brokerMaterialsText(m),/not a required document list/);
  assert.doesNotMatch(applicantMaterialsText(m),/SELF-REPORT-ONLY/);assert.match(applicantMaterialsText(m),/does not mean no documents/);
});
let JSDOM;try{({JSDOM}=await import(process.env.CF_JSDOM_MODULE||'jsdom'));}catch{}
(JSDOM?test:test.skip)('mounted no-concern choice preserves contradictions, clears receipt notes, stales manual view and respects reset/tier',async()=>{
 const html=await readFile(new URL('../preview/credit-framework.html',import.meta.url),'utf8');const dom=new JSDOM(html,{url:'https://example.test/preview/credit-framework.html?tier=comprehensive',pretendToBeVisual:true});
 const {window}=dom;window.matchMedia=()=>({matches:false});window.HTMLElement.prototype.scrollIntoView=function(){};
 for(const key of ['window','document','Node','location'])globalThis[key]=window[key];document.execCommand=()=>true;
 await import('../assets/js/preview/credit-framework/app.js');const $=s=>document.querySelector(s),click=s=>$(s).click();
 const change=(s,v,event='input')=>{$(s).value=v;$(s).dispatchEvent(new window.Event(event,{bubbles:true}));};
 click('[data-toggle="manual"]');change('#risk-rating-risk_management','green','change');change('#risk-basis-risk_management','Synthetic manual basis');click('[data-confirm-risk="risk_management"]');
 assert.equal($('[data-risk-segment="risk_management"]').dataset.colour,'green');
 click('[data-material-receipt]');const selectedBefore=[...document.querySelectorAll('.risk-groups input:checked')].map(n=>n.id);
 assert.ok(selectedBefore.length>0);const rating=$('#rating-pill').textContent;const beforeReviews=[...document.querySelectorAll('[data-rerate]')].map(n=>[n.dataset.rerate,n.value]);
 const choice='[data-preset-field="conduct"][data-preset="no_concerns"]';click(choice);
 assert.equal($(choice).getAttribute('aria-pressed'),'true');assert.ok($('#conduct-self-report').classList.contains('warn'));assert.ok($('#conduct-input-note').classList.contains('warn'));assert.equal($('#conduct-input-note').hidden,false);assert.equal($('[data-risk-segment="risk_management"]').dataset.colour,'not_assessed');assert.match($('#sec-manual [data-summary]').textContent,/Review required/);
 assert.deepEqual([...document.querySelectorAll('.risk-groups input:checked')].map(n=>n.id),selectedBefore);assert.equal($('#rating-pill').textContent,rating);assert.deepEqual([...document.querySelectorAll('[data-rerate]')].map(n=>[n.dataset.rerate,n.value]),beforeReviews);
 assert.ok([...document.querySelectorAll('[data-material-receipt]')].every(n=>!n.checked));assert.match($('#f-conduct').value,/dishonour/i);
 click('[data-preset-field="conduct"][data-preset="dishonours"]');assert.equal($(choice).getAttribute('aria-pressed'),'true');assert.ok($('#conduct-self-report'));
 click('#copy-btn');assert.match($('#copy-buffer').value,/Conduct self-report:.*unverified/);
 click('#tier-output [data-tier="simple"]');assert.ok($('#conduct-self-report'));assert.equal($('#materials-applicant'),null);
 click('[data-preset-field="conduct"][data-preset="unknown"]');assert.equal($('#conduct-self-report'),null);assert.match($('#f-conduct').value,/dishonour/i);
 click('#case-picker [data-case="custom"]');click(choice);assert.ok($('#conduct-self-report').classList.contains('info'));assert.match($('#materials-reported-documents').textContent,/actual availability unknown/);
 const docs=$('#f-documents');docs.value='Synthetic statements noted';docs.dispatchEvent(new window.Event('input',{bubbles:true}));assert.match($('#materials-reported-documents').textContent,/Synthetic statements noted/);
 click('#case-picker [data-case="CF-001"]');assert.equal($('#conduct-self-report'),null);assert.equal($(choice).getAttribute('aria-pressed'),'false');assert.equal(document.body.dataset.lint,'pass');dom.window.close();
});

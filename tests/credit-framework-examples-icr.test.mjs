import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CASES, EXAMPLE_ORDER, CASE_ORDER} from '../assets/js/preview/credit-framework/cases.js';
import {initialState, blankState, buildAssessment, buildReport, reportToPlainText, RULES, lintCompliance, classifyScenario, suggestTriggers} from '../assets/js/preview/credit-framework/engine.js';
import {investmentICR,investmentICRText,changeDealType} from '../assets/js/preview/credit-framework/investment-icr.js';
import {calcICR} from '../assets/js/core/finance-math.js';

test('six synthetic examples render both tiers; new exercises have no calibrated upward rating',()=>{
 assert.equal(EXAMPLE_ORDER.length,6);assert.equal(new Set(EXAMPLE_ORDER).size,6);
 for(const id of EXAMPLE_ORDER)for(const tier of ['simple','comprehensive']){
  const s=initialState(id,tier),a=buildAssessment(s),text=reportToPlainText(buildReport(a,tier));
  assert.equal(CASES[id].synthetic,true);assert.ok(s.triggers.length);assert.ok(s.triggers.every(id=>RULES.some(r=>r.id===id)));assert.equal(lintCompliance(text).ok,true);
  assert.match(text,new RegExp(CASES[id].intake.dealName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.ok(a.engine[tier].questions.length>0);
  if(!CASE_ORDER.includes(id)){
   assert.equal(a.pristine,false);assert.equal(a.judgementSource,null);
   for(const key of s.triggers)s.evidence[key]='supports';
   const reviewed=buildAssessment(s);assert.equal(reviewed.rerate.upwardBlocked,true);assert.notEqual(reviewed.rerate.to,'green');
  }
 }
 assert.notEqual(CASES['CF-005'].intake.scenario,CASES['CF-006'].intake.scenario);
 const altered=initialState('CF-005');altered.intake.icrNOI='999';altered.triggers.length=0;altered.evidence.x='supports';
 const fresh=initialState('CF-005');assert.equal(fresh.intake.icrNOI,'120000');assert.ok(fresh.triggers.length);assert.deepEqual(fresh.evidence,{});
 assert.equal(investmentICR(blankState().intake).applicable,false);
});
test('ICR reuses existing arithmetic, preserves losses and explicitly annualizes both periods',()=>{
 for(const [noi,interest,period,expected] of [['120000','84000','annual',120000/84000],['4,500','6000','monthly',0.75],['0','100','annual',0],['-100','100','monthly',-1],['10.50','0.50','annual',21]]){
  const r=investmentICR({dealType:'commercial_investment',icrNOI:noi,icrInterest:interest,icrPeriod:period});
  assert.equal(r.valid,true);assert.equal(r.ratio,expected);assert.equal(r.ratio,calcICR({noi:r.annualNOI,annualInterest:r.annualInterest}));
  assert.equal(r.factor,period==='monthly'?12:1);assert.equal(r.annualNOI,r.noi*r.factor);
  assert.match(investmentICRText(r),/No pass\/fail threshold applied/);assert.match(investmentICRText(r),/not DSCR/);
 }
 const result=investmentICR(initialState('CF-006').intake);assert.equal(result.annualNOI,54000);assert.equal(result.annualInterest,72000);
});
test('missing, zero-interest, malformed and unsafe amounts never become a misleading ratio',()=>{
 const base={dealType:'commercial_investment',icrNOI:'100',icrInterest:'50',icrPeriod:'annual'};
 for(const key of ['icrNOI','icrInterest'])for(const value of ['',null,undefined,'abc','Infinity','NaN','1e9','1,00','1.234','9007199254740992']){
  const r=investmentICR({...base,[key]:value});assert.equal(r.valid,false,`${key}: ${value}`);assert.equal(r.ratio,undefined);assert.match(investmentICRText(r),/ICR unavailable/);
 }
 for(const value of ['0','-1'])assert.equal(investmentICR({...base,icrInterest:value}).valid,false);
 for(const value of ['',undefined,'quarterly'])assert.equal(investmentICR({...base,icrPeriod:value}).valid,false);
 for(const type of ['sme','equipment','commercial_property','refinance','working_capital','ato_debt','',undefined])assert.equal(investmentICR({...base,dealType:type}).applicable,false);
 assert.equal(investmentICR({...base,dealType:'resi_investor_complex'}).valid,true);
 changeDealType(base,'equipment');assert.equal(base.icrNOI,undefined);assert.equal(base.icrPeriod,undefined);
 changeDealType(base,'commercial_investment');assert.equal(investmentICR(base).valid,false);
});
let JSDOM;try{({JSDOM}=await import(process.env.CF_JSDOM_MODULE||'jsdom'));}catch{}
(JSDOM?test:test.skip)('library, investment panel, reset, stale judgement and copy output are isolated',async()=>{
 const html=await readFile(new URL('../preview/credit-framework.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://example.test/preview/credit-framework.html?case=CF-005&tier=comprehensive',pretendToBeVisual:true});
 const {window}=dom;window.matchMedia=()=>({matches:false});window.HTMLElement.prototype.scrollIntoView=function(){};
 for(const k of ['window','document','Node','location'])globalThis[k]=window[k];document.execCommand=()=>true;
 await import('../assets/js/preview/credit-framework/app.js?examples-icr');
 const $=s=>document.querySelector(s),click=s=>$(s).click(),change=(s,v,e='input')=>{$(s).value=v;$(s).dispatchEvent(new window.Event(e,{bubbles:true}));};
 assert.equal($('#example-case-group').tagName,'DETAILS');assert.equal($('#example-case-group').open,false);assert.match($('#example-case-group > summary').textContent,/Example Library.*6 synthetic/);
 assert.equal(document.querySelectorAll('#blank-case-group [data-case]').length,1);
 assert.equal(document.querySelectorAll('#example-case-group [data-case]').length,6);
 assert.match($('#sec-investment-icr').textContent,/1.43x/);
 const rating=$('#rating-pill').textContent,ring=()=>[...document.querySelectorAll('[data-rule-segment]')].map(n=>n.dataset.colour),before=ring();
 click('[data-edit-risk="risk_servicing"]');change('#risk-rating-risk_servicing','green','change');change('#risk-basis-risk_servicing','Independent synthetic review');change('#risk-next-risk_servicing','Confirm scope');click('[data-confirm-risk="risk_servicing"]');
 assert.equal($('[data-risk-segment="risk_servicing"]').dataset.colour,'green');
 change('#f-icrNOI','240000');assert.match($('#sec-investment-icr').textContent,/2.86x/);assert.equal($('#rating-pill').textContent,rating);assert.deepEqual(ring(),before);assert.equal($('[data-risk-segment="risk_servicing"]').dataset.colour,'not_assessed');assert.match($('#sec-manual').textContent,/Review required/);
 click('#copy-btn');assert.match($('#copy-buffer').value,/Annualization: both amounts × 1/);assert.match($('#copy-buffer').value,/240,000.00/);assert.match($('#copy-buffer').value,/not reviewed evidence/);
 change('#f-icrInterest','0');assert.match($('#sec-investment-icr').textContent,/Unavailable/);assert.equal($('#f-icrInterest').getAttribute('aria-invalid'),'true');click('#copy-btn');assert.doesNotMatch($('#copy-buffer').value,/ICR =/);
 change('#f-dealType','equipment');assert.equal($('#f-icrNOI'),null);assert.equal($('#sec-investment-icr'),null);click('#copy-btn');assert.doesNotMatch($('#copy-buffer').value,/Investment interest coverage/);
 change('#f-dealType','commercial_investment');assert.equal($('#f-icrNOI').value,'');assert.match($('#sec-investment-icr').textContent,/Unavailable/);
 for(const id of EXAMPLE_ORDER)for(const tier of ['simple','comprehensive']){
  click(`#case-picker [data-case="${id}"]`);click(`#tier-output [data-tier="${tier}"]`);
  assert.equal(document.body.dataset.case,id);assert.equal(document.body.dataset.lint,'pass');assert.equal($('#f-dealName').value,CASES[id].intake.dealName);
  assert.equal(Boolean($('#sec-investment-icr')),['CF-005','CF-006'].includes(id));
  assert.ok([...document.querySelectorAll('[data-risk-segment]')].every(n=>n.dataset.colour==='not_assessed'));
 }
 click('#case-picker [data-case="CF-006"]');assert.equal($('#f-icrNOI').value,'4500');assert.match($('#sec-investment-icr').textContent,/0.75x/);click('#copy-btn');assert.match($('#copy-buffer').value,/Annualization: both amounts × 12/);
 change('[data-rerate="short_wale"]','supports','change');click('[data-material-receipt]');change('#f-icrNOI','12345');
 click('#case-picker [data-case="CF-005"]');assert.equal($('#f-icrNOI').value,'120000');assert.ok([...document.querySelectorAll('[data-rerate]')].every(n=>n.value==='outstanding'));assert.ok([...document.querySelectorAll('[data-material-receipt]')].every(n=>!n.checked));assert.equal($('#copy-buffer').value,'');
 click('#tier-output [data-tier="simple"]');assert.equal($('#f-icrNOI').value,'120000');assert.match($('#sec-investment-icr').textContent,/1.43x/);
 click('#case-picker [data-case="custom"]');assert.equal($('#f-dealName').value,'');assert.equal($('#sec-investment-icr'),null);assert.equal($('#f-icrNOI'),null);assert.equal(document.querySelectorAll('#intake-form input[type="checkbox"]:checked').length,0);click('#copy-btn');assert.doesNotMatch($('#copy-buffer').value,/Synthetic industrial|Synthetic retail|Investment interest coverage/);
 assert.equal($('#sec-manual').textContent.includes('Independent synthetic review'),false);
 const css=html;assert.match(css,/\.sec-body\[hidden\]/); // Existing print rule exposes report details.
 dom.window.close();
});

test('explicit commercial investment retains existing property review with blank narrative',()=>{
 const commercial={dealType:'commercial_property'},investment={dealType:'commercial_investment'};
 assert.deepEqual(classifyScenario(investment,[]),classifyScenario(commercial,[]));
 assert.ok(classifyScenario(investment,[]).some(t=>t.tag==='commercial_property'));
 assert.deepEqual(suggestTriggers(investment),suggestTriggers(commercial));
 assert.ok(suggestTriggers(investment).some(t=>t.id==='zoning_environmental_missing'));
 const s=blankState();changeDealType(s.intake,'commercial_investment');assert.deepEqual(s.triggers,[]);assert.equal(s.rating,'Amber — Package Better');
});

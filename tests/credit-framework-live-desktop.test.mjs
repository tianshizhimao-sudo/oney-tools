import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {blankState,initialState,buildAssessment,buildReport} from '../assets/js/preview/credit-framework/engine.js';
import {buildRuleRing} from '../assets/js/preview/credit-framework/rule-ring.js';
import {createRiskView,syncRiskInputs,confirmRiskArea} from '../assets/js/preview/credit-framework/manual-risk-view.js';
import {createLiveTracker,updateLiveTracker} from '../assets/js/preview/credit-framework/live-desktop.js';
const context=(s,manual=createRiskView())=>({inputKey:JSON.stringify(s.intake),tier:s.tier,rating:s.rating,ring:buildRuleRing(buildAssessment(s),s.tier),manual,evidence:s.evidence});
test('live projection separates suggested from selected and unmapped input from risk changes',()=>{
 const s=blankState('comprehensive'),tracker=createLiveTracker();let m=updateLiveTracker(tracker,context(s));assert.match(m.message,/baseline/);
 s.intake.conduct='ATO debt';m=updateLiveTracker(tracker,context(s));const row=m.rows.find(r=>r.id==='risk_management');assert.equal(row.inner,'not_assessed');assert.match(row.changes.join(' '),/suggestions changed/);assert.equal(row.selected.length,0);
 s.triggers=['ato_debt'];m=updateLiveTracker(tracker,context(s));assert.equal(m.rows[0].inner,'selected');assert.match(m.rows[0].changes.join(' '),/Selected trigger display changed/);
 s.intake.dealName='Synthetic new label';m=updateLiveTracker(tracker,context(s));assert.match(m.message,/does not establish unchanged risk/);assert.ok(m.rows.every(r=>!r.changes.length));
 const reset=updateLiveTracker(createLiveTracker(),context(blankState('comprehensive')));assert.match(reset.message,/baseline/);assert.ok(reset.rows.every(r=>!r.selected.length&&!r.suggested.length&&!r.changes.length));
});
test('live view uses shown-tier data, keeps evidence distinct and never mutates assessment',()=>{
 const s=initialState('CF-002','comprehensive'),manual=createRiskView(),tracker=createLiveTracker();const a=buildAssessment(s),before=buildReport(a,s.tier);updateLiveTracker(tracker,context(s,manual));
 s.evidence.ato_debt='supports';let m=updateLiveTracker(tracker,context(s,manual));assert.equal(m.rows[0].inner,'selected');assert.match(m.rows[0].changes.join(' '),/Trigger-review entries changed/);
 s.tier='simple';m=updateLiveTracker(tracker,context(s,manual));assert.match(m.message,/Output tier changed/);assert.ok(m.rows.every(r=>r.reviews===null));assert.equal(m.rows[1].selected.length,0);assert.equal(m.rows[1].omitted,1);
 assert.deepEqual(buildReport(a,'comprehensive'),before);
});
test('manual changes and stale entries are projected from the same authoritative state',()=>{
 const s=blankState('comprehensive'),manual=createRiskView(),tracker=createLiveTracker();syncRiskInputs(manual,{amount:1});updateLiveTracker(tracker,context(s,manual));
 manual.entries.risk_management.draft={rating:'green',basis:'Synthetic checked basis',nextStep:''};confirmRiskArea(manual,'risk_management');let m=updateLiveTracker(tracker,context(s,manual));assert.equal(m.rows[0].outerColour,'green');assert.equal(m.rows[0].inner,'not_assessed');
 syncRiskInputs(manual,{amount:2});m=updateLiveTracker(tracker,context(s,manual));assert.equal(m.rows[0].outerColour,'not_assessed');assert.match(m.rows[0].outer,/Review required/);
});
let JSDOM;try{({JSDOM}=await import(process.env.CF_JSDOM_MODULE||'jsdom'));}catch{}
(JSDOM?test:test.skip)('desktop mounted live updates, single editor, unique IDs, focus, reset, tier and source-only print boundaries',async()=>{
 const html=await readFile(new URL('../preview/credit-framework.html',import.meta.url),'utf8');const dom=new JSDOM(html,{url:'https://example.test/preview/credit-framework.html?tier=comprehensive',pretendToBeVisual:true});const {window}=dom;window.matchMedia=()=>({matches:false});window.HTMLElement.prototype.scrollIntoView=function(){};for(const k of ['window','document','Node','location'])globalThis[k]=window[k];document.execCommand=()=>true;
 await import('../assets/js/preview/credit-framework/app.js');const $=s=>document.querySelector(s),click=s=>$(s).click(),change=(s,v,event='input')=>{$(s).focus();$(s).value=v;$(s).dispatchEvent(new window.Event(event,{bubbles:true}));};
 assert.equal(document.querySelectorAll('[data-live-domain]').length,4);assert.equal(document.querySelectorAll('[id^="risk-rating-"]').length,4);assert.ok($('#live-impact').classList.contains('no-print'));assert.ok($('#live-domain-rail').classList.contains('no-print'));
 click('[data-live-domain="risk_management"]');assert.equal($('#sec-manual .sec-body').hidden,false);assert.equal(document.activeElement.id,'risk-rating-risk_management');
 change('#risk-rating-risk_management','green','change');change('#risk-basis-risk_management','Synthetic basis');click('[data-confirm-risk="risk_management"]');assert.ok($('[data-live-outer="risk_management"]').classList.contains('green'));
 change('#f-conduct','Recent dishonours; ATO debt');assert.equal(document.activeElement.id,'f-conduct');assert.ok($('[data-live-outer="risk_management"]').classList.contains('not_assessed'));assert.match($('#live-impact').textContent,/Manual view status changed/);
 click('#tier-output [data-tier="simple"]');assert.doesNotMatch($('#live-impact').textContent,/reviews are not marked supporting/);assert.match($('#live-domain-rail').textContent,/Scope: simple/);
 click('#case-picker [data-case="custom"]');assert.match($('#live-impact').textContent,/baseline/);assert.equal(document.querySelectorAll('[data-live-change]').length,0);assert.doesNotMatch($('#live-domain-rail').textContent,/Synthetic basis/);
 change('#f-conduct','ATO debt');assert.match($('#live-impact').textContent,/Unconfirmed input suggestions changed/);assert.ok($('[data-live-inner="risk_management"]').classList.contains('not_assessed'));
 click('#t-ato_debt');assert.ok($('[data-live-inner="risk_management"]').classList.contains('selected'));click('#t-ato_debt');assert.ok($('[data-live-inner="risk_management"]').classList.contains('not_assessed'));
 const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);assert.deepEqual([...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))].sort(),['cfFill','cfStroke'], 'Only pre-existing cloned print-logo gradient IDs repeat; live/editor IDs remain unique');
 click('#copy-btn');assert.doesNotMatch($('#copy-buffer').value,/Current-change explanation|Mapped display changes are highlighted/);assert.match($('#copy-buffer').value,/Inner ring — rule-trigger indicators/);
 const css=await readFile(new URL('../assets/css/credit-framework-reading.css',import.meta.url),'utf8');assert.match(css,/\.desktop-live\{display:none\}/);assert.match(css,/@media screen and \(min-width:1450px\)/);assert.match(css,/@media print\{\.desktop-live\{display:none!important\}\}/);
 assert.equal(document.body.dataset.lint,'pass');dom.window.close();
});

test('overall pause and unknown entries stay explicit without implying domain risk calculation',()=>{
 const s=blankState('comprehensive'),tracker=createLiveTracker();updateLiveTracker(tracker,context(s));
 s.rating='Black — Do Not Proceed';let m=updateLiveTracker(tracker,context(s));assert.match(m.message,/Overall pause status changed/);assert.equal(m.pause,true);assert.ok(m.rows.every(r=>r.inner==='not_assessed'));
 s.rating='Amber — Package Better';updateLiveTracker(tracker,context(s));s.rating='Green — Package Ready';m=updateLiveTracker(tracker,context(s));assert.match(m.message,/rating input changed/);assert.ok(m.rows.every(r=>r.inner==='not_assessed'));
 s.triggers=['unknown-entry'];m=updateLiveTracker(tracker,context(s));assert.match(m.message,/no domain mapping/);assert.equal(m.unknown,1);
});

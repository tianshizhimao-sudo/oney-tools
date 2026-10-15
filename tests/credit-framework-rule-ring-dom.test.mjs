import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
let JSDOM;try{({JSDOM}=await import(process.env.CF_JSDOM_MODULE||'jsdom'));}catch{}
(JSDOM?test:test.skip)('dual ring DOM: independent sources, keyboard reasons, stale outer, Black stop, copy and tier gates',async()=>{
 const html=await readFile(new URL('../preview/credit-framework.html',import.meta.url),'utf8');const dom=new JSDOM(html,{url:'https://example.test/preview/credit-framework.html?tier=comprehensive',pretendToBeVisual:true});const {window}=dom;
 window.matchMedia=()=>({matches:false});window.HTMLElement.prototype.scrollIntoView=function(){};for(const k of ['window','document','Node','location'])globalThis[k]=window[k];document.execCommand=()=>true;
 await import('../assets/js/preview/credit-framework/app.js?dual-ring-test');const $=s=>document.querySelector(s);const click=s=>$(s).click();const change=(s,value,event='input')=>{$(s).value=value;$(s).dispatchEvent(new window.Event(event,{bubbles:true}));};
 assert.equal(document.querySelectorAll('[data-rule-segment]').length,4);assert.equal(document.querySelectorAll('[data-risk-segment]').length,4);
 assert.ok($('.manual-risk-visual .ring-print-legend'));assert.match($('.ring-print-legend').textContent,/Inner:.*Outer:.*Scope:/);
 assert.equal($('#dual-ring-legend').closest('.sec-body'),null);assert.match($('#dual-ring-legend').textContent,/Inner ring:.*Outer ring:/);
 click('[data-toggle="manual"]');const initial=$('[data-rule-segment="conduct"]').dataset.colour;assert.equal(initial,'red');
 $('[data-rule-segment="conduct"]').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.equal($('#risk-editor-conduct').open,true);assert.equal(document.activeElement.id,'risk-rating-conduct');assert.match($('#risk-editor-conduct .rule-ring-reasons').textContent,/Source: Synthetic sample trigger/);
 change('#risk-rating-conduct','green','change');change('#risk-basis-conduct','My independent view');change('#risk-next-conduct','Proposed next action');click('[data-confirm-risk="conduct"]');assert.equal($('[data-risk-segment="conduct"]').dataset.colour,'green');assert.equal($('[data-rule-segment="conduct"]').dataset.colour,initial);
 click('[data-toggle="materials"]');click('[data-material-receipt]');assert.equal($('[data-rule-segment="conduct"]').dataset.colour,initial);assert.equal($('[data-risk-segment="conduct"]').dataset.colour,'green');
 change('[data-rerate="ato_debt"]','supports','change');assert.equal($('[data-rule-segment="conduct"]').dataset.colour,initial);assert.equal($('[data-risk-segment="conduct"]').dataset.colour,'not_assessed');assert.match($('#sec-manual [data-summary]').textContent,/Review required/);
 click('#copy-btn');assert.match($('#copy-buffer').value,/Inner ring — rule-trigger indicators/);assert.match($('#copy-buffer').value,/Manual four-area risk view/);
 change('#f-rating','Black — Do Not Proceed','change');assert.ok($('#ring-pause'));assert.equal($('#ring-pause').closest('.sec-body'),null);click('#copy-btn');assert.match($('#copy-buffer').value,/OVERALL PAUSE/);
 click('#case-picker [data-case="custom"]');change('#f-conduct','ATO debt');assert.equal($('[data-rule-segment="conduct"]').dataset.colour,'not_assessed');assert.match($('#manual-risk-view').textContent,/Unconfirmed suggestion only/);
 click('#t-ato_debt');assert.equal($('[data-rule-segment="conduct"]').dataset.colour,'red');click('#tier-output [data-tier="simple"]');assert.match($('#dual-ring-legend').textContent,/Scope: simple/);assert.equal($('#materials-applicant'),null);assert.equal(document.body.dataset.lint,'pass');dom.window.close();
});

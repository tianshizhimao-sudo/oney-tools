import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL('../'+path,import.meta.url),'utf8');
function luminance(hex) { const rgb = hex.match(/\w\w/g).map(n=>parseInt(n,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722; }
test('light palette text meets AA on tinted surfaces; controls and print have explicit contracts',async()=>{
  const css=await read('assets/css/credit-framework-reading.css');
  for(const fg of ['202c3e','505d70','593778','765000','a62138','245b9c','086b48']) for(const bg of ['ffffff','f1f5fa','f7f4fa','f5f3f8']) {
    const contrast=(luminance(bg)+.05)/(luminance(fg)+.05);assert.ok(contrast>=4.5,`${fg} on ${bg}: ${contrast}`);
  }
  assert.match(css,/@media screen/);assert.match(css,/\.mobile-nav\{background:#f3f5f8/);
  assert.match(css,/@media print/);assert.match(css,/\.reading-detail>:not\(summary\)\{display:block!important/);
  assert.match(css,/focus-visible/);assert.match(css,/min-height:44px/);
  const js=await read('assets/js/preview/credit-framework/theme.js');assert.doesNotMatch(js,/localStorage|sessionStorage|indexedDB|\bfetch\s*\(|state\./);
});
let JSDOM;try{({JSDOM}=await import(process.env.CF_JSDOM_MODULE||'jsdom'));}catch{}
(JSDOM?test:test.skip)('reading controls preserve case/copy, expose warnings, restore print folds and open next-action targets',async()=>{
 const dom=new JSDOM(await read('preview/credit-framework.html'),{url:'https://example.test/preview/credit-framework.html?tier=comprehensive',pretendToBeVisual:true});
 const {window}=dom;window.matchMedia=()=>({matches:false});window.HTMLElement.prototype.scrollIntoView=function(){};
 for(const key of ['window','document','Node','location'])globalThis[key]=window[key];document.execCommand=()=>true;
 await import('../assets/js/preview/credit-framework/app.js?reading-test');await import('../assets/js/preview/credit-framework/theme.js');
 const $=s=>document.querySelector(s);const click=s=>$(s).click();
 assert.equal(document.documentElement.dataset.theme,'light');assert.equal($('#body-manual').hidden,true);assert.equal($('#body-materials').hidden,true);assert.equal($('#reading-legend').open,false);
 assert.match($('#sec-manual [data-summary]').textContent,/Purpose & growth|Not assessed/);
 assert.equal($('#rerate-evidence-rule').closest('.sec-body'),null);
 click('[data-toggle="materials"]');click('[data-material-receipt]');click('[data-materials-view="applicant"]');
 const draft=$('#materials-applicant-text').value;const rating=$('#rating-pill').textContent;
 click('[data-set-theme="dark"]');assert.equal(document.documentElement.dataset.theme,'dark');assert.equal($('[data-set-theme="dark"]').getAttribute('aria-pressed'),'true');
 assert.equal($('#materials-applicant-text').value,draft);assert.equal($('#rating-pill').textContent,rating);assert.ok([...document.querySelectorAll('[data-material-receipt]')].some(c=>c.checked));
 click('[data-set-theme="light"]');click('#materials-copy-applicant');assert.equal($('#copy-buffer').value,draft);
 click('[data-open-section="questions"]');assert.equal($('#body-questions').hidden,false);assert.equal(document.activeElement.id,'sec-questions');
 click('[data-toggle="manual"]');assert.equal($('#body-manual').hidden,false);
 click('[data-toggle="manual"]');assert.equal($('#body-manual').hidden,true);
 const f=$('#f-dealName');f.value='changed';f.dispatchEvent(new window.Event('input',{bubbles:true}));
 assert.equal($('#materials-reset').closest('.sec-body'),null);assert.equal($('#body-manual').hidden,true);
 window.dispatchEvent(new window.Event('beforeprint'));window.dispatchEvent(new window.Event('beforeprint'));assert.equal($('#reading-legend').open,true);
 window.dispatchEvent(new window.Event('afterprint'));assert.equal($('#reading-legend').open,false);
 click('#tier-output [data-tier="simple"]');assert.equal($('#materials-applicant'),null);assert.equal(document.documentElement.dataset.theme,'light');
 assert.equal($('#rerate-evidence-rule'),null);
 click('#expand-all');assert.ok([...document.querySelectorAll('details.reading-detail:not(.no-print)')].every(n=>n.open));
 click('#expand-all');assert.ok([...document.querySelectorAll('details.reading-detail:not(.no-print)')].every(n=>!n.open));
 assert.equal(document.body.dataset.lint,'pass');dom.window.close();
});

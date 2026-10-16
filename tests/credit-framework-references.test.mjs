import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {GLOSSARY,POLICY_REFERENCES,findTerms,searchTerms,referencesFor} from '../assets/js/preview/credit-framework/reference-library.js';
import {RULES} from '../assets/js/preview/credit-framework/rules.js';
import {RISK_AREAS} from '../assets/js/preview/credit-framework/manual-risk-view.js';
test('glossary matches actual terms and aliases without substring false positives',()=>{
 assert.equal(new Set(GLOSSARY.map(t=>t.term)).size,GLOSSARY.length);assert.ok(GLOSSARY.length>=19);
 assert.deepEqual(findTerms('BASIS and format and ratio').map(t=>t.term),[]);assert.deepEqual(findTerms('FY24 / FY25 / FY').map(t=>t.term),['FY']);
 assert.ok(findTerms('ATO/SG and ABNs, 2% p.a.').some(t=>t.term==='p.a.'));assert.equal(searchTerms('估值').some(t=>t.term==='AVM'),true);assert.equal(searchTerms('merchant cash advance')[0].term,'MCA');
 assert.match(GLOSSARY.find(t=>t.term==='SBSCH').zh,/2026年7月1日永久关闭/);assert.ok(!GLOSSARY.some(t=>t.term==='PI'));
 for(const t of GLOSSARY){assert.ok(t.full&&t.zh&&/[\u3400-\u9fff]/u.test(t.zh));assert.equal(new URL(t.source).protocol,'https:');assert.equal(t.checkedOn,'2026-10-16');}
});
test('curated references have explicit scope and provenance with no residential trigger mapping',()=>{
 assert.ok(POLICY_REFERENCES.length>=2);assert.equal(new Set(POLICY_REFERENCES.map(r=>r.id)).size,POLICY_REFERENCES.length);
 for(const r of POLICY_REFERENCES){const u=new URL(r.url);assert.equal(u.protocol,'https:');assert.ok(!u.username&&!u.password);assert.ok(r.title&&r.sourceType&&r.publisher&&r.scope&&r.summary);assert.equal(r.checkedOn,'2026-10-16');assert.ok('sourceDate' in r);assert.ok(r.domainIds.every(id=>RISK_AREAS.some(a=>a.id===id)));assert.ok(r.triggerIds.every(id=>RULES.some(rule=>rule.id===id)));if(/^(Primarily residential|Residential$)/.test(r.scope)){assert.equal(r.domainIds.length,0);assert.equal(r.triggerIds.length,0);}}
 assert.deepEqual(referencesFor({triggerId:'unknown-trigger'}),[]);
});
let JSDOM;try{({JSDOM}=await import(process.env.CF_JSDOM_MODULE||'jsdom'));}catch{}
(JSDOM?test:test.skip)('reference UI is searchable, safe, opt-in and separate from tiered requests and exports',async()=>{
 const html=await readFile(new URL('../preview/credit-framework.html',import.meta.url),'utf8');const dom=new JSDOM(html,{url:'https://example.test/preview/credit-framework.html?tier=comprehensive',pretendToBeVisual:true});const {window}=dom;window.matchMedia=()=>({matches:false});window.HTMLElement.prototype.scrollIntoView=function(){};for(const k of ['window','document','Node','location'])globalThis[k]=window[k];document.execCommand=()=>true;await import('../assets/js/preview/credit-framework/app.js');const $=s=>document.querySelector(s);
 assert.equal($('#reference-library').open,false);assert.ok($('#reference-library').classList.contains('no-print'));assert.equal(document.querySelectorAll('label .term-help,summary .term-help').length,0);
 assert.ok(document.querySelectorAll('.term-help').length>4);const helper=document.querySelector('.term-help');assert.equal(helper.open,false);helper.querySelector('summary').click();assert.equal(helper.open,true);
 const search=$('#glossary-search');search.value='商户';search.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal($('#glossary-results').children.length,1);assert.match($('#glossary-results').textContent,/Merchant Cash Advance/);
 search.value='<img src=x onerror=alert(1)>';search.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal($('#glossary-results').children.length,0);assert.equal($('#reference-content img'),null);
 $('#f-conduct').value='CASE_SECRET_UNIQUE';$('#f-conduct').dispatchEvent(new window.Event('input',{bubbles:true}));
 for(const link of document.querySelectorAll('.reference-library a,.term-help a,.context-references a')){assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');assert.equal(link.getAttribute('referrerpolicy'),'no-referrer');assert.match(link.getAttribute('aria-label'),/new tab/);assert.doesNotMatch(link.href,/CASE_SECRET_UNIQUE/);assert.ok([...GLOSSARY.map(t=>t.source),...POLICY_REFERENCES.map(r=>r.url)].includes(link.getAttribute('href')));}
 $('#tier-output [data-tier="simple"]').click();for(const card of document.querySelectorAll('.q[data-question]')){const expected=referencesFor({triggerId:card.dataset.question}).map(r=>r.id);assert.deepEqual([...card.querySelectorAll('[data-reference]')].map(n=>n.dataset.reference),expected);}
 $('#copy-btn').click();assert.doesNotMatch($('#copy-buffer').value,/Definition source|Link checked|Tool summary \(not source wording\)/);assert.equal(document.body.dataset.lint,'pass');
 const css=await readFile(new URL('../assets/css/credit-framework-reading.css',import.meta.url),'utf8');assert.match(css,/@media print\{\.reference-library,\.term-help,\.context-references,\.domain-reference-links\{display:none!important\}\}/);
 const module=await readFile(new URL('../assets/js/preview/credit-framework/reference-library.js',import.meta.url),'utf8');assert.doesNotMatch(module,/innerHTML|fetch\(|localStorage|sessionStorage/);dom.window.close();
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { getToolById, resolveToolHref } from '../assets/js/app/tool-registry.js';
import { renderGroupPage, renderHomeHeroTools, renderHomeProfessionalTools } from '../assets/js/app/route-map.js';
const require=createRequire(import.meta.url);
const { JSDOM }=require(process.env.CF_JSDOM_MODULE);
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
test('Analyse and home render the real Beta route without changing Assess heroes',()=>{
 const dom=new JSDOM('<div id="analyse"></div><div id="home"></div><div id="assess"></div>');
 const d=dom.window.document;
 renderGroupPage('analyse',d.querySelector('#analyse'));
 renderHomeProfessionalTools(d.querySelector('#home'));
 renderHomeHeroTools(d.querySelector('#assess'));
 for(const id of ['analyse','home']){
  const a=d.querySelector(`#${id} a[href="/preview/credit-framework.html"]`);
  assert.ok(a);assert.match(a.textContent,/Credit Framework · Beta/);
  assert.match(a.textContent,/not credit approval/);assert.match(a.textContent,/No automatic transfer/);
  assert.equal(new URL(a.getAttribute('href'),'https://tools.oneyco.com.au').search,'');
 }
 assert.equal(d.querySelector('#assess a[href="/preview/credit-framework.html"]'),null);
 assert.ok(existsSync(new URL(resolveToolHref(getToolById('credit-framework')).slice(1),root)));
 assert.match(read('index.html'),/renderHomeProfessionalTools\(document.getElementById\('home-professional-tools'\)\)/);
 dom.window.close();
});
test('current BRS links through registry without answers transfer',()=>{
 assert.equal(resolveToolHref(getToolById('bank-ready-score')),'/tools/bank-ready-score.html');
 const s=read('tools/bank-ready-score.html');
 assert.match(s,/resolveToolHref\(getToolById\('credit-framework'\)\)/);
 assert.match(s,/Your BRS answers are not automatically transferred/);assert.match(s,/not credit approval/);
});
test('Beta retains noindex, non-approval boundary and return navigation',()=>{
 const s=read('preview/credit-framework.html');
 assert.match(s,/noindex/);assert.match(s,/does not approve credit/);
 assert.doesNotMatch(s,/BY INVITATION|Internal Prototype|Private beta/);
 assert.match(s,/href="\/analyse\/"/);assert.match(s,/href="\/"/);
 assert.ok(existsSync(new URL('analyse/index.html',root)));
});

test('public Beta footer requires human review without denying navigation links',()=>{
 const s=read('preview/credit-framework.html');
 assert.doesNotMatch(s,/not linked from site navigation/i);
 const footer=new JSDOM(s).window.document.querySelector('footer.footer');
 assert.ok(footer);
 assert.match(footer.textContent,/Human review required/);
});

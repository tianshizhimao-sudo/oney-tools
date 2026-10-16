import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../preview/credit-framework.html',import.meta.url),'utf8');
const css=await readFile(new URL('../assets/css/credit-framework-reading.css',import.meta.url),'utf8');
const polish=css.split('/* Readability polish:')[1].split('/* Reference helpers')[0];
test('readability changes are screen-only with wrapping and mobile sizing, preserving sticky and print rules',()=>{
 assert.ok(polish);assert.match(polish,/@media screen\{/);assert.doesNotMatch(polish,/@media print|position:fixed|overflow:hidden|display:none/);
 assert.match(polish,/font-size:17px;line-height:1.5;min-height:48px/);assert.match(polish,/\.money-control\{font-size:18px/);
 assert.match(polish,/max-width:100%;min-width:0/);assert.match(polish,/overflow-wrap:anywhere/);assert.match(polish,/@media screen and \(max-width:640px\)/);
 assert.match(css,/@media screen and \(min-width:1450px\)/);assert.match(css,/@media print\{\.desktop-live\{display:none!important\}\}/);
});
let JSDOM;try{({JSDOM}=await import(process.env.CF_JSDOM_MODULE||'jsdom'));}catch{}
(JSDOM?test:test.skip)('larger type applies to actual entry fields and existing collapsed help keeps warnings outside',async()=>{
 const dom=new JSDOM(html,{url:'https://example.test/preview/credit-framework.html',pretendToBeVisual:true});const {window}=dom;window.matchMedia=()=>({matches:false});window.HTMLElement.prototype.scrollIntoView=function(){};for(const k of ['window','document','Node','location'])globalThis[k]=window[k];
 // JSDOM has no screen media layout engine; apply only the screen typography block
 // for cascade checks. Breakpoint/print contracts are checked above, not visually.
 const screen=polish.split('@media screen{')[1].split('@media screen and')[0].trim();const style=document.createElement('style');style.textContent=screen.slice(0,-1);document.head.append(style);
 await import('../assets/js/preview/credit-framework/app.js');
 const fields=[...document.querySelectorAll('#intake input.control,#intake select.control,#intake textarea.control')];assert.ok(fields.length>10);
 for(const field of fields){const font=parseFloat(window.getComputedStyle(field).fontSize);assert.ok(font>=17,`${field.id} is ${font}px`);assert.ok(field.labels?.length||field.getAttribute('aria-label'),`${field.id} needs a label`);}
 assert.equal(window.getComputedStyle(document.querySelector('.money-control')).fontSize,'18px');
 const guide=document.querySelector('.intake-guide');assert.equal(guide.open,false);assert.equal(guide.querySelectorAll('input,select,textarea,.notice,.field-error').length,0);
 assert.match(document.querySelector('.intake-intro').textContent,/no names, ABNs, addresses or account numbers/);assert.match(guide.nextElementSibling.textContent,/Any edit switches/);
 const field=document.querySelector('.money-control');field.value='abc';field.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(field.getAttribute('aria-invalid'),'true');const error=document.getElementById(`${field.id}-error`);assert.equal(error.hidden,false);assert.ok(parseFloat(window.getComputedStyle(error).fontSize)>=13);
 const details=document.querySelector('.manual-details');details.open=true;assert.equal(details.open,true);assert.equal(document.querySelectorAll('[data-live-domain]').length,4);assert.equal(document.body.dataset.lint,'pass');dom.window.close();
});

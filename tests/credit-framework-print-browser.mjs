// Actual browser PDF regression. Uses an existing Playwright/Chromium installation.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.CF_BASE;
assert.ok(base, 'Set CF_BASE to the explicit local or authorized production origin');
const out=process.env.CF_PDF_OUT || '/tmp/credit-framework-print-audit';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const evidence={base,browser:browser.version(),runs:[],errors:[],requests:[]};
page.on('pageerror',e=>evidence.errors.push(e.message));
page.on('request',r=>evidence.requests.push({method:r.method(),url:r.url()}));
const load=async(id,tier)=>{await page.goto(`${base}/preview/credit-framework.html?tier=${tier}`,{waitUntil:'networkidle'}); await page.locator(`#case-picker [data-case="${id}"]`).click();};
const capture=async(name)=>{
  const disclosure = await page.locator('.review-record').evaluateAll(nodes => nodes.map(n => n.open));
  await page.emulateMedia({media:'print'});
  evidence.runs.push({name,tier:await page.locator('body').getAttribute('data-tier'),critical:await page.locator('#review-overview .priority-issue .prio.Critical').count(),printText:await page.locator('#report').innerText()});
  await page.pdf({path:`${out}/${name}.pdf`,format:'A4',printBackground:false,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:8px;width:100%;text-align:center;color:#555">Synthetic acceptance sample · <span class="pageNumber"></span> / <span class="totalPages"></span></div>'});
  await page.emulateMedia({media:null});
  assert.deepEqual(await page.locator('.review-record').evaluateAll(nodes => nodes.map(n => n.open)), disclosure, 'PDF restores screen disclosure');
};
for(const id of ['CF-001','CF-002','CF-004'])for(const tier of ['simple','comprehensive']){await load(id,tier);await capture(`${id}-${tier}`);}
await load('CF-002','comprehensive');
await page.locator('[data-open-section="rerate"]').first().click();
await page.locator('[data-open-review="sg_unevidenced"]').click();
for(const [key,value] of Object.entries({sourceId:'SYNTHETIC-PDF-AUDIT-01',supportedScope:'Synthetic summary only: balance and overdue both AUD 0.00.',remainingGap:'Payment timing and fund receipt remain unverified. No evidence of per-period settlement.',ownerReviewDate:'2026-10-23',note:'Historical reviewer judgement retained.'}))await page.locator(`#review-${key}-sg_unevidenced`).fill(value);
await page.locator('[data-confirm-review="sg_unevidenced"]').click();
await page.locator('[data-open-review="sg_unevidenced"]').click();
await page.locator('#access-result-sg_unevidenced').selectOption('unavailable');await page.locator('#access-observedAt-sg_unevidenced').fill('2026-11-01');await page.locator('[data-record-access="sg_unevidenced"]').click();
await capture('CF-002-history-comprehensive');
await page.locator('#tier-output [data-tier="simple"]').click();
await capture('CF-002-history-simple');
await page.locator('#tier-output [data-tier="comprehensive"]').click();
await page.locator('[data-open-review="sg_unevidenced"]').click();
// Long unbroken citation and maximum-sized notes exercise safe pagination and wrapping.
await page.locator('#review-sourceId-sg_unevidenced').fill('SYNTHETIC-'+ 'X'.repeat(180));
await page.locator('#review-note-sg_unevidenced').fill('Synthetic pending judgement. '.repeat(21).slice(0,590));
await page.locator('#review-remainingGap-sg_unevidenced').fill('Synthetic unresolved payment evidence. '.repeat(15).slice(0,590));
await page.locator('[data-cancel-review="sg_unevidenced"]').click();
await capture('CF-002-stale-long-draft');
await writeFile(`${out}/browser-evidence.json`,JSON.stringify(evidence,null,2));
await browser.close();
assert.deepEqual(evidence.errors,[]);
console.log(JSON.stringify({base,browser:evidence.browser,pdfs:evidence.runs.map(r=>({name:r.name,critical:r.critical})),errors:evidence.errors}));

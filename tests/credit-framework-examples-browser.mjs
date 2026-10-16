// Optional local browser verification. No external requests or case uploads.
// PLAYWRIGHT_MODULE and PLAYWRIGHT_EXECUTABLE may select an existing installation.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {join,extname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
let chromium;
try {const module=await import(process.env.PLAYWRIGHT_MODULE||'playwright');chromium=module.chromium||module.default?.chromium;if(!chromium)throw new Error('Chromium API unavailable');}
catch {console.log('SKIP: existing Playwright runtime unavailable');process.exit(0);}
const root=fileURLToPath(new URL('../',import.meta.url));
const out=process.env.CF_SMOKE_OUT||join(tmpdir(),'cf-examples-icr-smoke');await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
 const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!path.startsWith(root)||req.method!=='GET'){res.writeHead(403).end();return;}
 try{const body=await readFile(path);res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream'}).end(body);}catch{res.writeHead(404).end();}
});
await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||undefined});
 const origin=`http://127.0.0.1:${server.address().port}`;
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}});const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{if(r.request().url().startsWith(origin))return r.continue();external.push(r.request().url());return r.abort();});
  await page.goto(origin+'/preview/credit-framework.html?case=CF-005&tier=comprehensive');
  await page.waitForSelector('#example-case-group > summary');
  await page.click('#example-case-group > summary');
  assert.equal(await page.locator('#example-case-group [data-case]:visible').count(),6);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}px library overflow`);
  await page.screenshot({path:join(out,`library-${width}.png`),fullPage:true});
  for(const id of ['CF-001','CF-002','CF-004','CF-005','CF-006','CF-007']){
   if(width<640)await page.click('button[data-mobile-view="inputs"]');
   if(!await page.locator('#example-case-group').evaluate(n=>n.open))await page.click('#example-case-group > summary');
   await page.click(`#case-picker [data-case="${id}"]`);
   if(width<640)await page.click('button[data-mobile-view="results"]');
   for(const tier of ['simple','comprehensive']){
    await page.click(`#tier-output [data-tier="${tier}"]`);
    assert.equal(await page.locator('body').getAttribute('data-case'),id);
    assert.equal(await page.locator('body').getAttribute('data-lint'),'pass');
    assert.equal(await page.locator('#sec-investment-icr').count(),['CF-005','CF-006'].includes(id)?1:0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}px ${id} ${tier} overflow`);
   }
  }
  if(width<640)await page.click('button[data-mobile-view="inputs"]');
  await page.click('#example-case-group > summary');await page.click('#case-picker [data-case="CF-006"]');
  if(width<640)for(let step=0;step<4;step++)await page.click('.mobile-step-actions button:last-child');
  else await page.locator('#f-income').evaluate(node=>{node.closest('details.sec').open=true;});
  assert.equal(await page.locator('#f-icrNOI').isVisible(),true);
  await page.locator('#f-icrInterest').evaluate(node=>node.scrollIntoView({block:'center'}));
  if(width<640)assert.equal(await page.locator('#f-icrInterest').evaluate(node=>node.getBoundingClientRect().bottom<innerHeight-70),true,'interest input can scroll clear of phone navigation');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}px ICR inputs overflow`);
  await page.locator('#investment-icr-inputs').screenshot({path:join(out,`icr-inputs-${width}.png`)});
  if(width<640){await page.click('button[data-mobile-view="results"]');}
  await page.click('[data-toggle="investment-icr"]');
  assert.match(await page.locator('#sec-investment-icr').innerText(),/0.75x/);
  await page.screenshot({path:join(out,`icr-${width}.png`),fullPage:true});
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('#body-investment-icr').isVisible(),true);
  assert.match(await page.locator('#sec-investment-icr').innerText(),/Annualization: both amounts × 12/);
  if(width===1440)await page.pdf({path:join(out,'investment-report.pdf'),format:'A4',printBackground:true});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await page.close();
 }
 console.log(JSON.stringify({passed:true,widths:[1440,390],cases:6,tiers:2,externalRequests:0,output:out}));
}finally{await browser?.close();server.close();}

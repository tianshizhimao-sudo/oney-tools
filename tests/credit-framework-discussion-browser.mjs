// Oney Credit Framework — MVP wrapper headless browser smoke test.
// Optional: uses Playwright's bundled Chromium only if it is already installed.
// No dependency is added to this repo; if Playwright cannot be resolved the
// script prints SKIP and exits 0.
//
// Run: node tests/credit-framework-browser-smoke.mjs
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs  (optional explicit module path)
//   CF_SMOKE_OUT=/some/dir                            (screenshots + PDF; default: OS temp dir)
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'));
} catch (err) {
  console.log(JSON.stringify({ skip: true, reason: `Playwright not resolvable (${err.code || err.message})` }));
  process.exit(0);
}

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = process.env.CF_SMOKE_OUT || join(tmpdir(), 'cf-smoke');
await mkdir(OUT, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css' };
const served = [];
const server = http.createServer(async (req, res) => {
  served.push(`${req.method} ${req.url}`);
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  if (path.includes('..')) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
const URL_PAGE = `${process.env.CF_BASE || ORIGIN}/preview/credit-framework.html`;


const { initialState, buildAssessment, buildReport } = await import('../assets/js/preview/credit-framework/engine.js');
const { buildOverview } = await import('../assets/js/preview/credit-framework/overview.js');
const browser = await chromium.launch();
const checks = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL_PAGE);
    await page.waitForSelector('#review-overview', { state: 'attached' });
    for (const id of ['CF-001', 'CF-002', 'CF-004', 'custom']) for (const tier of ['simple', 'comprehensive']) {
      if (width < 640) await page.click('[data-mobile-view="inputs"]');
      await page.click(`#case-picker [data-case="${id}"]`);
      if (width < 640) await page.click('[data-mobile-view="results"]');
      await page.click(`#tier-output [data-tier="${tier}"]`);
      if (id === 'custom') {
        assert.match(await page.locator('#overview-empty').innerText(), /have not been assessed/);
        assert.equal(await page.locator('[data-priority-issue]').count(), 0);
        continue;
      }
      const s = initialState(id, tier), a = buildAssessment(s), r = buildReport(a, tier), v = buildOverview(a, r, s.evidence);
      assert.equal(await page.locator('[data-priority-issue]').count(), v.issues.length);
      for (const q of v.issues) {
        const card = page.locator(`[data-priority-issue="${q.id}"]`);
        assert.ok((await card.innerText()).includes(q.whyItMatters));
        assert.equal(await card.locator('.discussion-next-step').innerText(), `Consider asking: ${q.question}`);
        await card.locator('summary').click();
        assert.deepEqual(await card.locator('li').allTextContents(), q.evidence);
        assert.match(await card.innerText(), /does not establish that evidence is missing/);
        await card.locator('summary').click();
      }
      assert.equal(await page.locator('#review-overview .priority-issue .prio.Critical').count(), v.criticalOpen, 'every open Critical remains directly in the summary');
      const link = page.locator('.overview-issues [data-open-section="questions"]');
      if (v.criticalOpen) assert.ok((await link.innerText()).includes(`all ${v.criticalOpen} Critical`));
      await link.click();
      assert.equal(await page.locator('#body-questions').isVisible(), true);
      for (const q of r.sections.find(s => s.id === 'questions').items.filter(q => q.priority === 'Critical')) {
        assert.equal(await page.locator(`[data-question="${q.id}"]`).isVisible(), true);
      }
      if (id === 'CF-002' && tier === 'comprehensive') {
        await page.locator('#review-overview').screenshot({ path: join(OUT, `discussion-${width}.png`) });
        await page.locator('[data-open-section="rerate"]').first().click();
        const critical = r.sections.find(s => s.id === 'questions').items.filter(q => q.priority === 'Critical');
        for (const q of critical) await page.locator(`[data-rerate="${q.id}"]`).selectOption('supports');
        assert.equal(await page.locator('#overview-critical-count').innerText(), `0 / ${critical.length}`);
        assert.doesNotMatch(await link.innerText(), /Critical needing attention/);
        for (const status of ['reply_only', 'weak', 'outstanding']) {
          await page.locator(`[data-rerate="${critical[0].id}"]`).selectOption(status);
          assert.equal(await page.locator('#overview-critical-count').innerText(), `1 / ${critical.length}`);
          assert.equal(await page.locator(`[data-priority-issue="${critical[0].id}"]`).count(), 1);
        }
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      checks.push({width, id, tier, critical: v.criticalOpen, pass:true});
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  await writeFile(join(OUT, 'discussion-results.json'), JSON.stringify({pass:true, checks}, null, 2));
  console.log(JSON.stringify({pass:true, checks}));
} finally { await browser.close(); server.close(); }

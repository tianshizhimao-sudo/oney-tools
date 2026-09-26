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
const URL_PAGE = `${ORIGIN}/preview/credit-framework.html`;

const EXPECT_Q = { 'CF-001': { simple: 3, comprehensive: 3 }, 'CF-002': { simple: 5, comprehensive: 7 }, 'CF-004': { simple: 4, comprehensive: 4 } };
const BOUNDARY = 'This is a lender-readiness and deal-packaging review. It does not approve credit, predict lender acceptance, or replace licensed credit assessment.';

const browser = await chromium.launch();
const results = { browser: `chromium ${browser.version()}`, origin: ORIGIN, viewports: {} };

async function runViewport(name, contextOpts) {
  const ctx = await browser.newContext({ ...contextOpts, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const external = [];
  const nonGet = [];
  const requests = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('request', (r) => {
    requests.push(r.url());
    if (!r.url().startsWith(ORIGIN) && !r.url().startsWith('data:')) external.push(r.url());
    if (r.method() !== 'GET') nonGet.push(`${r.method()} ${r.url()}`);
  });
  // Belt and braces: anything off-origin is aborted and recorded.
  await page.route('**/*', (route) => (route.request().url().startsWith(ORIGIN) ? route.continue() : route.abort()));

  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await page.waitForSelector('#sec-questions');
  const v = { viewport: contextOpts.viewport, cases: {} };

  // noindex effective in the served DOM
  v.robots = await page.getAttribute('meta[name="robots"]', 'content');
  assert.match(v.robots, /noindex/);

  // CSP effectiveness: an attempted network data call from page context must be blocked
  v.cspFetch = await page.evaluate(async () => { try { await fetch('https://example.com/cf-probe', { mode: 'no-cors' }); return 'allowed'; } catch { return 'blocked'; } });
  assert.equal(v.cspFetch, 'blocked');

  for (const id of ['CF-001', 'CF-002', 'CF-004']) {
    const c = {};
    await page.click(`[data-case="${id}"]`);
    await page.click('#tier-output [data-tier="simple"]');
    c.simpleQuestions = await page.locator('[data-question]').count();
    c.simpleLocked = await page.locator('section[data-locked="true"]').count();
    c.simpleGatedFields = await page.locator('[data-gated]').count();
    c.simpleEmail = await page.locator('#email-draft').count();
    assert.equal(c.simpleQuestions, EXPECT_Q[id].simple, `${name} ${id} simple questions`);
    assert.equal(c.simpleLocked, 4, `${name} ${id} locked sections`);
    assert.equal(c.simpleGatedFields, 0, `${name} ${id} no gated fields in Simple`);
    assert.equal(c.simpleEmail, 0);
    assert.equal(await page.getAttribute('body', 'data-lint'), 'pass', `${name} ${id} simple lint`);

    // copy (Simple) — clipboard read-back
    await page.click('#copy-btn');
    await page.waitForFunction(() => document.body.dataset.copyStatus);
    const simpleClip = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(simpleClip.includes(BOUNDARY), 'copied text has boundary');
    assert.ok(!simpleClip.includes('If strong:'), 'Simple copy excludes gated content');
    c.simpleCopyChars = simpleClip.length;

    await page.click('#tier-output [data-tier="comprehensive"]');
    c.compQuestions = await page.locator('[data-question]').count();
    c.compGatedFields = await page.locator('[data-gated]').count();
    c.compEmail = await page.locator('#email-draft').count();
    c.rerateSelects = await page.locator('[data-rerate]').count();
    assert.equal(c.compQuestions, EXPECT_Q[id].comprehensive);
    assert.equal(c.compGatedFields, EXPECT_Q[id].comprehensive * 4);
    assert.equal(c.compEmail, 1);
    assert.equal(c.rerateSelects, EXPECT_Q[id].comprehensive);
    assert.equal(await page.getAttribute('body', 'data-lint'), 'pass', `${name} ${id} comprehensive lint`);
    await page.click('#copy-btn');
    const compClip = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(compClip.includes('If strong:') && compClip.includes(BOUNDARY));
    c.compCopyChars = compClip.length;
    c.boundaryVisible = await page.locator('#boundary-bottom').isVisible();
    c.kindsVisible = await page.evaluate(() => [...new Set([...document.querySelectorAll('#report [data-kind]')].map((n) => n.dataset.kind))].sort());
    assert.deepEqual(c.kindsVisible, ['assumption', 'calculation', 'fact', 'judgement', 'rule']);
    v.cases[id] = c;
  }

  // Re-rate loop in the UI (CF-002, Comprehensive)
  await page.click('[data-case="CF-002"]');
  await page.click('#tier-output [data-tier="comprehensive"]');
  const selects = await page.locator('[data-rerate]').all();
  for (const s of selects) await s.selectOption('reply_only');
  v.rerateReplyOnly = await page.textContent('#rerate-movement');
  assert.match(v.rerateReplyOnly, /red → red/);
  for (const s of await page.locator('[data-rerate]').all()) await s.selectOption('supports');
  v.rerateSupported = await page.textContent('#rerate-movement');
  assert.match(v.rerateSupported, /red → amber \(up\)/);
  v.rerateConfidence = await page.textContent('#rerate-confidence');
  assert.equal(v.rerateConfidence, 'Medium');

  // Edit -> judgement withdrawn
  await page.click('[data-case="CF-004"]');
  await page.click('details.sec >> summary:has-text("Purpose and amount")');
  await page.fill('#f-loanAmount', '1400000');
  v.editNotice = await page.locator('#custom-notice').isVisible();
  assert.equal(v.editNotice, true);
  assert.equal(await page.getAttribute('body', 'data-pristine'), 'false');
  await page.click('[data-case="CF-004"]');

  // Layout
  v.layout = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll('body *')].filter((n) => {
      const r = n.getBoundingClientRect();
      return r.width > 0 && (r.right > vw + 1 || r.left < -1) && !n.closest('.watermark') && !n.closest('.sr-only');
    }).slice(0, 5).map((n) => `${n.tagName}.${n.className}`);
    const tierBtn = document.querySelector('#tier-output .tier-btn').getBoundingClientRect();
    return { clientWidth: vw, scrollWidth: document.documentElement.scrollWidth, offenders, tierButtonHeight: Math.round(tierBtn.height), brandVisible: !!document.querySelector('#brand svg').getBoundingClientRect().width, watermark: getComputedStyle(document.querySelector('#watermark')).display };
  });
  assert.ok(v.layout.scrollWidth <= v.layout.clientWidth, `${name} horizontal overflow ${JSON.stringify(v.layout)}`);
  assert.deepEqual(v.layout.offenders, []);
  assert.ok(v.layout.tierButtonHeight >= 40);
  assert.ok(v.layout.brandVisible);
  await page.screenshot({ path: join(OUT, `${name}-cf004-simple-top.png`) });
  await page.click('[data-case="CF-002"]');
  await page.click('#tier-output [data-tier="comprehensive"]');
  await page.screenshot({ path: join(OUT, `${name}-cf002-comprehensive-full.png`), fullPage: true });

  // Print / PDF
  await page.emulateMedia({ media: 'print' });
  v.print = await page.evaluate(() => ({
    intake: getComputedStyle(document.querySelector('#intake')).display,
    actions: getComputedStyle(document.querySelector('.out-head .actions')).display,
    watermark: getComputedStyle(document.querySelector('#watermark')).display,
    printHead: getComputedStyle(document.querySelector('#print-head')).display,
    printHeadText: document.querySelector('#print-head').innerText.slice(0, 120),
    bodyBg: getComputedStyle(document.body).backgroundColor,
  }));
  assert.equal(v.print.intake, 'none');
  assert.equal(v.print.actions, 'none');
  assert.equal(v.print.watermark, 'grid');
  assert.equal(v.print.printHead, 'block');
  assert.equal(v.print.bodyBg, 'rgb(255, 255, 255)');
  if (name === 'desktop') {
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await writeFile(join(OUT, 'cf002-comprehensive-print.pdf'), pdf);
    v.pdfBytes = pdf.length;
    v.pdfPages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    assert.ok(v.pdfBytes > 10000 && v.pdfPages >= 2);
  }
  await page.screenshot({ path: join(OUT, `${name}-cf002-print-media.png`), fullPage: false });
  await page.emulateMedia({ media: 'screen' });

  v.consoleErrors = consoleErrors;
  v.externalRequests = external;
  v.nonGetRequests = nonGet;
  v.requestCount = requests.length;
  v.uniqueRequests = [...new Set(requests.map((u) => u.replace(ORIGIN, '')))];
  assert.deepEqual(consoleErrors.filter((e) => !/Content Security Policy|Refused to connect|Failed to fetch/i.test(e)), [], `${name} console errors`);
  assert.deepEqual(external, [], `${name} external requests`);
  assert.deepEqual(nonGet, [], `${name} non-GET requests`);
  results.viewports[name] = v;
  await ctx.close();
}

try {
  await runViewport('desktop', { viewport: { width: 1440, height: 900 } });
  await runViewport('mobile-390', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  results.pass = true;
} catch (err) {
  results.pass = false;
  results.error = err.message;
  process.exitCode = 1;
} finally {
  results.servedNonGet = served.filter((s) => !s.startsWith('GET '));
  results.out = OUT;
  await browser.close();
  server.close();
  console.log(JSON.stringify(results, null, 2));
}

// Partial-support review records — real-browser evidence run (A01, A04, A07, A08, A09, A10, A11, A12).
// Same conventions as credit-framework-browser-smoke.mjs: uses an already-installed Playwright only,
// serves the repo on loopback, never adds a dependency. SKIP + exit 0 when Playwright is absent.
//
// Run: node tests/credit-framework-evidence-review-browser.mjs
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.js   CF_EVIDENCE_OUT=/some/dir
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { classifyRequests } from './helpers/a12-network-policy.mjs';
let chromium;
try { ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')); }
catch (err) { console.log(JSON.stringify({ skip: true, reason: `Playwright not resolvable (${err.code || err.message})` })); process.exit(0); }

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = process.env.CF_EVIDENCE_OUT || join(tmpdir(), 'cf-evidence-review');
await mkdir(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const served = [];
const server = http.createServer(async (req, res) => {
  let body = ''; req.on('data', (c) => { body += c; });
  req.on('end', async () => {
    served.push({ method: req.method, url: req.url, requestBodyBytes: Buffer.byteLength(body), contentLength: req.headers['content-length'] || null });
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    if (path.includes('..')) { res.writeHead(403).end(); return; }
    try { const data = await readFile(join(ROOT, path)); res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }).end(data); }
    catch { res.writeHead(404).end(); }
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const FIXTURE = {
  sourceId: 'F-SG-01-CF002-20261023', sourceVersion: '2026-10-23', sourceLocator: 'F06–F10; F11–F13',
  supportedScope: 'Synthetic summary shows no Super balance / overdue (AUD 0.00) at 2026-10-23 (synthetic).',
  remainingGap: 'Per-period SG liability, on-time payment to fund and fund receipt / payroll-to-fund reconciliation unknown.',
  note: '部分支持', reviewerLabel: 'owner', ownerReviewDate: '2026-10-23 (time not provided)',
};
const SG = 'sg_unevidenced';
const result = { base, startedAt: new Date().toISOString(), steps: [], network: { pageRequests: [], serverRequests: null }, assertions: [] };
let seq = 0;
const note = (id, text, data = {}) => result.steps.push({ id, text, ...data });
const check = (id, cond, text) => { result.assertions.push({ id, pass: Boolean(cond), text }); assert.ok(cond, `${id}: ${text}`); };

// Allow-set of static URLs that the page and its modules reference in source (path+query). Any
// request outside this set — even same-origin — is a violation. Built once from the repo on disk.
async function buildStaticAllow() {
  const allow = new Set();
  const html = await readFile(join(ROOT, 'preview/credit-framework.html'), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) allow.add(m[1].replace(/&amp;/g, '&'));
  const dirs = ['assets/js/preview/credit-framework', 'assets/js/core'];
  const { readdir } = await import('node:fs/promises');
  for (const dir of dirs) for (const f of await readdir(join(ROOT, dir))) {
    if (!f.endsWith('.js')) continue;
    const src = await readFile(join(ROOT, dir, f), 'utf8');
    for (const m of src.matchAll(/from\s+'(\.\.?\/[^']+)'/g)) { const abs = new URL(m[1], `http://x/${dir}/${f}`); allow.add(abs.pathname + abs.search); }
  }
  return allow;
}
const staticAllow = await buildStaticAllow();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
page.on('request', (r) => result.network.pageRequests.push({ seq: seq++, phase: currentPhase, method: r.method(), url: r.url(), postData: r.postData() ?? null, resourceType: r.resourceType(), headers: r.headers() }));
page.on('console', (m) => { if (m.type() === 'error') result.steps.push({ id: 'console', text: m.text() }); });
let currentPhase = 'load';
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
const snapshot = () => page.evaluate(() => ({
  movement: document.querySelector('#rerate-movement')?.textContent ?? null, confidence: document.querySelector('#rerate-confidence')?.textContent ?? null,
  critical: document.querySelector('#overview-critical-count')?.textContent ?? null, rating: document.querySelector('#f-rating')?.value ?? null,
  triggers: [...document.querySelectorAll('#intake input[type="checkbox"]:checked')].map((n) => n.id).sort(),
  manual: [...document.querySelectorAll('[data-risk-readout]')].map((n) => n.dataset.status).join(','),
  badges: [...document.querySelectorAll('[data-review-badge]')].map((n) => ({ id: n.dataset.reviewBadge, validity: n.dataset.validity, text: n.textContent })),
  sgEngine: document.querySelector('[data-rerate="sg_unevidenced"]')?.value ?? null,
  reviewSection: document.querySelector('#sec-evidence-review')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
}));
const expand = async (...ids) => { for (const id of ids) { const t = await page.$(`[data-toggle="${id}"]`); if (t && await t.getAttribute('aria-expanded') !== 'true') await t.click(); } };
// Copy path is recorded explicitly, never silently merged:
//   app path  = document.body.dataset.copyStatus set by the app ('clipboard' | 'legacy' | 'failed')
//   read path = 'clipboard' when navigator.clipboard.readText() returned the text, else 'buffer' (#copy-buffer)
// Content assertions use whichever text was obtained; the receipt reports the path per copy.
const copies = [];
const copyText = async (label) => {
  await page.click('#copy-btn'); await page.waitForTimeout(150);
  const r = await page.evaluate(async () => {
    const appPath = document.body.dataset.copyStatus || null; const buffer = document.querySelector('#copy-buffer').value;
    let clipboard = null, readError = null; try { clipboard = await navigator.clipboard.readText(); } catch (e) { readError = String(e && e.message || e); }
    return { appPath, readPath: clipboard ? 'clipboard' : 'buffer', clipboardLength: clipboard ? clipboard.length : 0, bufferLength: buffer.length, readError, text: clipboard || buffer, sameContent: clipboard ? clipboard === buffer || buffer === '' : null };
  });
  copies.push({ label, appPath: r.appPath, readPath: r.readPath, clipboardLength: r.clipboardLength, bufferLength: r.bufferLength, readError: r.readError, sameContent: r.sameContent });
  return r.text;
};
const fill = async (key, value) => page.fill(`#review-${key}-${SG}`, value);

try {
  await page.goto(`${base}/preview/credit-framework.html?case=CF-002&tier=comprehensive`, { waitUntil: 'networkidle' });
  await expand('rerate', 'evidence-review', 'questions');
  await page.waitForSelector('[data-rerate="sg_unevidenced"]');
  const before = await snapshot(); note('A01-before', 'CF-002 Comprehensive loaded, no records', { before }); await shot('01-comprehensive-before');
  check('A05', before.badges.length === 0 && before.sgEngine === 'outstanding', 'no record, SG engine status outstanding');
  check('A05-options', JSON.stringify(await page.$$eval('[data-rerate="sg_unevidenced"] option', (o) => o.map((x) => x.value))) === JSON.stringify(['outstanding', 'reply_only', 'supports', 'weak']), 'tracker keeps the four engine options');

  currentPhase = 'confirm-partial';
  await page.click(`[data-open-review="${SG}"]`); await page.waitForSelector(`#review-editor-${SG}`);
  await page.click(`[data-confirm-review="${SG}"]`);
  const err = await page.textContent(`#review-error-${SG}`); check('A06', /Draft only/.test(err), `validation blocks confirm: ${err}`);
  await shot('02-editor-draft-validation');
  for (const [k, v] of Object.entries(FIXTURE)) await fill(k, v);
  await page.click(`[data-confirm-review="${SG}"]`); await page.waitForSelector(`[data-review-badge="${SG}"][data-validity="current"]`);
  const afterConfirm = await snapshot(); await shot('03-comprehensive-partial-current');
  check('A01', afterConfirm.badges.some((b) => b.id === SG && b.validity === 'current'), 'partial record current on SG');
  check('A03-I', JSON.stringify([afterConfirm.movement, afterConfirm.confidence, afterConfirm.critical, afterConfirm.rating, afterConfirm.triggers, afterConfirm.manual, afterConfirm.sgEngine]) === JSON.stringify([before.movement, before.confidence, before.critical, before.rating, before.triggers, before.manual, before.sgEngine]), 'rating/confidence/critical/triggers/manual/engine status unchanged by partial record');
  check('A13', afterConfirm.triggers.join() === before.triggers.join() && afterConfirm.manual === before.manual, 'triggers and manual rings untouched');
  const recordText = await page.textContent(`[data-review-record="${SG}"]`);
  check('A01-text', /F-SG-01-CF002-20261023/.test(recordText) && /Still unproven/.test(recordText) && /SYNTHETIC TEST FIXTURE/.test(recordText) && !/\bverified\b/i.test(recordText), 'record shows source, gap, synthetic tag, no "verified"');
  currentPhase = 'copy-current';
  const copyCurrent = await copyText('comprehensive-current'); await writeFile(join(OUT, 'copy-comprehensive-current.txt'), copyCurrent);
  check('A10-current', /\[CURRENT\]/.test(copyCurrent) && /Original gap:/.test(copyCurrent) && /Engine status \(unchanged\): Not received/.test(copyCurrent), 'copied report carries CURRENT record');
  currentPhase = 'print';
  // page.pdf() uses whatever media is currently emulated; force print media for every PDF and reset afterwards.
  const pdf = async (name) => { await page.emulateMedia({ media: 'print' }); await page.pdf({ path: join(OUT, name), format: 'A4', printBackground: false }); await page.emulateMedia({ media: null }); };
  await pdf('print-comprehensive-current.pdf');
  await page.emulateMedia({ media: 'print' }); await shot('04-print-media-comprehensive'); await page.emulateMedia({ media: null });
  note('A11', 'PDF written via Chromium print pipeline (page.pdf) + print-media screenshot');

  currentPhase = 'simple';
  await page.click('#tier-output [data-tier="simple"]'); await expand('evidence-review', 'questions'); await page.waitForSelector(`[data-review-badge="${SG}"]`);
  const simple = await snapshot(); await shot('05-simple-partial-visible');
  check('A08-simple', simple.badges.some((b) => b.id === SG && b.validity === 'current') && /1 current · 0 stale · 0 conflict · 0 draft/.test(simple.reviewSection), 'Simple shows same partial record and gap-remains');
  const copySimple = await copyText('simple-current'); await writeFile(join(OUT, 'copy-simple-current.txt'), copySimple);
  check('A08-copy', /Manual evidence-review records/.test(copySimple) && /\[CURRENT\]/.test(copySimple), 'Simple copy carries the record');
  await page.click('#tier-output [data-tier="comprehensive"]'); await expand('rerate', 'evidence-review', 'questions'); await page.waitForSelector('[data-rerate="sg_unevidenced"]');
  const back = await snapshot(); check('A08-roundtrip', back.badges[0]?.validity === 'current' && back.movement === before.movement, 'tier round-trip keeps record and evaluation');

  currentPhase = 'weak';
  await page.selectOption('[data-rerate="sg_unevidenced"]', 'weak'); await page.waitForSelector(`[data-weak-retained="${SG}"]`);
  const weak = await snapshot(); await shot('06-weak-plus-partial');
  check('A04', weak.sgEngine === 'weak' && weak.badges[0]?.validity === 'current' && /Low/.test(weak.confidence), 'weak drives engine (Low) while partial record stays beside it');
  const copyWeak = await copyText('weak-plus-partial'); await writeFile(join(OUT, 'copy-weak-plus-partial.txt'), copyWeak);
  check('A04-copy', /Counterevidence recorded .* is retained/.test(copyWeak), 'copy states counterevidence retained');
  await page.selectOption('[data-rerate="sg_unevidenced"]', 'outstanding');

  currentPhase = 'supports-conflict';
  // A02 reverse path: tracker set to supports AFTER the partial record was confirmed.
  const movementBeforeSupports = await page.textContent('#rerate-out');
  await page.selectOption('[data-rerate="sg_unevidenced"]', 'supports'); await page.waitForSelector(`[data-review-badge="${SG}"][data-validity="conflict"]`);
  const conflict = await snapshot(); await shot('06b-supports-after-partial-conflict');
  check('A02-reverse', conflict.badges[0]?.validity === 'conflict' && conflict.badges[0].text.startsWith('Partial support · NOT CURRENT') && /1 conflict/.test(conflict.reviewSection), 'record is NOT CURRENT / conflict once engine status is supports');
  check('A02-reverse-engine', (await page.textContent('#rerate-out')) !== movementBeforeSupports, 'existing supports rule still applied by the engine (record layer did not block it)');
  const copyConflict = await copyText('supports-conflict'); await writeFile(join(OUT, 'copy-supports-conflict.txt'), copyConflict);
  check('A02-reverse-copy', /\[CONFLICT — engine status is supports; partial record not current; re-review required\]/.test(copyConflict) && !/gap remains \[CURRENT\]/.test(copyConflict), 'copied report marks CONFLICT, not CURRENT');
  const PRESENT_TENSE_SUPPORTS = /engine status is supports|keeps applying|currently treats this item as supported|is currently "supports"/;
  currentPhase = 'conflict-history-outstanding';
  await page.selectOption('[data-rerate="sg_unevidenced"]', 'outstanding'); await page.waitForSelector(`[data-conflict="${SG}"][data-conflict-kind="historical"]`);
  const hist = await snapshot(); await shot('06c-conflict-history-outstanding');
  const histNotice = await page.textContent(`[data-conflict="${SG}"]`); const histRecord = await page.textContent(`[data-review-record="${SG}"]`);
  check('A02-reverse-sticky', hist.badges[0]?.validity === 'conflict' && hist.badges[0].text.startsWith('Partial support · NOT CURRENT'), 'conflict is sticky after moving the engine status back');
  check('r3-outstanding-wording', !PRESENT_TENSE_SUPPORTS.test(hist.badges[0].text) && !PRESENT_TENSE_SUPPORTS.test(histNotice) && /has since been changed to "Not received \/ not yet reviewed"/.test(histNotice) && /Engine status \(unchanged\): Not received \/ not yet reviewed/.test(histRecord) && !/currently treats/.test(histRecord), 'no present-tense supports wording once engine status is outstanding; engine field shows outstanding');
  const copyHistOut = await copyText('conflict-history-outstanding'); await writeFile(join(OUT, 'copy-conflict-history-outstanding.txt'), copyHistOut);
  check('r3-outstanding-copy', !PRESENT_TENSE_SUPPORTS.test(copyHistOut) && /\[NOT CURRENT — prior supports conflict; engine status now "Not received \/ not yet reviewed"; re-review required\]/.test(copyHistOut), 'copied report: historical wording, no present-tense supports');
  currentPhase = 'conflict-history-weak';
  await page.selectOption('[data-rerate="sg_unevidenced"]', 'weak'); await page.waitForSelector(`[data-weak-retained="${SG}"]`);
  const histWeak = await snapshot(); await shot('06d-conflict-history-weak');
  const weakNotice = await page.textContent(`[data-conflict="${SG}"]`);
  check('r3-weak-state', histWeak.badges[0]?.validity === 'conflict' && histWeak.sgEngine === 'weak' && /Low/.test(histWeak.confidence) && !PRESENT_TENSE_SUPPORTS.test(weakNotice) && /weak\/contradicts/.test(weakNotice), 'supports → weak: still NOT CURRENT, counterevidence drives engine (Low), wording names weak');
  const copyHistWeak = await copyText('conflict-history-weak'); await writeFile(join(OUT, 'copy-conflict-history-weak.txt'), copyHistWeak);
  check('r3-weak-copy', !PRESENT_TENSE_SUPPORTS.test(copyHistWeak) && /Counterevidence recorded .* is retained/.test(copyHistWeak) && /engine status now "Reviewed evidence — weak\/contradicts"/.test(copyHistWeak), 'copied report: weak retained, historical conflict, no present-tense supports');
  currentPhase = 'conflict-history-weak-stale';
  await page.fill('#f-dealName', 'S-r3 synthetic label change'); await page.waitForSelector(`[data-stale="${SG}"]`);
  const histWeakStale = await snapshot(); await shot('06e-conflict-history-weak-stale');
  const copyHistWeakStale = await copyText('conflict-history-weak-stale'); await writeFile(join(OUT, 'copy-conflict-history-weak-stale.txt'), copyHistWeakStale);
  check('r3-weak-stale', histWeakStale.badges[0]?.validity === 'conflict' && /Inputs changed since this record was confirmed/.test(copyHistWeakStale) && !PRESENT_TENSE_SUPPORTS.test(copyHistWeakStale), 'conflict + stale both stated; still NOT CURRENT; no present-tense supports');
  await page.click(`[data-open-review="${SG}"]`); await page.click(`[data-confirm-review="${SG}"]`); await page.waitForSelector(`[data-review-badge="${SG}"][data-validity="current"]`);
  const afterReconfirm = await snapshot(); await shot('06f-after-manual-reconfirm-weak-kept');
  check('r3-reconfirm', afterReconfirm.sgEngine === 'weak' && /Low/.test(afterReconfirm.confidence), 'manual re-confirm restores CURRENT without touching weak or confidence');
  await page.selectOption('[data-rerate="sg_unevidenced"]', 'outstanding'); await page.fill('#f-dealName', 'Northside Hospitality Group — ATO Debt Restructure'); await page.waitForTimeout(100);
  // Record is now stale (two input changes); re-confirm so the following stale step starts from CURRENT.
  await page.click(`[data-open-review="${SG}"]`); await page.click(`[data-confirm-review="${SG}"]`); await page.waitForSelector(`[data-review-badge="${SG}"][data-validity="current"]`);

  currentPhase = 'stale';
  await page.fill('#f-dealName', 'S-A07 synthetic label change'); await page.waitForSelector(`[data-review-badge="${SG}"][data-validity="stale"]`);
  const stale = await snapshot(); await shot('07-stale-after-input-change');
  check('A07', stale.badges[0]?.validity === 'stale', 'record stale after input change');
  const copyStale = await copyText('stale'); await writeFile(join(OUT, 'copy-stale.txt'), copyStale);
  check('A10-stale', /\[STALE — inputs changed; re-review required\]/.test(copyStale), 'copied report marks STALE');
  await page.click(`[data-open-review="${SG}"]`); const btn = await page.textContent(`[data-confirm-review="${SG}"]`);
  check('A07-manual', /Re-review and confirm/.test(btn), 'explicit manual re-review button');
  await page.click(`[data-confirm-review="${SG}"]`); await page.waitForSelector(`[data-review-badge="${SG}"][data-validity="current"]`);

  currentPhase = 'source-stale';
  // A07 (source reference): change the confirmed citation's version → STALE (source), survives Close and type-back; manual re-confirm restores.
  await page.click(`[data-open-review="${SG}"]`); await page.fill(`#review-sourceVersion-${SG}`, '2026-10-24'); await page.waitForSelector(`[data-review-badge="${SG}"][data-validity="stale"]`);
  const srcStale = await snapshot(); await shot('07b-source-version-changed-stale');
  check('A07-source', srcStale.badges[0]?.validity === 'stale' && /source reference changed/.test(srcStale.badges[0].text) && !/CURRENT/.test(srcStale.badges[0].text), 'source version change invalidates the record (not CURRENT)');
  await page.click(`[data-cancel-review="${SG}"]`); await page.waitForTimeout(100);
  check('A07-source-close', (await snapshot()).badges[0]?.validity === 'stale', 'Close does not restore');
  const copySrcStale = await copyText('source-stale'); await writeFile(join(OUT, 'copy-source-stale.txt'), copySrcStale);
  check('A07-source-copy', /\[STALE — source reference changed; re-review required\]/.test(copySrcStale) && /Confirmed citation: .*2026-10-23/.test(copySrcStale) && /Draft citation: .*2026-10-24/.test(copySrcStale), 'copied report shows prior and draft citation, STALE (source)');
  await page.click(`[data-open-review="${SG}"]`); await page.fill(`#review-sourceVersion-${SG}`, '2026-10-23'); await page.waitForTimeout(100);
  check('A07-source-typeback', (await snapshot()).badges[0]?.validity === 'stale', 'typing the original version back does not restore');
  await shot('07c-source-typed-back-still-stale');
  await page.click(`[data-confirm-review="${SG}"]`); await page.waitForSelector(`[data-review-badge="${SG}"][data-validity="current"]`);

  currentPhase = 'unknown-status-weak';
  // A14 (fail-closed): with SG weak + partial, inject an unknown status via the existing select; weak must be retained.
  await page.selectOption('[data-rerate="sg_unevidenced"]', 'weak'); await page.waitForSelector(`[data-weak-retained="${SG}"]`);
  const weakBefore = await snapshot();
  await page.evaluate(() => { const p = document.querySelector('[data-rerate="sg_unevidenced"]'); const o = document.createElement('option'); o.value = 'partial'; p.append(o); p.value = 'partial'; p.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForSelector('#evidence-status-unsupported');
  const weakAfter = await snapshot(); await shot('10b-unknown-status-weak-retained');
  check('A14-weak-retained', weakAfter.sgEngine === 'weak' && weakAfter.confidence === weakBefore.confidence && weakAfter.movement === weakBefore.movement && /Low/.test(weakAfter.confidence), 'unknown value does not swallow weak: tracker weak, confidence Low, movement unchanged');
  const copyUnknown = await copyText('unknown-status-weak'); await writeFile(join(OUT, 'copy-unknown-status-weak.txt'), copyUnknown);
  check('A14-copy', /Unsupported review status ignored .*recorded weak\/contradicts retained/.test(copyUnknown) && /Engine status \(unchanged\): Reviewed evidence — weak\/contradicts/.test(copyUnknown), 'copied report states the hold and the retained weak');
  await page.selectOption('[data-rerate="sg_unevidenced"]', 'outstanding'); await page.waitForTimeout(100);
  check('A14-manual-clears', (await page.$('#evidence-status-unsupported')) === null && (await snapshot()).sgEngine === 'outstanding', 'explicit manual choice clears the hold and the normal four-state choice still works');

  currentPhase = 'draft-vs-confirmed';
  // Unconfirmed draft vs confirmed content: edit S1/G1 over confirmed S0/G0 WITHOUT closing the editor.
  const S0 = 'SCOPE-S0 synthetic summary shows no Super balance', G0 = 'GAP-G0 per-period liability and fund receipt unknown', S1 = 'SCOPE-S1 EDITED DRAFT TEXT', G1 = 'GAP-G1 EDITED DRAFT TEXT';
  await page.click(`[data-open-review="${SG}"]`); await page.fill(`#review-supportedScope-${SG}`, S0); await page.fill(`#review-remainingGap-${SG}`, G0); await page.click(`[data-confirm-review="${SG}"]`); await page.waitForSelector(`[data-review-badge="${SG}"][data-validity="current"]`);
  const fixedBefore = await snapshot();
  await page.click(`[data-open-review="${SG}"]`); await page.click(`#review-supportedScope-${SG}`); await page.keyboard.press('Control+A'); await page.keyboard.type(S1);
  const focusAfter = await page.evaluate(() => ({ id: document.activeElement?.id, sel: document.activeElement?.selectionStart, val: document.activeElement?.value }));
  check('draft-focus', focusAfter.id === `review-supportedScope-${SG}` && focusAfter.val === S1 && focusAfter.sel === S1.length, `focus and caret kept while typing (${JSON.stringify(focusAfter)})`);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); // leave field; no Close
  const openDraft = await snapshot(); await shot('08b-draft-S1-editor-open-not-closed');
  const recText = await page.textContent(`[data-review-record="${SG}"]`); const pendingBlock = await page.textContent(`[data-pending-drafts="${SG}"]`).catch(() => '');
  check('draft-immediate-ui', openDraft.badges[0]?.validity === 'draft-edits' && /unconfirmed draft edits pending/.test(openDraft.badges[0].text) && recText.includes(`Supports: ${S0}`) && !recText.includes(`Supports: ${S1}`) && pendingBlock.includes(`supported scope: "${S1}" (confirmed: "${S0}")`) && Boolean(await page.$(`[data-draft-dirty="supportedScope"]`)), 'editor open: badge pending, record keeps S0, pending block lists S1, field flagged');
  const copyDraftOpen = await copyText('draft-S1-open'); await writeFile(join(OUT, 'copy-draft-S1-open.txt'), copyDraftOpen);
  check('draft-immediate-copy', /\[CURRENT — unconfirmed draft edits pending\]/.test(copyDraftOpen) && copyDraftOpen.includes(`Supports: ${S0}`) && copyDraftOpen.includes(`Unconfirmed draft edit (not applied) — supported scope: "${S1}"`) && !copyDraftOpen.includes(`Supports: ${S1}`), 'copy while editing: pending tag, confirmed S0, S1 only as unapplied draft');
  await pdf('print-draft-S1-open.pdf');
  const pdfText = await page.evaluate(() => { const r = document.querySelector('[data-review-record="sg_unevidenced"]'); return r ? r.textContent : ''; });
  check('draft-print-dom', pdfText.includes('Supports: SCOPE-S0') && pdfText.includes('Unconfirmed draft edits pending'), 'printable record block keeps S0 and shows pending (PDF text verified offline with pdftotext in the receipt)');
  check('draft-fixed-facts', JSON.stringify([openDraft.movement, openDraft.confidence, openDraft.critical, openDraft.sgEngine]) === JSON.stringify([fixedBefore.movement, fixedBefore.confidence, fixedBefore.critical, fixedBefore.sgEngine]), 'drafts do not change rating/confidence/critical/engine');
  await page.click(`[data-cancel-review="${SG}"]`); await page.waitForTimeout(100);
  const closed = await snapshot(); await shot('08c-draft-after-close');
  check('draft-close-keeps', closed.badges[0]?.validity === 'draft-edits' && !(await page.$(`#review-editor-${SG}`)), 'Close only closes; draft kept (no discard control exists — NOT APPLICABLE)');
  await page.click(`[data-open-review="${SG}"]`); check('draft-reopen', (await page.inputValue(`#review-supportedScope-${SG}`)) === S1, 'reopen shows kept draft S1');
  await page.fill(`#review-remainingGap-${SG}`, G1); await page.fill(`#review-supportedScope-${SG}`, ''); await page.click(`[data-confirm-review="${SG}"]`); await page.waitForSelector(`#review-error-${SG}`);
  const invalid = await snapshot(); await shot('08d-invalid-draft-rejected');
  check('draft-invalid', /Draft only/.test(await page.textContent(`#review-error-${SG}`)) && (await page.textContent(`[data-review-record="${SG}"]`)).includes(`Supports: ${S0}`) && invalid.badges[0]?.validity === 'draft-edits', 'invalid draft rejected; confirmed S0 untouched');
  await page.fill(`#review-supportedScope-${SG}`, S1); await page.click(`[data-confirm-review="${SG}"]`); await page.waitForSelector(`[data-review-badge="${SG}"][data-validity="current"]`);
  const applied = await snapshot(); await shot('08e-after-reconfirm-S1-applied');
  const copyApplied = await copyText('draft-S1-applied'); await writeFile(join(OUT, 'copy-draft-S1-applied.txt'), copyApplied);
  check('draft-applied', applied.badges[0]?.validity === 'current' && copyApplied.includes(`Supports: ${S1}`) && copyApplied.includes(`Still unproven: ${G1}`) && !/Unconfirmed draft|SCOPE-S0|GAP-G0/.test(copyApplied) && JSON.stringify([applied.movement, applied.confidence]) === JSON.stringify([fixedBefore.movement, fixedBefore.confidence]), 'manual re-confirm applies S1/G1; S0/G0 gone; evaluation unchanged');
  await page.click(`[data-open-review="${SG}"]`); await page.fill(`#review-supportedScope-${SG}`, FIXTURE.supportedScope); await page.fill(`#review-remainingGap-${SG}`, FIXTURE.remainingGap); await page.click(`[data-confirm-review="${SG}"]`); await page.waitForSelector(`[data-review-badge="${SG}"][data-validity="current"]`);

  currentPhase = 'draft';
  await page.click('[data-open-review="ato_debt"]'); await page.fill('#review-sourceId-ato_debt', 'DRAFT-ONLY-SYNTHETIC');
  const copyDraft = await copyText('draft-plus-current'); await writeFile(join(OUT, 'copy-draft-plus-current.txt'), copyDraft);
  check('A10-draft', /\[DRAFT — not confirmed\]/.test(copyDraft) && /\[CURRENT\]/.test(copyDraft), 'copied report distinguishes DRAFT and CURRENT');
  await shot('08-draft-and-current');

  currentPhase = 'blank';
  await page.click('#case-picker [data-case="custom"]'); await page.waitForTimeout(100); await expand('rerate', 'evidence-review');
  const blank = await snapshot(); await shot('09-blank');
  const copyBlank = await copyText('blank'); await writeFile(join(OUT, 'copy-blank.txt'), copyBlank);
  check('A09', blank.badges.length === 0 && /No partial-support records/.test(blank.reviewSection) && !/F-SG-01|DRAFT-ONLY/.test(copyBlank) && !/Manual evidence-review records/.test(copyBlank), 'Blank clears records, drafts and copy text');

  currentPhase = 'done';
  result.copies = copies; await writeFile(join(OUT, 'copy-paths.json'), JSON.stringify(copies, null, 2));
  check('A10-path', copies.length === 14 && copies.every((c) => c.appPath === 'clipboard' && c.readPath === 'clipboard'), `copy paths: ${copies.map((c) => `${c.label}:${c.appPath}/${c.readPath}`).join(', ')}`);
  const policy = classifyRequests(result.network.pageRequests, served, { origin: base, staticAllow });
  result.network.serverRequests = served;
  await writeFile(join(OUT, 'network-raw-page-requests.json'), JSON.stringify(result.network.pageRequests, null, 2));
  await writeFile(join(OUT, 'network-raw-server-requests.json'), JSON.stringify(served, null, 2));
  await writeFile(join(OUT, 'network-baseline-navigation.json'), JSON.stringify({ expectedOrigin: policy.expectedOrigin, baselineHref: policy.baselineHref, matched: policy.baseline }, null, 2));
  await writeFile(join(OUT, 'network-interaction-requests.json'), JSON.stringify(policy.interaction, null, 2));
  await writeFile(join(OUT, 'network-violations.json'), JSON.stringify(policy.violations, null, 2));
  await writeFile(join(OUT, 'network-static-allow.json'), JSON.stringify([...staticAllow].sort(), null, 2));
  check('A12', policy.pass, `baseline navigation (${policy.baselineHref}) matched exactly ${policy.baseline.length}×; ${policy.interaction.length} other requests checked (origin, method, body, document, path, static query key, source allow-list, markers, headers, server destination); violations=${policy.violations.length}. Conclusion limited to requests observed in this run.`);
  result.network.summary = { total: result.network.pageRequests.length, baseline: policy.baseline.length, interaction: policy.interaction.length, violations: policy.violations, phasesSeen: [...new Set(result.network.pageRequests.map((r) => r.phase))] };
  result.ok = true;
} catch (err) {
  result.ok = false; result.error = String(err && err.stack || err);
} finally {
  result.finishedAt = new Date().toISOString();
  await writeFile(join(OUT, 'result.json'), JSON.stringify(result, null, 2));
  await browser.close(); server.close();
  console.log(JSON.stringify({ ok: result.ok, out: OUT, assertions: result.assertions.length, failed: result.assertions.filter((a) => !a.pass).map((a) => a.id), error: result.error || null }));
  process.exit(result.ok ? 0 : 1);
}

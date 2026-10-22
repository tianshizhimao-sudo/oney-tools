// Build token: page footer, app.js script query and copied report must agree.
// CF_JSDOM_MODULE=/absolute/path/to/jsdom/lib/api.js node --test tests/credit-framework-build-stamp.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BUILD_ID, BUILD_LINE } from '../assets/js/preview/credit-framework/build-info.js';

const html = await readFile(new URL('../preview/credit-framework.html', import.meta.url), 'utf8');

test('T4 build token has the documented shape and the report line is derived from it', () => {
  assert.match(BUILD_ID, /^cf-\d{8}-[a-z0-9]+$/);
  assert.equal(BUILD_LINE, `Build ${BUILD_ID}`);
});

test('T1 footer carries data-build and visible build text equal to BUILD_ID', () => {
  const footer = html.match(/<footer class="footer"([^>]*)>([\s\S]*?)<\/footer>/);
  assert.ok(footer, 'footer present');
  assert.match(footer[1], new RegExp(`data-build="${BUILD_ID}"`));
  assert.match(footer[2], new RegExp(`Build ${BUILD_ID}`));
  assert.doesNotMatch(footer[1], /no-print/, 'footer must stay printable');
});

test('T2 app.js script query string uses the same token as BUILD_ID', () => {
  const scripts = [...html.matchAll(/src="\/assets\/js\/preview\/credit-framework\/app\.js\?v=([^"&]+)"/g)];
  assert.equal(scripts.length, 1, 'exactly one app.js entry script');
  assert.equal(scripts[0][1], BUILD_ID);
});

let JSDOM;
try { ({ JSDOM } = await import(process.env.CF_JSDOM_MODULE || 'jsdom')); } catch {}

(JSDOM ? test : test.skip)('T3 copied report ends with the build line across tier and case changes', async () => {
  const dom = new JSDOM(html, { url: 'https://example.test/preview/credit-framework.html?tier=comprehensive', pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false });
  window.HTMLElement.prototype.scrollIntoView = function () {};
  for (const k of ['window', 'document', 'Node', 'location']) globalThis[k] = window[k];
  document.execCommand = () => true;
  await import('../assets/js/preview/credit-framework/app.js');
  const $ = (s) => document.querySelector(s);
  const copied = () => { $('#copy-btn').click(); return $('#copy-buffer').value; };
  const endsWithBuild = (text) => assert.ok(text.trimEnd().endsWith(BUILD_LINE), `report should end with "${BUILD_LINE}", got: …${text.trimEnd().slice(-60)}`);
  const first = copied();
  endsWithBuild(first);
  assert.equal(first.split(BUILD_LINE).length, 2, 'build line appears exactly once');
  $('#tier-output [data-tier="simple"]').click();
  endsWithBuild(copied());
  $('#case-picker [data-case="custom"]').click();
  endsWithBuild(copied());
  assert.equal($('footer.footer').dataset.build, BUILD_ID);
  dom.window.close();
});

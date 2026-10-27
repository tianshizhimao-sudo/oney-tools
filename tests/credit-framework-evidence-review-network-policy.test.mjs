// Negative controls for the A12 policy. In-memory data only: no browser, no server, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRequests } from './helpers/a12-network-policy.mjs';

const origin = 'http://127.0.0.1:38171';
const NAV = `${origin}/preview/credit-framework.html?case=CF-002&tier=comprehensive`;
const nav = (over = {}) => ({ seq: 0, phase: 'load', method: 'GET', resourceType: 'document', url: NAV, postData: null, headers: {}, ...over });
const asset = (p, over = {}) => ({ seq: 1, phase: 'load', method: 'GET', resourceType: 'script', url: `${origin}${p}`, postData: null, headers: {}, ...over });
const servedFor = (reqs) => reqs.filter((r) => { try { return new URL(r.url).origin === origin; } catch { return false; } })
  .map((r) => { const u = new URL(r.url); return { method: r.method, url: u.pathname + u.search, requestBodyBytes: r.postData ? String(r.postData).length : 0, contentLength: null }; });
const allow = new Set(['/assets/js/preview/credit-framework/app.js?v=cf-20261014-6&pwa=20261016-14-examples-icr', '/assets/js/preview/credit-framework/rules.js']);
const run = (reqs, served = servedFor(reqs), opts = {}) => classifyRequests(reqs, served, { origin, staticAllow: allow, ...opts });
const kinds = (r) => r.violations.map((v) => v.kind);

test('positive: exact first navigation + static assets listed in source pass', () => {
  const r = run([nav(), asset('/assets/js/preview/credit-framework/app.js?v=cf-20261014-6&pwa=20261016-14-examples-icr'), asset('/assets/js/preview/credit-framework/rules.js', { seq: 2 })]);
  assert.deepEqual(kinds(r), []); assert.equal(r.pass, true); assert.equal(r.baseline.length, 1); assert.equal(r.interaction.length, 2);
  assert.equal(r.expectedOrigin, origin);
});
test('negative: missing baseline (first request is an asset) fails', () => {
  const r = run([asset('/assets/js/preview/credit-framework/rules.js', { seq: 0 })]);
  assert.equal(r.pass, false); assert.ok(kinds(r).includes('baseline-count')); assert.equal(r.baseline.length, 0);
});
test('negative: initial POST navigation is not baseline', () => {
  const r = run([nav({ method: 'POST', postData: 'x=1' })]);
  assert.equal(r.pass, false); assert.ok(kinds(r).includes('baseline-count')); assert.ok(kinds(r).includes('non-get')); assert.ok(kinds(r).includes('request-body'));
});
test('negative: initial GET with a body is not baseline', () => {
  const r = run([nav({ postData: 'sourceId=F-SG-01' })]);
  assert.equal(r.pass, false); assert.ok(kinds(r).includes('baseline-count')); assert.ok(kinds(r).includes('request-body')); assert.ok(kinds(r).includes('marker-in-request'));
});
test('negative: second same-URL navigation still in load phase is a violation', () => {
  const r = run([nav(), nav({ seq: 1 })]);
  assert.equal(r.pass, false); assert.ok(kinds(r).includes('later-document-navigation')); assert.equal(r.baseline.length, 1);
});
test('negative: second navigation during interaction is a violation', () => {
  const r = run([nav(), nav({ seq: 7, phase: 'confirm-partial' })]);
  assert.equal(r.pass, false); assert.ok(kinds(r).includes('later-document-navigation'));
});
test('negative: wrong origin (external host) on first navigation', () => {
  const r = run([nav({ url: 'https://example.org/preview/credit-framework.html?case=CF-002&tier=comprehensive' })], []);
  assert.equal(r.pass, false); assert.ok(kinds(r).includes('baseline-count')); assert.ok(kinds(r).includes('foreign-origin'));
});
test('negative: wrong port on first navigation', () => {
  const r = run([nav({ url: 'http://127.0.0.1:9999/preview/credit-framework.html?case=CF-002&tier=comprehensive' })], []);
  assert.equal(r.pass, false); assert.ok(kinds(r).includes('baseline-count')); assert.ok(kinds(r).includes('foreign-origin'));
});
test('negative: seq not 0 or array position not 0 is not baseline', () => {
  assert.equal(run([nav({ seq: 3 })]).baseline.length, 0);
  const r = run([asset('/assets/js/preview/credit-framework/rules.js', { seq: 0 }), nav({ seq: 1 })]);
  assert.equal(r.baseline.length, 0); assert.ok(kinds(r).includes('later-document-navigation'));
});
test('negative: different path or different / extra query on first navigation', () => {
  for (const url of [`${origin}/preview/other.html?case=CF-002&tier=comprehensive`, `${origin}/preview/credit-framework.html?case=CF-005&tier=comprehensive`, `${origin}/preview/credit-framework.html?case=CF-002&tier=comprehensive&x=F-SG-01`, `${origin}/preview/credit-framework.html?tier=comprehensive&case=CF-002`]) {
    const r = run([nav({ url })]); assert.equal(r.pass, false, url); assert.ok(kinds(r).includes('baseline-count'), url);
  }
});
test('negative: POST or body to loopback asset path is a violation', () => {
  const r = run([nav(), asset('/assets/js/preview/credit-framework/rules.js', { method: 'POST', postData: 'note=部分支持' })]);
  assert.equal(r.pass, false); for (const k of ['non-get', 'request-body', 'marker-in-request', 'server-saw-body-or-non-get']) assert.ok(kinds(r).includes(k), k);
});
test('negative: query that is not a static cache key, or URL absent from source, or non-asset path', () => {
  const r = run([nav(), asset('/assets/js/preview/credit-framework/rules.js?note=%E9%83%A8%E5%88%86%E6%94%AF%E6%8C%81'), asset('/api/upload', { seq: 2, resourceType: 'fetch' }), asset('/assets/js/preview/credit-framework/app.js?v=OTHER', { seq: 3 })]);
  assert.equal(r.pass, false); for (const k of ['query-not-static-cache-key', 'marker-in-request', 'unexpected-path', 'unexpected-resource-type', 'url-not-in-static-source']) assert.ok(kinds(r).includes(k), k);
});
test('negative: evidence marker or credential in a request header', () => {
  const r = run([nav(), asset('/assets/js/preview/credit-framework/rules.js', { headers: { 'x-note': 'F-SG-01' } })]);
  assert.ok(kinds(r).includes('marker-or-credential-in-header'));
});
test('negative: destination mismatch — page requested something the loopback server never saw', () => {
  const reqs = [nav(), asset('/assets/js/preview/credit-framework/rules.js')];
  const r = run(reqs, servedFor([reqs[0]]));
  assert.equal(r.pass, false); assert.ok(kinds(r).includes('page-request-not-seen-by-server')); assert.ok(kinds(r).includes('server-count-mismatch'));
});
test('negative: unparseable / undecodable URL and malformed server record are reported, not skipped', () => {
  const r = run([nav(), { seq: 1, phase: 'load', method: 'GET', resourceType: 'script', url: 'not a url', postData: null, headers: {} }], [{ method: 'GET', url: NAV.replace(origin, '') }]);
  assert.ok(kinds(r).includes('unparseable-url')); assert.ok(kinds(r).includes('server-record-missing-fields'));
  const r2 = run([nav(), asset('/assets/js/preview/credit-framework/rules.js%E0%A4%A')]);
  assert.ok(kinds(r2).includes('undecodable-url'));
});
test('negative: expected origin itself must be loopback http with a port', () => {
  const r = classifyRequests([nav()], servedFor([nav()]), { origin: 'https://oney-tools.example', staticAllow: allow });
  assert.ok(kinds(r).includes('bad-expected-origin'));
});

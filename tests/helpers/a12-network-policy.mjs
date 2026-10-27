// A12 network policy — pure function, no I/O, no network.
// Input: ordered page requests {seq, phase, method, url, postData, resourceType, headers},
//        server log {method, url, requestBodyBytes, contentLength},
//        options {origin, baselinePath, baselineQuery, staticAllow:Set<path+query>}.
// Exactly one request may be treated as baseline: the test's own first navigation, matched on
// array index 0 AND seq===0, phase 'load', GET, resourceType 'document', exact origin, exact path,
// exact query, no body. Every other request (any origin, any later document, any other path/query,
// any method, any body) is checked. Nothing is exempted by phase or resourceType alone.
export const EVIDENCE_MARKERS = /F-SG-01|SYNTHETIC|sg_unevidenced|CF-002|Northside|AUD\s*0\.00|部分支持|Super balance|DRAFT-ONLY/i;
const QUERY_KEYS = new Set(['v', 'pwa', 'vanilla', 'taxonomy', 'ring']);
const TOKEN = /^[A-Za-z0-9._-]+$/;

export function classifyRequests(requests, served, { origin, baselinePath = '/preview/credit-framework.html', baselineQuery = 'case=CF-002&tier=comprehensive', staticAllow = new Set() } = {}) {
  const violations = [];
  const expectedOrigin = (() => { try { return new URL(origin).origin; } catch { return null; } })();
  if (!expectedOrigin || !/^http:\/\/127\.0\.0\.1:\d+$/.test(expectedOrigin)) violations.push({ kind: 'bad-expected-origin', origin });
  const baselineHref = `${expectedOrigin}${baselinePath}?${baselineQuery}`;
  const isBaseline = (r, i) => i === 0 && r.seq === 0 && r.phase === 'load' && r.method === 'GET' && r.resourceType === 'document'
    && typeof r.url === 'string' && r.url === baselineHref && (r.postData === null || r.postData === undefined || r.postData === '');
  const baseline = requests.filter((r, i) => isBaseline(r, i));
  const interaction = requests.filter((r, i) => !isBaseline(r, i));
  if (baseline.length !== 1) violations.push({ kind: 'baseline-count', count: baseline.length, first: requests[0] ? { seq: requests[0].seq, method: requests[0].method, resourceType: requests[0].resourceType, url: requests[0].url, hasBody: Boolean(requests[0].postData) } : null });
  for (const r of interaction) {
    let u;
    try { u = new URL(r.url); } catch { violations.push({ kind: 'unparseable-url', seq: r.seq, url: String(r.url) }); continue; }
    let decoded; try { decoded = decodeURIComponent(r.url); } catch { violations.push({ kind: 'undecodable-url', seq: r.seq, url: r.url }); decoded = r.url; }
    if (u.origin !== expectedOrigin) violations.push({ kind: 'foreign-origin', seq: r.seq, origin: u.origin, url: r.url });
    if (r.method !== 'GET') violations.push({ kind: 'non-get', seq: r.seq, method: r.method, url: r.url });
    if (r.postData) violations.push({ kind: 'request-body', seq: r.seq, url: r.url, bytes: String(r.postData).length });
    if (r.resourceType === 'document') violations.push({ kind: 'later-document-navigation', seq: r.seq, phase: r.phase, url: r.url });
    if (!/^\/assets\//.test(u.pathname)) violations.push({ kind: 'unexpected-path', seq: r.seq, path: u.pathname });
    if (!['script', 'stylesheet'].includes(r.resourceType)) violations.push({ kind: 'unexpected-resource-type', seq: r.seq, resourceType: r.resourceType, url: r.url });
    if (u.search) {
      const params = [...u.searchParams.entries()];
      const bad = params.filter(([k, v]) => !QUERY_KEYS.has(k) || !TOKEN.test(v));
      if (bad.length) violations.push({ kind: 'query-not-static-cache-key', seq: r.seq, url: r.url, bad });
    }
    if (!staticAllow.has(u.pathname + u.search)) violations.push({ kind: 'url-not-in-static-source', seq: r.seq, url: u.pathname + u.search });
    if (EVIDENCE_MARKERS.test(decoded + (r.postData || ''))) violations.push({ kind: 'marker-in-request', seq: r.seq, url: r.url });
    const hdrs = r.headers || {};
    for (const [k, v] of Object.entries(hdrs)) if (EVIDENCE_MARKERS.test(String(v)) || /^(cookie|authorization)$/i.test(k)) violations.push({ kind: 'marker-or-credential-in-header', seq: r.seq, header: k });
  }
  for (const s of served) if (!s || typeof s.requestBodyBytes !== 'number') violations.push({ kind: 'server-record-missing-fields', s });
  for (const s of served) if (s && (s.requestBodyBytes > 0 || s.method !== 'GET')) violations.push({ kind: 'server-saw-body-or-non-get', method: s.method, url: s.url, bytes: s.requestBodyBytes });
  const servedUrls = new Set(served.map((s) => s && s.url));
  for (const r of requests) { try { const u = new URL(r.url); if (u.origin === expectedOrigin && !servedUrls.has(u.pathname + u.search)) violations.push({ kind: 'page-request-not-seen-by-server', seq: r.seq, url: u.pathname + u.search }); } catch {} }
  if (served.length !== requests.filter((r) => { try { return new URL(r.url).origin === expectedOrigin; } catch { return false; } }).length) violations.push({ kind: 'server-count-mismatch', served: served.length, pageSameOrigin: requests.length });
  return { expectedOrigin, baselineHref, baseline, interaction, violations, pass: violations.length === 0 };
}

/** Build the allow-set of static URLs (path+query) referenced by the page and its modules. */
export function staticAllowFromSources(html, moduleSources) {
  const allow = new Set();
  for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) allow.add(m[1].replace(/&amp;/g, '&'));
  for (const src of moduleSources) for (const m of src.matchAll(/from\s+'(\.\.?\/[^']+)'/g)) allow.add(m[1]); // resolved below
  return allow;
}

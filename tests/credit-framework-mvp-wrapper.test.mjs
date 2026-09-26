// Oney Credit Framework — MVP wrapper deterministic tests (no dependencies).
// Run: node --test tests/credit-framework-mvp-wrapper.test.mjs
//   or: node tests/credit-framework-mvp-wrapper.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

import {
  RULES, RULE_LIBRARY, CASES, CASE_ORDER, KIND, BOUNDARY_TEXT, ENGINE_BOUNDARY_TEXT,
  generateFollowUps, classifyScenario, calculations, initialState, blankState, isPristine,
  buildAssessment, buildReport, reportToPlainText, buildClientEmail, rerate, lintCompliance,
} from '../assets/js/preview/credit-framework/engine.js';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');
const readJson = async (p) => JSON.parse(await read(p));

const FIXTURE_CASE_FILE = { 'CF-001': 'case-green-sme-refi.json', 'CF-002': 'case-red-ato.json', 'CF-004': 'case-amber-commercial-property.json' };

/* Expected output pinned from `python3 generate_followups.py <case> --tier …` (2026-09-26). */
const PY_ORDER = {
  'CF-001': { simple: ['valuation_sensitive', 'contract_growth', 'working_capital_vague'], comprehensive: ['valuation_sensitive', 'contract_growth', 'working_capital_vague'] },
  'CF-002': {
    simple: ['mca_present', 'dishonours_recent', 'high_lvr_second_mortgage', 'ato_debt', 'missed_ato_plan'],
    comprehensive: ['mca_present', 'dishonours_recent', 'high_lvr_second_mortgage', 'ato_debt', 'missed_ato_plan', 'sg_unevidenced', 'working_capital_vague'],
  },
  'CF-004': {
    simple: ['short_wale', 'zoning_environmental_missing', 'valuation_sensitive', 'related_party_security'],
    comprehensive: ['short_wale', 'zoning_environmental_missing', 'valuation_sensitive', 'related_party_security'],
  },
};

const EXPECTED = {
  'CF-001': {
    level: 'green', confidence: 'Medium', lvr: '80.7%', tags: ['clean_sme_refi', 'working_capital_growth'],
    risks: [/valuation shortfall/i, /working capital/i, /contract execution/i],
    critical: [/valuation|AVM/i, /contract|purchase order/i, /debt schedule/i],
  },
  'CF-002': {
    level: 'red', confidence: 'Medium', lvr: '96.8%', tags: ['ato_debt_restructure', 'weak_security_private_path'],
    risks: [/ATO debt/i, /missed ATO/i, /SG/i, /96\.8% total LVR second mortgage/i, /dishonour/i, /MCA/i, /working capital/i],
    critical: [/ATO integrated client account/i, /SG payment/i, /bank statements/i, /Merchant cash advance/i, /Full debt schedule/i, /Cash-flow forecast/i, /working-capital breakdown/i, /after-tax/i, /Private-lender feasibility/i],
  },
  'CF-004': {
    level: 'amber', confidence: 'Medium', lvr: '70.0%', tags: ['commercial_property'],
    risks: [/WALE/i, /Valuation/i, /Zoning/i, /Environmental/i, /Rent-saving/i],
    critical: [/valuation/i, /lease/i, /Zoning/i, /Environmental/i, /debt schedule/i],
  },
};

const allStates = () => CASE_ORDER.flatMap((id) => ['simple', 'comprehensive'].map((tier) => ({ id, tier })));
const reportFor = (id, tier, mutate) => {
  const s = initialState(id, tier);
  if (mutate) mutate(s);
  const a = buildAssessment(s);
  const r = buildReport(a, tier);
  return { s, a, r, text: reportToPlainText(r) };
};

/* ------------------------------------------------------------------ */
test('rule library is a verbatim transcription of Obsidian rules-v0.1.json', async () => {
  const fixture = await readJson('tests/fixtures/credit-framework/rules-v0.1.json');
  assert.deepEqual(JSON.parse(JSON.stringify(RULE_LIBRARY)), fixture);
  assert.equal(RULES.length, 16);
});

test('sample cases reuse the Obsidian follow-up case JSON unchanged and are synthetic', async () => {
  for (const id of CASE_ORDER) {
    const fixture = await readJson(`tests/fixtures/credit-framework/${FIXTURE_CASE_FILE[id]}`);
    assert.deepEqual(CASES[id].followUpCase, fixture, id);
    assert.equal(CASES[id].synthetic, true, `${id} flagged synthetic`);
    assert.equal(CASES[id].intake.dealName, fixture.dealName);
    assert.equal(CASES[id].intake.scenario, fixture.scenario);
  }
});

test('follow-up engine port matches generate_followups.py ordering and Simple cap', () => {
  for (const { id, tier } of allStates()) {
    const out = generateFollowUps(CASES[id].followUpCase, tier);
    assert.deepEqual(out.questions.map((q) => q.id), PY_ORDER[id][tier], `${id} ${tier}`);
    assert.ok(out.questions.length <= (tier === 'simple' ? 5 : 99));
    assert.deepEqual(out.unknownTriggers, []);
  }
  const unknown = generateFollowUps({ dealId: 'X', triggers: ['nope', 'ato_debt'] }, 'comprehensive');
  assert.deepEqual(unknown.unknownTriggers, ['nope']);
  assert.equal(generateFollowUps(CASES['CF-002'].followUpCase, 'simple').engineView, 'Quick readiness snapshot: identify the highest-impact questions only.');
  assert.equal(generateFollowUps(CASES['CF-002'].followUpCase, 'comprehensive').engineView, 'Rework first before lender submission; focus only on critical blockers.');
});

test('scenario tags, LVR calculation, rating and evidence-weighted confidence per case', () => {
  for (const id of CASE_ORDER) {
    const { a } = reportFor(id, 'comprehensive');
    const e = EXPECTED[id];
    assert.equal(a.pristine, true);
    assert.deepEqual(a.tags.map((t) => t.tag), e.tags, `${id} tags`);
    assert.equal(a.calcs[0].value, e.lvr, `${id} LVR`);
    assert.equal(a.calcs[0].kind, KIND.CALC);
    assert.equal(a.rating.level, e.level, `${id} rating`);
    assert.equal(a.confidence.value, e.confidence, `${id} confidence`);
    assert.ok(a.confidence.rulesApplied.some((r) => r.id === 'R-CONF-1'), `${id} critical cap applied`);
  }
  const cf1 = reportFor('CF-001', 'simple').a.confidence;
  assert.equal(cf1.base, 'Medium-High');
  assert.equal(cf1.capped, true, 'CF-001 Medium-High sample confidence capped by wrapper spec §8');
  assert.ok(reportFor('CF-002', 'simple').a.confidence.rulesApplied.some((r) => r.id === 'R-CONF-3'), 'specialist path never High');
  const custom = classifyScenario({ dealType: 'resi_investor_complex', deferralReason: 'Lender asked for updated servicing' }, ['high_dti', 'stale_preapproval']);
  assert.deepEqual(custom.map((t) => t.tag), ['high_dti_resi_investor', 'deferral_recovery']);
  assert.deepEqual(calculations({ securityValue: '', totalSecuredDebt: 100 }), []);
});

test('Simple vs Comprehensive gating (tiered-output-pricing-logic §4)', () => {
  for (const id of CASE_ORDER) {
    const simple = reportFor(id, 'simple');
    const comp = reportFor(id, 'comprehensive');
    const sec = (r, sid) => r.sections.find((s) => s.id === sid);

    for (const sid of ['dimensions', 'deferral', 'email', 'rerate']) {
      assert.equal(sec(simple.r, sid).locked, true, `${id} simple ${sid} locked`);
      assert.equal(Object.keys(sec(simple.r, sid)).sort().join(), 'id,locked,title', `${id} simple ${sid} carries no content`);
      assert.ok(!sec(comp.r, sid).locked, `${id} comprehensive ${sid} unlocked`);
    }
    const sq = sec(simple.r, 'questions').items;
    assert.ok(sq.length >= 3 && sq.length <= 5, `${id} simple 3-5 questions`);
    for (const q of sq) for (const k of ['ifStrong', 'ifWeak', 'owner', 'clientWording']) assert.equal(q[k], undefined, `${id} simple question ${k} gated`);
    for (const q of sec(comp.r, 'questions').items) for (const k of ['ifStrong', 'ifWeak', 'owner', 'clientWording']) assert.ok(q[k], `${id} comprehensive ${k}`);
    assert.ok(sec(simple.r, 'risks').items.length <= 5 && sec(simple.r, 'risks').items.every((r) => r.mitigant === undefined));
    assert.ok(sec(simple.r, 'missing').limited && sec(simple.r, 'missing').items.length <= 5);
    assert.equal(sec(simple.r, 'packaging').specialist, undefined, 'simple packaging is short');

    // Plain-text export must enforce the same gating (copy / print path).
    for (const q of generateFollowUps(CASES[id].followUpCase, 'comprehensive').questions) {
      for (const k of ['ifStrong', 'ifWeak', 'clientWording']) assert.ok(!simple.text.includes(q[k]), `${id} simple text leaks ${q.id}.${k}`);
      for (const k of ['ifStrong', 'ifWeak', 'clientWording']) assert.ok(comp.text.includes(q[k]), `${id} comprehensive text has ${q.id}.${k}`);
    }
    for (const label of ['If strong:', 'If weak:', 'Owner:', 'Client-friendly wording:', 'Subject:', 'Guardrail:', 'Re-rate logic:']) {
      assert.ok(!simple.text.includes(label), `${id} simple text contains ${label}`);
      assert.ok(comp.text.includes(label), `${id} comprehensive text missing ${label}`);
    }
    assert.match(simple.text, /\[LOCKED: Comprehensive only\]/);
  }
  assert.match(reportFor('CF-002', 'simple').text, /2 further question\(s\) — \[LOCKED: Comprehensive only\]/);
});

test('expected risk, missing-evidence and follow-up output per case', () => {
  for (const id of CASE_ORDER) {
    const { a, text } = reportFor(id, 'comprehensive');
    const e = EXPECTED[id];
    const riskText = a.risks.map((r) => r.risk).join(' | ');
    for (const re of e.risks) assert.match(riskText, re, `${id} risk ${re}`);
    const critical = a.missing.critical.map((m) => m.item).join(' | ');
    for (const re of e.critical) assert.match(critical, re, `${id} critical evidence ${re}`);
    for (const m of a.missing.critical) { assert.ok(m.impact, `${id} decision impact`); assert.ok(m.ifWeak, `${id} if weak`); }
    for (const tid of CASES[id].followUpCase.triggers) {
      const rule = RULES.find((r) => r.id === tid);
      assert.ok(text.includes(rule.question), `${id} question for ${tid}`);
      for (const ev of rule.evidence) assert.ok(text.includes(ev), `${id} evidence ${ev}`);
    }
  }
  // Targeted, not generic: CF-004 must not ask ATO questions; CF-002 must not ask WALE questions.
  assert.ok(!reportFor('CF-004', 'comprehensive').text.includes(RULES.find((r) => r.id === 'ato_debt').question));
  assert.ok(!reportFor('CF-002', 'comprehensive').text.includes(RULES.find((r) => r.id === 'short_wale').question));
});

test('re-rate loop: evidence-driven movement and the client-reply guardrail', () => {
  const run = (id, statusFor) => {
    const a = buildAssessment(initialState(id, 'comprehensive'));
    const qs = a.engine.comprehensive.questions;
    const evidence = Object.fromEntries(qs.map((q) => [q.id, statusFor(q)]));
    return rerate({ questions: qs, rating: a.rating.text, tags: a.tags, evidence });
  };
  let r = run('CF-002', () => 'outstanding');
  assert.equal(r.to, 'red'); assert.equal(r.movement, 'unchanged');

  r = run('CF-002', () => 'reply_only');
  assert.equal(r.to, 'red', 'client replies alone never improve the rating');
  assert.equal(r.replyOnly.length, 7);
  assert.ok(r.reasons.some((x) => /Guardrail applied/.test(x)));

  r = run('CF-002', () => 'supports');
  assert.equal(r.to, 'amber'); assert.equal(r.movement, 'up');
  assert.equal(r.confidence, 'Medium', 'specialist path cannot reach High');
  assert.match(r.strategy, /Specialist\/private testing only/);

  r = run('CF-002', (q) => (q.id === 'high_lvr_second_mortgage' ? 'weak' : 'supports'));
  assert.equal(r.to, 'red'); assert.equal(r.confidence, 'Low'); assert.match(r.strategy, /Pause \/ refer/);

  r = run('CF-004', (q) => (q.priority === 'Critical' ? 'supports' : 'outstanding'));
  assert.equal(r.to, 'green'); assert.equal(r.confidence, 'Medium-High');
  assert.deepEqual(r.stillMissing, ['Related-party security or property-owning entity']);

  r = run('CF-004', (q) => (q.id === 'short_wale' ? 'weak' : 'supports'));
  assert.equal(r.to, 'red'); assert.equal(r.movement, 'down');

  r = run('CF-001', (q) => (q.id === 'valuation_sensitive' ? 'weak' : 'supports'));
  assert.equal(r.to, 'amber', 'CF-001 weak valuation moves Green to Amber');

  r = run('CF-001', () => 'supports');
  assert.equal(r.to, 'green'); assert.equal(r.movement, 'unchanged');

  const black = rerate({ questions: [], rating: 'Black — Do Not Proceed', tags: [], evidence: {} });
  assert.equal(black.to, 'black', 'Black never moves automatically');
});

test('client email draft is Comprehensive-only and uses rule client wording', () => {
  const a = buildAssessment(initialState('CF-002', 'comprehensive'));
  const email = buildClientEmail(a).text;
  for (const q of a.engine.comprehensive.questions) assert.ok(email.includes(q.clientWording));
  assert.ok(reportFor('CF-002', 'comprehensive').text.includes(email));
  assert.ok(!reportFor('CF-002', 'simple').text.includes('Hi [Client name]'));
});

test('compliance: boundary on every output and no approval/decline/bankable/viable/financeable claims', () => {
  const variants = [];
  for (const { id, tier } of allStates()) variants.push(reportFor(id, tier).text);
  for (const id of CASE_ORDER) {
    for (const st of ['supports', 'weak', 'reply_only']) {
      variants.push(reportFor(id, 'comprehensive', (s) => { for (const t of s.triggers) s.evidence[t] = st; }).text);
    }
  }
  variants.push(reportToPlainText(buildReport(buildAssessment(blankState('comprehensive')), 'comprehensive')));
  variants.push(reportFor('CF-002', 'comprehensive', (s) => { s.intake.urgency = 'edited'; s.triggers.push('high_dti', 'supplier_arrears', 'turnaround_claim', 'stale_preapproval'); }).text);
  for (const text of variants) {
    assert.ok(text.includes(BOUNDARY_TEXT), 'required boundary sentence');
    const lint = lintCompliance(text);
    assert.equal(lint.ok, true, JSON.stringify(lint.hits));
  }
  // Every rule field and every judgement string is individually clean too.
  for (const r of RULES) for (const v of Object.values(r)) assert.equal(lintCompliance([].concat(v).join(' ')).ok, true, r.id);
  assert.equal(lintCompliance(JSON.stringify(CASES)).ok, true, JSON.stringify(lintCompliance(JSON.stringify(CASES)).hits));
});

test('compliance linter catches banned wording (negative controls)', () => {
  for (const bad of [
    'This deal will be approved.', 'Strong approval chance.', 'The lender declined it.', 'Likely to be declined',
    'This is a bankable deal.', 'The business is viable.', 'Viability is clear.', 'Clearly financeable.', 'This is fundable.',
    'It will pass credit.', 'A lender will accept this.', 'We guarantee approval.',
  ]) assert.equal(lintCompliance(bad).ok, false, bad);
  assert.equal(lintCompliance(`${BOUNDARY_TEXT} ${ENGINE_BOUNDARY_TEXT}`).ok, true, 'required boundary sentences are allow-listed');
  assert.equal(lintCompliance('It does not approve credit').ok, false, 'only the exact boundary sentence is allow-listed');
  assert.equal(lintCompliance('The pre-approval is 4 months old; old pre-approvals can be unreliable.').ok, true, 'pre-approval is a document name, not a claim');
});

test('facts, calculations, assumptions, rules and judgement are separately labelled', async () => {
  const { r, text, a } = reportFor('CF-002', 'comprehensive');
  for (const k of ['[FACT]', '[CALCULATION]', '[ASSUMPTION]', '[RULE]', '[JUDGEMENT]']) assert.ok(text.includes(k), k);
  const kinds = new Set(Object.values(KIND));
  const walk = (o) => { if (o && typeof o === 'object') { if ('kind' in o) assert.ok(kinds.has(o.kind), JSON.stringify(o).slice(0, 80)); Object.values(o).forEach(walk); } };
  walk(r);
  assert.ok(a.facts.every((f) => f.kind === KIND.FACT));
  assert.ok(a.risks.every((x) => x.kind === KIND.JUDGEMENT));
  assert.ok(a.engine && r.sections.find((s) => s.id === 'questions').items.every((q) => q.kind === KIND.RULE));
  const html = await read('preview/credit-framework.html');
  for (const k of kinds) assert.match(html, new RegExp(`\\.kind\\.${k}\\{`), `CSS for ${k}`);
  const app = await read('assets/js/preview/credit-framework/app.js');
  assert.match(app, /kindBadge/);
});

test('edited or custom input withdraws model judgement (rules still run)', () => {
  const edited = reportFor('CF-002', 'comprehensive', (s) => { s.intake.loanAmount = 500000; });
  assert.equal(edited.a.pristine, false);
  assert.equal(edited.a.dimensions, null);
  assert.ok(edited.a.risks.every((x) => x.kind === KIND.RULE));
  assert.match(edited.text, /Custom scenario: no model judgement/);
  const reordered = initialState('CF-002'); reordered.triggers.reverse();
  assert.equal(isPristine(reordered), true, 'trigger order does not matter');
  const blank = buildAssessment(blankState());
  assert.equal(blank.engine.comprehensive.questions.length, 0);
  assert.equal(blank.rating.kind, KIND.ASSUMPTION);
  assert.equal(blank.confidence.value, 'Medium');
});

/* ------------------------------ static / safety scans ------------------------------ */

const PAGE = 'preview/credit-framework.html';
const MODULE_DIR = 'assets/js/preview/credit-framework/';
const shipped = async () => {
  const files = [PAGE, ...(await readdir(new URL(MODULE_DIR, root))).map((f) => MODULE_DIR + f)];
  return Promise.all(files.map(async (f) => ({ f, src: await read(f) })));
};

test('noindex, CSP and no external data calls / network APIs', async () => {
  const html = await read(PAGE);
  assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">/);
  assert.match(html, /<meta name="googlebot" content="noindex,nofollow,noarchive,nosnippet">/);
  assert.match(html, /http-equiv="Content-Security-Policy"[^>]*connect-src 'none'/);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.doesNotMatch(html, /rel="canonical"|og:url|<form[^>]*action=/i);
  for (const { f, src } of await shipped()) {
    assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|import\s*\(\s*['"]https?:/, f);
    assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB|document\.cookie/, f);
    const urls = [...src.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => m[0]).filter((u) => !u.startsWith('http://www.w3.org/'));
    assert.deepEqual(urls, [], `${f} external URLs`);
    assert.doesNotMatch(src, /<script[^>]+src="(?!\/assets\/js\/preview\/credit-framework\/)/, f);
    assert.doesNotMatch(src, /<link[^>]+href="(?!data:)/, f);
  }
});

test('no secrets, credentials or production endpoints in shipped files', async () => {
  const patterns = [/sk-[A-Za-z0-9]{16,}/, /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, /\bre_[A-Za-z0-9]{16,}/, /AKIA[0-9A-Z]{16}/, /gh[pous]_[A-Za-z0-9]{20,}/, /supabase/i, /service_role/i, /api[_-]?key/i, /password/i, /bearer\s/i, /resend/i, /@oneyco\.com\.au/i, /\b04\d{2}\s?\d{3}\s?\d{3}\b/];
  for (const { f, src } of await shipped()) for (const p of patterns) assert.doesNotMatch(src, p, `${f} ${p}`);
});

test('prototype is not linked from production navigation, sitemap or registries', async () => {
  for (const f of ['sitemap.xml', 'index.html', 'tools.html', 'robots.txt', 'data/tools-registry.json', 'assets/js/app/tool-registry.js']) {
    const src = await read(f);
    assert.doesNotMatch(src, /credit-framework/i, f);
  }
});

test('responsive and print CSS present (browser smoke verifies behaviour)', async () => {
  const html = await read(PAGE);
  assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1">/);
  assert.match(html, /@media \(max-width:620px\)/);
  assert.match(html, /@media \(max-width:1100px\)/);
  const print = html.slice(html.indexOf('@media print'));
  assert.match(print, /\.intake[^{]*\{?[^}]*display:none/);
  assert.match(print, /\.watermark\{[^}]*display:grid!important/);
  assert.match(html, /id="watermark"/);
  assert.match(html, /aria-label="Oney &amp; Co logo"/);
  assert.equal((html.match(/data-boundary/g) || []).length, 2, 'boundary shown above and below output');
  const app = await read('assets/js/preview/credit-framework/app.js');
  assert.match(app, /window\.print\(\)/);
  assert.match(app, /navigator\.clipboard/);
  assert.match(app, /execCommand\('copy'\)/, 'legacy copy fallback');
});

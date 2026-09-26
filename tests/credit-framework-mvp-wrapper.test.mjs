// Oney Credit Framework — MVP wrapper deterministic tests (no dependencies).
// Run: node --test tests/credit-framework-mvp-wrapper.test.mjs
//   or: node tests/credit-framework-mvp-wrapper.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

import {
  RULES, RULE_LIBRARY, CASES, CASE_ORDER, KIND, BOUNDARY_TEXT, ENGINE_BOUNDARY_TEXT,
  generateFollowUps, classifyScenario, calculations, initialState, blankState, isPristine,
  buildAssessment, buildReport, reportToPlainText, buildClientEmail, rerate, lintCompliance, summarizeSection,
  suggestTriggers, compareTriggers, DEFERRAL_REASONS, buildDeferralPlan,
  FEEDBACK_QUESTIONS, scoreFeedback, feedbackText,
  SIMPLE_QUESTION_TARGET, simpleExpansionNote, EVIDENCE_STATUS, RERATE_GUARDRAIL, RERATE_EVIDENCE_RULE,
} from '../assets/js/preview/credit-framework/engine.js';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');
const readJson = async (p) => JSON.parse(await read(p));

const FIXTURE_CASE_FILE = { 'CF-001': 'case-green-sme-refi.json', 'CF-002': 'case-red-ato.json', 'CF-004': 'case-amber-commercial-property.json' };

/* Expected output pinned from `python3 generate_followups.py <case> --tier …` (2026-09-26).
   The Python CLI still slices Simple to the first 5; the wrapper intentionally keeps every
   Critical question (red team RT-02), so WRAPPER_SIMPLE below overrides CF-002 Simple. */
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

/* Wrapper Simple order after RT-02: CF-002 keeps all 6 Critical items (adds Critical sg_unevidenced), drops Important working_capital_vague. */
const WRAPPER_SIMPLE = {
  'CF-001': PY_ORDER['CF-001'].simple,
  'CF-002': ['mca_present', 'dishonours_recent', 'high_lvr_second_mortgage', 'ato_debt', 'missed_ato_plan', 'sg_unevidenced'],
  'CF-004': PY_ORDER['CF-004'].simple,
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

test('follow-up engine port matches generate_followups.py ordering; Simple keeps every Critical (RT-02)', () => {
  for (const { id, tier } of allStates()) {
    const out = generateFollowUps(CASES[id].followUpCase, tier);
    const expected = tier === 'simple' ? WRAPPER_SIMPLE[id] : PY_ORDER[id][tier];
    assert.deepEqual(out.questions.map((q) => q.id), expected, `${id} ${tier}`);
    const critical = out.questions.filter((q) => q.priority === 'Critical').length;
    assert.ok(out.questions.length <= (tier === 'simple' ? Math.max(SIMPLE_QUESTION_TARGET, critical) : 99));
    assert.deepEqual(out.unknownTriggers, []);
  }
  // Only CF-002 Simple diverges from the Python CLI, and only by the Critical overflow.
  assert.deepEqual(WRAPPER_SIMPLE['CF-002'].slice(0, 5), PY_ORDER['CF-002'].simple);
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
  assert.equal(cf1.value, 'Medium', 'Dong 2026-09-26: CF-001 shows Medium');
  assert.equal(cf1.capped, false);
  assert.deepEqual(cf1.watch, ['Formal valuation or reliable AVM confidence', 'Executed or near-final new contract / purchase order', 'Updated debt schedule including home loan']);
  assert.match(reportFor('CF-001', 'simple').text, /Watch points \(confidence stays Medium until evidenced\): Formal valuation/);
  const flag = reportFor('CF-002', 'simple').a.confidence.flags.find((f) => f.id === 'R-CONF-2');
  assert.match(flag.text, /^Flag: .* may cap confidence at Low\.$/);
  assert.doesNotMatch(flag.text, /review|decides|should|collect|obtain|provide/i, 'R-CONF-2 flags only, no remedy');
  assert.equal(reportFor('CF-002', 'simple').a.confidence.value, 'Medium', 'Low cap never auto-applied');
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
    const simpleCritical = sq.filter((q) => q.priority === 'Critical').length;
    assert.ok(sq.length >= 3 && sq.length <= Math.max(SIMPLE_QUESTION_TARGET, simpleCritical), `${id} simple 3-5 questions (more only for Critical overflow)`);
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
  assert.match(reportFor('CF-002', 'simple').text, /1 further question\(s\) — \[LOCKED: Comprehensive only\]/);
});

test('RT-02: Simple never hides a Critical trigger; overflow is explained', () => {
  // CF-002: SG is Critical and now visible in Simple.
  const { r, text } = reportFor('CF-002', 'simple');
  const q = r.sections.find((s) => s.id === 'questions');
  assert.ok(q.items.some((x) => x.id === 'sg_unevidenced'), 'CF-002 Simple includes sg_unevidenced');
  assert.ok(text.includes(RULES.find((x) => x.id === 'sg_unevidenced').question), 'SG question in copied Simple text');
  assert.equal(q.items.length, 6);
  assert.ok(q.items.every((x) => x.priority === 'Critical'));
  assert.equal(q.hiddenCount, 1, 'only the Important working-capital question is Comprehensive-only');
  assert.equal(q.expansionNote, 'Simple normally shows up to 5 questions. It shows all 6 here because 6 Critical items were triggered — Critical items are never held back for Comprehensive.');
  assert.match(text, /\[RULE\] Simple expanded: Simple normally shows up to 5 questions\. It shows all 6 here/);
  assert.equal(lintCompliance(q.expansionNote).ok, true);
  // Cases at or under the target carry no expansion note.
  for (const id of ['CF-001', 'CF-004']) assert.equal(reportFor(id, 'simple').r.sections.find((s) => s.id === 'questions').expansionNote, null, id);
  assert.equal(reportFor('CF-002', 'comprehensive').r.sections.find((s) => s.id === 'questions').expansionNote, null, 'Comprehensive never needs the note');
  assert.equal(simpleExpansionNote(null), null);

  // Exhaustive: every subset of the 16 rules (65,536 trigger sets).
  const ids = RULES.map((x) => x.id);
  const priority = Object.fromEntries(RULES.map((x) => [x.id, x.priority]));
  let overflowSets = 0;
  for (let mask = 0; mask < 1 << ids.length; mask++) {
    const triggers = ids.filter((_, i) => mask & (1 << i));
    const comp = generateFollowUps({ dealId: 'X', triggers }, 'comprehensive').questions.map((x) => x.id);
    const simple = generateFollowUps({ dealId: 'X', triggers }, 'simple');
    const got = simple.questions.map((x) => x.id);
    const critical = comp.filter((x) => priority[x] === 'Critical');
    for (const c of critical) if (!got.includes(c)) assert.fail(`mask ${mask}: Critical ${c} dropped from Simple`);
    assert.equal(got.length, Math.min(comp.length, Math.max(SIMPLE_QUESTION_TARGET, critical.length)));
    if (critical.length <= SIMPLE_QUESTION_TARGET) assert.deepEqual(got, comp.slice(0, SIMPLE_QUESTION_TARGET), `mask ${mask}: parity with Python slice`);
    else { overflowSets++; assert.deepEqual(got, critical, `mask ${mask}: overflow shows Critical only`); assert.equal(simple.simpleSelection.expanded, true); }
  }
  assert.ok(overflowSets > 0);

  // Overflow on a custom scenario: all Critical rules ticked.
  const allCritical = RULES.filter((x) => x.priority === 'Critical').map((x) => x.id);
  const s = blankState('simple'); s.triggers = [...ids];
  const custom = buildReport(buildAssessment(s), 'simple');
  const cq = custom.sections.find((x) => x.id === 'questions');
  assert.deepEqual(cq.items.map((x) => x.id).sort(), [...allCritical].sort());
  assert.equal(cq.hiddenCount, ids.length - allCritical.length);
  assert.match(cq.expansionNote, new RegExp(`shows all ${allCritical.length} here because ${allCritical.length} Critical items`));

  // Simple missing-evidence list discloses Critical items beyond its top five.
  const miss = r.sections.find((x) => x.id === 'missing');
  assert.equal(miss.moreCritical, CASES['CF-002'].judgement.missingEvidence.critical.length - 5);
  assert.match(text, /5 further Critical evidence item\(s\) — full list in Comprehensive; not resolved by this snapshot\./);
  assert.equal(reportFor('CF-004', 'simple').r.sections.find((x) => x.id === 'missing').moreCritical, 0);
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

test('RT-03: supports means reviewed evidence; a client reply can never improve readiness', () => {
  assert.deepEqual(EVIDENCE_STATUS, {
    outstanding: 'Not received / not yet reviewed',
    reply_only: 'Client reply only — does not count',
    supports: 'Reviewed evidence — supports',
    weak: 'Reviewed evidence — weak/contradicts',
  });
  assert.match(RERATE_GUARDRAIL, /Improve only if reviewed evidence proves/);
  assert.match(RERATE_EVIDENCE_RULE, /only after you have read the actual document/);
  assert.match(RERATE_EVIDENCE_RULE, /cannot improve readiness/);
  for (const l of Object.values(EVIDENCE_STATUS)) assert.ok(l.length <= 38, `label fits a 390px select: ${l}`);
  for (const t of [RERATE_GUARDRAIL, RERATE_EVIDENCE_RULE, ...Object.values(EVIDENCE_STATUS)]) assert.equal(lintCompliance(t).ok, true, t);
  const comp = reportFor('CF-002', 'comprehensive').text;
  assert.ok(comp.includes(`Evidence rule: ${RERATE_EVIDENCE_RULE}`));
  assert.ok(!reportFor('CF-002', 'simple').text.includes('Evidence rule:'), 'rule sits in the Comprehensive re-rate tracker');

  // Exhaustive over every status combination for every shipped case.
  const statuses = Object.keys(EVIDENCE_STATUS);
  const better = (a, b) => ['green', 'amber', 'red', 'black'].indexOf(a) < ['green', 'amber', 'red', 'black'].indexOf(b);
  let combos = 0;
  for (const id of CASE_ORDER) {
    const a = buildAssessment(initialState(id, 'comprehensive'));
    const qs = a.engine.comprehensive.questions;
    const run = (ev) => rerate({ questions: qs, rating: a.rating.text, tags: a.tags, evidence: ev });
    for (let n = 0; n < statuses.length ** qs.length; n++) {
      const ev = Object.fromEntries(qs.map((q, i) => [q.id, statuses[Math.floor(n / statuses.length ** i) % statuses.length]]));
      const r = run(ev);
      combos++;
      if (r.movement === 'up' || better(r.to, r.from)) {
        for (const q of qs.filter((x) => x.priority === 'Critical')) assert.equal(ev[q.id], 'supports', `${id} ${JSON.stringify(ev)} moved up without reviewed evidence on ${q.id}`);
      }
      // A reply-only item is treated exactly like an unreviewed one (except the guardrail note).
      const asOutstanding = run(Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, v === 'reply_only' ? 'outstanding' : v])));
      assert.deepEqual([r.to, r.movement, r.confidence, r.stillMissing], [asOutstanding.to, asOutstanding.movement, asOutstanding.confidence, asOutstanding.stillMissing], `${id} reply_only ≡ outstanding`);
      if (r.replyOnly.length) assert.ok(r.reasons.some((x) => /without reviewed evidence treated as still missing/.test(x)));
    }
  }
  assert.equal(combos, 4 ** 3 + 4 ** 7 + 4 ** 4);
});

test('RT-04: re-rate matrix for CF-001, CF-002 and CF-004 (shared with browser smoke)', async () => {
  const matrix = await readJson('tests/fixtures/credit-framework/rerate-matrix.json');
  assert.deepEqual(Object.keys(matrix.cases), CASE_ORDER);
  for (const id of CASE_ORDER) {
    const a = buildAssessment(initialState(id, 'comprehensive'));
    const qs = a.engine.comprehensive.questions;
    assert.deepEqual(matrix.cases[id].questions, qs.map((q) => ({ id: q.id, priority: q.priority })), `${id} question set`);
    assert.deepEqual(matrix.cases[id].rows.map((x) => x.scenario), Object.keys(matrix.scenarios), `${id} covers every scenario`);
    for (const row of matrix.cases[id].rows) {
      const r = rerate({ questions: qs, rating: a.rating.text, tags: a.tags, evidence: row.evidence });
      assert.deepEqual({ from: r.from, to: r.to, movement: r.movement, confidence: r.confidence, stillMissing: r.stillMissing.length }, row.expect, `${id} ${row.scenario}`);
      // Same state through the full report path (what the page renders and copies).
      const text = reportFor(id, 'comprehensive', (s) => { s.evidence = { ...row.evidence }; }).text;
      assert.ok(text.includes(`Rating movement: ${row.expect.from} → ${row.expect.to} (${row.expect.movement}) · Confidence: ${row.expect.confidence}`), `${id} ${row.scenario} text`);
      assert.equal(lintCompliance(text).ok, true);
    }
  }
  const row = (id, sc) => matrix.cases[id].rows.find((x) => x.scenario === sc).expect;
  // Headline expectations (readable pins for reviewers).
  assert.deepEqual([row('CF-001', 'reply_only').to, row('CF-001', 'critical_supported').to, row('CF-001', 'one_critical_weak').to], ['green', 'green', 'amber']);
  assert.deepEqual([row('CF-002', 'reply_only').to, row('CF-002', 'critical_supported').to, row('CF-002', 'one_critical_weak').to, row('CF-002', 'mixed_critical_reply').to], ['red', 'amber', 'red', 'red']);
  assert.deepEqual([row('CF-004', 'reply_only').to, row('CF-004', 'critical_supported').to, row('CF-004', 'one_critical_weak').to, row('CF-004', 'mixed_critical_reply').to], ['amber', 'green', 'red', 'amber']);
  for (const id of CASE_ORDER) {
    assert.equal(row(id, 'reply_only').movement, 'unchanged', `${id} reply-only never moves`);
    assert.notEqual(row(id, 'mixed_critical_reply').movement, 'up', `${id} one Critical reply-only blocks upward move`);
    assert.equal(row(id, 'one_critical_weak').confidence, 'Low');
  }
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

test('every unlocked section has a one-line summary derived from its own content', () => {
  for (const { id, tier } of allStates()) {
    const { r, text } = reportFor(id, tier);
    for (const sec of r.sections) {
      if (sec.locked) { assert.equal(sec.summary, undefined, `${id} ${tier} locked ${sec.id} has no summary`); continue; }
      if (sec.id === 'cta') continue;
      assert.ok(sec.summary && sec.summary.text.length > 5, `${id} ${tier} ${sec.id} summary`);
      assert.ok(!/\n/.test(sec.summary.text), 'single line');
      assert.ok(sec.summary.text.length <= 200, `${id} ${tier} ${sec.id} summary short: ${sec.summary.text}`);
      assert.equal(lintCompliance(sec.summary.text).ok, true, sec.summary.text);
      assert.ok(text.includes(`Summary: ${sec.summary.text}`), 'summary in copied text');
    }
  }
  const cf2 = reportFor('CF-002', 'comprehensive').r.sections;
  const sum = (sid) => cf2.find((x) => x.id === sid).summary.text;
  assert.match(sum('snapshot'), /96\.8% estimated LVR/);
  assert.match(sum('rating'), /^Red — Rework First/);
  assert.match(sum('questions'), /^7 questions \(6 Critical\)/);
  assert.match(sum('dimensions'), /^Weakest \(Red\)/);
  assert.equal(sum('packaging'), 'Not ready.');
  // Simple summary never mentions gated detail counts beyond what Simple shows.
  const s2 = reportFor('CF-002', 'simple').r.sections;
  assert.match(s2.find((x) => x.id === 'questions').summary.text, /^6 questions \(6 Critical\)/);
  assert.match(s2.find((x) => x.id === 'risks').summary.text, /\(\+4 more\)/);
  assert.equal(summarizeSection({ id: 'cta' }, null), null);
});

test('collapsed/expand UI wiring present', async () => {
  const app = await read('assets/js/preview/credit-framework/app.js');
  const html = await read('preview/credit-framework.html');
  assert.match(app, /aria-expanded/);
  assert.match(app, /data-toggle/);
  assert.match(html, /id="expand-all"/);
  assert.match(html.slice(html.indexOf('@media print')), /\.sec-body\[hidden\]\{display:block!important\}/, 'print expands everything');
  assert.match(app, /\$\('#report'\)\.textContent/, 'wording check covers collapsed content');
});

test('trigger suggestions reproduce the calibrated triggers for every sample case', () => {
  for (const id of CASE_ORDER) {
    const got = suggestTriggers(CASES[id].intake).map((s) => s.id).sort();
    assert.deepEqual(got, [...CASES[id].followUpCase.triggers].sort(), id);
    for (const s of suggestTriggers(CASES[id].intake)) {
      assert.ok(s.reasons.length > 0, `${id} ${s.id} has a reason`);
      assert.equal(lintCompliance(s.reasons.join(' ')).ok, true);
    }
    const { a, text } = reportFor(id, 'simple');
    assert.deepEqual(a.triggerCheck.notSelected, []);
    assert.deepEqual(a.triggerCheck.manualOnly, []);
    assert.match(text, /Trigger check: \d+ suggested from intake, \d+ selected · selection matches intake\./);
  }
});

test('trigger suggestions: positives, negations and thresholds', () => {
  const base = { dealType: 'sme', purpose: '', security: '', securityValue: '', totalSecuredDebt: '', income: '', existingDebts: '', conduct: '', documents: '', urgency: '', deferralReason: '', borrower: '' };
  const ids = (over) => suggestTriggers({ ...base, ...over }).map((s) => s.id);
  assert.deepEqual(ids({}), [], 'blank intake suggests nothing');
  // negations
  assert.deepEqual(ids({ conduct: 'ATO current, no payment plan; no dishonours or excesses in 12 months' }), []);
  assert.deepEqual(ids({ conduct: '2 dishonours in March' }), ['dishonours_recent']);
  // tax
  assert.deepEqual(ids({ existingDebts: 'ATO debt $80k on payment plan' }), ['ato_debt']);
  assert.ok(ids({ conduct: 'ATO plan: missed a payment in June', existingDebts: 'tax debt $40k' }).includes('missed_ato_plan'));
  assert.deepEqual(ids({ conduct: 'Super paid, director says current' }), ['sg_unevidenced']);
  // security thresholds
  assert.deepEqual(ids({ security: 'Second mortgage over home', securityValue: 1000000, totalSecuredDebt: 700000 }), [], 'second mortgage at 70% LVR is not high-LVR');
  assert.deepEqual(ids({ security: 'Second mortgage over home', securityValue: 1000000, totalSecuredDebt: 900000 }), ['high_lvr_second_mortgage']);
  assert.deepEqual(ids({ security: 'First mortgage', securityValue: 1000000, totalSecuredDebt: 650000, documents: 'valuation provided' }), []);
  assert.deepEqual(ids({ security: 'First mortgage', securityValue: 1000000, totalSecuredDebt: 790000 }), ['valuation_sensitive']);
  // other rules
  assert.deepEqual(ids({ existingDebts: 'supplier arrears $120k' }), ['supplier_arrears']);
  assert.deepEqual(ids({ income: 'DTI 9.2x after purchase' }), ['high_dti']);
  assert.deepEqual(ids({ income: 'DTI 5.1x' }), []);
  assert.deepEqual(ids({ documents: 'pre-approval issued 4 months ago' }), ['stale_preapproval']);
  assert.deepEqual(ids({ documents: 'pre-approval issued 1 month ago' }), []);
  assert.deepEqual(ids({ income: 'Lost a major customer in FY25; turnaround underway' }), ['turnaround_claim']);
  assert.deepEqual(ids({ security: 'Property held by SMSF' }), ['related_party_security']);
  assert.deepEqual(ids({ purpose: 'Working capital $80k — breakdown attached' }), []);
  // suggestions never change the selection by themselves
  const s = blankState(); s.intake.conduct = '3 dishonours'; const before = [...s.triggers];
  const a = buildAssessment(s);
  assert.deepEqual(s.triggers, before);
  assert.deepEqual(a.triggerCheck.notSelected, ['dishonours_recent']);
  assert.deepEqual(compareTriggers(['ato_debt'], []).manualOnly, ['ato_debt']);
});

test('deferral reason library (draft) links only to existing rules and is wording-clean', () => {
  const ruleIds = new Set(RULES.map((r) => r.id));
  const ids = new Set();
  for (const d of DEFERRAL_REASONS) {
    assert.ok(!ids.has(d.id), `unique ${d.id}`); ids.add(d.id);
    for (const t of d.linkedTriggers) assert.ok(ruleIds.has(t), `${d.id} → ${t}`);
    assert.ok(d.lenderTesting && d.explanation && d.collectFirst.length >= 2, d.id);
    assert.equal(lintCompliance(JSON.stringify(d)).ok, true, d.id);
  }
});

test('deferral recovery plan: Comprehensive only, evidence-driven status, sample judgement kept', () => {
  const withCodes = (id, tier, codes, evidence = {}) => reportFor(id, tier, (s) => { s.intake.deferralCodes = codes; s.evidence = evidence; });
  const c = withCodes('CF-004', 'comprehensive', ['valuation_shortfall', 'property_due_diligence']);
  const sec = c.r.sections.find((x) => x.id === 'deferral');
  assert.equal(sec.plan.reasons.length, 2);
  assert.equal(sec.plan.overall, 'rework');
  assert.ok(c.a.tags.some((t) => t.tag === 'deferral_recovery'));
  assert.equal(c.a.pristine, true, 'deferral overlay keeps sample judgement');
  assert.deepEqual(sec.plan.reasons[0].linkedNotSelected.map((x) => x.id), ['high_lvr_second_mortgage']);
  assert.match(sec.summary.text, /^2 lender deferral reasons · rework, then resubmit\.$/);
  assert.deepEqual(c.r.sections.slice(0, 3).map((x) => x.id), ['snapshot', 'rating', 'deferral'], 'plan shown right after rating');
  assert.equal(reportFor('CF-004', 'comprehensive').r.sections[2].id, 'risks', 'default order without deferral');
  assert.match(c.text, /Lender is testing: Whether the security still covers/);
  assert.match(c.text, /KEY: Provide the exact documents credit asked for, or the same document type\./, 'exact-document rule (Dong 2026-09-26)');
  assert.match(c.text, /Collect first \(exact documents credit asked for, or the same type\)/);
  assert.match(c.text, /Please send the exact documents listed \(or the same type of document\)/, 'client email carries the rule');
  assert.ok(!reportFor('CF-004', 'comprehensive').text.includes('exact documents listed'), 'no deferral → no exact-doc line in email');
  assert.equal(lintCompliance(c.text).ok, true);

  assert.equal(withCodes('CF-004', 'comprehensive', ['valuation_shortfall'], { valuation_sensitive: 'weak' }).r.sections.find((x) => x.id === 'deferral').plan.overall, 'pause');
  assert.equal(withCodes('CF-004', 'comprehensive', ['valuation_shortfall'], { valuation_sensitive: 'reply_only' }).r.sections.find((x) => x.id === 'deferral').plan.overall, 'rework', 'reply without documents does not count');
  assert.equal(withCodes('CF-002', 'comprehensive', ['ato_position'], { ato_debt: 'supports', missed_ato_plan: 'supports', sg_unevidenced: 'supports' }).r.sections.find((x) => x.id === 'deferral').plan.overall, 'resubmit');
  assert.equal(buildDeferralPlan(['structure_parties'], [], {}).overall, 'rework', 'no linked trigger selected stays rework');
  assert.equal(buildDeferralPlan([], [], {}).overall, null);

  const simple = withCodes('CF-004', 'simple', ['valuation_shortfall']);
  assert.equal(simple.r.sections.find((x) => x.id === 'deferral').locked, true);
  assert.ok(!simple.text.includes('Lender is testing'), 'plan content gated');
  assert.match(simple.text, /Lender deferral entered \(1\): the deferral recovery plan is in Comprehensive\./);
});

test('broker feedback checklist: spec §14 questions verbatim, bar of 3 yes, copy text', async () => {
  const spec = [
    'Does this tell me what is actually blocking the deal?',
    'Does this reduce my next 30 minutes of work?',
    'Does this produce better client follow-up questions than a generic checklist?',
    'Does this stop me submitting a weak file too early?',
    'Does this help me explain the issue to a client without sounding vague?',
    'Would I pay for the Comprehensive version on a messy file?',
  ];
  assert.deepEqual(FEEDBACK_QUESTIONS.map((q) => q.text), spec);
  const ids = FEEDBACK_QUESTIONS.map((q) => q.id);
  const ans = (arr) => Object.fromEntries(arr.map((v, i) => [ids[i], v]).filter(([, v]) => v));
  assert.equal(scoreFeedback({}).meetsBar, false);
  assert.equal(scoreFeedback(ans(['yes', 'yes', 'no', 'no', 'no', 'no'])).meetsBar, false);
  assert.equal(scoreFeedback(ans(['yes', 'yes', 'yes', 'no', 'no', 'no'])).meetsBar, true);
  assert.match(scoreFeedback(ans(['yes', 'yes'])).verdict, /2\/6 yes so far — 4 still unanswered/);
  assert.match(scoreFeedback(ans(['no', 'no', 'no', 'no', 'unsure', 'unsure'])).verdict, /below the spec §14 bar/);
  const txt = feedbackText({ answers: ans(['yes', 'yes', 'yes', 'unsure', 'no', 'yes']), comment: 'Deferral plan is the useful bit', context: { caseId: 'CF-002', tier: 'comprehensive' } });
  for (const q of spec) assert.ok(txt.includes(q));
  assert.match(txt, /Result: 4\/6 yes — meets the spec §14 bar/);
  assert.match(txt, /Viewed: CF-002 · comprehensive/);
  assert.match(txt, /Comment: Deferral plan is the useful bit/);
  assert.equal(lintCompliance(txt).ok, true);
  const html = await read('preview/credit-framework.html');
  assert.match(html, /<section class="out no-print" id="feedback"/, 'feedback not printed with the report');
  const plain = reportFor('CF-002', 'comprehensive').text;
  assert.ok(!plain.includes('30 minutes of work'), 'feedback is not part of the copied report');
});

test('beta data notice: de-identified real deals only, nothing leaves the browser', async () => {
  const html = await read('preview/credit-framework.html');
  assert.match(html, /id="data-notice"[^>]*>Private beta: everything runs in your browser\. Nothing is uploaded, saved, emailed or submitted/);
  assert.match(html, /only de-identified<\/strong>: no client names, ABNs\/ACNs, addresses, dates of birth or account numbers/);
  assert.doesNotMatch(html, /INTERNAL PROTOTYPE|Use synthetic data only/);
  assert.match(reportFor('CF-001', 'simple').text, /^Oney & Co — Oney Credit Framework \(beta · sample cases are synthetic · generated in the browser\)/);
});

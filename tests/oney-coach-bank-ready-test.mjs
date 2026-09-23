import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SAMPLE_TELL_ONEY_TEXT,
  AMBIGUOUS_TELL_ONEY_TEXT,
  confirmationFromQuickCheck,
  confirmationFromTellOney,
  confirmedValues,
  scoreReadiness,
  canCalculate,
} from '../assets/js/preview/oney-coach-scoring.js';

const quickInput = {
  turnover: '1800000',
  profit: '162000',
  yearsInBusiness: '8',
  atoStatus: 'plan',
  totalDebt: '450000',
  industryRisk: 'medium',
  creditScore: '715',
  cashflowStability: 'seasonal',
  loanPurpose: 'workingCapital',
  incomeResilience: 'moderate',
};

function confirmProposed(rows) {
  return rows.map((row) => ({ ...row, confirmed: row.proposed }));
}

const quickRows = confirmProposed(confirmationFromQuickCheck(quickInput));
const tell = confirmationFromTellOney(SAMPLE_TELL_ONEY_TEXT);
const tellRows = confirmProposed(tell.rows);
assert.equal(tell.parsed.meta.parsedCount, 10, 'clear sample should parse all fields');
assert.equal(canCalculate(quickRows), true);
assert.equal(canCalculate(tellRows), true);

const quickResult = scoreReadiness(confirmedValues(quickRows));
const tellResult = scoreReadiness(confirmedValues(tellRows));
assert.equal(quickResult.score, tellResult.score, 'both paths must produce the same score');
assert.equal(quickResult.gradeLabel, tellResult.gradeLabel, 'both paths must produce the same band');
assert.deepEqual(quickResult.actions, tellResult.actions, 'both paths must produce the same action plan');

const ambiguous = confirmationFromTellOney(AMBIGUOUS_TELL_ONEY_TEXT);
const ambiguousRows = confirmProposed(ambiguous.rows);
assert.ok(ambiguous.parsed.meta.notUnderstoodCount >= 5, 'ambiguous text must leave unresolved fields');
assert.equal(canCalculate(ambiguousRows), false, 'ambiguous text must be blocked pending confirmation');

const html = await readFile(new URL('../preview/oney-coach-bank-ready-test.html', import.meta.url), 'utf8');
assert.match(html, /name="robots" content="noindex,nofollow,noarchive"/);
assert.match(html, /Quick Check/);
assert.match(html, /Tell Oney in your own words/);
assert.match(html, /zero AI tokens/i);
assert.doesNotMatch(html, /\bfetch\s*\(/);
assert.doesNotMatch(html, /XMLHttpRequest|WebSocket|EventSource/);
assert.match(html, /@media\(max-width:820px\)/);

console.log(JSON.stringify({
  pass: true,
  score: quickResult.score,
  band: quickResult.gradeLabel,
  clearSampleParsed: tell.parsed.meta.parsedCount,
  ambiguousUnresolved: ambiguous.parsed.meta.notUnderstoodCount,
  networkDataCalls: 0,
}));

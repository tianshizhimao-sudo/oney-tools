const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = {};
sandbox.globalThis = sandbox;
const source = fs.readFileSync(path.join(__dirname, '../assets/js/tools/ato-disclosure-alert.js'), 'utf8');
vm.runInNewContext(source, sandbox);
const { classifyAtoDisclosureAlert } = sandbox.OneyAtoDisclosure;

const cases = [
  {
    name: '120k / 120 days / no arrangement',
    input: {
      ato_debt: 'Yes',
      ato_overdue_amount: 120000,
      ato_oldest_overdue_days: 120,
      ato_engagement_evidence: 'none',
      disclosure_notice_received: 'No'
    },
    expected: 'red_manual_review'
  },
  {
    name: '120k / 120 days / compliant plan evidenced / no notice',
    input: {
      ato_debt: 'Yes',
      ato_overdue_amount: 120000,
      ato_oldest_overdue_days: 120,
      ato_engagement_evidence: 'compliant_plan_evidenced',
      disclosure_notice_received: 'No'
    },
    expected: 'managed_or_below_threshold'
  },
  {
    name: 'amount unknown / plan claimed / no receipt',
    input: {
      ato_debt: 'Yes',
      ato_overdue_amount: '',
      ato_oldest_overdue_days: 120,
      ato_engagement_evidence: 'claimed_no_evidence',
      disclosure_notice_received: 'No'
    },
    expected: 'amber_clarify'
  },
  {
    name: '80k / 120 days / notice received',
    input: {
      ato_debt: 'Yes',
      ato_overdue_amount: 80000,
      ato_oldest_overdue_days: 120,
      ato_engagement_evidence: 'none',
      disclosure_notice_received: 'Yes',
      disclosure_notice_received_date: '2026-09-09'
    },
    expected: 'red_manual_review',
    reviewBy: '2026-10-07'
  }
];

for (const testCase of cases) {
  const result = classifyAtoDisclosureAlert(testCase.input);
  assert.equal(result.status, testCase.expected, testCase.name);
  if (testCase.reviewBy) assert.equal(result.operational_review_by, testCase.reviewBy, `${testCase.name} review date`);
  if (testCase.expected === 'red_manual_review') {
    assert.equal(result.internal_task?.priority, 'urgent', `${testCase.name} urgent task`);
    assert.equal(result.stop_automated_lender_positioning, true, `${testCase.name} lender-positioning stop`);
  }
  console.log(`PASS: ${testCase.name} => ${result.status}`);
}

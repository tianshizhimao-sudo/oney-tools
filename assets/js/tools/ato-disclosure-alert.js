/* Oney & Co — ATO business tax debt disclosure alert.
 * Internal finance-readiness routing only. Not tax/legal advice or a credit decision.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.OneyAtoDisclosure = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SOURCE_FACT_VERSION = 'ato-business-tax-debt-disclosure__verified-2026-09-09';
  const BOUNDARY = 'Finance-readiness evidence flag only — not tax advice, legal advice, a credit decision or an ATO disclosure determination.';
  const CLIENT_SAFE_COPY = 'The ATO can disclose some overdue business tax debts to registered credit reporting bureaus when specific conditions are met. Your answers help identify what evidence needs checking. If you have received a notice, contact the ATO or your tax professional promptly. Oney is collecting evidence for finance-readiness only; this is not tax or legal advice and does not indicate a lending outcome.';

  function clean(value) {
    return (value == null ? '' : String(value)).trim().toLowerCase();
  }

  function numberOrNull(value) {
    if (value == null || value === '') return null;
    const parsed = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  function addDaysIso(dateString, days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || '')) return null;
    const date = new Date(`${dateString}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function classifyAtoDisclosureAlert(input) {
    const atoDebt = clean(input.ato_debt);
    const amount = numberOrNull(input.ato_overdue_amount);
    const overdueDays = numberOrNull(input.ato_oldest_overdue_days);
    const engagement = clean(input.ato_engagement_evidence);
    const notice = clean(input.disclosure_notice_received);
    const noticeDate = (input.disclosure_notice_received_date || '').toString().trim();

    const triggered = /yes|unknown|not sure/.test(atoDebt)
      || amount !== null
      || overdueDays !== null
      || Boolean(engagement)
      || Boolean(notice);

    if (!triggered) {
      return {
        status: 'not_triggered',
        label: 'No disclosure workflow triggered from supplied facts',
        tag: 'ato_disclosure_not_triggered',
        urgent_manual_review: false,
        stop_automated_lender_positioning: false,
        source_fact_version: SOURCE_FACT_VERSION,
        boundary: BOUNDARY,
        client_safe_copy: CLIENT_SAFE_COPY,
        missing_evidence: [],
        operational_review_by: null
      };
    }

    const engagementEvidenced = engagement === 'compliant_plan_evidenced'
      || engagement === 'other_active_engagement_evidenced';
    const engagementClaimedWithoutEvidence = engagement === 'claimed_no_evidence';
    const thresholdMet = amount !== null && amount >= 100000
      && overdueDays !== null && overdueDays > 90;
    const noticeReceived = notice === 'yes';

    const missingEvidence = [];
    if (amount === null) missingEvidence.push('Exact overdue ATO debt amount');
    if (overdueDays === null) missingEvidence.push('Age of the oldest overdue ATO debt');
    if (!engagement || engagement === 'unknown') missingEvidence.push('Current ATO engagement status and evidence');
    if (!notice || notice === 'unknown' || notice === 'not sure') missingEvidence.push('Whether an ATO disclosure notice has been received');
    if (engagementClaimedWithoutEvidence) missingEvidence.push('Current payment-plan or engagement compliance evidence');
    if (noticeReceived && !noticeDate) missingEvidence.push('Date the ATO notice was received');

    let status;
    let label;
    if (noticeReceived || (thresholdMet && !engagementEvidenced)) {
      status = 'red_manual_review';
      label = 'Possible disclosure exposure — urgent evidence/manual review';
    } else if (missingEvidence.length > 0 || engagementClaimedWithoutEvidence) {
      status = 'amber_clarify';
      label = 'Disclosure conditions unclear — obtain evidence';
    } else {
      status = 'managed_or_below_threshold';
      label = 'No current alert from supplied facts — continue normal ATO evidence review';
    }

    return {
      status,
      label,
      tag: `ato_disclosure_${status}`,
      urgent_manual_review: status === 'red_manual_review',
      stop_automated_lender_positioning: status === 'red_manual_review',
      threshold_snapshot: {
        amount_aud: amount,
        oldest_overdue_days: overdueDays,
        amount_at_or_above_100k: amount !== null ? amount >= 100000 : null,
        overdue_more_than_90_days: overdueDays !== null ? overdueDays > 90 : null,
        engagement_evidenced: engagementEvidenced,
        notice_received: noticeReceived
      },
      missing_evidence: missingEvidence,
      operational_review_by: noticeReceived ? addDaysIso(noticeDate, 28) : null,
      operational_timing_note: noticeReceived
        ? 'ATO guidance says action is required within 28 days from receiving the notice; confirm timing directly with the ATO or a tax professional.'
        : null,
      internal_task: status === 'red_manual_review' ? {
        type: 'ato_disclosure_manual_review',
        priority: 'urgent',
        due_date: noticeReceived ? addDaysIso(noticeDate, 28) : null,
        action: 'Verify ATO amount, age, engagement evidence, notice status and excluded-entity position before any lender-positioning copy.'
      } : null,
      source_fact_version: SOURCE_FACT_VERSION,
      boundary: BOUNDARY,
      client_safe_copy: CLIENT_SAFE_COPY
    };
  }

  return { classifyAtoDisclosureAlert, SOURCE_FACT_VERSION };
});

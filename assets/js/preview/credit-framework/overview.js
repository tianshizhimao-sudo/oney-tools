/* A presentation view of the existing assessment. No scoring, risk inference,
   rating changes or evidence verification happens here. Tier gating is retained. */
import { EVIDENCE_STATUS } from './engine.js?v=cf-20261022-bs1';

export function buildOverview(assessment, report, evidence = {}) {
  const comprehensive = report.tier === 'comprehensive';
  const questions = report.sections.find((s) => s.id === 'questions').items;
  // Evidence tracking belongs to Comprehensive; Simple always shows intake scope.
  const rows = questions.map((q) => ({ ...q, status: comprehensive ? evidence[q.id] || 'outstanding' : 'outstanding' }));
  const open = rows.filter((q) => q.status !== 'supports');
  // Preserve framework ordering within each priority. Weak evidence is visible
  // first within that priority, with no invented numerical severity score.
  const ordered = ['Critical', 'Important', 'Helpful'].flatMap((priority) => {
    const group = open.filter((q) => q.priority === priority);
    return [...group.filter((q) => q.status === 'weak'), ...group.filter((q) => q.status !== 'weak')];
  });
  const critical = rows.filter((q) => q.priority === 'Critical');
  const first = ordered[0] || null;
  const reRate = comprehensive ? assessment.rerate : null;
  const deferralCount = report.deferralCount;
  // Use only the existing recovery plan, and never expose it through Simple.
  const deferral = comprehensive && deferralCount ? assessment.deferral.plan : null;
  const pauseFirst = assessment.rating.level === 'black';
  // Text and rendered action share this precedence; neither can independently
  // put recovery or trigger selection ahead of a pause / banker-review step.
  const actionType = pauseFirst ? 'pause'
    : deferralCount ? 'deferral'
    : !rows.length ? 'confirm'
    : reRate && (reRate.upwardBlocked || !first) ? 'rerate'
    : first ? 'question' : 'confirm';
  return {
    comprehensive,
    rating: assessment.rating,
    ratingSource: assessment.pristine ? 'Pre-generated sample view' : 'Current input rating (manual)',
    initialConfidence: assessment.confidence.value,
    reRate,
    deferralCount,
    deferral,
    pauseFirst,
    actionType,
    scope: 'Selected triggers identify potential issues to review; they are not verified findings or a complete credit assessment.',
    total: rows.length,
    criticalTotal: critical.length,
    criticalOpen: critical.filter((q) => q.status !== 'supports').length,
    reviewCounts: Object.fromEntries(Object.keys(EVIDENCE_STATUS).map((status) => [status, rows.filter((q) => q.status === status).length])),
    suggestions: assessment.triggerCheck.notSelected,
    issues: ordered.slice(0, 3),
    remaining: Math.max(0, ordered.length - 3),
    empty: rows.length === 0,
    emptyText: rows.length === 0
      ? deferralCount
        ? 'No triggers selected. Trigger-based issues have not been assessed. The entered lender deferral is shown separately; confirm any other triggers that apply.'
        : 'No triggers selected. Potential blockers and evidence gaps have not been assessed. Confirm the triggers that apply.'
      : 'All shown trigger reviews are marked supporting by you. This does not establish overall readiness; other issues may remain.',
    evidenceCounts: Object.fromEntries(Object.entries(assessment.missing).map(([priority, items]) => [priority, items.length])),
    evidenceScope: assessment.pristine
      ? 'Intake checklist from the sample. This list does not update when you mark trigger reviews.'
      : 'Requests from selected rules. Document availability is not checked; these are not confirmed missing documents.',
    first,
    nextStep: actionType === 'pause' ? assessment.rating.action
      : actionType === 'deferral' ? comprehensive
        ? 'Review the lender deferral recovery plan before the general trigger follow-ups.'
        : 'Lender deferral entered. Switch to Comprehensive for the deferral recovery plan.'
      : actionType === 'rerate' ? reRate.nextStep
      : actionType === 'question' ? (first.status === 'weak' ? `Review the weak evidence for ${first.trigger} with the client.` : `Ask the client about ${first.trigger}.`)
        : 'Confirm the triggers that apply before drawing a readiness conclusion.',
  };
}

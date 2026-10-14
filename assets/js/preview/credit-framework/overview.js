/* A presentation view of the existing assessment. No scoring, risk inference,
   rating changes or evidence verification happens here. Tier gating is retained. */
import { EVIDENCE_STATUS } from './engine.js';

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
  return {
    comprehensive,
    rating: assessment.rating,
    ratingSource: assessment.pristine ? 'Pre-generated sample view' : 'Current input rating (manual)',
    initialConfidence: assessment.confidence.value,
    reRate,
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
      ? 'No triggers selected. Potential blockers and evidence gaps have not been assessed. Confirm the triggers that apply.'
      : 'All shown trigger reviews are marked supporting by you. This does not establish overall readiness; other issues may remain.',
    evidenceCounts: Object.fromEntries(Object.entries(assessment.missing).map(([priority, items]) => [priority, items.length])),
    evidenceScope: assessment.pristine
      ? 'Intake checklist from the sample. This list does not update when you mark trigger reviews.'
      : 'Requests from selected rules. Document availability is not checked; these are not confirmed missing documents.',
    first,
    nextStep: assessment.rating.level === 'black' ? assessment.rating.action
      : !rows.length ? 'Confirm the triggers that apply before drawing a readiness conclusion.'
      : reRate && (reRate.upwardBlocked || !first)
      ? reRate.nextStep
      : first ? (first.status === 'weak' ? `Review the weak evidence for ${first.trigger} with the client.` : `Ask the client about ${first.trigger}.`)
        : 'Confirm the triggers that apply before drawing a readiness conclusion.',
  };
}

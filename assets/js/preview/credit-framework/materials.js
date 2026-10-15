/* Presentation only. Never writes engine evidence or assesses documents. */
import { RULES, EVIDENCE_STATUS } from './engine.js?v=cf-20261014-6';
export const MATERIALS_BOUNDARY = 'Preparation guide for this SME / commercial case only. Requirements vary by lender and case; this is not a complete or lender-verified document list. Ask your broker to review the list and confirm exact documents, alternatives, periods and applicability. Some entries are information or work your broker prepares; confirm who should supply each item. Receiving a document does not verify it or determine a lending outcome.';
export const MATERIAL_GROUPS = Object.freeze({ needed: 'Needed now — request / confirm availability', received: 'Received — awaiting document review', conditional: 'Conditional — confirm applicability first' });
export const materialKey = text => text.trim().replace(/\s+/g, ' ').toLowerCase();
const priorities = { Critical: 0, Important: 1, Helpful: 2 };
export function createMaterialReceipts() { return { fingerprint: null, received: new Set(), resetNotice: false }; }
export function syncMaterialReceipts(receipts, inputs) {
  const fingerprint = JSON.stringify(inputs);
  if (receipts.fingerprint !== null && fingerprint !== receipts.fingerprint) {
    receipts.resetNotice ||= receipts.received.size > 0;
    receipts.received.clear();
  }
  receipts.fingerprint = fingerprint;
}
export function applicantDocument(text) {
  return text.replace(/\bATO\b/g, 'Australian Taxation Office (ATO)').replace(/\bBAS\b/g, 'business activity statement (BAS)')
    .replace(/\bSG\b/g, 'superannuation guarantee (SG)').replace(/\bYTD\b/g, 'year-to-date').replace(/\bP&L\b/g, 'profit and loss');
}
export function buildMaterials(assessment, tier, evidence = {}, received = new Set()) {
  const comprehensive = tier === 'comprehensive';
  const selected = assessment.engine[comprehensive ? 'comprehensive' : 'simple'];
  const byId = new Map(RULES.map(q => [q.id, q]));
  const materials = new Map();
  const add = (q, conditional) => {
    for (const document of q.evidence) {
      const key = materialKey(document);
      let item = materials.get(key);
      if (!item) { item = { key, document, priority: q.priority, links: [], conditional: true }; materials.set(key, item); }
      if (!conditional) item.conditional = false;
      if (priorities[q.priority] < priorities[item.priority]) item.priority = q.priority;
      if (!item.links.some(link => link.id === q.id)) item.links.push({ id: q.id, trigger: q.triggerLabel, why: q.whyItMatters, conditional,
        review: comprehensive ? (EVIDENCE_STATUS[evidence[q.id]] || EVIDENCE_STATUS.outstanding) : null });
    }
  };
  for (const q of selected.questions) add(q, false);
  // Only existing deterministic suggestions that have not been selected.
  if (comprehensive) for (const id of assessment.triggerCheck.notSelected) { const q = byId.get(id); if (q) add(q, true); }
  const items = [...materials.values()].map(item => ({ ...item,
    group: item.conditional ? 'conditional' : received.has(item.key) ? 'received' : 'needed',
    receipt: received.has(item.key) && !item.conditional ? 'Receipt recorded; document not verified' : 'Receipt not recorded; availability unknown',
  })).sort((a, b) => priorities[a.priority] - priorities[b.priority] || a.document.localeCompare(b.document));
  return { comprehensive, scope: assessment.pristine ? `Synthetic example ${assessment.caseId}` : 'Current de-identified custom scenario', items,
    unknownCount: selected.unknownTriggers.length, omittedTriggers: assessment.engine.comprehensive.questions.length - selected.questions.length, boundary: MATERIALS_BOUNDARY };
}
// Allow-list: no raw scenario, risk, review judgments or trigger IDs.
export function applicantMaterials(model) {
  if (!model.comprehensive) return null;
  return { scope: model.scope, boundary: model.boundary, unknownCount: model.unknownCount,
    groups: Object.entries(MATERIAL_GROUPS).map(([key, title]) => ({ key, title,
      items: model.items.filter(item => item.group === key).map(item => ({
        request: key === 'conditional' ? `Ask your broker whether you need to provide: ${applicantDocument(item.document)}.`
          : key === 'received' ? `Receipt noted for: ${applicantDocument(item.document)}. Your broker still needs to review the document.`
          : `Please prepare ${applicantDocument(item.document)} for broker review, or tell your broker if it is unavailable.`, receipt: item.receipt,
      })),
    })),
  };
}
export function applicantMaterialsText(model) {
  const view = applicantMaterials(model); if (!view) return '';
  const lines = ['DOCUMENT PREPARATION LIST — DRAFT FOR BROKER REVIEW', `Scope: ${view.scope}`, view.boundary];
  if (view.unknownCount) lines.push('Some case details could not be mapped. Ask your broker what else is needed.');
  if (!model.items.length) lines.push('No documents mapped yet. This does not mean no documents are needed. Confirm case details with your broker.');
  for (const group of view.groups) if (group.items.length) { lines.push('', group.title); for (const item of group.items) lines.push(`- ${item.request} ${item.receipt}.`); }
  return lines.join('\n');
}
export function brokerMaterialsText(model) {
  const lines = ['MATERIALS — BROKER WORKING LIST', `Scope: ${model.scope}`, model.boundary,
    'Receipt tracking is separate from trigger-level evidence review; it does not change readiness, rating or confidence.'];
  if (!model.comprehensive) lines.push('Simple: selected-question document preview only. Full workflow and applicant wording require Comprehensive.');
  if (model.omittedTriggers) lines.push(`${model.omittedTriggers} additional trigger(s) omitted by the Simple tier.`);
  if (model.unknownCount) lines.push(`${model.unknownCount} unrecognised trigger(s) have no document mapping; review required.`);
  if (!model.items.length) lines.push('No documents mapped yet; this does not mean no documents are needed.');
  for (const [key, title] of Object.entries(MATERIAL_GROUPS)) {
    const items = model.items.filter(item => item.group === key); if (!items.length) continue;
    lines.push('', title);
    for (const item of items) {
      lines.push(`- ${item.document} [${item.priority}] — ${item.receipt}`);
      for (const link of item.links) lines.push(`  ${link.trigger}${link.conditional ? ' (suggested, unconfirmed)' : ''}: ${link.why}${link.review ? ` | Trigger review: ${link.review}` : ''}`);
    }
  }
  return lines.join('\n');
}

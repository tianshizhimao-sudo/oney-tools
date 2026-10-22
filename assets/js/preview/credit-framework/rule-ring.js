// Presentation of existing selected rule priorities; not a credit-risk model.
import { RISK_AREAS } from './manual-risk-view.js?v=cf-20261022-bs1&taxonomy=2';
import { RULES } from './engine.js?v=cf-20261022-bs1';
export const RING_LEGEND = 'Inner ring: selected review triggers, not automatic risk ratings. Purple = selected trigger(s); priority counts describe review order, not risk severity. Grey = no selected trigger shown in this tier, not a safe finding. Outer ring: your confirmed manual risk judgement; grey also means unconfirmed or stale. Each ring has four equal areas, not proportions, probabilities or a score. One primary area per trigger; issues may cross domains.';
export const RING_CAVEAT = 'Typing may suggest a trigger but does not select it. Confirm applicable triggers in Inputs; unconfirmed suggestions do not colour the inner ring. Reported inputs are unverified. Receipt notes, supporting evidence marks and proposed mitigation never remove selected triggers from the inner ring. Neither ring changes overall rating, confidence or re-rate.';
export function buildRuleRing(assessment, tier) {
  const selected = assessment.engine[tier === 'comprehensive' ? 'comprehensive' : 'simple'];
  const suggested = assessment.triggerCheck.suggested;
  const suggestionById = new Map(suggested.map(s => [s.id, s]));
  const rules = new Map(RULES.map(r => [r.id,r]));
  const areas = RISK_AREAS.map(area => {
    const triggers = selected.questions.filter(q => area.triggers.includes(q.id)).map(q => ({
      id:q.id, label:q.triggerLabel, priority:q.priority, why:q.whyItMatters,
      source:`${assessment.pristine ? 'Synthetic sample trigger' : 'User-selected trigger'}${suggestionById.has(q.id) ? ', also suggested by the intake rule (unverified input)' : '; no matching current intake suggestion'}`,
      reasons:[...(suggestionById.get(q.id)?.reasons || [])],
    }));
    const unconfirmed = assessment.triggerCheck.notSelected.filter(id=>area.triggers.includes(id)).map(id=>({id,label:rules.get(id)?.triggerLabel || id,reasons:[...(suggestionById.get(id)?.reasons || [])]}));
    const counts = Object.fromEntries(['Critical', 'Important', 'Helpful'].map(priority => [priority, triggers.filter(q => q.priority === priority).length]));
    const omitted = assessment.engine.comprehensive.questions.filter(q => area.triggers.includes(q.id)).length - triggers.length;
    const colour = triggers.length ? 'selected' : 'not_assessed';
    const label = triggers.length ? `${triggers.length} selected review trigger(s): ${counts.Critical} Critical, ${counts.Important} Important, ${counts.Helpful} Helpful — priorities, not risk ratings`
      : 'Not assessed — no selected trigger shown in this tier';
    return { id:area.id, label:area.label, scope:area.scope, manualScope:area.manualScope, counts, omitted, colour, indicator:label + (omitted ? `; ${omitted} selected trigger(s) omitted in this tier` : '') + (unconfirmed.length ? `; ${unconfirmed.length} unconfirmed suggestion(s)` : ''), triggers, unconfirmed };
  });
  return { areas, tier, omitted:selected.simpleSelection ? assessment.engine.comprehensive.questions.length-selected.questions.length : 0,
    unknownCount:selected.unknownTriggers.length, pause:assessment.rating.level==='black', pauseText:assessment.rating.level==='black' ? assessment.rating.action : '', legend:RING_LEGEND, caveat:RING_CAVEAT };
}
export function ruleRingText(model) {
  if (!model) return '';
  return ['Inner ring — rule-trigger indicators', model.legend, model.caveat,
    `Scope: ${model.tier}; ${model.omitted} selected trigger(s) omitted by this tier.`,
    ...(model.pause ? [`OVERALL PAUSE: ${model.pauseText} The rings do not override this.`] : []),
    ...(model.unknownCount ? [`${model.unknownCount} unrecognised trigger(s) have no ring mapping; review required.`] : []),
    ...model.areas.flatMap((area,i)=>[`${i+1}. ${area.label}: ${area.indicator}`, `Manual review considerations: ${area.manualScope}`, `Mapped coverage: ${area.scope}`,
      ...area.triggers.map(q=>`${q.priority}: ${q.label}. ${q.why} Source: ${q.source}${q.reasons.length ? `; ${q.reasons.join('; ')}` : ''}.`),
      ...area.unconfirmed.map(q=>`Unconfirmed suggestion only: ${q.label}; ${q.reasons.join('; ')}.`),
    ]),
  ].join('\n');
}

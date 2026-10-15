// Presentation of existing selected rule priorities; not a credit-risk model.
import { RISK_AREAS } from './manual-risk-view.js?v=cf-20261014-6';
import { RULES } from './engine.js?v=cf-20261014-6';
export const RING_LEGEND = 'Inner ring: selected rule-trigger priorities, not automatic risk ratings. Red = an existing Critical trigger; amber = Important / Helpful triggers; grey = no selected trigger in this tier, not a safe finding. Outer ring: your confirmed manual judgement; grey also means unconfirmed or stale. Each ring has four equal areas, not proportions, probabilities or a score.';
export const RING_CAVEAT = 'Typing may suggest a trigger but does not select it. Confirm applicable triggers in Inputs; unconfirmed suggestions do not colour the inner ring. Reported inputs are unverified. Receipt notes, supporting evidence marks and proposed mitigation never lower the inner indicator. Neither ring changes overall rating, confidence or re-rate.';
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
    const colour = triggers.some(q=>q.priority==='Critical') ? 'red' : triggers.length ? 'amber' : 'not_assessed';
    const label = colour==='red' ? 'Critical review trigger' : colour==='amber' ? 'Important / Helpful review trigger' : 'Not assessed — no selected trigger in this tier';
    return { id:area.id, label:area.label, colour, indicator:label + (unconfirmed.length ? `; ${unconfirmed.length} unconfirmed suggestion(s)` : ''), triggers, unconfirmed };
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
    ...model.areas.flatMap((area,i)=>[`${i+1}. ${area.label}: ${area.indicator}`,
      ...area.triggers.map(q=>`${q.priority}: ${q.label}. ${q.why} Source: ${q.source}${q.reasons.length ? `; ${q.reasons.join('; ')}` : ''}.`),
      ...area.unconfirmed.map(q=>`Unconfirmed suggestion only: ${q.label}; ${q.reasons.join('; ')}.`),
    ]),
  ].join('\n');
}

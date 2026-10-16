// Derived desktop presentation only. No case history, storage or rating writes.
import { riskAreaState } from './manual-risk-view.js?v=cf-20261014-6&taxonomy=2';
export const LIVE_BOUNDARY = 'Changes below describe existing rule displays and your entries, not automatic changes to risk ratings. Unconfirmed suggestions are not selected triggers. Unmapped information still needs review.';
export function createLiveTracker() { return { previous: null, model: null }; }
export function updateLiveTracker(tracker, { inputKey, tier, ring, manual, evidence = {}, rating = '' }) {
  const rows = ring.areas.map(area => {
    const outer = riskAreaState(manual, area.id);
    return { id: area.id, label: area.label, inner: area.colour, indicator: area.indicator, omitted: area.omitted,
      selected: area.triggers.map(q => ({ id:q.id, label:q.label, why:q.why, reasons:q.reasons })),
      suggested: area.unconfirmed.map(q => ({ id:q.id, reasons:q.reasons })),
      reviews: tier === 'comprehensive' ? area.triggers.map(q => ({id:q.id, status:['supports','weak','reply_only'].includes(evidence[q.id]) ? evidence[q.id] : 'outstanding'})) : null,
      outer: outer.label, outerColour: outer.colour };
  });
  const next = { inputKey, tier, rating, rows, pause:ring.pause, pauseText:ring.pauseText, unknown:ring.unknownCount };
  const prior = tracker.previous;
  if (prior && JSON.stringify(next) === JSON.stringify(prior)) return tracker.model;
  const changes = rows.map(row => {
    const before = prior?.rows.find(r => r.id === row.id); const notes=[];
    if (before) {
      if (JSON.stringify(before.selected.map(q=>q.id)) !== JSON.stringify(row.selected.map(q=>q.id))) notes.push('Selected trigger display changed');
      else if (JSON.stringify(before.selected) !== JSON.stringify(row.selected)) notes.push('Input-derived trigger reasons changed');
      if (JSON.stringify(before.suggested) !== JSON.stringify(row.suggested)) notes.push('Unconfirmed input suggestions changed');
      if (prior.tier === tier && JSON.stringify(before.reviews) !== JSON.stringify(row.reviews)) notes.push('Trigger-review entries changed');
      if (before.outer !== row.outer || before.outerColour !== row.outerColour) notes.push('Manual view status changed');
      if (before.omitted !== row.omitted) notes.push('Shown-tier coverage changed');
    }
    return {...row, changes:notes};
  });
  const any = changes.some(row=>row.changes.length);
  const message = !prior ? 'Current case baseline. No change comparison yet.'
    : prior.tier !== tier ? 'Output tier changed. Differences can reflect visibility, not a change in the case.'
    : prior.pause !== ring.pause ? 'Overall pause status changed. Check the current overall warning; domain indicators are separate.'
    : prior.rating !== rating ? 'Current overall rating input changed. Domain indicators are separate; no automatic domain rating was calculated.'
    : prior.unknown !== ring.unknownCount ? 'Unrecognised trigger count changed. These entries have no domain mapping and need review.'
    : any ? 'Mapped display changes are highlighted below. Check the source of each change.'
    : prior.inputKey !== inputKey ? 'Input changed; no change to the mapped indicators shown. This does not establish unchanged risk.'
    : 'No mapped indicator change. Check the current case and review status.';
  tracker.previous=next;
  tracker.model={tier,rows:changes,message,pause:ring.pause,pauseText:ring.pauseText,unknown:ring.unknownCount};
  return tracker.model;
}
const el=(tag,attrs={},...children)=>{const n=document.createElement(tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);for(const c of children.flat(Infinity))if(c!==null)n.append(c instanceof Node?c:document.createTextNode(String(c)));return n;};
const svgNode=(tag,attrs,text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
// DOM replaceChildren stringifies null; optional warning nodes must be omitted.
const replaceOptionalChildren=(target,...children)=>target.replaceChildren(...children.filter(child=>child!=null));
const rendered = new WeakMap();
export function renderLiveDesktop(model, openArea) {
  const panel=document.querySelector('#live-impact');const rail=document.querySelector('#live-domain-rail');if(!panel||!rail)return;
  const signature=JSON.stringify(model);if(rendered.get(panel)===signature)return;rendered.set(panel,signature);
  const changed=model.rows.filter(row=>row.changes.length);
  const overviewLink=el('button',{type:'button',class:'medium-overview-link btn btn-secondary'},'Open four-domain overview and review');overviewLink.addEventListener('click',()=>openArea(model.rows[0].id));
  replaceOptionalChildren(panel,el('h3',{},'Current-change explanation'),el('p',{class:'hint'},model.message),
    model.pause?el('p',{class:'notice warn'},`OVERALL PAUSE: ${model.pauseText}`):null,
    model.unknown?el('p',{class:'notice warn'},`${model.unknown} unrecognised trigger(s); no domain mapping.`):null,el('p',{class:'hint'},LIVE_BOUNDARY),
    overviewLink,...changed.map(row=>el('div',{class:'live-change','data-live-change':row.id},el('strong',{},row.label),el('p',{},row.changes.join(' · ')),
      el('p',{class:'hint'},row.indicator),
      ...row.selected.map(q=>el('p',{class:'hint'},`${q.label}: ${q.why}${q.reasons.length ? ' Input rule: '+q.reasons.join('; ') : ''}`)),
      row.suggested.length ? el('p',{class:'hint'},`${row.suggested.length} unconfirmed input suggestion(s); confirm applicability in Inputs. They do not colour the inner ring.`):null,
      row.reviews ? el('p',{class:'hint'},`${row.reviews.filter(r=>r.status!=='supports').length} of ${row.reviews.length} shown trigger reviews are not marked supporting. This is not a count of missing documents.`):null)));
  const svg=svgNode('svg',{viewBox:'0 0 320 320',role:'img','aria-labelledby':'live-ring-title live-ring-desc',class:'live-ring'});
  svg.append(svgNode('title',{id:'live-ring-title'},'Current four-domain overview'),svgNode('desc',{id:'live-ring-desc'},'Inner purple means selected triggers; grey means no selected trigger shown, not safety. Outer colours are manual views. Equal areas are not a score. Use the domain buttons to open the single review editor.'));
  const point=(r,d)=>[160+r*Math.cos(d*Math.PI/180),160+r*Math.sin(d*Math.PI/180)].map(n=>n.toFixed(3));
  const arc=(outer,inner,start,end)=>`M ${point(outer,start).join(' ')} A ${outer} ${outer} 0 0 1 ${point(outer,end).join(' ')} L ${point(inner,end).join(' ')} A ${inner} ${inner} 0 0 0 ${point(inner,start).join(' ')} Z`;
  model.rows.forEach((row,i)=>{const start=-90+i*90,end=start+90;svg.append(svgNode('path',{d:arc(140,98,start,end),class:`live-outer-fill ${row.outerColour}`,'data-live-outer':row.id}),svgNode('path',{d:arc(86,48,start,end),class:`rule-ring-fill ${row.inner}`,'data-live-inner':row.id}));const [x,y]=point(119,start+45);svg.append(svgNode('text',{x,y,'text-anchor':'middle','dominant-baseline':'central',class:'risk-quadrant-number'},String(i+1)));});
  svg.append(svgNode('text',{x:'160',y:'163','text-anchor':'middle',class:'risk-centre'},'Sources'));
  replaceOptionalChildren(rail,el('div',{class:'live-ring-pinned'},el('h3',{},'Four-domain overview'),
    svg,el('div',{class:'live-domain-key'},...model.rows.map((row,i)=>el('span',{},`${i+1}. ${row.label}`))),el('p',{class:'hint'},`Scope: ${model.tier}. Inner: selected triggers / unassessed. Outer: manual judgement / draft or stale.`),
    model.pause?el('p',{class:'notice warn'},`OVERALL PAUSE: ${model.pauseText}`):null,
    model.unknown?el('p',{class:'notice warn'},`${model.unknown} unrecognised trigger(s); no domain mapping.`):null,
    el('p',{class:'hint'},'Equal areas are not a risk score. Purple: selected triggers; grey: unassessed.')),
    el('div',{class:'live-domain-details',tabindex:'0',role:'region','aria-label':'Domain review links'},
    ...model.rows.map((row,i)=>{const button=el('button',{type:'button',class:'live-domain-button','data-live-domain':row.id,'data-changed':String(row.changes.length>0)},el('strong',{},`${i+1}. ${row.label}`),el('span',{},`Inner: ${row.indicator}`),el('span',{},`Outer: ${row.outer}`),el('span',{class:'hint'},row.changes.length?'Display changed · Open review':'Open review'));button.addEventListener('click',()=>openArea(row.id));return button;})));
}

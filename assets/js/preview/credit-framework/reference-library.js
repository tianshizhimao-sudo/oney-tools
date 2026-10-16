// Static educational helpers only. Never read case inputs or change assessment state.
import { GLOSSARY, POLICY_REFERENCES } from './reference-data.js?v=reference-2';
export { GLOSSARY, POLICY_REFERENCES };
export const FIELD_TERMS=Object.freeze({income:'FY YTD NPAT EBITDA p.a.',security:'LVR AVM WALE GSA',existingDebts:'MCA',conduct:'ATO SG',documents:'BAS FY YTD',borrowerType:'SME SMSF',borrower:'SME SMSF'});
export const REFERENCE_BOUNDARY='Learning and research links only. Oney summaries are editorial, not lender policy. Public pages may be incomplete or outdated; confirm the applicable lender, product and current requirements with the lender. Only the lender can decide a credit application. These links do not change the tool’s ratings.';
const node=(tag,attrs={},...children)=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);for(const c of children.flat(Infinity))if(c!=null)n.append(c instanceof Node?c:document.createTextNode(String(c)));return n;};
export function findTerms(text){const value=String(text||'');return GLOSSARY.filter(term=>term.aliases.some(alias=>new RegExp(`(^|[^A-Za-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}s?(?=$|[^A-Za-z0-9])`,'i').test(value)));}
export function searchTerms(query){const q=String(query||'').trim().toLocaleLowerCase();return GLOSSARY.filter(term=>[term.term,term.full,term.explanation,...term.aliases].join(' ').toLocaleLowerCase().includes(q));}
function definition(term){return node('div',{'data-term':term.term},node('dt',{},`${term.term} — ${term.full}`),node('dd',{},term.explanation),term.source?node('dd',{class:'hint'},safeExternalLink(term.source,'Definition source ↗'),` · Link checked ${term.checkedOn}; terminology only, not an applicable policy.`):null);}
export function glossaryHelp(staticText){const terms=findTerms(staticText);if(!terms.length)return null;return node('details',{class:'term-help no-print'},node('summary',{},`Terms: ${terms.map(t=>t.term).join(' · ')}`),node('dl',{},terms.map(definition)));}
export function referencesFor({triggerId,domainId}={}){return POLICY_REFERENCES.filter(r=>(triggerId&&r.triggerIds.includes(triggerId))||(domainId&&r.domainIds.includes(domainId)));}
function safeExternalLink(url,text){const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw new Error('Reference links must be public HTTPS URLs');return node('a',{href:url,target:'_blank',rel:'noopener noreferrer',referrerpolicy:'no-referrer','aria-label':`${text} (opens external website in a new tab)`},text);}
function referenceCard(ref){return node('article',{class:'reference-card','data-reference':ref.id},node('h4',{},safeExternalLink(ref.url,`${ref.title} ↗`)),node('p',{class:'reference-source'},`${ref.sourceType} · ${ref.publisher} · Scope: ${ref.scope}`),node('p',{},`Tool summary (not source wording): ${ref.summary}`),node('p',{class:'hint'},`Link checked: ${ref.checkedOn}. Source publication / update date: ${ref.sourceDate||'Not stated / unknown'}. Link check is not confirmation that policy is current.`));}
export function contextualReferences(context){const refs=referencesFor(context);if(!refs.length)return null;return node('details',{class:'context-references no-print'},node('summary',{},`External research references (${refs.length})`),node('p',{class:'hint'},REFERENCE_BOUNDARY),refs.map(referenceCard));}
export function mountReferenceLibrary(root){if(!root)return;const search=node('input',{id:'glossary-search',type:'search',class:'control',placeholder:'e.g. LVR, super, valuation',autocomplete:'off','aria-describedby':'glossary-search-note'});const list=node('dl',{id:'glossary-results'});const status=node('p',{id:'glossary-search-status',class:'hint',role:'status','aria-live':'polite'});const render=()=>{const terms=searchTerms(search.value);list.replaceChildren(...terms.map(definition));status.textContent=`${terms.length} of ${GLOSSARY.length} terms${terms.length?'':' · Try another abbreviation or keyword'}`;};search.addEventListener('input',render);
 root.replaceChildren(node('p',{id:'glossary-search-note',class:'hint'},'Search abbreviations, full names or plain-English explanations. Learning aid only; terms do not establish a lending requirement.'),node('label',{for:'glossary-search'},'Find a term'),search,status,list,node('details',{class:'reference-sources'},node('summary',{},`External policy and research library (${POLICY_REFERENCES.length})`),node('p',{class:'notice info'},REFERENCE_BOUNDARY),node('p',{class:'hint'},'Links open another website in a new tab. No case details are added to the URL and no referrer is sent. Definitions and link selection are curated manually; this page does not synchronise Policy Radar.'),POLICY_REFERENCES.map(referenceCard)));render();}

// Supplemental help stays in normal document flow, avoiding clipped popovers.
export function createQuickHelp(id,label,text){
 const button=node('button',{type:'button',class:'quick-help-button','aria-expanded':'false','aria-controls':id},label+' ⓘ');
 const panel=node('div',{id,class:'quick-help-panel',hidden:''},node('p',{},text));
 const close=node('button',{type:'button',class:'quick-help-close','aria-label':'Close '+label+' help'},'Close help');panel.append(close);
 const root=node('div',{class:'quick-help no-print'},button,panel);let pinned=false,suppressed=false;
 const show=()=>{if(!suppressed){panel.hidden=false;button.setAttribute('aria-expanded','true');}};
 const hide=()=>{panel.hidden=true;button.setAttribute('aria-expanded','false');};
 root.addEventListener('pointerenter',show);
 root.addEventListener('pointerleave',()=>{suppressed=false;if(!pinned&&!root.contains(document.activeElement))hide();});
 root.addEventListener('focusin',()=>{if(!panel.hidden||document.activeElement===button)show();});
 root.addEventListener('focusout',event=>{if(!root.contains(event.relatedTarget)){pinned=false;suppressed=false;hide();}});
 button.addEventListener('click',()=>{if(pinned){pinned=false;suppressed=true;hide();}else{pinned=true;suppressed=false;show();}});
 const dismiss=()=>{pinned=false;suppressed=true;hide();button.focus();};
 close.addEventListener('click',dismiss);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){const focusInside=root.contains(document.activeElement);pinned=false;suppressed=true;hide();if(focusInside){event.preventDefault();button.focus();}}});
 return root;
}
export function mountGettingStarted(){
 const policy=document.querySelector('#policy-radar-shortcut');
 if(policy){const ref=POLICY_REFERENCES.find(r=>r.id==='policy_radar_search');policy.replaceChildren(safeExternalLink(ref.url,'Explore Oney Policy Radar ↗'),node('span',{class:'hint'},'Select Commercial after opening. Oney editorial research; lender coverage and source dates vary. Confirm current criteria with the lender.'));}
 const helpers={
  'trigger-quick-help':['Selected triggers','A trigger is an issue you choose to investigate. Typing a detail may suggest a trigger; review and select it explicitly. No selected triggers does not mean no risk. Existing concerns remain when you report no concerns.'],
  'evidence-quick-help':['Evidence status','A document reported or marked received still needs review. In Comprehensive, review each follow-up against its evidence before updating its status. Status choices and re-rate outcomes remain separate from a lender decision.'],
  'ring-quick-help':['Reading the two rings','The inner ring counts selected triggers in Management, Transaction, Servicing and Security. Purple means selected items to check; gray means unassessed. The outer ring records your manual judgement and basis. Adding mitigation text does not lower a rating; edits can make previous manual judgements stale. Use a segment to open the shared editor.']
 };
 for(const[id,[label,text]]of Object.entries(helpers)){const target=document.getElementById(id);if(target)target.replaceChildren(createQuickHelp(id+'-panel',label,text));}
}

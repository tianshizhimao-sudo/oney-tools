/* =========================================================
   Oney Credit Framework — MVP wrapper page controller (DOM only)
   INTERNAL PROTOTYPE ONLY. No network calls, no storage, no submissions.
   All logic lives in engine.js; this file renders and wires events.
   ========================================================= */

import {
  CASES, CASE_ORDER, RULES, KIND, KIND_LABEL, KIND_HELP, TIERS, INTAKE_FIELDS,
  RATING_OPTIONS, EVIDENCE_STATUS, BOUNDARY_TEXT,
  initialState, blankState, buildAssessment, buildReport, reportToPlainText, lintCompliance,
  suggestTriggers, compareTriggers, triggerCheckText,
  DEFERRAL_REASONS, DEFERRAL_LIBRARY_VERSION, DEFERRAL_STATUS,
  FEEDBACK_QUESTIONS, FEEDBACK_ANSWERS, scoreFeedback, feedbackText,
} from './engine.js?v=cf-20261014-6&vanilla=1';
import { formatMoneyEdit, deleteMoneySeparator } from './money-input.js';
import { buildOverview } from './overview.js?v=cf-20261014-6';
import { INTAKE_PRESETS, TRIGGER_GROUPS, composeIntakeValue, conductReport } from './intake-options.js?v=conduct-1';
import { createRiskView, syncRiskInputs, riskViewText, RISK_AREAS, riskAreaState } from './manual-risk-view.js?v=cf-20261014-6&taxonomy=2';
import { renderManualRiskView } from './manual-risk-view-ui.js?v=cf-20261014-6&ring=2';

import { createMaterialReceipts, syncMaterialReceipts, buildMaterials, MATERIAL_GROUPS, brokerMaterialsText, applicantMaterialsText } from './materials.js?v=materials-3';

import { buildRuleRing, ruleRingText } from './rule-ring.js?v=ring-2';

import { createLiveTracker, updateLiveTracker, renderLiveDesktop } from './live-desktop.js?v=live-2';

import { glossaryHelp, contextualReferences, mountReferenceLibrary, mountGettingStarted, FIELD_TERMS } from './reference-library.js?v=reference-3';

const $ = (s, r = document) => r.querySelector(s);

/** Safe element builder: strings become text nodes, never HTML. */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

const kindBadge = (kind) => el('span', { class: `kind ${kind}`, title: KIND_HELP[kind], 'data-kind': kind }, KIND_LABEL[kind]);
const item = (kind, ...children) => el('div', { class: `item ${kind}`, 'data-kind': kind }, kindBadge(kind), ' ', ...children);

/* ------------------------------ state ------------------------------ */

const params = new URLSearchParams(location.search);
const startCase = CASE_ORDER.includes(params.get('case')) ? params.get('case') : 'CF-002';
const startTier = params.get('tier') === 'comprehensive' ? 'comprehensive' : 'simple';
let state = initialState(startCase, startTier);
let lastPlainText = '';
let basePlainText = '';
let manualRiskView = createRiskView();
let materialReceipts = createMaterialReceipts();
let materialsAudience = 'broker';
let ruleRing = null;
let liveTracker = createLiveTracker();
let liveContext = null;
// UI-only drafts retain invalid text and decimal precision across tier switches.
const moneyDrafts = new Map();
const manualDrafts = new Map();
const presetSelections = new Map();
const manualExpanded = new Set();
const triggerGroupsExpanded = new Set();
function resetIntakeUi() {
  liveTracker = createLiveTracker(); liveContext = null;
  moneyDrafts.clear(); manualDrafts.clear(); presetSelections.clear(); manualExpanded.clear(); triggerGroupsExpanded.clear();
  manualRiskView = createRiskView();
  materialReceipts = createMaterialReceipts();
  materialsAudience = 'broker';
}

/* ------------------------------ intake ------------------------------ */

function renderCasePicker() {
  const box = $('#case-picker');
  box.replaceChildren();
  const blank = el('fieldset', { class: 'case-group', id: 'blank-case-group' },
    el('legend', {}, 'Blank new case'),
    el('p', { class: 'hint' }, 'Start without sample data. Enter de-identified details only.'),
    el('button', {
      class: 'case-btn', type: 'button', 'aria-pressed': state.caseId === null ? 'true' : 'false', 'data-case': 'custom',
      onclick: () => { state = blankState(state.tier); resetIntakeUi(); renderAll(); },
    }, el('span', { class: 'dot custom' }), el('span', {}, 'Blank custom scenario (rules only)')));
  const examples = el('fieldset', { class: 'case-group', id: 'example-case-group' },
    el('legend', {}, 'CF examples — synthetic'),
    el('p', { class: 'hint' }, 'Illustrative sample deals, not your client data. Loading a case replaces the current inputs and manual views.'));
  for (const id of CASE_ORDER) {
    const c = CASES[id];
    examples.append(el('button', {
      class: 'case-btn', type: 'button', 'aria-pressed': state.caseId === id ? 'true' : 'false', 'data-case': id,
      onclick: () => { state = initialState(id, state.tier); resetIntakeUi(); renderAll(); },
    }, el('span', { class: `dot ${c.tone}` }), el('span', {}, c.shortLabel)));
  }
  box.append(blank, examples);
}

function renderTierToggles() {
  for (const id of ['#tier-intake', '#tier-output']) {
    const box = $(id);
    box.replaceChildren();
    for (const t of Object.values(TIERS)) {
      box.append(el('button', {
        class: 'tier-btn', type: 'button', role: 'tab', 'data-tier': t.id, 'aria-selected': state.tier === t.id ? 'true' : 'false',
        onclick: () => { state.tier = t.id; renderAll(); },
      }, t.id === 'simple' ? 'Simple' : 'Comprehensive', el('small', {}, t.name)));
    }
  }
}

function deferralPicker() {
  const codes = state.intake.deferralCodes || (state.intake.deferralCodes = []);
  return el('fieldset', { class: 'deferral-pick', id: 'deferral-pick' },
    el('legend', {}, 'Lender deferral / more-info request'),
    el('small', { class: 'hint' }, `Tick what the lender asked for. Reason library ${DEFERRAL_LIBRARY_VERSION}.`),
    DEFERRAL_REASONS.map((d) => {
      const cb = el('input', { type: 'checkbox', id: `d-${d.id}`, value: d.id, checked: codes.includes(d.id) });
      cb.addEventListener('change', () => {
        state.intake.deferralCodes = cb.checked ? [...codes.filter((c) => c !== d.id), d.id] : codes.filter((c) => c !== d.id);
        renderAll();
      });
      return el('label', { class: 'trig', for: `d-${d.id}` }, cb, el('span', {}, d.label));
    }));
}

function renderPresetField(f, id) {
  const config = INTAKE_PRESETS[f.key];
  if (!manualDrafts.has(f.key)) manualDrafts.set(f.key, String(state.intake[f.key] ?? ''));
  const selected = () => presetSelections.get(f.key) || [];
  const reviewNote = el('small', { class: 'preset-review-note' }, 'Retained details are still included. Check that these choices agree with them; edit the details if the situation changed.');
  const updateReviewNote = () => {
    reviewNote.hidden = !manualDrafts.get(f.key)?.trim() || !config.options.some((option) => selected().includes(option.id));
  };
  updateReviewNote();
  const manual = el('textarea', { class: 'control', id, name: f.key, rows: '2', maxlength: '600', placeholder: 'Optional details or anything the choices do not cover' });
  manual.value = manualDrafts.get(f.key);
  const details = el('details', { class: 'manual-details', open: manualExpanded.has(f.key) ? true : null },
    el('summary', {}, manual.value ? 'View / edit retained details' : 'Add other details (optional)'),
    el('label', { class: 'sr-only', for: id }, `${f.label} — manual details`), manual);
  details.addEventListener('toggle', () => { if (details.open) manualExpanded.add(f.key); else manualExpanded.delete(f.key); });
  const choices = el('div', { class: 'preset-options', role: 'group', 'aria-label': config.label });
  const apply = (values) => {
    presetSelections.set(f.key, values);
    state.edited = true; // Choices describe a custom scenario, never a calibrated sample.
    state.intake[f.key] = composeIntakeValue(f.key, manualDrafts.get(f.key), values);
    updateReviewNote();
    for (const button of choices.querySelectorAll('[data-preset]')) button.setAttribute('aria-pressed', String(values.includes(button.dataset.preset)));
    if (values.includes('other')) { details.open = true; manualExpanded.add(f.key); manual.focus(); }
    renderOutput();
  };
  const options = [...config.options, { id: 'unknown', label: 'Unknown' }, { id: 'other', label: 'Other / add details' }];
  if (config.multiple) {
    for (const option of options) choices.append(el('button', {
      class: 'preset-choice', type: 'button', 'data-preset-field': f.key, 'data-preset': option.id,
      'aria-pressed': String(selected().includes(option.id)),
      onclick: () => {
        const current = selected();
        const next = current.includes(option.id) ? current.filter((value) => value !== option.id)
          : option.id === 'unknown' ? ['unknown'] : [...current.filter((value) => value !== 'unknown'), option.id];
        apply(next);
      },
    }, option.label));
  } else {
    const select = el('select', { class: 'control', id: `preset-${f.key}`, 'aria-label': config.label, 'data-preset-select': f.key },
      el('option', { value: '', selected: !selected().length }, 'Choose an option (optional)'),
      options.map((option) => el('option', { value: option.id, selected: selected().includes(option.id) }, option.label)));
    select.addEventListener('change', () => apply(select.value ? [select.value] : []));
    choices.append(select);
  }
  manual.addEventListener('input', () => {
    manualDrafts.set(f.key, manual.value);
    state.edited = true;
    state.intake[f.key] = composeIntakeValue(f.key, manual.value, selected());
    updateReviewNote();
    renderOutput();
  });
  return el('div', { class: 'field preset-field', 'data-structured-field': f.key },
    el('span', { class: 'preset-label' }, config.label),
    config.multiple ? el('small', { class: 'hint' }, 'Choose all that apply; leave unselected if unsure.') : null,
    choices,
    el('small', { class: 'hint preset-help' }, f.key === 'documents'
      ? 'Availability is reported only, not reviewed or verified. Choices add to retained details.'
      : f.key === 'conduct' ? 'No concerns reported is unverified. Existing concerns and retained details stay included; reconcile any differences. Unknown does not mean none.' : 'Choices add to retained details below. Unknown does not mean none.'), glossaryHelp([config.label,FIELD_TERMS[f.key]||'',...config.options.map(option=>option.label)].join(' ')), reviewNote, f.key === 'conduct' ? el('p', { id: 'conduct-input-note', class: 'notice info', role: 'status', hidden: true }) : null, details);
}

function renderIntakeForm() {
  const form = $('#intake-form');
  form.replaceChildren();
  const sections = [...new Set(INTAKE_FIELDS.map((f) => f.section))];
  sections.forEach((section, i) => {
    const fields = INTAKE_FIELDS.filter((f) => f.section === section).map((f) => {
      const id = `f-${f.key}`;
      if (INTAKE_PRESETS[f.key]) return renderPresetField(f, id);
      let control;
      let error;
      if (f.options) {
        control = el('select', { class: 'control', id, name: f.key },
          Object.entries(f.options).map(([v, label]) => el('option', { value: v, selected: String(state.intake[f.key]) === v }, label)));
      } else if (f.money) {
        const draft = moneyDrafts.get(f.key) || formatMoneyEdit(state.intake[f.key] ?? '');
        control = el('input', { class: 'control money-control', id, name: f.key, type: 'text', inputmode: 'decimal', spellcheck: 'false', value: draft.text, 'aria-describedby': `${id}-help ${id}-error`, 'aria-invalid': String(!draft.valid) });
        error = el('small', { class: 'field-error', id: `${id}-error`, hidden: draft.valid }, draft.error || '');
        control.setCustomValidity(draft.error || '');
        const updateMoney = (result) => {
          moneyDrafts.set(f.key, result);
          control.value = result.text;
          control.setSelectionRange(result.start, result.end);
          control.setAttribute('aria-invalid', String(!result.valid));
          control.setCustomValidity(result.error || '');
          error.textContent = result.error || '';
          error.hidden = result.valid;
          state.intake[f.key] = result.value;
          renderOutput();
        };
        control.addEventListener('input', (event) => {
          const strict = moneyDrafts.get(f.key)?.valid === false || !event.inputType || /insertFrom(?:Drop|Paste)/.test(event.inputType) || (event.inputType === 'insertText' && event.data?.includes(','));
          updateMoney(formatMoneyEdit(control.value, control.selectionStart, control.selectionEnd, { paste: strict }));
        });
        control.addEventListener('paste', (event) => {
          if (!event.clipboardData) return;
          event.preventDefault();
          const pasted = event.clipboardData.getData('text');
          const start = control.selectionStart;
          const text = control.value.slice(0, start) + pasted + control.value.slice(control.selectionEnd);
          // Validate the pasted segment on its own; grouping around an edited
          // selection may legitimately be incomplete and is reformatted below.
          const segment = formatMoneyEdit(pasted, pasted.length, pasted.length, { paste: true });
          const caret = start + pasted.length;
          updateMoney(segment.valid ? formatMoneyEdit(text, caret, caret, { paste: moneyDrafts.get(f.key)?.valid === false }) : { ...segment, text, start: caret, end: caret });
        });
        control.addEventListener('beforeinput', (event) => {
          if (moneyDrafts.get(f.key)?.valid === false) return;
          const deletion = deleteMoneySeparator(control.value, control.selectionStart, control.selectionEnd, event.inputType);
          if (!deletion) return;
          event.preventDefault();
          updateMoney(formatMoneyEdit(deletion.text, deletion.caret, deletion.caret));
        });
      } else if (f.key === 'dealName') {
        control = el('input', { class: 'control', id, name: f.key, type: 'text', maxlength: '600', value: state.intake[f.key] ?? '', placeholder: 'Optional de-identified deal label' });
      } else {
        control = el('textarea', { class: 'control', id, name: f.key, rows: '2', maxlength: '600' });
        control.value = state.intake[f.key] ?? '';
      }
      if (!f.money) control.addEventListener('input', () => {
        state.intake[f.key] = control.value;
        renderOutput();
      });
      const field = el('div', { class: 'field' }, el('label', { for: id }, f.label), control,
        f.money ? el('small', { class: 'hint money-help', id: `${id}-help` }, 'AUD · e.g. 1,250,000.50 · blank means not provided') : null, error, glossaryHelp([f.label,FIELD_TERMS[f.key]||'',f.money?'AUD':'',...Object.values(f.options||{})].join(' ')));
      const optionalLabels = { scenario: 'Scenario context (optional)', borrower: 'Structure details (optional)', deferralReason: 'Exact lender wording (optional)' };
      return optionalLabels[f.key] ? el('details', { class: 'manual-details' }, el('summary', {}, optionalLabels[f.key]), field) : field;
    });
    const narrow = window.matchMedia('(max-width: 1100px)').matches;
    if (section === 'Deferral / concern reason') fields.unshift(deferralPicker());
    const hasDeferral = section === 'Deferral / concern reason' && (state.intake.deferralCodes || []).length > 0;
    form.append(el('details', { class: 'sec', open: (!narrow && i < 2) || hasDeferral ? true : null }, el('summary', {}, section), el('div', { class: 'fields' }, fields)));
  });

  const ratingSel = el('select', { class: 'control', id: 'f-rating', name: 'rating' },
    [...new Set([state.rating, ...RATING_OPTIONS])].map((r) => el('option', { value: r, selected: r === state.rating }, r)));
  ratingSel.addEventListener('change', () => { state.rating = ratingSel.value; renderOutput(); });

  const trigNodes = Object.fromEntries(RULES.map((r) => {
    const cb = el('input', { type: 'checkbox', id: `t-${r.id}`, value: r.id, checked: state.triggers.includes(r.id) });
    cb.addEventListener('change', () => {
      state.triggers = cb.checked ? [...state.triggers, r.id] : state.triggers.filter((t) => t !== r.id);
      delete state.evidence[r.id];
      renderOutput();
    });
    return [r.id, el('label', { class: 'trig', for: `t-${r.id}`, 'data-trig': r.id }, cb,
      el('span', {}, r.triggerLabel, ' ', el('span', { class: `prio ${r.priority}` }, r.priority), el('span', { class: 'sugg-chip', 'data-sugg-chip': r.id, hidden: true }, 'Suggested'),
        el('small', { class: 'sugg-why', 'data-sugg-why': r.id, hidden: true })))];
  }));
  const groups = TRIGGER_GROUPS.map((group) => {
    const box = el('details', { class: 'risk-group', id: `risk-group-${group.id}`, open: triggerGroupsExpanded.has(group.id) ? true : null },
      el('summary', {}, el('span', {}, el('strong', {}, group.label), el('small', {}, group.hint)), el('span', { class: 'group-count', 'data-group-count': group.id })),
      el('div', { class: 'risk-group-body' }, group.rules.map((id) => trigNodes[id]), glossaryHelp(group.rules.map(id=>RULES.find(rule=>rule.id===id).triggerLabel).join(' '))));
    box.addEventListener('toggle', () => { if (box.open) triggerGroupsExpanded.add(group.id); else triggerGroupsExpanded.delete(group.id); });
    return box;
  });

  form.append(el('details', { class: 'sec', open: true },
    el('summary', {}, 'Risk categories + current rating'),
    el('div', { class: 'fields' },
      el('p', { class: 'hint', style: 'margin:0' }, 'Oney suggests triggers from your intake by rule. Nothing is ticked for you — confirm or change. Rules come verbatim from rules-v0.1.json.'),
      el('div', { class: 'sugg-panel', id: 'sugg-panel', 'aria-live': 'polite' }),
      el('div', { class: 'selected-risk-summary', id: 'selected-risk-summary', 'aria-live': 'polite' }),
      el('div', { class: 'risk-groups' }, groups),
      el('div', { class: 'field' }, el('label', { for: 'f-rating' }, 'Current readiness rating'), ratingSel))));
  document.dispatchEvent(new window.Event('credit:intake-rendered'));
}

/* ------------------------------ output ------------------------------ */

/* Trigger suggestions: refreshed on every intake change without rebuilding the form. */
function renderSuggestions() {
  const suggested = suggestTriggers(state.intake);
  const cmp = compareTriggers(state.triggers, suggested);
  const byId = Object.fromEntries(suggested.map((x) => [x.id, x]));
  for (const group of TRIGGER_GROUPS) {
    const count = document.querySelector(`[data-group-count="${group.id}"]`);
    if (count) {
      const selectedCount = group.rules.filter((id) => state.triggers.includes(id)).length;
      const toConfirm = group.rules.filter((id) => cmp.notSelected.includes(id)).length;
      count.textContent = `${selectedCount} selected${toConfirm ? ` · ${toConfirm} suggested` : ''}`;
    }
  }
  const selectedBox = $('#selected-risk-summary');
  if (selectedBox) selectedBox.replaceChildren(
    el('strong', {}, `${state.triggers.length} trigger${state.triggers.length === 1 ? '' : 's'} selected`),
    state.triggers.length ? el('div', { class: 'selected-risk-chips' }, RULES.filter((rule) => state.triggers.includes(rule.id)).map((rule) => el('button', {
      class: 'selected-risk-chip', type: 'button', 'data-review-trigger': rule.id, title: 'Open this trigger for review',
      onclick: () => {
        const group = TRIGGER_GROUPS.find((item) => item.rules.includes(rule.id));
        const box = $(`#risk-group-${group.id}`); box.open = true; triggerGroupsExpanded.add(group.id);
        const input = $(`#t-${rule.id}`); input.focus({ preventScroll: true }); input.scrollIntoView({ block: 'center' });
      },
    }, rule.triggerLabel))) : el('p', { class: 'hint' }, 'None selected yet. This does not mean there are no risks. Open a category to confirm what applies.'));
  for (const r of RULES) {
    const chip = document.querySelector(`[data-sugg-chip="${r.id}"]`);
    const why = document.querySelector(`[data-sugg-why="${r.id}"]`);
    if (!chip) continue;
    chip.hidden = !byId[r.id];
    why.hidden = !byId[r.id];
    why.textContent = byId[r.id] ? `Why: ${byId[r.id].reasons.join('; ')}` : '';
    document.querySelector(`[data-trig="${r.id}"]`).dataset.suggested = byId[r.id] ? 'true' : 'false';
  }
  const panel = $('#sugg-panel');
  if (!panel) return;
  const addBtn = cmp.notSelected.length
    ? el('button', { class: 'btn btn-primary', type: 'button', id: 'apply-suggestions', onclick: () => {
        state.triggers = [...state.triggers, ...cmp.notSelected];
        renderAll();
      } }, `Add ${cmp.notSelected.length} suggested trigger${cmp.notSelected.length > 1 ? 's' : ''}`)
    : null;
  panel.replaceChildren(
    el('div', { class: 'sugg-head' }, kindBadge(KIND.RULE), el('strong', {}, ` ${suggested.length} suggested from intake`)),
    el('p', { class: 'hint', style: 'margin:4px 0 0', id: 'sugg-status' }, triggerCheckText({ suggested, ...cmp })),
    ...(addBtn ? [addBtn] : []));
  panel.dataset.notSelected = String(cmp.notSelected.length);
}

function renderLegend() {
  const box = $('#legend');
  box.replaceChildren(el('strong', { style: 'font-size:12px;width:100%' }, 'How to read this output'));
  for (const k of Object.values(KIND)) box.append(el('span', { class: 'legend-item' }, kindBadge(k), KIND_HELP[k]));
}

/* Collapsed-by-default sections: one-line summary + "Details" toggle.
   Open sections are remembered across re-renders (UI state only). */
const expanded = new Set();
const SECTION_TOPICS = { snapshot: 'Deal context', rating: 'Assessment context', risks: 'Assessment context', manual: 'Your manual view', dimensions: 'Assessment context', missing: 'Evidence & preparation', materials: 'Evidence & preparation', questions: 'Evidence & preparation', deferral: 'Evidence & preparation', rerate: 'Evidence & preparation', nextStep: 'Next steps & communication', packaging: 'Next steps & communication', email: 'Next steps & communication' };

function watchNote(conf) {
  const shown = conf.watch.slice(0, 3);
  const more = conf.watch.length - shown.length;
  return el('div', { class: 'notice warn watch', id: 'watch-points', 'data-kind': KIND.RULE },
    el('strong', {}, `Watch — confidence stays ${conf.value} until evidenced: `),
    shown.join('; '), more > 0 ? ` (+${more} more in Missing evidence)` : '');
}

function summaryNode(s) {
  if (s.id === 'rating') {
    return el('div', { class: 'summary rating-row', 'data-summary': s.id },
      el('span', { class: `rating-pill ${s.rating.level || ''}`, id: 'rating-pill' }, s.rating.text),
      el('span', { class: 'conf', id: 'confidence-pill' }, `Confidence: ${s.confidence.value}`),
      s.confidence.watch.length ? watchNote(s.confidence) : null);
  }
  return el('p', { class: 'summary', 'data-summary': s.id }, kindBadge(s.summary.kind), el('span', {}, s.summary.text));
}

function sectionShell(s, ...body) {
  const attrs = { class: `out${s.locked ? ' locked' : ''}`, id: `sec-${s.id}`, 'data-section': s.id, 'data-locked': s.locked ? 'true' : 'false' };
  const title = el('h3', {}, s.title, s.locked ? el('span', { class: 'prio Important' }, 'Comprehensive only') : null);
  if (!s.summary) return el('section', attrs, title, ...body);
  const open = expanded.has(s.id);
  const bodyId = `body-${s.id}`;
  const wrap = el('div', { class: 'sec-body', id: bodyId }, ...body);
  wrap.hidden = !open;
  const btn = el('button', { class: 'sec-toggle no-print', type: 'button', 'aria-expanded': String(open), 'aria-controls': bodyId, 'data-toggle': s.id }, open ? 'Hide details ▴' : 'Show details ▾');
  btn.addEventListener('click', () => {
    const now = wrap.hidden;
    wrap.hidden = !now;
    if (now) expanded.add(s.id); else expanded.delete(s.id);
    btn.setAttribute('aria-expanded', String(now));
    btn.textContent = now ? 'Hide details ▴' : 'Show details ▾';
    syncExpandAll();
  });
  return el('section', attrs, el('div', { class: 'sec-intro' }, el('span', { class: 'section-topic' }, SECTION_TOPICS[s.id] || 'Further detail'), el('div', { class: 'sec-head' }, title, btn), summaryNode(s)), wrap);
}

function syncExpandAll() {
  const toggles = [...document.querySelectorAll('[data-toggle]')];
  const reading = [...document.querySelectorAll('details.reading-detail:not(.no-print)')];
  const allOpen = toggles.length > 0 && toggles.every((t) => t.getAttribute('aria-expanded') === 'true') && reading.every(node => node.open);
  const b = $('#expand-all');
  b.textContent = allOpen ? 'Collapse all' : 'Expand all';
  b.dataset.state = allOpen ? 'open' : 'closed';
}

function revealSection(id) {
  const section = $(`#sec-${id}`);
  if (!section) return;
  const toggle = $(`[data-toggle="${id}"]`, section);
  if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
  section.setAttribute('tabindex', '-1');
  section.focus({ preventScroll: true });
  section.scrollIntoView({ block: 'start' });
}

function renderOverview(assessment, report) {
  const v = buildOverview(assessment, report, state.evidence);
  const detailButton = (text, target) => el('button', { type: 'button', class: 'overview-link no-print', 'data-open-section': target, onclick: () => revealSection(target) }, text, ' →');
  const reviewTriggers = () => {
    document.dispatchEvent(new window.Event('credit:review-triggers'));
    const panel = $('#sugg-panel');
    panel.closest('details').open = true;
    panel.setAttribute('tabindex', '-1');
    panel.focus({ preventScroll: true });
    panel.scrollIntoView({ block: 'center' });
  };
  const first = v.first;
  return el('section', { class: 'review-overview', id: 'review-overview', 'aria-labelledby': 'overview-title' },
    el('div', { class: 'overview-intro' },
    el('div', { class: 'overview-heading' }, el('div', {}, el('span', { class: 'eyebrow' }, 'Start here'), el('h3', { id: 'overview-title' }, 'What needs attention?')), kindBadge(KIND.RULE)),
    el('p', { class: 'overview-scope' }, v.scope),
    el('div', { class: 'overview-stats' },
      el('div', { class: 'overview-stat' }, el('span', { class: 'lbl' }, v.ratingSource), el('strong', { class: `overview-rating ${v.rating.level}` }, v.rating.text), el('small', {}, `Initial framework confidence: ${v.initialConfidence}`), detailButton('Rating context', 'rating')),
      el('div', { class: 'overview-stat' }, el('span', { class: 'lbl' }, v.comprehensive ? 'Critical trigger reviews' : 'Selected Critical triggers'), el('strong', { class: 'overview-count', id: 'overview-critical-count' }, v.comprehensive ? `${v.criticalOpen} / ${v.criticalTotal}` : String(v.criticalTotal)), el('small', {}, v.comprehensive ? 'need attention / selected' : 'potential issues; review evidence'), detailButton(v.comprehensive ? 'Update review status' : 'See follow-ups', v.comprehensive ? 'rerate' : 'questions')),
      el('div', { class: 'overview-stat' }, el('span', { class: 'lbl' }, 'Intake evidence checklist'), el('strong', { class: 'overview-count' }, `${v.evidenceCounts.critical} Critical`), el('small', {}, `${v.evidenceCounts.important} Important · ${v.evidenceCounts.helpful} Helpful`), detailButton('View evidence checklist', 'missing'))),
    el('p', { class: 'overview-checklist-note' }, v.evidenceScope)),
    v.suggestions.length ? el('div', { class: 'notice warn', id: 'overview-suggestions' }, el('strong', {}, `${v.suggestions.length} intake suggestion${v.suggestions.length === 1 ? '' : 's'} not selected. `), 'The review may be incomplete. ', el('button', { class: 'overview-link no-print', type: 'button', onclick: reviewTriggers }, 'Confirm triggers →')) : null,
    v.comprehensive ? el('div', { class: 'review-statuses', 'aria-label': 'Review status of shown selected triggers' },
      [['weak', 'weak / contradicting'], ['outstanding', 'not reviewed'], ['reply_only', 'reply only'], ['supports', 'marked supporting']].map(([status, label]) => el('span', { class: `review-status ${status}`, 'data-review-count': status }, `${v.reviewCounts[status]} ${label}`))) : null,
    v.comprehensive && v.reRate ? el('div', { class: 'overview-rerate' },
      el('span', {}, el('strong', {}, 'Evidence re-rate: '), `${v.reRate.from ?? '—'} → ${v.reRate.to ?? '—'} (${v.reRate.movement}) · ${v.reRate.confidence} confidence`),
      el('small', {}, v.reRate.customGuardrail || v.reRate.confidenceCap), detailButton('Re-rate reasons', 'rerate')) : null,
    el('div', { class: 'overview-work' },
      el('div', { class: 'overview-issues' },
        el('h4', {}, 'Potential blockers / priority issues'),
        v.empty || !v.issues.length ? el('p', { class: 'notice info', id: 'overview-empty' }, v.emptyText) : null,
        el('ol', { class: 'priority-list' }, v.issues.map((q) => el('li', { class: `priority-issue ${q.status}`, 'data-priority-issue': q.id },
          el('div', { class: 'issue-heading' }, el('span', { class: `prio ${q.priority}` }, q.priority), el('strong', {}, q.trigger)),
          v.comprehensive ? el('span', { class: `review-status ${q.status}` }, EVIDENCE_STATUS[q.status]) : null,
          el('details', { class: 'reading-detail' }, el('summary', {}, 'Why it matters'), el('p', {}, q.whyItMatters))))),
        v.remaining ? el('p', { class: 'hint' }, `${v.remaining} more selected issue${v.remaining === 1 ? '' : 's'} need attention; the full workflow is below.`) : null,
        detailButton('All prioritised questions', 'questions')),
      el('div', { class: 'overview-action', 'data-overview-action': v.actionType }, el('h4', {}, 'Next conversation'),
        el('p', { class: 'overview-next-step', id: 'overview-next-step' }, v.nextStep),
        v.actionType === 'pause' ? [
          detailButton('Review pause / referral context', 'rating'),
          v.deferralCount ? el('details', { class: 'overview-secondary', id: 'overview-secondary-deferral' },
            el('summary', {}, `Lender deferral (${v.deferralCount}) — secondary context`),
            el('p', { class: 'hint' }, 'The lender deferral remains recorded. It does not change the pause / referral action above.'),
            detailButton(v.deferral ? 'View recorded lender deferral' : 'View Comprehensive recovery-plan access', 'deferral')) : null,
        ] : v.actionType === 'deferral' ? [
          el('div', { class: 'notice warn', id: 'overview-deferral' }, `Lender deferral entered (${v.deferralCount}). `,
            v.deferral ? 'Review the lender’s request before the general trigger questions.' : 'The deferral recovery plan is available in Comprehensive.'),
          v.deferral ? [
            el('ul', { class: 'overview-evidence' }, v.deferral.reasons.map((reason) => el('li', {}, reason.label))),
            el('p', { id: 'overview-deferral-status' }, el('span', { class: 'lbl' }, 'Recovery status from recorded evidence: '), DEFERRAL_STATUS[v.deferral.overall].label),
            el('p', { class: 'hint' }, 'Status follows the evidence review you record; a client reply alone does not count.'),
            el('p', { class: 'notice info', id: 'overview-exact-doc' }, v.deferral.exactDocumentRule),
          ] : null,
          detailButton(v.deferral ? 'Open lender deferral recovery plan' : 'View Comprehensive recovery-plan access', 'deferral'),
        ] : v.actionType === 'rerate' ? detailButton('Review re-rate / banker-review context', 'rerate') : v.actionType === 'question' ? [
          el('p', { class: 'overview-question', id: 'overview-question' }, el('span', { class: 'lbl' }, 'Ask: '), first.question),
          first.clientWording ? el('details', { class: 'client-wording' }, el('summary', {}, 'Client-friendly wording'), el('p', {}, first.clientWording)) : null,
          el('details', { class: 'reading-detail' }, el('summary', {}, `Evidence to request / review (${first.evidence.length})`),
            el('ul', { class: 'overview-evidence' }, first.evidence.map((text) => el('li', {}, text)))),
          first.owner ? el('p', { class: 'hint' }, `Owner: ${first.owner}`) : null,
          detailButton('Full question and context', 'questions'),
        ] : el('button', { type: 'button', class: 'overview-link no-print', onclick: reviewTriggers }, 'Review selected triggers →'))));
}

function renderSection(s, report) {
  if (s.locked) {
    return sectionShell(s,
      el('p', {}, 'Available in Comprehensive — Deal Coaching Report + Follow-Up Plan.'),
      el('button', { class: 'btn btn-ghost no-print', type: 'button', onclick: () => { state.tier = 'comprehensive'; renderAll(); } }, 'Switch to Comprehensive'));
  }
  switch (s.id) {
    case 'snapshot':
      return sectionShell(s,
        el('div', { class: 'kv' }, s.facts.map((f) => el('div', { class: 'kv-row' }, el('div', { class: 'k' }, kindBadge(f.kind), ' ', f.label), el('div', { 'data-kind': f.kind }, f.value)))),
        s.calcs.map((c) => item(c.kind, el('strong', {}, `${c.label}: ${c.value}`), el('span', { class: 'hint' }, ` = ${c.formula}`))),
        s.assumptions.map((a) => item(a.kind, a.text)),
        item(KIND.RULE, el('span', { class: 'lbl' }, 'Trigger check: '), el('span', { id: 'trigger-check' }, triggerCheckText(s.triggerCheck))),
        item(KIND.RULE, el('span', { class: 'lbl' }, 'Scenario tags: '),
          s.tags.length ? s.tags.map((t) => el('span', { class: 'tagpill', title: t.because.join('; '), 'data-tag': t.tag }, t.tag)) : 'none'));
    case 'rating':
      return sectionShell(s,
        item(s.rating.kind, el('strong', {}, 'Readiness rating: '), s.rating.text),
        item(KIND.RULE, el('strong', {}, 'Confidence: '), s.confidence.value),
        s.rating.action ? item(KIND.RULE, 'Product action: ', s.rating.action) : null,
        s.confidence.capped ? el('div', { class: 'notice info' }, `Confidence set to ${s.confidence.value} by framework rule (judgement source said ${s.confidence.base}).`) : null,
        s.confidence.rulesApplied.map((r) => item(r.kind, el('strong', {}, `${r.id} `), r.text)),
        s.confidence.flags.map((r) => item(r.kind, el('strong', {}, `${r.id} `), r.text)),
        s.oneLineView ? item(s.oneLineView.kind, el('strong', {}, 'One-line view: '), s.oneLineView.text) : null);
    case 'risks': {
      const full = s.items[0] && s.items[0].mitigant !== undefined;
      if (!s.items.length) return sectionShell(s, el('p', { class: 'hint' }, 'No risk triggers selected. This is not a finding that there are no risks.'));
      return sectionShell(s, el('table', { class: 'grid' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Type'), el('th', {}, 'Risk'), el('th', {}, 'Why it matters'), full ? [el('th', {}, 'Mitigant'), el('th', {}, 'Status')] : null)),
        el('tbody', {}, s.items.map((r) => el('tr', { 'data-kind': r.kind },
          el('td', { 'data-label': 'Type' }, kindBadge(r.kind)), el('td', { 'data-label': 'Risk' }, el('strong', {}, r.risk)), el('td', { 'data-label': 'Why it matters' }, r.why),
          full ? [el('td', { 'data-label': 'Mitigant' }, r.mitigant), el('td', { 'data-label': 'Status' }, r.status)] : null)))));
    }
    case 'missing':
      if (s.limited) {
        return sectionShell(s,
          s.items.map((m) => item(m.kind, el('span', { class: `prio ${m.priority}` }, m.priority), ' ', m.item)),
          s.moreCritical > 0 ? el('div', { class: 'notice warn', id: 'more-critical-evidence' }, `${s.moreCritical} further Critical evidence item(s) — full list in Comprehensive; not resolved by this snapshot.`) : null,
          el('p', { class: 'hint' }, 'Decision impact and if-weak consequence per item: Comprehensive.'));
      }
      return sectionShell(s,
        el('h4', {}, 'Critical — cannot form a lender-ready view without these'),
        s.groups.critical.map((m) => item(m.kind, el('strong', {}, m.item), el('div', {}, el('span', { class: 'lbl' }, 'Decision impact: '), m.impact), el('div', {}, el('span', { class: 'lbl' }, 'If weak: '), m.ifWeak))),
        el('h4', {}, 'Important — stronger packaging / lender selection'),
        s.groups.important.map((m) => item(m.kind, el('strong', {}, m.item), m.impact ? ` — ${m.impact}` : '')),
        el('h4', {}, 'Helpful — improves narrative'),
        s.groups.helpful.map((m) => item(m.kind, m.item)));
    case 'questions':
      return sectionShell(s,
        item(KIND.RULE, el('span', { class: 'lbl' }, 'Engine view: '), s.engineView),
        s.expansionNote ? el('div', { class: 'notice warn', id: 'simple-expanded', 'data-kind': KIND.RULE }, el('strong', {}, 'Simple expanded: '), s.expansionNote) : null,
        s.items.length ? null : el('p', { class: 'hint' }, 'No triggers selected.'),
        s.items.map((q, i) => el('div', { class: 'q', 'data-question': q.id },
          el('h4', {}, `${i + 1}. ${q.trigger}`, el('span', { class: `prio ${q.priority}` }, q.priority), kindBadge(q.kind)),
          el('p', {}, el('span', { class: 'lbl' }, 'Question: '), q.question),
          el('p', {}, el('span', { class: 'lbl' }, 'Why it matters: '), q.whyItMatters),
          glossaryHelp([q.trigger,q.question,...q.evidence].join(' ')), contextualReferences({triggerId:q.id}),
          el('div', {}, el('span', { class: 'lbl' }, 'Evidence to request:'), el('ul', {}, q.evidence.map((e) => el('li', {}, e)))),
          q.ifStrong ? [
            el('p', { class: 'gated', 'data-gated': 'ifStrong' }, el('span', { class: 'lbl' }, 'If strong: '), q.ifStrong),
            el('p', { class: 'gated', 'data-gated': 'ifWeak' }, el('span', { class: 'lbl' }, 'If weak: '), q.ifWeak),
            el('p', { class: 'gated', 'data-gated': 'owner' }, el('span', { class: 'lbl' }, 'Owner: '), q.owner),
            el('p', { class: 'gated', 'data-gated': 'clientWording' }, el('span', { class: 'lbl' }, 'Client-friendly wording: '), q.clientWording),
          ] : null)),
        s.hiddenCount > 0 ? el('div', { class: 'notice info', id: 'hidden-questions' }, `${s.hiddenCount} further question(s) and all if-strong / if-weak / owner / client wording fields are in Comprehensive.`) : null,
        s.unknownTriggers.length ? el('div', { class: 'notice warn' }, `Unknown triggers: ${s.unknownTriggers.join(', ')}`) : null);
    case 'packaging':
      return sectionShell(s,
        item(s.kind, el('span', { class: 'lbl' }, 'Mainstream: '), s.mainstream),
        s.specialist ? item(s.kind, el('span', { class: 'lbl' }, 'Specialist / private: '), s.specialist) : null,
        s.angle ? item(s.kind, el('span', { class: 'lbl' }, 'Packaging angle (evidence-backed only): '), s.angle) : null);
    case 'nextStep':
      return sectionShell(s, item(s.nextStep.kind, s.nextStep.text));
    case 'dimensions':
      if (s.empty) return sectionShell(s, el('p', { class: 'hint' }, 'No dimension judgement for a custom scenario in this prototype (model layer not connected).'));
      return sectionShell(s, el('table', { class: 'grid' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Type'), el('th', {}, 'Dimension'), el('th', {}, 'Rating'), el('th', {}, 'Note'))),
        el('tbody', {}, s.items.map((d) => el('tr', {}, el('td', { 'data-label': 'Type' }, kindBadge(d.kind)), el('td', { 'data-label': 'Dimension' }, el('strong', {}, d.dimension)), el('td', { 'data-label': 'Rating' }, d.rating), el('td', { 'data-label': 'Note' }, d.note))))));
    case 'deferral':
      return sectionShell(s,
        item(s.kind, el('span', { class: 'lbl' }, 'Engine view: '), s.engineView),
        item(s.kind, el('span', { class: 'lbl' }, 'Re-rate logic: '), s.rerateNote),
        s.plan.reasons.length
          ? [el('div', { class: 'notice warn exact-doc', id: 'exact-doc-rule' }, el('strong', {}, 'Key: '), s.plan.exactDocumentRule),
            el('div', { class: 'notice info' }, `Deferral reason library ${s.plan.version}. Status follows the reviewed-evidence status you set in the Re-rate tracker; a client reply without reviewed evidence does not count.${report.pristine ? ' Sample judgement above was prepared before this deferral.' : ''}`),
            s.plan.reasons.map((r) => el('div', { class: 'q deferral', 'data-deferral': r.id, 'data-status': r.status },
              el('h4', {}, r.label, el('span', { class: `dstatus ${r.status}` }, DEFERRAL_STATUS[r.status].short), kindBadge(r.kind)),
              el('p', {}, el('span', { class: 'lbl' }, 'Lender is testing: '), r.lenderTesting),
              el('div', {}, el('span', { class: 'lbl' }, 'Collect first — exact documents credit asked for (or the same type):'), el('ul', {}, r.collectFirst.map((c) => el('li', {}, c)))),
              el('p', {}, el('span', { class: 'lbl' }, 'Explanation to include: '), r.explanation),
              el('p', {}, el('span', { class: 'lbl' }, 'Linked triggers: '), r.linkedSelected.length ? r.linkedSelected.map((x) => `${x.label} (${EVIDENCE_STATUS[x.status]})`).join('; ') : 'none selected',
                r.linkedNotSelected.length ? el('span', { class: 'hint' }, ` · not selected: ${r.linkedNotSelected.map((x) => x.label).join('; ')}`) : null),
              el('p', { class: 'hint' }, DEFERRAL_STATUS[r.status].label)))]
          : el('p', { class: 'hint' }, 'No lender deferral entered. Tick reasons under Intake → Deferral / concern reason to get a recovery plan.'));
    case 'email':
      return sectionShell(s,
        el('p', { class: 'hint' }, 'Draft only — edit before use. Nothing is sent from this page.'),
        el('pre', { class: 'email', id: 'email-draft' }, s.email.text),
        el('button', { class: 'btn btn-secondary no-print', type: 'button', id: 'copy-email', onclick: () => copyText(s.email.text, 'Email draft copied') }, 'Copy email draft'));
    case 'rerate': {
      const r = s.rerate;
      return sectionShell(s,
        el('div', { class: 'notice info', id: 'rerate-guardrail' }, r.guardrail),
        el('div', { class: 'notice warn', id: 'rerate-evidence-rule' }, el('strong', {}, 'Reviewed evidence only: '), r.evidenceRule),
        r.customGuardrail ? el('div', { class: 'notice warn', id: 'rerate-custom-guardrail', 'data-upward-blocked': String(r.upwardBlocked) }, el('strong', {}, 'Banker review before any upgrade: '), r.customGuardrail) : null,
        s.questions.map((q) => {
          const sel = el('select', { class: 'control', 'data-rerate': q.id, 'aria-label': `Reviewed-evidence status for ${q.trigger}` },
            Object.entries(EVIDENCE_STATUS).map(([v, label]) => el('option', { value: v, selected: (state.evidence[q.id] || 'outstanding') === v }, label)));
          sel.addEventListener('change', () => {
            state.evidence[q.id] = sel.value;
            renderOutput();
            document.querySelector(`[data-rerate="${q.id}"]`)?.focus({ preventScroll: true });
          });
          return el('div', { class: 'rr-row' }, el('span', {}, el('span', { class: `prio ${q.priority}` }, q.priority), ' ', q.trigger,
            el('span', { class: 'print-only' }, ` — ${EVIDENCE_STATUS[state.evidence[q.id] || 'outstanding']}`)), sel);
        }),
        el('div', { class: 'rr-out', id: 'rerate-out' },
          item(r.kind, el('strong', {}, 'Rating movement: '), el('span', { id: 'rerate-movement' }, `${r.from ?? '—'} → ${r.to ?? '—'} (${r.movement})`), ` · ${r.ratingText ?? ''}`),
          item(r.kind, el('strong', {}, 'Confidence: '), el('span', { id: 'rerate-confidence' }, r.confidence)),
          item(r.kind, el('span', { class: 'lbl' }, 'Confidence cap: '), el('span', { id: 'rerate-confidence-cap' }, r.confidenceCap)),
          r.reasons.map((x) => item(r.kind, el('span', { class: 'lbl' }, 'Reason: '), x)),
          item(r.kind, el('span', { class: 'lbl' }, 'Still missing: '), r.stillMissing.length ? r.stillMissing.join('; ') : 'none'),
          item(r.kind, el('span', { class: 'lbl' }, 'Strategy: '), el('span', { id: 'rerate-strategy' }, r.strategy)),
          item(r.kind, el('span', { class: 'lbl' }, 'Next step: '), r.nextStep)));
    }
    case 'cta':
      return sectionShell(s, report.tier === 'simple'
        ? [report.deferralCount ? el('div', { class: 'notice warn', id: 'deferral-upsell' }, `Lender deferral entered (${report.deferralCount} reason${report.deferralCount > 1 ? 's' : ''}). The deferral recovery plan is in Comprehensive.`) : null,
          el('p', { class: 'hint' }, 'Generate the comprehensive follow-up checklist and deferral recovery plan: full workflow, client wording, if-strong / if-weak consequences, re-rate loop.'),
          el('button', { class: 'btn btn-primary no-print', type: 'button', id: 'upgrade-btn', onclick: () => { state.tier = 'comprehensive'; renderAll(); } }, 'Upgrade to Comprehensive'),
          el('p', { class: 'hint', style: 'margin-top:8px' }, 'Banker Review — add-on. Not active in this prototype; no pricing, payment or data handoff.')]
        : [el('p', { class: 'hint' }, 'Optional Banker Review — add-on handoff. Not active in this prototype; nothing is sent.'),
          el('button', { class: 'btn btn-ghost no-print', type: 'button', disabled: true, 'aria-disabled': 'true' }, 'Request Banker Review (inactive)')]);
    default:
      return null;
  }
}

function renderMaterials(model) {
  const box = sectionShell({ id: 'materials', title: 'Case-linked materials', summary: { kind: KIND.RULE,
    text: `${model.items.length} unique documents / information items from ${model.comprehensive ? 'selected triggers and unconfirmed suggestions' : 'Simple selected questions'} (${model.items.filter(item => item.priority === 'Critical').length} Critical; ${model.items.filter(item => item.group === 'received').length} receipt notes; ${model.items.filter(item => item.conditional).length} conditional). Receipt is separate from evidence review.` } });
  const body = box.querySelector('.sec-body');
  body.append(el('p', { class: 'hint' }, model.boundary),
    el('p', { class: 'hint' }, 'Documents or information to arrange with your broker. Some entries are alternatives or broker-prepared work, not separate mandatory documents. No files are uploaded here.'),
    el('p', { class: 'hint' }, 'Receipt checkboxes are session-only notes. They never update the Re-rate tracker or any readiness, rating or confidence result. Intake changes clear them. Trigger review is not document-level verification.'));
  if (materialReceipts.resetNotice) body.append(el('p', { class: 'notice warn', id: 'materials-reset', role: 'status' }, 'Case inputs changed. Previous receipt notes were cleared; confirm availability again.'));
  if (!model.comprehensive) body.append(el('p', { class: 'notice info', id: 'materials-gate' }, `Simple document preview only. ${model.omittedTriggers ? `${model.omittedTriggers} additional trigger(s) omitted. ` : ''}Full receipt workflow, conditional suggestions and applicant wording are available in Comprehensive.`));
  if (model.unknownCount) body.append(el('p', { class: 'notice warn', id: 'materials-unknown' }, `${model.unknownCount} unrecognised trigger(s) have no document mapping. Review the missing case context.`));
  if (!model.items.length) body.append(el('p', { class: 'hint', id: 'materials-empty' }, 'No documents mapped yet. This does not mean no documents are needed. Confirm the case details and triggers first.'),
    el('div', { class: 'notice info', id: 'materials-reported-documents' },
      el('strong', {}, 'Reported documents (unverified): '), model.reportedDocuments || 'None reported; actual availability unknown.',
      el('p', {}, 'This is an intake overview, not a required document list. Ask your broker to confirm which materials apply to this case.')));
  if (model.comprehensive) body.append(el('div', { class: 'actions no-print', 'aria-label': 'Materials audience' },
    ['broker', 'applicant'].map(audience => el('button', { type: 'button', class: 'btn btn-secondary', 'data-materials-view': audience,
      'aria-pressed': String(materialsAudience === audience), onclick: () => { materialsAudience = audience; renderOutput(); $(`[data-materials-view="${audience}"]`).focus(); } }, audience === 'broker' ? 'Broker working list' : 'Applicant wording preview'))));
  // Broker list is always the report/print version. Applicant text is isolated, explicitly copied.
  const broker = el('div', { class: materialsAudience === 'applicant' && model.comprehensive ? 'materials-broker materials-print-only' : 'materials-broker' });
  for (const [key, title] of Object.entries(MATERIAL_GROUPS)) {
    const items = model.items.filter(item => item.group === key);
    if (!items.length) continue;
    broker.append(el('h4', {}, `${title} (${items.length})`), ...items.map((item, index) => {
      const card = el('div', { class: 'item rule material-item', 'data-material-key': item.key },
        el('strong', {}, item.document), ' ', el('span', { class: `prio ${item.priority}` }, item.priority),
        el('p', { class: 'hint material-receipt' }, item.receipt),
        el('p', { class: 'hint material-requirement' }, item.requirement),
        el('p', { class: 'hint material-provider' }, `Possible source (confirm with broker): ${item.provider}`),
        el('p', { class: 'hint material-gap' }, `Still to confirm: ${item.gap}`),
        item.links.map(link => el('p', { class: 'hint' }, el('strong', {}, `${link.trigger}${link.conditional ? ' — suggested, unconfirmed' : ''}: `), link.why,
          link.review ? el('span', { class: 'material-review' }, ` · Trigger review: ${link.review}`) : null)));
      if (model.comprehensive && !item.conditional) {
        const id = `material-receipt-${key}-${index}`;
        const cb = el('input', { id, type: 'checkbox', checked: item.group === 'received', 'data-material-receipt': item.key });
        cb.addEventListener('change', () => {
          if (cb.checked) materialReceipts.received.add(item.key); else materialReceipts.received.delete(item.key);
          materialReceipts.resetNotice = false;
          renderOutput();
          [...document.querySelectorAll('[data-material-receipt]')].find(node => node.dataset.materialReceipt === item.key)?.focus();
        });
        card.append(el('label', { class: 'trig no-print', for: id }, cb, 'Record receipt only (not reviewed)'));
      }
      return card;
    }));
  }
  body.append(broker);
  if (model.comprehensive && materialsAudience === 'applicant') {
    const text = applicantMaterialsText(model);
    const preview = el('textarea', { id: 'materials-applicant-text', class: 'control', rows: '14', readonly: true, 'aria-label': 'Applicant document request draft' });
    preview.value = text;
    body.append(el('div', { class: 'no-print', id: 'materials-applicant' },
      el('p', { class: 'notice info' }, 'Applicant wording only for this checklist. The rest of this page and Copy report / Print remain the broker report. Review before sharing; nothing is sent automatically.'),
      preview, el('button', { class: 'btn btn-secondary', type: 'button', id: 'materials-copy-applicant', onclick: () => copyText(text, 'Applicant draft copied') }, 'Copy applicant list')));
  }
  return box;
}

function renderOutput() {
  $('#copy-buffer').value = ''; // Discard stale draft text when case or tier changes.
  syncMaterialReceipts(materialReceipts, {
    intake: state.intake, triggers: [...state.triggers].sort(), rating: state.rating,
    moneyDrafts: [...moneyDrafts].map(([key, value]) => [key, value.text]).sort(),
    presets: [...presetSelections].map(([key, values]) => [key, [...values].sort()]).sort(),
  });
  syncRiskInputs(manualRiskView, {
    intake: state.intake, triggers: [...state.triggers].sort(),
    evidence: Object.entries(state.evidence).sort(), rating: state.rating,
    moneyDrafts: [...moneyDrafts].map(([key, value]) => [key, value.text]).sort(),
    presets: [...presetSelections].map(([key, values]) => [key, [...values].sort()]).sort(),
  });
  renderSuggestions();
  const assessment = buildAssessment(state);
  ruleRing = buildRuleRing(assessment, state.tier);
  liveContext = { inputKey: JSON.stringify({intake:state.intake,triggers:state.triggers,rating:state.rating,moneyDrafts:[...moneyDrafts],presets:[...presetSelections]}), tier:state.tier, rating:state.rating, ring:ruleRing, manual:manualRiskView, evidence:state.evidence };
  const report = buildReport(assessment, state.tier);
  const materials = buildMaterials(assessment, state.tier, state.evidence, materialReceipts.received, state.intake.documents);
  const conduct = conductReport(presetSelections.get('conduct'), manualDrafts.get('conduct') || '', state.triggers, assessment.triggerCheck.suggested.map(item => item.id), Boolean(state.intake.deferralReason?.trim() || state.intake.deferralCodes?.length));
  const conductInputNote = $('#conduct-input-note');
  if (conductInputNote) { conductInputNote.hidden = !conduct; conductInputNote.textContent = conduct?.text || ''; conductInputNote.className = `notice ${conduct?.conflict ? 'warn' : 'info'}`; }
  basePlainText = `${reportToPlainText(report)}\n\n${brokerMaterialsText(materials)}${conduct ? `\n\nConduct self-report: ${conduct.text}` : ''}`;

  $('#out-title').textContent = `2 · ${report.tierName}`;
  $('#out-sub').textContent = `${report.dealName} (${report.dealId}) · ${report.pristine ? `Judgement: ${report.judgementSource}` : 'Custom scenario — rule output only'}`;

  const out = $('#report');
  out.replaceChildren();
  if (conduct) out.append(el('div', { class: `notice ${conduct.conflict ? 'warn' : 'info'}`, id: 'conduct-self-report', role: 'status' }, conduct.text));
  const invalidAmounts = INTAKE_FIELDS.filter((f) => f.money && moneyDrafts.has(f.key) && !moneyDrafts.get(f.key).valid);
  if (invalidAmounts.length) out.append(el('div', { class: 'notice warn', id: 'amount-warning', role: 'status' }, `Check amount inputs: ${invalidAmounts.map((f) => f.label).join(', ')}. Invalid entries are treated as not provided; calculations using them are unavailable.`));
  if (!report.pristine) {
    out.append(el('div', { class: 'notice warn', id: 'custom-notice' }, state.caseId
      ? `Edited from ${state.caseId}: model judgement withdrawn (it only applies to the untouched sample). Risks and missing evidence below are rule-derived. Reload ${state.caseId} to restore.`
      : 'Custom scenario: no model judgement in this prototype. Risks and missing evidence below are rule-derived; rating is your own current view.'));
  }
  out.append(renderOverview(assessment, report));
  const comparison = sectionShell({ id: 'manual', title: 'Inner / outer review comparison', summary: { kind: KIND.ASSUMPTION, text: manualSummary() } },
    renderManualRiskView(manualRiskView, Object.fromEntries(RULES.map(r => [r.id, r.triggerLabel])), refreshManualRiskOutput, ruleRing));
  comparison.insertBefore(el('div', { class: 'dual-ring-legend', id: 'dual-ring-legend' },
    el('p', { class: 'hint' }, ruleRing.legend), el('p', { class: 'hint' }, ruleRing.caveat),
    el('p', { class: 'hint' }, `Scope: ${state.tier}; ${ruleRing.omitted} selected trigger(s) omitted by this tier.`),
    ruleRing.pause ? el('p', { class: 'notice warn', id: 'ring-pause' }, `OVERALL PAUSE: ${ruleRing.pauseText} The rings do not override this.`) : null,
    ruleRing.unknownCount ? el('p', { class: 'notice warn', id: 'ring-unknown' }, `${ruleRing.unknownCount} unrecognised trigger(s) have no ring mapping; review required.`) : null), comparison.querySelector('.sec-body'));
  comparison.querySelector('.sec-body').append(el('div',{class:'domain-reference-links no-print'},el('p',{class:'hint'},'General domain reading, not a finding that an issue applies to this case. Confirm source scope before relying on it.'),RISK_AREAS.map(area=>el('div',{},el('h4',{},area.label),glossaryHelp(area.manualScope),contextualReferences({domainId:area.id})))));
  out.append(comparison);
  out.append(renderMaterials(materials));
  for (const s of report.sections) {
    const node = renderSection(s, report);
    if (node) out.append(node);
  }

  // Safety notices stay visible even while explanatory detail is folded.
  for (const section of out.querySelectorAll('section.out')) {
    const body = section.querySelector(':scope > .sec-body');
    if (!body) continue;
    const alerts = [...body.querySelectorAll(':scope > .notice.warn, :scope > #rerate-guardrail, :scope > #materials-gate')];
    if (alerts.length) section.insertBefore(el('div', { class: 'section-alerts' }, alerts), body);
  }
  syncExpandAll();
  refreshManualRiskOutput();
  document.body.dataset.tier = state.tier;
  document.body.dataset.case = state.caseId || 'custom';
  document.body.dataset.pristine = String(report.pristine);

  $('#print-head').replaceChildren(
    el('div', { style: 'display:flex;align-items:center;gap:10px;font-weight:800' }, printLogo(), 'Oney & Co — Oney Credit Framework'),
    el('div', { style: 'font-size:10pt;color:#444', id: 'print-tier', 'data-tier': state.tier }, `Output tier: ${state.tier === 'simple' ? 'Simple' : 'Comprehensive'} — ${report.tierName} · ${report.dealName} (${report.dealId}) · Oney Credit Framework beta`),
    el('p', { class: 'hint', id: 'print-scope' }, state.tier === 'simple'
      ? 'Current in-page selection: Simple. Comprehensive-only sections are omitted from this printout; any gated evidence detail is labelled in the report.'
      : 'Current in-page selection: Comprehensive. The report below reflects this selected tier.'),
    el('div', { class: 'boundary', style: 'margin:8px 0' }, BOUNDARY_TEXT));
}

function manualSummary() {
  return RISK_AREAS.map(area => `${area.label} — inner: ${ruleRing?.areas.find(a => a.id === area.id)?.indicator || 'Not assessed'}; outer: ${riskAreaState(manualRiskView, area.id).label}`).join(' · ');
}

function refreshManualRiskOutput() {
  if (liveContext) renderLiveDesktop(updateLiveTracker(liveTracker, liveContext), id => {
    revealSection('manual');
    document.querySelector(`[data-edit-risk="${id}"]`)?.click();
    document.querySelector(`#risk-editor-${id}`)?.scrollIntoView({block:'nearest'});
  });
  const summary = $('#sec-manual [data-summary="manual"] span:last-child');
  if (summary) summary.textContent = manualSummary();
  lastPlainText = `${basePlainText}\n\n${ruleRingText(ruleRing)}\n\n${riskViewText(manualRiskView)}`;
  const renderedText = `${$('#report').textContent}\n${lastPlainText}`;
  const lint = lintCompliance(renderedText);
  const badge = $('#lint-badge');
  badge.className = `lint ${lint.ok ? 'ok' : 'bad'}`;
  badge.textContent = lint.ok ? 'Wording check: pass' : `Wording check: ${lint.hits.length} flag(s)`;
  badge.title = lint.ok ? 'No approval/decline, bankable, viable or financeable claims detected.' : lint.hits.map((h) => `${h.match}: ${h.hint}`).join('\n');
  document.body.dataset.lint = lint.ok ? 'pass' : 'fail';
}

function printLogo() {
  const svg = $('#brand svg').cloneNode(true);
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '28');
  svg.removeAttribute('aria-label');
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

function renderAll() {
  renderCasePicker();
  renderTierToggles();
  renderIntakeForm();
  renderLegend();
  renderOutput();
}

/* ------------------------------ copy / print ------------------------------ */

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 1800);
}

async function copyText(text, okMsg) {
  document.body.dataset.lastCopy = text.length.toString();
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      toast(okMsg);
      document.body.dataset.copyStatus = 'clipboard';
      return true;
    }
  } catch (_) { /* fall through to legacy path */ }
  const buf = $('#copy-buffer');
  buf.value = text;
  buf.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
  document.body.dataset.copyStatus = ok ? 'legacy' : 'failed';
  toast(ok ? okMsg : 'Copy blocked by the browser — select the text manually.');
  return ok;
}

document.addEventListener('toggle', event => {
  if (event.target.matches?.('details.reading-detail:not(.no-print)')) syncExpandAll();
}, true);
$('#expand-all').addEventListener('click', () => {
  const open = $('#expand-all').dataset.state !== 'open';
  for (const t of document.querySelectorAll('[data-toggle]')) {
    if ((t.getAttribute('aria-expanded') === 'true') !== open) t.click();
  }
  for (const node of document.querySelectorAll('details.reading-detail:not(.no-print)')) node.open = open;
  syncExpandAll();
});
$('#copy-btn').addEventListener('click', () => copyText(lastPlainText, `${state.tier === 'simple' ? 'Simple' : 'Comprehensive'} report copied`));
$('#print-btn').addEventListener('click', () => window.print());

/* ------------------------------ broker feedback (spec §14) ------------------------------ */

const feedback = { answers: {}, comment: '' };

function renderFeedbackResult() {
  const sc = scoreFeedback(feedback.answers);
  const out = $('#fb-result');
  out.textContent = sc.verdict;
  out.className = `notice ${sc.meetsBar ? 'info' : 'warn'}`;
  out.dataset.yes = String(sc.yes);
  out.dataset.meetsBar = String(sc.meetsBar);
}

function renderFeedback() {
  const box = $('#feedback');
  box.replaceChildren(
    el('div', { class: 'sec-head' }, el('h3', {}, 'Broker feedback — 6 questions'), el('span', { class: 'prio Helpful' }, 'spec §14')),
    el('p', { class: 'hint' }, 'After trying a case, answer these. The MVP is worth continuing if at least 3 are “Yes”. Answers stay on this device; use Copy feedback to send them.'),
    ...FEEDBACK_QUESTIONS.map((q, i) => el('fieldset', { class: 'fb-q', 'data-fb': q.id },
      el('legend', {}, `${i + 1}. ${q.text}`),
      el('div', { class: 'fb-opts' }, Object.entries(FEEDBACK_ANSWERS).map(([v, label]) => {
        const id = `fb-${q.id}-${v}`;
        const r = el('input', { type: 'radio', name: `fb-${q.id}`, id, value: v, checked: feedback.answers[q.id] === v });
        r.addEventListener('change', () => { feedback.answers[q.id] = v; renderFeedbackResult(); });
        return el('label', { class: `fb-opt ${v}`, for: id }, r, el('span', {}, label));
      })))),
    el('div', { class: 'field' }, el('label', { for: 'fb-comment' }, 'Anything else? (optional — no client details)'),
      (() => { const t = el('textarea', { class: 'control', id: 'fb-comment', rows: '3', maxlength: '800' }); t.value = feedback.comment; t.addEventListener('input', () => { feedback.comment = t.value; }); return t; })()),
    el('div', { id: 'fb-result', role: 'status' }),
    el('div', { class: 'actions' },
      el('button', { class: 'btn btn-secondary', type: 'button', id: 'fb-copy', onclick: () => copyText(feedbackText({ ...feedback, context: { caseId: state.caseId, tier: state.tier } }), 'Feedback copied') }, 'Copy feedback'),
      el('button', { class: 'btn btn-ghost', type: 'button', id: 'fb-reset', onclick: () => { feedback.answers = {}; feedback.comment = ''; renderFeedback(); } }, 'Clear answers')));
  renderFeedbackResult();
}

renderAll();
renderFeedback();
mountReferenceLibrary(document.querySelector('#reference-content'));

mountGettingStarted();

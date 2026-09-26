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
} from './engine.js';

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

/* ------------------------------ intake ------------------------------ */

function renderCasePicker() {
  const box = $('#case-picker');
  box.replaceChildren();
  for (const id of CASE_ORDER) {
    const c = CASES[id];
    box.append(el('button', {
      class: 'case-btn', type: 'button', 'aria-pressed': state.caseId === id ? 'true' : 'false', 'data-case': id,
      onclick: () => { state = initialState(id, state.tier); renderAll(); },
    }, el('span', { class: `dot ${c.tone}` }), el('span', {}, c.shortLabel)));
  }
  box.append(el('button', {
    class: 'case-btn', type: 'button', 'aria-pressed': state.caseId === null ? 'true' : 'false', 'data-case': 'custom',
    onclick: () => { state = blankState(state.tier); renderAll(); },
  }, el('span', { class: 'dot custom' }), el('span', {}, 'Blank custom scenario (rules only)')));
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

function renderIntakeForm() {
  const form = $('#intake-form');
  form.replaceChildren();
  const sections = [...new Set(INTAKE_FIELDS.map((f) => f.section))];
  sections.forEach((section, i) => {
    const fields = INTAKE_FIELDS.filter((f) => f.section === section).map((f) => {
      const id = `f-${f.key}`;
      let control;
      if (f.options) {
        control = el('select', { class: 'control', id, name: f.key },
          Object.entries(f.options).map(([v, label]) => el('option', { value: v, selected: String(state.intake[f.key]) === v }, label)));
      } else if (f.money) {
        control = el('input', { class: 'control', id, name: f.key, type: 'number', min: '0', step: '1000', inputmode: 'numeric', value: state.intake[f.key] ?? '' });
      } else {
        control = el('textarea', { class: 'control', id, name: f.key, rows: '2', maxlength: '600' });
        control.value = state.intake[f.key] ?? '';
      }
      control.addEventListener('input', () => {
        state.intake[f.key] = f.money ? (control.value === '' ? '' : Number(control.value)) : control.value;
        renderOutput();
      });
      return el('div', { class: 'field' }, el('label', { for: id }, f.label), control);
    });
    const narrow = window.matchMedia('(max-width: 1100px)').matches;
    if (section === 'Deferral / concern reason') fields.unshift(deferralPicker());
    const hasDeferral = section === 'Deferral / concern reason' && (state.intake.deferralCodes || []).length > 0;
    form.append(el('details', { class: 'sec', open: (!narrow && i < 2) || hasDeferral ? true : null }, el('summary', {}, section), el('div', { class: 'fields' }, fields)));
  });

  const ratingSel = el('select', { class: 'control', id: 'f-rating', name: 'rating' },
    [...new Set([state.rating, ...RATING_OPTIONS])].map((r) => el('option', { value: r, selected: r === state.rating }, r)));
  ratingSel.addEventListener('change', () => { state.rating = ratingSel.value; renderOutput(); });

  const trigList = RULES.map((r) => {
    const cb = el('input', { type: 'checkbox', id: `t-${r.id}`, value: r.id, checked: state.triggers.includes(r.id) });
    cb.addEventListener('change', () => {
      state.triggers = cb.checked ? [...state.triggers, r.id] : state.triggers.filter((t) => t !== r.id);
      delete state.evidence[r.id];
      renderOutput();
    });
    return el('label', { class: 'trig', for: `t-${r.id}`, 'data-trig': r.id }, cb,
      el('span', {}, r.triggerLabel, ' ', el('span', { class: `prio ${r.priority}` }, r.priority), el('span', { class: 'sugg-chip', 'data-sugg-chip': r.id, hidden: true }, 'Suggested'),
        el('small', {}, `${r.id} · ${r.category}`), el('small', { class: 'sugg-why', 'data-sugg-why': r.id, hidden: true })));
  });

  form.append(el('details', { class: 'sec', open: true },
    el('summary', {}, 'Triggers + current rating'),
    el('div', { class: 'fields' },
      el('p', { class: 'hint', style: 'margin:0' }, 'Oney suggests triggers from your intake by rule. Nothing is ticked for you — confirm or change. Rules come verbatim from rules-v0.1.json.'),
      el('div', { class: 'sugg-panel', id: 'sugg-panel', 'aria-live': 'polite' }),
      el('div', {}, trigList),
      el('div', { class: 'field' }, el('label', { for: 'f-rating' }, 'Current readiness rating'), ratingSel))));
}

/* ------------------------------ output ------------------------------ */

/* Trigger suggestions: refreshed on every intake change without rebuilding the form. */
function renderSuggestions() {
  const suggested = suggestTriggers(state.intake);
  const cmp = compareTriggers(state.triggers, suggested);
  const byId = Object.fromEntries(suggested.map((x) => [x.id, x]));
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
    addBtn);
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
  return el('section', attrs, el('div', { class: 'sec-head' }, title, btn), summaryNode(s), wrap);
}

function syncExpandAll() {
  const toggles = [...document.querySelectorAll('[data-toggle]')];
  const allOpen = toggles.length > 0 && toggles.every((t) => t.getAttribute('aria-expanded') === 'true');
  const b = $('#expand-all');
  b.textContent = allOpen ? 'Collapse all' : 'Expand all';
  b.dataset.state = allOpen ? 'open' : 'closed';
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
        el('div', { class: 'kv' }, s.facts.flatMap((f) => [el('div', { class: 'k' }, kindBadge(f.kind), ' ', f.label), el('div', { 'data-kind': f.kind }, f.value)])),
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
      if (!s.items.length) return sectionShell(s, el('p', { class: 'hint' }, 'No risks — select triggers or load a sample.'));
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
        s.items.length ? null : el('p', { class: 'hint' }, 'No triggers selected.'),
        s.items.map((q, i) => el('div', { class: 'q', 'data-question': q.id },
          el('h4', {}, `${i + 1}. ${q.trigger}`, el('span', { class: `prio ${q.priority}` }, q.priority), kindBadge(q.kind)),
          el('p', {}, el('span', { class: 'lbl' }, 'Question: '), q.question),
          el('p', {}, el('span', { class: 'lbl' }, 'Why it matters: '), q.whyItMatters),
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
            el('div', { class: 'notice info' }, `Deferral reason library ${s.plan.version}. Status follows the evidence you set in the Re-rate tracker; a client reply without documents does not count.${report.pristine ? ' Sample judgement above was prepared before this deferral.' : ''}`),
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
        el('div', { class: 'notice info' }, r.guardrail),
        s.questions.map((q) => {
          const sel = el('select', { class: 'control', 'data-rerate': q.id, 'aria-label': `Evidence status for ${q.trigger}` },
            Object.entries(EVIDENCE_STATUS).map(([v, label]) => el('option', { value: v, selected: (state.evidence[q.id] || 'outstanding') === v }, label)));
          sel.addEventListener('change', () => { state.evidence[q.id] = sel.value; renderOutput(); });
          return el('div', { class: 'rr-row' }, el('span', {}, el('span', { class: `prio ${q.priority}` }, q.priority), ' ', q.trigger,
            el('span', { class: 'print-only' }, ` — ${EVIDENCE_STATUS[state.evidence[q.id] || 'outstanding']}`)), sel);
        }),
        el('div', { class: 'rr-out', id: 'rerate-out' },
          item(r.kind, el('strong', {}, 'Rating movement: '), el('span', { id: 'rerate-movement' }, `${r.from ?? '—'} → ${r.to ?? '—'} (${r.movement})`), ` · ${r.ratingText ?? ''}`),
          item(r.kind, el('strong', {}, 'Confidence: '), el('span', { id: 'rerate-confidence' }, r.confidence)),
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
          el('p', { class: 'hint', style: 'margin-top:8px' }, 'Banker Review by Dong — add-on. Not active in this prototype; no pricing, payment or data handoff.')]
        : [el('p', { class: 'hint' }, 'Optional Banker Review by Dong — add-on handoff. Not active in this prototype; nothing is sent.'),
          el('button', { class: 'btn btn-ghost no-print', type: 'button', disabled: true, 'aria-disabled': 'true' }, 'Request Dong review (inactive)')]);
    default:
      return null;
  }
}

function renderOutput() {
  renderSuggestions();
  const assessment = buildAssessment(state);
  const report = buildReport(assessment, state.tier);
  lastPlainText = reportToPlainText(report);

  $('#out-title').textContent = `2 · ${report.tierName}`;
  $('#out-sub').textContent = `${report.dealName} (${report.dealId}) · ${report.pristine ? `Judgement: ${report.judgementSource}` : 'Custom scenario — rule output only'}`;

  const out = $('#report');
  out.replaceChildren();
  if (!report.pristine) {
    out.append(el('div', { class: 'notice warn', id: 'custom-notice' }, state.caseId
      ? `Edited from ${state.caseId}: model judgement withdrawn (it only applies to the untouched sample). Risks and missing evidence below are rule-derived. Reload ${state.caseId} to restore.`
      : 'Custom scenario: no model judgement in this prototype. Risks and missing evidence below are rule-derived; rating is your own current view.'));
  }
  for (const s of report.sections) {
    const node = renderSection(s, report);
    if (node) out.append(node);
  }

  syncExpandAll();
  const renderedText = `${$('#report').textContent}\n${lastPlainText}`;
  const lint = lintCompliance(renderedText);
  const badge = $('#lint-badge');
  badge.className = `lint ${lint.ok ? 'ok' : 'bad'}`;
  badge.textContent = lint.ok ? 'Wording check: pass' : `Wording check: ${lint.hits.length} flag(s)`;
  badge.title = lint.ok ? 'No approval/decline, bankable, viable or financeable claims detected.' : lint.hits.map((h) => `${h.match}: ${h.hint}`).join('\n');
  document.body.dataset.lint = lint.ok ? 'pass' : 'fail';
  document.body.dataset.tier = state.tier;
  document.body.dataset.case = state.caseId || 'custom';
  document.body.dataset.pristine = String(report.pristine);

  $('#print-head').replaceChildren(
    el('div', { style: 'display:flex;align-items:center;gap:10px;font-weight:800' }, printLogo(), 'Oney & Co — Oney Credit Framework'),
    el('div', { style: 'font-size:10pt;color:#444' }, `${report.tierName} · ${report.dealName} (${report.dealId}) · Internal prototype · Synthetic data`),
    el('div', { class: 'boundary', style: 'margin:8px 0' }, BOUNDARY_TEXT));
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

$('#expand-all').addEventListener('click', () => {
  const open = $('#expand-all').dataset.state !== 'open';
  for (const t of document.querySelectorAll('[data-toggle]')) {
    if ((t.getAttribute('aria-expanded') === 'true') !== open) t.click();
  }
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

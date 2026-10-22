import { RISK_AREAS, RISK_VIEWS, RISK_SOURCE, RISK_BOUNDARY, riskAreaState, riskAreaNotes, confirmRiskArea, clearRiskArea } from './manual-risk-view.js?v=cf-20261022-bs1&taxonomy=2';

// DOM-only UI; text is always inserted as textContent, never HTML.
export function renderManualRiskView(view, ruleLabels, onChange, ruleRing = null) {
  const node = (tag, attrs = {}, ...children) => {
    const n = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) if (value !== null) n.setAttribute(key, value);
    for (const child of children.flat(Infinity)) if (child !== null) n.append(child instanceof Node ? child : document.createTextNode(child));
    return n;
  };
  const svgNode = (tag, attrs, text) => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, value);
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const root = node('section', { class: 'manual-risk-view', id: 'manual-risk-view', 'aria-labelledby': 'manual-risk-title' });
  const openArea = (id) => {
    view.openArea = id; draw();
    root.querySelector(`#risk-rating-${id}`).focus();
  };
  const redraw = (focusId) => {
    const active = document.activeElement;
    const selection = active && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;
    draw();
    const control = focusId ? root.querySelector(`#${focusId}`) : null;
    control?.focus({ preventScroll: true });
    if (control && selection && typeof control.setSelectionRange === 'function') control.setSelectionRange(...selection);
    onChange();
  };
  const point = (radius, degrees) => [160 + radius * Math.cos(degrees * Math.PI / 180), 160 + radius * Math.sin(degrees * Math.PI / 180)].map(n => n.toFixed(3)).join(' ');
  const innerArea = id => ruleRing?.areas.find(area => area.id === id);
  const ruleReasons = area => {
    const inner = innerArea(area.id);
    if (!inner) return null;
    return node('div', { class: 'rule-ring-reasons' },
      node('p', { class: 'hint' }, `Inner: ${inner.indicator}`),
      node('p', { class: 'hint area-scope' }, `Manual review considerations: ${area.manualScope}`),
      node('p', { class: 'hint area-scope' }, `Mapped coverage: ${area.scope}`),
      inner.triggers.map(q => node('p', { class: 'hint' }, `${q.priority}: ${q.label}. ${q.why} Source: ${q.source}${q.reasons.length ? '; ' + q.reasons.join('; ') : ''}.`)),
      inner.unconfirmed.map(q => node('p', { class: 'hint' }, `Unconfirmed suggestion only: ${q.label}; ${q.reasons.join('; ')}.`)));
  };
  const readoutNode = (area, i) => {
    const state = riskAreaState(view, area.id);
    const edit = node('button', { type: 'button', class: 'overview-link no-print', 'data-edit-risk': area.id }, 'Edit / review this area');
    edit.addEventListener('click', () => openArea(area.id));
    return node('li', { 'data-risk-readout': area.id, 'data-status': state.colour },
      node('strong', {}, `${i + 1}. ${area.label}`), node('p', { class: 'manual-risk-status' }, `Outer: ${state.label}`), ruleReasons(area),
      riskAreaNotes(view, area.id).map(text => node('p', { class: 'hint' }, text)), edit);
  };
  // Draft typing only updates the readout, never the active editor. This also
  // preserves IME composition, selection, and the browser's own edit history.
  const updateDisplay = () => {
    for (const [i, area] of RISK_AREAS.entries()) {
      const state = riskAreaState(view, area.id);
      const link = root.querySelector(`[data-risk-segment="${area.id}"]`);
      link.dataset.colour = state.colour;
      link.setAttribute('aria-label', `Outer ${i + 1}. ${area.label}: ${state.label}. Open manual view.`);
      link.querySelector('path').setAttribute('class', `risk-fill ${state.colour}`);
      root.querySelector(`[data-risk-readout="${area.id}"]`).replaceWith(readoutNode(area, i));
    }
    onChange();
  };
  const draw = () => {
    const svg = svgNode('svg', { viewBox: '0 0 320 320', class: 'manual-risk-donut', role: 'group', 'aria-labelledby': 'risk-svg-title risk-svg-desc' });
    svg.append(svgNode('title', { id: 'risk-svg-title' }, 'Inner review triggers and outer manual risk view: four equal areas each'),
      svgNode('desc', { id: 'risk-svg-desc' }, 'Inner purple segments show selected review triggers, not risk ratings; priorities are listed in text. Outer segments show your manual views. Each numbered quadrant opens reasons and the manual editor. Equal sizes do not represent proportions. Grey means not assessed, unconfirmed changes, or review required. Text status and notes follow.'));
    for (const [i, area] of RISK_AREAS.entries()) {
      const state = riskAreaState(view, area.id); const start = -90 + i * 90; const end = start + 90;
      const link = svgNode('a', { href: `#risk-editor-${area.id}`, tabindex: '0', 'aria-label': `Outer ${i + 1}. ${area.label}: ${state.label}. Open manual view.`, 'data-risk-segment': area.id, 'data-colour': state.colour });
      const path = `M ${point(140, start)} A 140 140 0 0 1 ${point(140, end)} L ${point(96, end)} A 96 96 0 0 0 ${point(96, start)} Z`;
      link.append(svgNode('path', { d: path, class: `risk-fill ${state.colour}` }), svgNode('text', { x: point(118, start + 45).split(' ')[0], y: point(118, start + 45).split(' ')[1], 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'risk-quadrant-number', 'aria-hidden': 'true' }, String(i + 1)));
      link.addEventListener('click', (event) => { event.preventDefault(); openArea(area.id); });
      link.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openArea(area.id); } });
      svg.append(link);
      const inner = innerArea(area.id);
      if (inner) {
        const innerLink = svgNode('a', { href: `#risk-editor-${area.id}`, tabindex: '0', 'aria-label': `Inner ${i + 1}. ${area.label}: ${inner.indicator}. Open trigger reasons and manual editor.`, 'data-rule-segment': area.id, 'data-colour': inner.colour });
        const innerPath = `M ${point(85, start)} A 85 85 0 0 1 ${point(85, end)} L ${point(48, end)} A 48 48 0 0 0 ${point(48, start)} Z`;
        innerLink.append(svgNode('path', { d: innerPath, class: `rule-ring-fill ${inner.colour}` }), svgNode('text', { x: point(66, start + 45).split(' ')[0], y: point(66, start + 45).split(' ')[1], 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'rule-ring-number', 'aria-hidden': 'true' }, String(i + 1)));
        innerLink.addEventListener('click', event => { event.preventDefault(); openArea(area.id); });
        innerLink.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openArea(area.id); } });
        svg.append(innerLink);
      }
    }
    svg.append(svgNode('text', { x: '160', y: '153', 'text-anchor': 'middle', class: 'risk-centre' }, 'Compare'), svgNode('text', { x: '160', y: '174', 'text-anchor': 'middle', class: 'risk-centre-small' }, 'sources'));
    const readouts = node('ol', { class: 'risk-readouts', 'aria-label': 'Manual risk views and their bases' });
    const editors = node('div', { class: 'risk-editors no-print' });
    for (const [i, area] of RISK_AREAS.entries()) {
      const state = riskAreaState(view, area.id);
      readouts.append(readoutNode(area, i));
      const select = node('select', { class: 'control', id: `risk-rating-${area.id}`, 'aria-describedby': `risk-help-${area.id} risk-error-${area.id}` },
        Object.entries(RISK_VIEWS).map(([value, label]) => node('option', { value }, label)));
      select.value = state.draft.rating;
      const basis = node('textarea', { class: 'control', id: `risk-basis-${area.id}`, rows: '2', maxlength: '600', 'aria-describedby': `risk-help-${area.id} risk-error-${area.id}` }); basis.value = state.draft.basis;
      const next = node('textarea', { class: 'control', id: `risk-next-${area.id}`, rows: '2', maxlength: '600', 'aria-describedby': `risk-help-${area.id} risk-error-${area.id}` }); next.value = state.draft.nextStep;
      const fields = [[select, 'rating'], [basis, 'basis'], [next, 'nextStep']];
      for (const [control, key] of fields) control.addEventListener(key === 'rating' ? 'change' : 'input', () => {
        view.openArea = area.id;
        view.entries[area.id].draft[key] = control.value; view.entries[area.id].error = '';
        root.querySelector(`#risk-error-${area.id}`).textContent = '';
        updateDisplay();
      });
      const save = node('button', { type: 'button', class: 'btn btn-secondary', 'data-confirm-risk': area.id }, 'Confirm my view');
      save.addEventListener('click', () => {
        view.openArea = area.id;
        const valid = confirmRiskArea(view, area.id);
        redraw(valid ? `risk-summary-${area.id}` : `risk-error-${area.id}`);
      });
      const clear = node('button', { type: 'button', class: 'btn btn-ghost', 'data-clear-risk': area.id }, 'Clear this area');
      clear.addEventListener('click', () => { view.openArea = area.id; clearRiskArea(view, area.id); redraw(`risk-rating-${area.id}`); });
      const details = node('details', { id: `risk-editor-${area.id}`, class: 'manual-risk-editor', ...(view.openArea === area.id ? { open: '' } : {}) },
        node('summary', { id: `risk-summary-${area.id}` }, `${i + 1}. ${area.label} — manual view`),
        ruleReasons(area),
        node('p', { class: 'hint', id: `risk-help-${area.id}` }, 'Confirm only your own view. A brief basis is required for Green, Amber or Red. Red also needs a proposed mitigation or next step; its adequacy is not verified. Use de-identified notes only.'),
        node('p', { class: 'hint' }, `Navigation topics: ${area.triggers.map(id => ruleLabels[id]).join('; ')}. Other issues may sit outside these topics.`),
        node('label', { for: select.id }, 'Your view'), select,
        node('label', { for: basis.id }, 'Brief basis for your view'), basis,
        node('label', { for: next.id }, 'Proposed mitigation / next step (required for Red)'), next,
        node('p', { class: 'field-error', id: `risk-error-${area.id}`, role: 'status', tabindex: '-1' }, state.error),
        node('div', { class: 'manual-risk-buttons' }, save, clear));
      details.addEventListener('toggle', () => {
        if (!details.isConnected) return;
        if (details.open) view.openArea = area.id;
        else if (view.openArea === area.id) view.openArea = null;
      });
      editors.append(details);
    }
    const intro = node('div', { class: 'manual-risk-intro' }, node('h3', { id: 'manual-risk-title' }, 'Inner / outer four-area comparison'), node('p', { class: 'manual-risk-source' }, `Outer: ${RISK_SOURCE}. Inner: selected review triggers, with priority counts.`),
      node('p', { class: 'hint' }, 'Outer ring only: ' + RISK_BOUNDARY),
      node('p', { class: 'hint' }, 'Grey = not assessed, draft changes, or review required. Changes to deal inputs, triggers or evidence require reconfirmation. Nothing is saved outside this page.'));
    if (ruleRing) intro.append(node('p', { class: 'print-only ring-print-legend hint' }, `Inner: purple selected review triggers, priority counts in text (not risk severity); grey no selected trigger shown (not a safe finding). Outer: manual judgement; grey includes unconfirmed or stale. Scope: ${ruleRing.tier}; ${ruleRing.omitted} selected trigger(s) omitted. Equal areas are not proportions or a score.`));
    // One bounded print unit keeps provenance and the legend with the SVG.
    // Notes stay outside it so long bases can flow across pages.
    root.replaceChildren(node('div', { class: 'manual-risk-layout' }, node('div', { class: 'manual-risk-visual' }, intro, svg), readouts), editors);
  };
  draw();
  return root;
}

/* =========================================================
   Oney & Co — Tool shell (Phase 2)
   Mounts a tool config into the DOM. Owns events + rendering.
   Tools provide: { id, group, title, eyebrow, defaults, steps[], resolveResult }.
   ========================================================= */

import { createFormEngine } from '../core/form-engine.js';
import { resolveResult } from '../core/result-engine.js';
import { renderField, readFieldValue } from './fields.js';
import { storage, SCOPES } from '../app/storage.js';
import { GROUPS, getNextStepLink, getToolById } from '../app/tool-registry.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function scopeFor(group) {
  switch (group) {
    case 'assess': return SCOPES.ASSESS;
    case 'calculate': return SCOPES.CALC;
    case 'analyse': return SCOPES.ANALYSE;
    case 'pro': return SCOPES.PRO;
    default: return SCOPES.CALC;
  }
}

function renderProgress(engine) {
  const total = engine.config.steps.length;
  if (total <= 1) return '';
  const cells = engine.config.steps.map((_, i) => {
    if (i < engine.state.step) return '<span class="is-done"></span>';
    if (i === engine.state.step) return '<span class="is-current"></span>';
    return '<span></span>';
  }).join('');
  return `<div class="progress-rail" aria-label="Step ${engine.state.step + 1} of ${total}">${cells}</div>`;
}

function renderStep(engine) {
  const step = engine.getCurrentStep();
  const fields = (step.fields || []).map((field) => {
    const value = engine.state.values[field.id];
    const error = engine.state.errors[field.id];
    return renderField(field, value, error);
  }).join('');
  return `
    ${step.title ? `<div class="step-title">${escapeHtml(step.title)}</div>` : ''}
    ${step.desc ? `<div class="step-desc">${escapeHtml(step.desc)}</div>` : ''}
    ${fields}
  `;
}

function renderStepActions(engine, opts) {
  const isFirst = engine.state.step === 0;
  const isLast = engine.state.step === engine.config.steps.length - 1;
  const isSingle = engine.config.steps.length === 1;
  if (isSingle) return '';
  return `
    <div class="step-actions">
      <button type="button" class="btn btn-secondary" data-action="prev" ${isFirst ? 'disabled style="opacity:.4;cursor:not-allowed"' : ''}>
        ← Back
      </button>
      <button type="button" class="btn btn-primary" data-action="${isLast ? 'submit' : 'next'}">
        ${isLast ? (opts.submitLabel || 'See result') : 'Continue →'}
      </button>
    </div>
  `;
}

function renderResultBlock(result, tool) {
  if (!result) return '';

  const metrics = result.metrics.length ? `
    <div class="metric-grid">
      ${result.metrics.map((m) => `
        <div class="metric">
          <div class="label">${escapeHtml(m.label)}</div>
          <div class="value">${escapeHtml(m.value)}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  const insights = result.insights.length ? `
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
      ${result.insights.map((it) => {
        const tone = it.tone || 'info';
        const colour = tone === 'pass' ? 'var(--green)'
          : tone === 'warn' ? 'var(--gold)'
          : tone === 'fail' ? 'var(--danger)'
          : 'var(--blue)';
        return `
          <div style="border:1px solid var(--border);border-left:3px solid ${colour};
                      background:var(--surface-2);padding:12px 14px;border-radius:10px;
                      font-size:14px;color:var(--text-soft);">
            ${escapeHtml(it.text)}
          </div>
        `;
      }).join('')}
    </div>
  ` : '';

  const actions = (result.actions || []).map((a) => `
    <a class="btn btn-secondary" href="${escapeHtml(a.href)}">${escapeHtml(a.label)}</a>
  `).join('');

  const nextStepBlock = renderNextStep(tool);

  return `
    <div class="result-hero" id="result-hero">
      <div class="label">${escapeHtml(result.heroLabel)}</div>
      <div class="value">${escapeHtml(result.heroValue)}</div>
    </div>
    ${metrics}
    ${insights}
    ${actions || nextStepBlock ? `
      <div class="result-actions">
        ${actions}
        ${nextStepBlock}
      </div>
    ` : ''}
  `;
}

function renderNextStep(tool) {
  if (!tool) return '';
  const next = getNextStepLink(tool);
  if (!next) return '';
  const cls = next.id === 'pro' ? 'btn btn-pro' : 'btn btn-primary';
  return `<a class="${cls}" href="${escapeHtml(next.cta.href)}">${escapeHtml(next.cta.label)} →</a>`;
}

/* ---------- Mount ---------- */

export function mountTool(rootEl, config, opts = {}) {
  if (!rootEl) throw new Error('mountTool: rootEl is required');
  const engine = createFormEngine(config);
  const tool = getToolById(config.id);
  const isSingleStep = config.steps.length === 1;
  const persistKey = config.id;
  const persistScope = scopeFor(config.group);

  // Restore saved values
  const saved = storage.get(persistScope, persistKey);
  if (saved && typeof saved === 'object') {
    Object.keys(saved).forEach((k) => {
      if (k in engine.state.values || config.defaults && k in config.defaults || true) {
        engine.state.values[k] = saved[k];
      }
    });
  }

  function persist() {
    storage.set(persistScope, persistKey, engine.state.values);
  }

  function currentResult() {
    if (!isSingleStep && !engine.isComplete()) return null;
    if (isSingleStep) {
      const ok = (config.steps[0].fields || []).every((f) => {
        if (!f.required) return true;
        const v = engine.state.values[f.id];
        return v !== undefined && v !== null && v !== '';
      });
      if (!ok) return null;
    }
    return resolveResult(config, engine.state.values);
  }

  function render() {
    const result = currentResult();
    rootEl.innerHTML = `
      <form class="step-form" id="tool-form" autocomplete="off" novalidate>
        ${renderProgress(engine)}
        ${renderStep(engine)}
        ${renderStepActions(engine, opts)}
      </form>
      <div id="tool-result" style="margin-top:24px">
        ${renderResultBlock(result, tool)}
      </div>
    `;
    bind();
  }

  function bind() {
    const form = rootEl.querySelector('#tool-form');
    if (!form) return;

    form.addEventListener('input', (e) => {
      const target = e.target;
      const id = target.dataset && target.dataset.input;
      if (!id) return;
      const field = currentFieldsById()[id];
      if (!field) return;
      engine.setValue(id, readFieldValue(field, target.value));
      persist();
      if (isSingleStep) updateResult();
    });

    form.addEventListener('change', (e) => {
      const target = e.target;
      if (target.tagName === 'SELECT') {
        const id = target.dataset && target.dataset.input;
        if (!id) return;
        const field = currentFieldsById()[id];
        if (!field) return;
        engine.setValue(id, readFieldValue(field, target.value));
        persist();
        if (isSingleStep) updateResult();
      }
    });

    form.addEventListener('click', (e) => {
      const choice = e.target.closest('[data-choice]');
      if (choice) {
        const id = choice.dataset.choice;
        const value = choice.dataset.value;
        const field = currentFieldsById()[id];
        if (field) engine.setValue(id, readFieldValue(field, value));
        persist();
        render();
        return;
      }
      const action = e.target.closest('[data-action]');
      if (!action) return;
      const a = action.dataset.action;
      if (a === 'next') {
        if (engine.next()) render();
        else render(); // re-render to show errors
      } else if (a === 'prev') {
        engine.prev();
        render();
      } else if (a === 'submit') {
        if (engine.validateCurrentStep()) {
          render();
          rootEl.querySelector('#result-hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          render();
        }
      }
    });
  }

  function updateResult() {
    const result = currentResult();
    const slot = rootEl.querySelector('#tool-result');
    if (slot) slot.innerHTML = renderResultBlock(result, tool);
  }

  function currentFieldsById() {
    const step = engine.getCurrentStep();
    const map = {};
    (step.fields || []).forEach((f) => { map[f.id] = f; });
    return map;
  }

  render();
  return { engine, render };
}

/* ---------- Full-page mount ---------- */

/**
 * Render the full tool layout (header + main + side rail) into `mainSelector`,
 * then mount the form engine into the root.
 */
export function mountToolPage({ mainSelector = 'main', config, assistCards = [] }) {
  const mainEl = document.querySelector(mainSelector);
  if (!mainEl) throw new Error(`mountToolPage: ${mainSelector} not found`);

  const tool = getToolById(config.id);
  const group = GROUPS[config.group] || {};
  const eyebrow = config.eyebrow || group.title || 'Tool';
  const tier = (tool && tool.tier) || 'free';
  const chips = [
    `<span class="chip is-${tier}">${escapeHtml(tier)}</span>`,
  ];
  if (config.scenarioReady) chips.push('<span class="chip">Scenario-ready</span>');

  const next = getNextStepLink(tool);
  const defaultAssist = [];
  if (next) {
    defaultAssist.push({
      title: 'Next best step',
      bodyHtml: `<p style="margin-bottom:12px">${escapeHtml(next.intro)}</p>
        <a href="${escapeHtml(next.cta.href)}" style="color:var(--green);font-weight:600">${escapeHtml(next.cta.label)} →</a>`,
    });
  }
  const allAssist = [...assistCards, ...defaultAssist];

  mainEl.innerHTML = `
    <div class="tool-shell">
      <section class="tool-header">
        <div>
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h1>${escapeHtml(config.title)}</h1>
          ${config.subtitle ? `<p>${escapeHtml(config.subtitle)}</p>` : ''}
        </div>
        <div class="header-chip-row">${chips.join('')}</div>
      </section>

      <section class="tool-layout">
        <div class="tool-main" id="tool-root"></div>
        <aside class="tool-side">
          ${allAssist.map((card) => `
            <div class="assist-card">
              <h2>${escapeHtml(card.title)}</h2>
              ${card.bodyHtml || (card.body ? `<p>${escapeHtml(card.body)}</p>` : '')}
            </div>
          `).join('')}
        </aside>
      </section>
    </div>
  `;

  return mountTool(document.getElementById('tool-root'), config);
}

export { GROUPS };

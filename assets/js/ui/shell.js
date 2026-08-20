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
import { isPro, gatedTeaserHTML } from '../app/gating.js';
import { applyUrlPrefill } from '../app/url-prefill.js';
import { sendToPro } from '../app/pro-bridge.js';

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

function renderMetrics(list) {
  if (!list || !list.length) return '';
  return `
    <div class="metric-grid">
      ${list.map((m) => `
        <div class="metric">
          <div class="label">${escapeHtml(m.label)}</div>
          <div class="value">${escapeHtml(m.value)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderInsights(list) {
  if (!list || !list.length) return '';
  return `
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
      ${list.map((it) => {
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
  `;
}

function renderLeadCapture(capture) {
  if (!capture) return '';
  const consentText = capture.consentText || 'Send me the checklist and related follow-up from Oney & Co. I understand I can unsubscribe at any time.';
  return `
    <div class="lead-capture-card" data-lead-capture="${escapeHtml(capture.id || 'lead-capture')}">
      <div class="lead-capture-kicker">${escapeHtml(capture.kicker || 'Optional checklist')}</div>
      <h2>${escapeHtml(capture.title || 'Get the checklist by email')}</h2>
      ${capture.body ? `<p>${escapeHtml(capture.body)}</p>` : ''}
      <div class="lead-capture-grid">
        <label>
          <span>Name</span>
          <input type="text" data-lead-field="name" placeholder="Your name">
        </label>
        <label>
          <span>Email <strong>*</strong></span>
          <input type="email" data-lead-field="email" placeholder="you@example.com" required>
        </label>
      </div>
      <label class="lead-consent-row">
        <input type="checkbox" data-lead-field="consent" value="true">
        <span>${escapeHtml(consentText)}</span>
      </label>
      ${capture.privacyText ? `<p class="lead-capture-privacy">${escapeHtml(capture.privacyText)}</p>` : ''}
      <button type="button" class="btn btn-primary" data-action="lead-capture-submit">${escapeHtml(capture.submitLabel || 'Send checklist')}</button>
      <div class="lead-capture-message" data-lead-message aria-live="polite"></div>
    </div>
  `;
}

function resultForLeadCapture(result, values) {
  if (!result) return null;
  return {
    heroLabel: result.heroLabel,
    heroValue: result.heroValue,
    metrics: result.metrics || [],
    insights: result.insights || [],
    narrative: result.narrative || null,
    metadata: result.metadata || null,
    values: { ...values },
    leadCapture: result.leadCapture || null,
  };
}

function renderResultBlock(result, tool) {
  if (!result) return '';
  const pro = isPro();

  // If a `gated` block is present, Pro users see it merged; free users see a teaser.
  const baseMetrics = result.metrics || [];
  const baseInsights = result.insights || [];
  const gated = result.gated;
  const mergedMetrics = pro && gated && gated.metrics ? [...baseMetrics, ...gated.metrics] : baseMetrics;
  const mergedInsights = pro && gated && gated.insights ? [...baseInsights, ...gated.insights] : baseInsights;

  const metrics = renderMetrics(mergedMetrics);
  const insights = renderInsights(mergedInsights);
  const gatedBlock = (!pro && gated) ? `
    <div style="margin:0 0 20px">${gatedTeaserHTML({ label: gated.label || 'Pro view' })}</div>
  ` : '';

  const actions = (result.actions || []).map((a) => `
    <a class="btn btn-secondary" href="${escapeHtml(a.href)}">${escapeHtml(a.label)}</a>
  `).join('');

  // Auto-inject Send-to-Pro button when the tool config opts in.
  // (Pro itself shouldn't show the button.)
  const proImportBtn = (tool && tool.group !== 'pro' && currentConfigOpts.proImport) ? `
    <button type="button" class="btn btn-pro" data-action="send-to-pro">Send to Oney Pro →</button>
  ` : '';

  const nextStepBlock = renderNextStep(tool);

  const narrative = result.narrative ? `
    <div style="border:1px solid var(--border);border-radius:14px;
                background:var(--surface-2);padding:18px 20px;margin-bottom:20px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;
                  color:var(--text-muted);margin-bottom:8px">Credit narrative</div>
      <p style="font-size:14px;line-height:1.65;color:var(--text-soft)">${escapeHtml(result.narrative)}</p>
    </div>
  ` : '';

  return `
    <div class="result-hero" id="result-hero">
      <div class="label">${escapeHtml(result.heroLabel)}</div>
      <div class="value">${escapeHtml(result.heroValue)}</div>
    </div>
    ${metrics}
    ${insights}
    ${gatedBlock}
    ${narrative}
    ${actions || nextStepBlock || proImportBtn ? `
      <div class="result-actions">
        ${actions}
        ${proImportBtn}
        ${nextStepBlock}
      </div>
    ` : ''}
    ${renderLeadCapture(result.leadCapture)}
  `;
}

// Set by mountTool before rendering so renderResultBlock can read tool-level flags
// without expanding its signature.
let currentConfigOpts = {};

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

  // Order: defaults (already in engine) → storage → URL params (URL wins)
  const saved = storage.get(persistScope, persistKey);
  if (saved && typeof saved === 'object') {
    Object.keys(saved).forEach((k) => { engine.state.values[k] = saved[k]; });
  }
  const prefilled = applyUrlPrefill(engine, config);
  if (prefilled.length) {
    // URL is the user's stated intent — persist it so links keep their state.
    try { storage.set(persistScope, persistKey, engine.state.values); } catch {}
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
    currentConfigOpts = config; // expose proImport / scenarioReady to the result renderer
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
        else render();
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
      } else if (a === 'send-to-pro') {
        sendToPro(config.id, engine.state.values);
      } else if (a === 'lead-capture-submit') {
        submitLeadCapture(action, currentResult(), engine.state.values);
      }
    });
  }

  function updateResult() {
    currentConfigOpts = config;
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

  async function submitLeadCapture(button, result, values) {
    const capture = result && result.leadCapture;
    if (!capture || !capture.endpoint) return;
    const card = button.closest('[data-lead-capture]');
    const message = card && card.querySelector('[data-lead-message]');
    const email = card?.querySelector('[data-lead-field="email"]')?.value?.trim() || '';
    const name = card?.querySelector('[data-lead-field="name"]')?.value?.trim() || '';
    const consent = card?.querySelector('[data-lead-field="consent"]')?.checked === true;

    function setMessage(text, tone = 'info') {
      if (!message) return;
      message.textContent = text;
      message.dataset.tone = tone;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('Please enter a valid email address.', 'fail');
      return;
    }
    if (!consent) {
      setMessage('Please tick the consent box so we can send the checklist and related follow-up.', 'fail');
      return;
    }

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'Sending...';
    setMessage('', 'info');

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (capture.anonKey) {
        headers.apikey = capture.anonKey;
        headers.Authorization = `Bearer ${capture.anonKey}`;
      }
      const response = await fetch(capture.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: name || null,
          email,
          consentChecklist: true,
          consentMarketing: capture.consentMarketing === true,
          consentTextVersion: capture.consentTextVersion || null,
          privacyNoticeVersion: capture.privacyNoticeVersion || null,
          source: config.id,
          sourceUrl: window.location.href,
          result: resultForLeadCapture(result, values),
        }),
      });
      const detail = await response.json().catch(() => ({}));
      if (!response.ok || detail.error) throw new Error(detail.error || 'Checklist request failed');
      setMessage(capture.successText || 'Done — your checklist has been sent.', 'pass');
      button.textContent = 'Checklist sent ✅';
    } catch (err) {
      console.error('lead capture error:', err);
      setMessage('Something went wrong. Please try again or contact Oney & Co directly.', 'fail');
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }

  render();
  return { engine, render };
}

/* ---------- Full-page mount ---------- */

/**
 * Render the full tool layout (header + main + side rail) into `mainSelector`,
 * then mount the form engine into the root.
 */
export function mountToolPage({ mainSelector = 'main', config, assistCards = [], submitLabel }) {
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

  return mountTool(document.getElementById('tool-root'), config, { submitLabel });
}

/**
 * Same chrome as mountToolPage but does not mount a form engine.
 * Use for canvas/non-form tools (Flow Visualiser, Pro workspace).
 * Returns the main slot element so the caller can populate it.
 */
export function mountCanvasPage({
  mainSelector = 'main',
  group,
  eyebrow,
  title,
  subtitle,
  tier = 'free',
  nextStepGroup, // override which next-step CTA to show
  assistCards = [],
}) {
  const mainEl = document.querySelector(mainSelector);
  if (!mainEl) throw new Error(`mountCanvasPage: ${mainSelector} not found`);

  const groupCfg = GROUPS[group] || {};
  const next = getNextStepLink({ group: nextStepGroup || group });
  const chips = [`<span class="chip is-${tier}">${escapeHtml(tier)}</span>`];

  const allAssist = [...assistCards];
  if (next) {
    allAssist.push({
      title: 'Next best step',
      bodyHtml: `<p style="margin-bottom:12px">${escapeHtml(next.intro)}</p>
        <a href="${escapeHtml(next.cta.href)}" style="color:var(--green);font-weight:600">${escapeHtml(next.cta.label)} →</a>`,
    });
  }

  mainEl.innerHTML = `
    <div class="tool-shell">
      <section class="tool-header">
        <div>
          <p class="eyebrow">${escapeHtml(eyebrow || groupCfg.title || '')}</p>
          <h1>${escapeHtml(title || '')}</h1>
          ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
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

  return document.getElementById('tool-root');
}

export { GROUPS };

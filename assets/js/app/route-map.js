/* =========================================================
   Oney & Co — Route map (Phase 1)
   Renders tool cards into a hub page grid. Pure DOM, no framework.
   ========================================================= */

import {
  GROUPS,
  TOOL_REGISTRY,
  getToolsByGroup,
  resolveToolHref,
} from './tool-registry.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderToolCard(tool) {
  const href = escapeHtml(resolveToolHref(tool));
  const title = escapeHtml(tool.title);
  const desc = escapeHtml(tool.description);
  const tier = escapeHtml(tool.tier);
  const group = escapeHtml(tool.group);
  const icon = escapeHtml(tool.icon || '🔧');
  const target = tool.external ? ' target="_blank" rel="noopener"' : '';
  return `
    <a class="tool-card fade-up" href="${href}"${target}
       data-tier="${tier}" data-priority="${escapeHtml(tool.priority)}">
      <div class="tool-card-top">
        <div class="tool-icon" data-tier="${tier}">${icon}</div>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="tool-tier" data-value="${tier}">${tier}</span>
        </div>
      </div>
      <h3>${title}</h3>
      <p>${desc}</p>
      <span class="tool-link">Open ${title}</span>
    </a>
  `;
}

export function renderGroupPage(group, container) {
  if (!container) return;
  const tools = getToolsByGroup(group);
  container.innerHTML = tools.map(renderToolCard).join('');
}

export function renderHomeQuickStart(container) {
  if (!container) return;
  const order = ['assess', 'calculate', 'analyse'];
  container.innerHTML = order.map((id) => {
    const g = GROUPS[id];
    const count = getToolsByGroup(id).length;
    return `
      <a class="entry-card fade-up" href="${escapeHtml(g.cta.href)}" data-group="${escapeHtml(id)}">
        <div class="entry-meta">${escapeHtml(g.eyebrow)} · ${count} tools</div>
        <h2>${escapeHtml(g.title)}</h2>
        <p>${escapeHtml(g.intro)}</p>
        <span class="tool-link">${escapeHtml(g.cta.label)}</span>
      </a>
    `;
  }).join('');
}

export function renderHomeHeroTools(container) {
  if (!container) return;
  // Free diagnostic entries — Assess heroes only.
  const heroes = getToolsByGroup('assess').filter((t) => t.priority === 'hero');
  container.innerHTML = heroes.map(renderToolCard).join('');
}

export { TOOL_REGISTRY, GROUPS };

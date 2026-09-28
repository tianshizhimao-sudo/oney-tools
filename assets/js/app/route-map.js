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


const ICONS = {
  pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  gauge: '<path d="M4 14a8 8 0 1 1 16 0"/><path d="m12 14 4-4"/><path d="M6 18h12"/>',
  building: '<path d="M5 21V5l7-3 7 3v16"/><path d="M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  bolt: '<path d="m13 2-8 12h7l-1 8 8-12h-7z"/>',
  capacity: '<path d="M4 18h16"/><path d="M7 15V9M12 15V5M17 15v-3"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trend: '<path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
  flow: '<path d="M5 5h5v5H5zM14 14h5v5h-5z"/><path d="M10 7.5h4a3 3 0 0 1 3 3V14M7.5 10v4a3 3 0 0 0 3 3H14"/>'
};

function renderIcon(name) {
  const body = ICONS[name] || ICONS.chart;
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
}

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
  const icon = renderIcon(tool.icon);
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

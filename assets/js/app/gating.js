/* =========================================================
   Oney & Co — Gating (Phase 3)
   Pro-tier visibility gate. Same engine, same numbers — gating
   only controls which result blocks/insights/metrics are revealed.
   ========================================================= */

import { storage, SCOPES } from './storage.js';

const PRO_KEY = 'pro-unlocked';

export function isPro() {
  // Two ways to be "Pro" in Phase 3:
  //  1. Local unlock flag (set via setPro(true) — typically by Oney Pro page).
  //  2. Query string ?pro=1 — useful for review links.
  try {
    if (storage.get(SCOPES.PRO, PRO_KEY) === true) return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('pro') === '1') return true;
  } catch {}
  return false;
}

export function setPro(value) {
  storage.set(SCOPES.PRO, PRO_KEY, !!value);
}

/**
 * Render a gated CTA block instead of a sensitive result panel.
 */
export function gatedTeaserHTML({ label, ctaHref = '/suite/' } = {}) {
  return `
    <div style="border:1px dashed rgba(155,89,182,0.40);
                background:linear-gradient(135deg,rgba(107,76,154,0.10),rgba(46,204,133,0.04));
                border-radius:16px;padding:20px;text-align:center;
                color:var(--text-soft);font-size:14px;display:flex;
                flex-direction:column;gap:10px;align-items:center">
      <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.12em;color:#d0c2ea">
        ${escapeHtml(label || 'Pro view')}
      </div>
      <p style="margin:0;max-width:380px">
        Detailed lender matrix and full module breakdown are unlocked in Oney Pro.
        Same engine — Pro just shows everything.
      </p>
      <a class="btn btn-pro" href="${escapeAttr(ctaHref)}">Unlock with Oney Pro →</a>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

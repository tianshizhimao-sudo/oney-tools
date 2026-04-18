/* =========================================================
   Oney & Co — Pro bridge (Phase 4)
   One-click handoff: any analyse tool → /pro/ workspace.
   Same data shape, no formula divergence — just a field-mapped merge
   into the same storage slot the Pro workspace already reads from.
   ========================================================= */

import { storage, SCOPES } from './storage.js';

const PRO_TOOL_ID = 'oney-pro';
const PRO_HREF = '/pro/';
const FLOW_SLOT = 'flow-diagram';
const PENDING_SLOT = 'pending-imports';

/**
 * Per-source field-mapping. Keys = analyse-tool field IDs; values = Pro field IDs.
 * Anything not in the map is dropped — keeps the merge surgical.
 */
const SOURCE_MAPS = {
  servicing: {
    loanAmount: 'loanAmount',
    rate: 'rate',
    termYears: 'termYears',
    repaymentType: 'repaymentType',
    propertyValue: 'propertyValue',
    propertyType: 'propertyClass',
    grossAnnualRent: 'grossAnnualRent',
    annualOutgoings: 'annualOutgoings',
    waleYears: 'waleYears',
  },
  'security-assessment': {
    propertyClass: 'propertyClass',
    purchasePrice: 'propertyValue',
    loanAmount: 'loanAmount',
  },
  'investment-yield': {
    purchasePrice: 'propertyValue',
    rate: 'rate',
    termYears: 'termYears',
    repaymentType: 'repaymentType',
    // weeklyRent is converted to grossAnnualRent below.
  },
  'commercial-investment': {
    purchasePrice: 'propertyValue',
    loanAmount: 'loanAmount',
    rate: 'rate',
  },
};

/* ---------- Public API ---------- */

/**
 * Merge analyse-tool values into the Pro workspace storage and navigate.
 * Returns the resulting Pro values (for tests / dev tools).
 */
export function sendToPro(sourceToolId, sourceValues, { navigate = true } = {}) {
  const map = SOURCE_MAPS[sourceToolId] || {};
  const existingPro = storage.get(SCOPES.PRO, PRO_TOOL_ID) || {};
  const merged = { ...existingPro };

  Object.entries(map).forEach(([from, to]) => {
    if (sourceValues[from] !== undefined && sourceValues[from] !== '' && sourceValues[from] !== null) {
      merged[to] = sourceValues[from];
    }
  });

  // Special derived: weeklyRent → grossAnnualRent
  if (sourceToolId === 'investment-yield' && sourceValues.weeklyRent != null && sourceValues.weeklyRent !== '') {
    merged.grossAnnualRent = Number(sourceValues.weeklyRent) * 52;
  }

  storage.set(SCOPES.PRO, PRO_TOOL_ID, merged);
  pushPendingImport(sourceToolId, Object.keys(map).filter((k) => k in sourceValues));

  if (navigate && typeof window !== 'undefined') {
    window.location.href = `${PRO_HREF}?from=${encodeURIComponent(sourceToolId)}`;
  }
  return merged;
}

/**
 * Save a flow-visualiser diagram into the Pro workspace separately.
 * Pro can then attach it to the credit summary.
 */
export function sendFlowToPro(flowState, { navigate = true } = {}) {
  storage.set(SCOPES.PRO, FLOW_SLOT, flowState);
  pushPendingImport('flow-visualiser', ['nodes', 'edges']);
  if (navigate && typeof window !== 'undefined') {
    window.location.href = `${PRO_HREF}?from=flow-visualiser`;
  }
}

export function getProFlow() {
  return storage.get(SCOPES.PRO, FLOW_SLOT);
}

export function consumePendingImports() {
  const pending = storage.get(SCOPES.PRO, PENDING_SLOT) || [];
  if (pending.length) storage.remove(SCOPES.PRO, PENDING_SLOT);
  return pending;
}

/* ---------- Internal ---------- */

function pushPendingImport(sourceToolId, fields) {
  const pending = storage.get(SCOPES.PRO, PENDING_SLOT) || [];
  pending.push({ sourceToolId, fields, at: Date.now() });
  storage.set(SCOPES.PRO, PENDING_SLOT, pending);
}

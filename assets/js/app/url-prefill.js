/* =========================================================
   Oney & Co — Query-string prefill (Phase 4)
   Order of precedence (later overrides earlier):
     defaults  →  storage  →  URL params

   Resolution for each URL key:
     1. Direct field-id match  (e.g. ?loanAmount=500000)
     2. Per-tool config.urlAlias override
     3. DEFAULT_ALIASES table  (e.g. ?loan=… → loanAmount on most tools)

   Always run through fields.readFieldValue so currency / percent / number
   come out as JS numbers — no rounding logic outside finance-math.js.
   ========================================================= */

import { readFieldValue } from '../ui/fields.js';

/**
 * Cross-tool aliases. Each key is a friendly URL param name; the value lists
 * candidate field IDs in priority order. The first one that exists on the
 * tool's schema wins.
 */
export const DEFAULT_ALIASES = {
  // Loan basics
  loan: ['loanAmount', 'currentLoan', 'balance', 'proposedLoan'],
  amount: ['loanAmount', 'proposedLoan', 'balance'],
  rate: ['rate', 'currentRate', 'interestRate', 'newRate'],
  term: ['termYears', 'currentTerm', 'newTerm'],
  type: ['repaymentType', 'currentType', 'newType'],

  // Income / borrower
  income: ['grossSalary', 'grossAnnualIncome'],
  salary: ['grossSalary', 'grossAnnualIncome'],

  // Property / security
  value: ['propertyValue', 'purchasePrice', 'securityValue'],
  price: ['purchasePrice', 'propertyValue'],
  property: ['propertyValue', 'purchasePrice'],
  rent: ['weeklyRent', 'grossAnnualRent'],
  weeklyRent: ['weeklyRent'],
  annualRent: ['grossAnnualRent'],
  outgoings: ['annualOutgoings'],
  wale: ['waleYears'],

  // Refinance
  newRate: ['newRate'],
  currentRate: ['currentRate'],
  newTerm: ['newTerm'],
  currentTerm: ['currentTerm'],
  switchCost: ['switchCost'],

  // Pro / borrower
  borrower: ['borrowerName'],
  entity: ['entityType'],
};

/**
 * Walk a tool config and return Set of all field IDs across all steps.
 */
export function collectFieldIds(config) {
  const ids = new Set();
  (config.steps || []).forEach((step) => {
    (step.fields || []).forEach((f) => ids.add(f.id));
  });
  return ids;
}

function findField(config, fieldId) {
  for (const step of config.steps || []) {
    for (const f of step.fields || []) {
      if (f.id === fieldId) return f;
    }
  }
  return null;
}

/**
 * Apply URL params into engine.state.values. Mutates in place.
 * Returns the list of resolved field IDs (for diagnostics).
 */
export function applyUrlPrefill(engine, config, search = (typeof window !== 'undefined' ? window.location.search : '')) {
  const params = new URLSearchParams(search || '');
  const applied = [];
  if (![...params.keys()].length) return applied;

  const ids = collectFieldIds(config);
  const aliasMap = config.urlAlias || {};

  params.forEach((rawValue, key) => {
    const target = resolveTargetField(key, ids, aliasMap);
    if (!target) return;
    const field = findField(config, target);
    if (!field) return;
    engine.state.values[target] = readFieldValue(field, rawValue);
    applied.push(target);
  });

  return applied;
}

function resolveTargetField(key, ids, aliasMap) {
  // 1. Direct match
  if (ids.has(key)) return key;

  // 2. Per-tool override
  const override = aliasMap[key];
  if (typeof override === 'string' && ids.has(override)) return override;
  if (Array.isArray(override)) {
    for (const id of override) if (ids.has(id)) return id;
  }

  // 3. Global aliases
  const candidates = DEFAULT_ALIASES[key];
  if (Array.isArray(candidates)) {
    for (const id of candidates) if (ids.has(id)) return id;
  }
  return null;
}

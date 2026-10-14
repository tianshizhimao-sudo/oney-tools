/* UI choices describe broker-entered facts, not findings or evidence review.
   Text fragments reuse the existing deterministic intake parser unchanged. */
export const INTAKE_PRESETS = Object.freeze({
  purpose: { label: 'What will the funds be used for?', multiple: true, options: [
    { id: 'refinance', label: 'Refinance', text: 'Refinance existing facilities' },
    { id: 'working_capital', label: 'Working capital', text: 'Working capital requested' },
    { id: 'property', label: 'Buy commercial property', text: 'Commercial property purchase' },
    { id: 'equipment', label: 'Buy equipment', text: 'Equipment purchase' },
    { id: 'contract', label: 'New contract / growth', text: 'Growth linked to a new contract' },
  ] },
  security: { label: 'What security is proposed?', multiple: true, options: [
    { id: 'residential', label: 'Residential property', text: 'Residential property security' },
    { id: 'commercial', label: 'Commercial property', text: 'Commercial property security' },
    { id: 'equipment', label: 'Equipment', text: 'Equipment security' },
    { id: 'second', label: 'Second mortgage', text: 'Second mortgage security' },
    { id: 'related', label: 'Related-party property', text: 'Related-party property-owning entity provides security' },
  ] },
  income: { label: 'What is the current trading picture?', multiple: false, options: [
    { id: 'stable', label: 'Stable trading', text: 'Broker reports stable trading' },
    { id: 'growing', label: 'Growing revenue', text: 'Broker reports growing revenue' },
    { id: 'declining', label: 'Revenue falling', text: 'Broker reports revenue lower than before' },
    { id: 'turnaround', label: 'Recovery / turnaround claimed', text: 'Recovery claimed; evidence review required' },
    { id: 'lost_customer', label: 'Lost a major customer', text: 'Lost a major customer' },
  ] },
  existingDebts: { label: 'Which existing commitments apply?', multiple: true, options: [
    { id: 'term', label: 'Term loan / mortgage', text: 'Existing term loan or mortgage' },
    { id: 'overdraft', label: 'Overdraft / credit line', text: 'Existing overdraft or credit line' },
    { id: 'leases', label: 'Vehicle / equipment leases', text: 'Existing vehicle or equipment leases' },
    { id: 'mca', label: 'Merchant cash advance', text: 'Merchant cash advance present' },
    { id: 'ato', label: 'ATO debt', text: 'ATO debt outstanding' },
  ] },
  conduct: { label: 'What has been reported?', multiple: true, options: [
    { id: 'dishonours', label: 'Dishonours / account excesses', text: 'Recent dishonours or account excesses reported' },
    { id: 'suppliers', label: 'Supplier arrears', text: 'Supplier arrears reported' },
    { id: 'ato_missed', label: 'Missed ATO plan payment', text: 'ATO payment plan: missed instalment reported' },
    { id: 'sg', label: 'Super claimed, proof not reviewed', text: 'Superannuation claimed current but unverified' },
  ] },
  documents: { label: 'Which documents are reported available?', multiple: true, options: [
    { id: 'financials', label: 'Financials / YTD accounts', text: 'Financial statements or YTD accounts reported available' },
    { id: 'statements', label: 'Bank statements', text: 'Bank statements reported available' },
    { id: 'debt_schedule', label: 'Debt schedule', text: 'Debt schedule reported available' },
    { id: 'valuation', label: 'Valuation', text: 'Valuation reported available' },
    { id: 'funds', label: 'Use-of-funds breakdown', text: 'Use-of-funds breakdown reported available' },
    { id: 'zoning', label: 'Zoning / permitted use', text: 'Zoning confirmation reported available' },
    { id: 'environmental', label: 'Environmental check', text: 'Environmental evidence reported available' },
  ] },
  urgency: { label: 'When is funding needed?', multiple: false, options: [
    { id: 'two_weeks', label: 'Within 2 weeks', text: 'Funding requested within two weeks' },
    { id: 'month', label: 'Within 1 month', text: 'Funding requested within one month' },
    { id: 'later', label: 'Later / flexible', text: 'Funding timing is flexible' },
  ] },
});

export function composeIntakeValue(key, manualText, selected = []) {
  const config = INTAKE_PRESETS[key];
  const fragments = (config?.options || []).filter((option) => selected.includes(option.id)).map((option) => option.text);
  // Unknown / Other never manufacture a fact or remove the user's own words.
  if (!fragments.length) return String(manualText ?? '');
  return `${manualText ? `${manualText}\n` : ''}Broker-selected options (unverified): ${fragments.join('; ')}.`;
}

// Presentation groups only: rule IDs, priorities and engine ordering do not change.
export const TRIGGER_GROUPS = Object.freeze([
  { id: 'tax', label: 'Tax & super', hint: 'ATO debt, payment plans, SG evidence', rules: ['ato_debt', 'missed_ato_plan', 'sg_unevidenced'] },
  { id: 'conduct', label: 'Account conduct & arrears', hint: 'Bank-account events and overdue suppliers', rules: ['dishonours_recent', 'supplier_arrears'] },
  { id: 'cashflow', label: 'Cash flow & repayments', hint: 'Expensive debt, leverage, turnaround', rules: ['mca_present', 'high_dti', 'turnaround_claim'] },
  { id: 'purpose', label: 'Purpose & growth', hint: 'Use of funds and new contracts', rules: ['working_capital_vague', 'contract_growth'] },
  { id: 'property', label: 'Security & property', hint: 'LVR, valuation, leases, due diligence', rules: ['high_lvr_second_mortgage', 'valuation_sensitive', 'short_wale', 'zoning_environmental_missing'] },
  { id: 'structure', label: 'Structure & document currency', hint: 'Related parties and old servicing positions', rules: ['related_party_security', 'stale_preapproval'] },
]);

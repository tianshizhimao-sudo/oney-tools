// Fictional teaching scenarios only. No calibrated judgement or lender decision.
const example = (id, label, intake, triggers, assumptions) => ({
  id, synthetic: true, tone: 'custom', shortLabel: `${id} · ${label} · Rules only`,
  followUpCase: { dealId: id, dealName: intake.dealName, scenario: intake.scenario,
    currentRating: 'Amber — Package Better', triggers },
  intake: { borrowerType: 'company', urgency: 'Illustrative timing only', deferralReason: '', ...intake },
  assumptions, judgement: null,
});
export const EXTRA_EXAMPLES = Object.freeze({
  'CF-005': example('CF-005', 'Industrial investment purchase', {
    dealName: 'Synthetic industrial investment purchase',
    scenario: 'Fictional single-tenant warehouse purchase; rent supports interest but lease and valuation evidence need review',
    dealType: 'commercial_investment', borrower: 'Synthetic property holding company; unrelated operating tenant',
    loanAmount: 1200000, purpose: 'Purchase a leased industrial investment property; no owner occupation',
    security: 'Proposed first mortgage over industrial property; title, zoning and environmental checks outstanding',
    securityValue: 2000000, totalSecuredDebt: 1200000,
    income: 'Illustrative annual gross rent $144,000 less unrecovered operating costs $24,000 gives net operating income $120,000 before interest and tax',
    existingDebts: 'Illustrative annual interest $84,000 on proposed debt; principal repayments and other commitments not assessed',
    conduct: 'No conduct evidence reviewed; tenant payment history not supplied',
    documents: 'Synthetic lease summary only; valuation and executed lease not supplied',
    icrNOI: '120000', icrInterest: '84000', icrPeriod: 'annual',
  }, ['valuation_sensitive', 'zoning_environmental_missing'], [
    'All amounts are synthetic teaching inputs, not verified rental or debt evidence.',
    'Net income and interest cover the same proposed property and 12-month period; no vacancy stress or lender adjustments are assumed.',
  ]),
  'CF-006': example('CF-006', 'Retail investment refinance', {
    dealName: 'Synthetic retail investment refinance',
    scenario: 'Fictional retail investment refinance with short lease expiry, vacancy exposure and income below interest',
    dealType: 'commercial_investment', borrower: 'Synthetic property investment company; one external tenant',
    loanAmount: 900000, purpose: 'Refinance investment property debt; tenant renewal remains unsigned',
    security: 'Retail property with a short lease and valuation sensitivity', securityValue: 1500000, totalSecuredDebt: 900000,
    income: 'Illustrative monthly gross rent $6,000 less unrecovered costs $1,500 gives net operating income $4,500 before interest and tax',
    existingDebts: 'Illustrative interest $6,000 per month; refinancing terms and principal repayments not assessed',
    conduct: 'Tenant arrears position unknown; no reviewed conduct evidence',
    documents: 'Synthetic expired offer and unsigned renewal proposal; current rent ledger and valuation outstanding',
    icrNOI: '4500', icrInterest: '6000', icrPeriod: 'monthly',
  }, ['short_wale', 'valuation_sensitive', 'stale_preapproval'], [
    'All amounts are synthetic. Monthly figures are multiplied by 12 without seasonal or vacancy adjustment.',
    'The tenant renewal and refinance terms remain unverified; an ICR calculation is not evidence of repayment capacity.',
  ]),
  'CF-007': example('CF-007', 'Equipment and contract expansion', {
    dealName: 'Synthetic equipment and contract expansion',
    scenario: 'Fictional equipment purchase for a new customer contract with supplier arrears and an unproven turnaround',
    dealType: 'equipment', borrower: 'Synthetic manufacturing company; three years trading',
    loanAmount: 280000, purpose: 'Equipment $240,000 and installation $40,000 for a proposed customer contract',
    security: 'Proposed equipment security; resale value and existing interests unknown', securityValue: '', totalSecuredDebt: '',
    income: 'Historical loss; management forecasts a turnaround from an unsigned contract; no forecast reconciliation supplied',
    existingDebts: 'Existing equipment repayments $4,000 per month; full debt schedule outstanding',
    conduct: 'Supplier arrears reported; current ATO and SG evidence not supplied',
    documents: 'Synthetic equipment quote and draft customer contract; aged creditors and bank statements outstanding',
  }, ['contract_growth', 'supplier_arrears', 'turnaround_claim'], [
    'The new contract, equipment delivery date and forecast improvement are unverified teaching assumptions.',
    'Equipment finance is not an investment-property transaction; rental ICR is not applied.',
  ]),
});

/* =========================================================
   Oney Credit Framework — lender deferral reason library v0.1
   INTERNAL PROTOTYPE ONLY. Calibrated by Dong 2026-09-26: reasons sufficient,
   "lender is testing" lines fit, collect-first order reasonable, linked
   triggers right. Key rule: supply the exact document credit asked for (or
   the same type) — after a concern is raised, only that meets credit policy.

   Source: deferral-follow-up-engine-spec-v0.1.md §4 Mode B (what the lender
   is really testing / what to collect first / what explanation should
   accompany documents / rework or pause) and §6 trigger category 9.
   Each reason links to existing rules-v0.1.json trigger ids so the
   Follow-Up Engine and re-rate loop are reused, not duplicated.
   Obsidian copy: deferral-reason-library-v0.1.md
   ========================================================= */

export const DEFERRAL_LIBRARY_VERSION = 'v0.1 (calibrated 2026-09-26)';

/* Dong 2026-09-26: the single most important instruction on any deferral. */
export const EXACT_DOCUMENT_RULE = 'Provide the exact documents credit asked for, or the same document type. Credit has already raised a concern, so only the requested evidence meets credit policy; substitutes, summaries or explanations on their own do not.';

export const DEFERRAL_REASONS = Object.freeze([
  {
    id: 'servicing_shortfall',
    label: 'Servicing / debt-service cover short of policy',
    lenderTesting: 'Whether repayments can be met at the assessed rate after every existing commitment, using income the lender will actually accept.',
    collectFirst: ['Updated servicing calculation with all commitments', 'Full debt schedule with limits', 'Latest financials plus YTD management accounts', 'Addback evidence with after-tax treatment'],
    explanation: 'A short bridge from reported profit to assessed surplus: each addback, why it is one-off or non-cash, and the resulting cover ratio.',
    linkedTriggers: ['high_dti', 'mca_present', 'stale_preapproval', 'turnaround_claim'],
  },
  {
    id: 'valuation_shortfall',
    label: 'Valuation came in below estimate',
    lenderTesting: 'Whether the security still covers the exposure at the lender’s LVR limit, and who funds the gap.',
    collectFirst: ['Valuation report', 'Cash-to-complete / available equity', 'Revised loan amount or additional security option'],
    explanation: 'The revised LVR and exactly how the shortfall is covered: extra equity, lower loan amount or additional security.',
    linkedTriggers: ['valuation_sensitive', 'high_lvr_second_mortgage'],
  },
  {
    id: 'conduct_explanation',
    label: 'Explain account conduct (dishonours, excesses, arrears)',
    lenderTesting: 'Whether the conduct was an isolated timing issue that has stopped, or an ongoing cash-flow pattern.',
    collectFirst: ['6–12 months business bank statements', 'Written explanation for each event', 'Evidence conduct has normalised since'],
    explanation: 'One line per event (date, amount, cause, fix) and the date conduct became clean.',
    linkedTriggers: ['dishonours_recent', 'supplier_arrears', 'mca_present'],
  },
  {
    id: 'ato_position',
    label: 'ATO / tax / super position not evidenced',
    lenderTesting: 'Whether statutory debt is contained and managed, or a sign of recurring compliance stress.',
    collectFirst: ['ATO integrated client account', 'Payment-plan letter and payment history', 'BAS lodgement status', 'SG / clearing-house evidence'],
    explanation: 'Balance, plan terms, any missed instalment with cause and catch-up date, and confirmation lodgements and super are current.',
    linkedTriggers: ['ato_debt', 'missed_ato_plan', 'sg_unevidenced'],
  },
  {
    id: 'updated_financials',
    label: 'Financials too old — updated trading requested',
    lenderTesting: 'Whether current trading supports the story told by the last full-year accounts.',
    collectFirst: ['YTD management accounts', 'Latest BAS', 'Accountant commentary on the trend'],
    explanation: 'A one-paragraph comparison of YTD to the same period last year, with the reason for any change.',
    linkedTriggers: ['turnaround_claim', 'stale_preapproval'],
  },
  {
    id: 'purpose_use_of_funds',
    label: 'Purpose / use of funds unclear',
    lenderTesting: 'Whether the money funds something productive and matched to the facility, rather than covering recurring losses.',
    collectFirst: ['Use-of-funds breakdown by category and timing', 'Signed contracts / purchase orders', 'Cash-flow forecast'],
    explanation: 'Each dollar mapped to a use and a date, and how that use generates the repayment.',
    linkedTriggers: ['working_capital_vague', 'contract_growth'],
  },
  {
    id: 'property_due_diligence',
    label: 'Property due diligence outstanding (lease, zoning, environmental)',
    lenderTesting: 'Whether the property is legally usable, marketable, and whether servicing relies on rent that may stop.',
    collectFirst: ['Full executed lease and tenant payment history', 'Zoning / permitted-use confirmation', 'Environmental risk check', 'Servicing with and without external rent'],
    explanation: 'Lease terms and expiry, permitted use, any environmental finding, and servicing if the tenant leaves.',
    linkedTriggers: ['short_wale', 'zoning_environmental_missing', 'related_party_security'],
  },
  {
    id: 'structure_parties',
    label: 'Borrower / guarantor / security-party structure questioned',
    lenderTesting: 'Whether the borrower, owners of security and guarantors line up and the security is enforceable.',
    collectFirst: ['Entity structure chart', 'Title / ownership details', 'Guarantor and security-provider consents', 'SMSF / related-party lease confirmation'],
    explanation: 'Who borrows, who owns each security, who guarantees, and any related-party lease — on one page.',
    linkedTriggers: ['related_party_security'],
  },
  {
    id: 'reduce_exposure',
    label: 'Lender wants a lower loan amount or LVR',
    lenderTesting: 'Whether a smaller or better-secured facility still achieves the purpose.',
    collectFirst: ['Revised loan amount and purpose mapping', 'Additional equity or security evidence', 'Updated servicing at the new amount'],
    explanation: 'The revised request, what is dropped or deferred, and why the purpose still works.',
    linkedTriggers: ['valuation_sensitive', 'high_dti', 'high_lvr_second_mortgage'],
  },
]);

/* =========================================================
   Oney Credit Framework — synthetic sample cases for the MVP wrapper
   INTERNAL PROTOTYPE ONLY — synthetic data, no real client information.

   For each case:
   - followUpCase : verbatim copy of Obsidian assets/follow-up-engine/case-*.json
                    (tests deep-equal it against tests/fixtures/credit-framework/).
   - intake       : case-pack-v0.1.md "Facts Provided" table, grouped into the
                    mvp-wrapper-spec-v0.1.md §5 intake fields.       -> FACT
   - assumptions  : placeholders the framework must not treat as proven.
                                                                   -> ASSUMPTION
   - judgement    : pre-generated, banker-calibrated judgement transcribed from
                    the v0.1 Deal Coaching sample reports (2026-08-15). No live
                    model call exists in this prototype.           -> JUDGEMENT
                    A handful of source phrases were reworded to satisfy the
                    mvp-wrapper-spec §3 wording table (see audit §3).
   ========================================================= */

export const CASES = Object.freeze({
  'CF-001': {
    id: 'CF-001',
    tone: 'green',
    shortLabel: 'CF-001 · Green · Clean SME refinance',
    synthetic: true,
    followUpCase: {
      dealId: 'CF-001',
      dealName: 'Harbour Electrical — Clean SME Refinance',
      currentRating: 'Green — Package Ready, subject to valuation and contract evidence',
      scenario: 'Clean SME refinance plus contract-backed growth working capital',
      triggers: ['valuation_sensitive', 'contract_growth', 'working_capital_vague'],
    },
    intake: {
      dealName: 'Harbour Electrical — Clean SME Refinance',
      scenario: 'Clean SME refinance plus contract-backed growth working capital',
      dealType: 'refinance',
      borrowerType: 'company',
      borrower: 'Harbour Electrical Services Pty Ltd — company, two directors/shareholders 50/50; 7 years trading; electrical contractor (commercial maintenance and small fit-out work)',
      loanAmount: 650000,
      purpose: '$500,000 refinance of existing business loan (major bank, 18 months remaining); $150,000 working capital for new service contracts',
      security: 'First registered mortgage over director-owned residential property',
      securityValue: 1450000,
      totalSecuredDebt: 1170000,
      income: 'FY24 revenue $2.35m / NPAT $215k; FY25 revenue $2.62m / NPAT $252k; addbacks: depreciation $38k, one-off legal cost $22k',
      existingDebts: 'Existing business loan repayment $12,600/month; proposed repayment estimate $13,800/month; existing home loan $520,000',
      conduct: 'ATO current, no payment plan; SG paid monthly via Xero; no dishonours or excesses in last 6 months',
      documents: 'FY24/FY25 financials, 6 months bank statements, existing loan statement, draft new contract',
      urgency: 'New contract starts in 6 weeks',
      deferralReason: '',
    },
    assumptions: [
      'Property value ($1.45m) is an estimate, not a formal valuation.',
      'LVR is calculated before costs and fees.',
      'The draft contract is assumed to reflect final terms; it is not yet executed.',
      'Proposed repayment ($13,800/month) is an estimate, not a lender quote.',
    ],
    judgement: {
      source: 'deal-coaching-report-sample-CF-001-green-v0.1.md (2026-08-15)',
      // Sample report said Medium-High; Dong 2026-09-26: show Medium and call out the watch points.
      calibratedConfidence: 'Medium',
      oneLineView: 'Strong SME refinance / growth working-capital file: established trade services business, improving profitability, clean conduct, clear refinance purpose and a near-term contract-supported working-capital need.',
      nextStep: 'Package for lender once valuation/LVR comfort, executed or near-final contract evidence and a clear working-capital breakdown are in hand.',
      dimensions: [
        { dimension: 'Purpose', rating: 'Green', note: 'Clear and productive; subject to a specific use-of-funds breakdown.' },
        { dimension: 'Capacity', rating: 'Green / Amber', note: 'Supportable on the FY25 trend; confirm against lender policy, director drawings and household commitments.' },
        { dimension: 'Conduct', rating: 'Green', note: 'No dishonours or excesses in the last 6 months.' },
        { dimension: 'Compliance', rating: 'Green', note: 'ATO and SG current — a key strength.' },
        { dimension: 'Security', rating: 'Amber / Green', note: 'First mortgage security, but ~80.7% LVR before costs is valuation-sensitive.' },
        { dimension: 'Structure', rating: 'Green / Amber', note: 'Consider separating working capital into a revolving line if the cash-flow cycle is revolving.' },
        { dimension: 'Management', rating: 'Green', note: 'Seven years trading, clean conduct and improving results.' },
        { dimension: 'Exit', rating: 'Green / Amber', note: 'Primary exit is trading cash flow; fallback is residential security, subject to valuation.' },
      ],
      risks: [
        { risk: 'Valuation shortfall', why: 'LVR is around 80.7% before costs.', mitigant: 'First mortgage security and existing equity.', status: 'Partial — valuation required' },
        { risk: 'Working capital vagueness', why: 'Lender may view the request as a buffer rather than a contract need.', mitigant: 'Draft new contract provided.', status: 'Partial — breakdown required' },
        { risk: 'New contract execution risk', why: 'Revenue uplift depends on delivery and payment.', mitigant: 'Established 7-year operator.', status: 'Partial — contract terms needed' },
        { risk: 'Slight repayment increase', why: 'Proposed repayment is $1,200/month higher.', mitigant: 'Improved FY25 profit and clean conduct.', status: 'Mostly mitigated' },
        { risk: 'Director property security', why: 'Personal exposure needs to be understood.', mitigant: 'Director-owned security offered.', status: 'Needs proper documentation / advice' },
      ],
      missingEvidence: {
        critical: [
          { item: 'Formal valuation or reliable AVM confidence', impact: 'Confirms whether the security position remains within lender appetite and pricing settings.', ifWeak: 'Rating may move to Amber and lender selection / loan amount may need adjustment.' },
          { item: 'Executed or near-final new contract / purchase order', impact: 'Supports a productive working-capital purpose.', ifWeak: 'Working capital may be viewed as a general cash buffer, reducing package strength.' },
          { item: 'Updated debt schedule including home loan', impact: 'Confirms all commitments and security exposure.', ifWeak: 'Servicing and LVR analysis cannot be finalised.' },
        ],
        important: [
          { item: 'Aged debtors/creditors', impact: 'Confirms the cash-conversion cycle.' },
          { item: 'Director asset/liability position', impact: 'Supports the guarantee/security view.' },
          { item: 'Management explanation of working-capital cycle', impact: 'Shows why funds are needed before contract cash arrives.' },
        ],
        helpful: ['Customer concentration summary', 'Supplier payment terms', 'Brief director background / trading history summary'],
      },
      packaging: {
        mainstream: 'Potentially package-ready: established SME with clean conduct, current tax/super, improving profitability and a contract-supported working-capital need.',
        specialist: 'Not the natural first path unless valuation, servicing or documentation creates an issue.',
        angle: 'Established 7-year electrical contractor seeking to refinance existing business debt and fund contract-backed working capital. Trading has improved year-on-year, conduct is clean, ATO/SG are current, and the request is supported by first mortgage security. Key conditions are valuation comfort and contract/use-of-funds evidence.',
      },
    },
  },

  'CF-002': {
    id: 'CF-002',
    tone: 'red',
    shortLabel: 'CF-002 · Red · ATO debt restructure',
    synthetic: true,
    followUpCase: {
      dealId: 'CF-002',
      dealName: 'Northside Hospitality Group — ATO Debt Restructure',
      currentRating: 'Red — Rework First / specialist-private path only',
      scenario: 'ATO debt restructure with missed payment plan, SG uncertainty, dishonours, MCA and high-LVR second mortgage',
      triggers: ['ato_debt', 'missed_ato_plan', 'sg_unevidenced', 'dishonours_recent', 'mca_present', 'high_lvr_second_mortgage', 'working_capital_vague'],
    },
    intake: {
      dealName: 'Northside Hospitality Group — ATO Debt Restructure',
      scenario: 'ATO debt restructure with missed payment plan, SG uncertainty, dishonours, MCA and high-LVR second mortgage',
      dealType: 'ato_debt',
      borrowerType: 'company',
      borrower: 'Northside Hospitality Group Pty Ltd — company trading two cafés; 5 years trading; hospitality / cafés',
      loanAmount: 420000,
      purpose: 'Clear ATO debt $310,000; $110,000 working capital',
      security: 'Second mortgage over director’s residential property (existing home loan $790,000)',
      securityValue: 1250000,
      totalSecuredDebt: 1210000,
      income: 'FY24 revenue $1.72m / NPAT $42k loss; FY25 revenue $1.95m / NPAT $86k profit; addbacks: director wages $95k, depreciation $18k',
      existingDebts: 'Equipment finance $4,800/month; merchant cash advance $6,200/month; ATO integrated client account $310,000',
      conduct: 'ATO plan entered 4 months ago, one missed instalment 2 months ago (now caught up); BAS current but two late lodgements in FY25; SG current according to director, no evidence; 3 dishonours in last 6 months, all under $2,000',
      documents: 'FY24/FY25 financials, ATO balance screenshot, 3 months bank statements',
      urgency: 'Director says ATO may cancel payment plan if lump sum not paid',
      deferralReason: '',
    },
    assumptions: [
      'Property value ($1.25m) is an estimate, not a formal valuation.',
      'LVR is calculated before costs and fees.',
      'SG status is as reported by the director and is unverified.',
      'Director wage addback is shown gross; after-tax treatment is not yet known.',
    ],
    judgement: {
      source: 'deal-coaching-report-sample-CF-002-v0.1.md (2026-08-15)',
      calibratedConfidence: 'Medium',
      oneLineView: 'Not a mainstream lender-ready refinance: a distressed statutory-debt restructure with weak conduct signs and very tight second-mortgage security. Only worth progressing if the ATO/SG position, cash-flow recovery, MCA treatment and a credible private-lender security path are proven.',
      nextStep: 'Do not submit to a mainstream lender yet: collect the critical evidence pack and test private-lender feasibility first; rework or pause if the evidence does not support a credible turnaround and exit.',
      dimensions: [
        { dimension: 'Purpose', rating: 'Amber / Red', note: 'Understandable, but the $110k working capital is not yet specific enough.' },
        { dimension: 'Capacity', rating: 'Red', note: 'Unproven after MCA and tax/addback reality.' },
        { dimension: 'Conduct', rating: 'Red', note: 'Missed ATO plan instalment, dishonours, late BAS.' },
        { dimension: 'Compliance', rating: 'Red', note: 'Red until SG and ATO evidence is provided.' },
        { dimension: 'Security', rating: 'Red', note: 'Second mortgage at ~96.8% total LVR before costs.' },
        { dimension: 'Structure', rating: 'Red / Amber', note: 'May need a restructure, not a simple refinance; MCA treatment unclear.' },
        { dimension: 'Management', rating: 'Amber / Red', note: 'Turnaround story needs evidence.' },
        { dimension: 'Exit', rating: 'Red', note: 'Not yet credible.' },
      ],
      risks: [
        { risk: 'ATO debt $310k', why: 'Material statutory/compliance pressure.', mitigant: 'Payment plan reportedly caught up.', status: 'Unresolved — needs full ATO evidence' },
        { risk: 'Missed ATO instalment', why: 'Signals cash-flow stress / plan risk.', mitigant: 'Caught up after missed payment.', status: 'Unresolved — need amount, reason, remediation' },
        { risk: 'SG unevidenced', why: 'Unpaid super would materially worsen the file.', mitigant: 'Director says current.', status: 'Unresolved — evidence required' },
        { risk: '96.8% total LVR second mortgage', why: 'Security likely near-fatal under normal settings.', mitigant: 'Property security exists.', status: 'Weak — private-lender appetite required' },
        { risk: '3 dishonours', why: 'Conduct concern.', mitigant: 'All under $2,000.', status: 'Still negative — need statement review' },
        { risk: 'MCA $6.2k/month', why: 'Expensive cash-flow pressure.', mitigant: 'May be paid out / restructured.', status: 'Unknown — MCA details required' },
        { risk: 'Vague working capital', why: 'Could be plugging losses.', mitigant: '$110k requested.', status: 'Unresolved — use-of-funds breakdown required' },
        { risk: 'Hospitality volatility', why: 'Higher trading / cash-flow risk.', mitigant: 'FY25 returned to profit.', status: 'Partial mitigant — needs current trading proof' },
      ],
      missingEvidence: {
        critical: [
          { item: 'Full ATO integrated client account and payment-plan letter', impact: 'Cannot tell whether ATO debt is a contained refinance issue or a recurring compliance problem.', ifWeak: 'Rating likely remains Red; mainstream submission should not proceed.' },
          { item: 'Missed ATO instalment context (amount, due date, reason, plan tolerance, catch-up, other defaults)', impact: 'Determines whether the missed payment is explainable or evidence of ongoing cash-flow failure.', ifWeak: 'Specialist/private only, and potentially no lender-ready path.' },
          { item: 'SG payment / clearing-house evidence', impact: 'Cannot assess payroll compliance.', ifWeak: 'Material deterioration; file may need accountant-led remediation before any lender approach.' },
          { item: '6–12 months business bank statements', impact: 'Cannot assess real conduct, surplus, dishonour trend or post-plan cash-flow quality.', ifWeak: 'Rating remains Red; no credible packaging narrative.' },
          { item: 'Merchant cash advance agreement, balance, payout and repayment burden', impact: 'Cannot assess true monthly commitments or whether the refinance improves cash flow.', ifWeak: 'Structure may be wrong or under-sized.' },
          { item: 'Full debt schedule', impact: 'Cannot assess total commitments and refinance benefit.', ifWeak: 'Servicing and structure cannot be relied on.' },
          { item: 'Cash-flow forecast after refinance', impact: 'Cannot show capacity to service proposed debt and stay current with tax/payroll obligations.', ifWeak: 'Refinance may be unsuitable from a lender-readiness perspective.' },
          { item: '$110,000 working-capital breakdown', impact: 'Cannot prove funds are productive rather than covering a recurring shortfall.', ifWeak: 'Reduce request, re-scope structure, or pause submission.' },
          { item: 'Director wage / addback after-tax treatment', impact: 'Cannot rely on gross wage addback for servicing.', ifWeak: 'Capacity may be overstated.' },
          { item: 'Private-lender feasibility for second mortgage / high LVR', impact: 'Cannot tell whether the security structure has any realistic path.', ifWeak: 'Deal may have no realistic secured-lending route.' },
        ],
        important: [
          { item: 'Accountant note on FY24 loss, FY25 recovery and current turnaround actions', impact: 'Supports or undermines the turnaround narrative.' },
          { item: 'Lease terms for both cafés (rent, expiry, options, arrears)', impact: 'Occupancy cost and continuity risk.' },
          { item: 'Aged creditors/debtors', impact: 'Liquidity stress and supplier arrears.' },
          { item: 'Director personal asset/liability statement', impact: 'Guarantor strength and fallback.' },
          { item: 'Evidence of current trading improvement', impact: 'Tests whether FY25 recovery is continuing.' },
        ],
        helpful: ['Management explanation of operational changes', 'Updated YTD management accounts', 'Supplier/payment arrangements', 'Evidence of reduced MCA reliance or improved cash balance'],
      },
      packaging: {
        mainstream: 'Not ready: ATO debt, missed payment plan, dishonours, SG uncertainty, MCA pressure and high-LVR second-mortgage security are unresolved.',
        specialist: 'Possible only if evidence supports it: specific appetite for a second mortgage at very high total LVR, clear pricing and cost disclosure, a credible exit, verified ATO/SG position and post-restructure cash-flow capacity.',
        angle: 'Five-year café group with FY25 return to profit after FY24 loss, seeking a controlled statutory-debt restructure and working-capital reset. ATO position is verified, SG is current, MCA treatment is clear, and cash-flow forecast shows capacity after restructure. Deal remains specialist due to conduct history and security leverage. (Usable only if evidence supports every part of it.)',
      },
    },
  },

  'CF-004': {
    id: 'CF-004',
    tone: 'amber',
    shortLabel: 'CF-004 · Amber · Commercial property / WALE',
    synthetic: true,
    followUpCase: {
      dealId: 'CF-004',
      dealName: 'Precision Parts — Commercial Property Purchase',
      currentRating: 'Amber — Package Better',
      scenario: 'Commercial warehouse purchase with external tenant, short WALE and missing property due diligence',
      triggers: ['valuation_sensitive', 'short_wale', 'zoning_environmental_missing', 'related_party_security'],
    },
    intake: {
      dealName: 'Precision Parts — Commercial Property Purchase',
      scenario: 'Commercial warehouse purchase with external tenant, short WALE and missing property due diligence',
      dealType: 'commercial_property',
      borrowerType: 'company',
      borrower: 'Precision Parts Pty Ltd — 11 years trading; light manufacturing / parts distribution',
      loanAmount: 1295000,
      purpose: 'Buy industrial warehouse (metro fringe) currently used by borrower (55% floor area) and one external tenant (45%); external lease 14 months remaining, no option documented',
      security: 'Industrial warehouse being purchased; purchase price $1,850,000',
      securityValue: 1850000,
      totalSecuredDebt: 1295000,
      income: 'FY24 revenue $3.8m; FY25 revenue $4.1m; FY25 adjusted EBITDA $510,000; external passing rent $82,000 p.a.; borrower currently pays $96,000 p.a. rent elsewhere',
      existingDebts: 'Equipment finance $9,500/month',
      conduct: 'ATO / super current; bank conduct clean',
      documents: 'Contract of sale, FY24/FY25 financials, rent roll summary, 3 months bank statements (missing: full lease, valuation, environmental report, zoning certificate)',
      urgency: 'Not stated',
      deferralReason: '',
    },
    assumptions: [
      'Security value uses the purchase price ($1.85m), not an independent valuation.',
      'LVR is calculated before costs and fees.',
      'External lease terms are taken from the rent roll summary; the full lease has not been sighted.',
      'Rent saving and rental income treatment in servicing is not yet confirmed against lender policy.',
    ],
    judgement: {
      source: 'deal-coaching-report-sample-CF-004-amber-v0.1.md (2026-08-15)',
      calibratedConfidence: 'Medium',
      oneLineView: 'Credible owner-occupier commercial property purchase with reasonable leverage, strong trading history and clean conduct — not yet package-ready because property-side evidence (short WALE, lease quality, valuation, zoning and environmental comfort) carries real credit impact.',
      nextStep: 'Collect the property due-diligence pack and build servicing sensitivity (with and without external rent) before final lender selection.',
      dimensions: [
        { dimension: 'Purpose', rating: 'Green / Amber', note: 'Credible; depends on property suitability and lease evidence.' },
        { dimension: 'Capacity', rating: 'Amber', note: 'May be workable if servicing holds under correct assumptions and vacancy sensitivity.' },
        { dimension: 'Conduct', rating: 'Green', note: 'Clean bank conduct.' },
        { dimension: 'Compliance', rating: 'Green', note: 'ATO and super current.' },
        { dimension: 'Security', rating: 'Amber', note: '70% LVR is not the whole story: valuation, marketability, zoning and environmental exposure drive comfort.' },
        { dimension: 'Structure', rating: 'Amber', note: 'Borrower entity, property-owning entity and any related-party lease need confirmation.' },
        { dimension: 'Management', rating: 'Green', note: '11 years trading, clean conduct, current tax/super.' },
        { dimension: 'Exit', rating: 'Amber', note: 'Fallback quality depends on valuation, location, zoning and marketability.' },
      ],
      risks: [
        { risk: 'Short WALE — 14 months', why: 'External rent may not continue.', mitigant: 'Borrower occupies 55%; rent saving exists.', status: 'Partial — full lease and sensitivity required' },
        { risk: 'Valuation risk', why: 'Purchase price may not equal bank value.', mitigant: '70% starting LVR.', status: 'Unresolved — valuation required' },
        { risk: 'Zoning / permitted use', why: 'Affects business use and security.', mitigant: 'Industrial warehouse use appears aligned.', status: 'Unresolved — zoning certificate required' },
        { risk: 'Environmental risk', why: 'Industrial use may create lender/security concern.', mitigant: 'No issue provided.', status: 'Unresolved — environmental check required' },
        { risk: 'Rent-saving treatment', why: 'Could be double-counted.', mitigant: 'Current rent saving is a real cash-flow benefit.', status: 'Needs lender-policy treatment' },
        { risk: 'External tenant quality', why: 'Rent roll summary is insufficient.', mitigant: '$82k passing rent.', status: 'Full lease / payment history required' },
      ],
      missingEvidence: {
        critical: [
          { item: 'Independent valuation', impact: 'Confirms LVR, security value, marketability and whether the purchase price is supported.', ifWeak: 'Lender selection, loan amount or equity contribution may need adjustment.' },
          { item: 'Full executed external lease and tenant payment history', impact: 'Cannot assess rental income reliability, expiry risk, options, arrears or outgoings recovery.', ifWeak: 'Treat external rent cautiously; servicing may need to stand without it.' },
          { item: 'Zoning certificate / permitted-use confirmation', impact: 'Confirms the borrower can operate from the property and that security is not impaired by use restrictions.', ifWeak: 'Property may be unsuitable or require specialist lender / legal review.' },
          { item: 'Environmental risk check', impact: 'Industrial property may carry contamination or environmental liability risk that affects security and lender appetite.', ifWeak: 'Lender may require further due diligence or remediation evidence, or may be unwilling to rely on the security.' },
          { item: 'Updated debt schedule', impact: 'Confirms total liabilities, equipment finance burden and servicing assumptions.', ifWeak: 'Capacity cannot be finalised.' },
        ],
        important: [
          { item: 'Outgoings schedule', impact: 'Confirms net rent and ownership cost.' },
          { item: 'Insurance details', impact: 'Confirms security protection.' },
          { item: 'Related-party lease (if borrower occupies via a separate property entity)', impact: 'Structure and enforceability.' },
          { item: 'Accountant-prepared cash-flow forecast after purchase', impact: 'Servicing resilience.' },
          { item: 'Director / guarantor A&L', impact: 'Guarantor strength.' },
        ],
        helpful: ['Business overview and customer concentration summary', 'Photos / property summary', 'Succinct management background'],
      },
      packaging: {
        mainstream: 'Potentially suitable after evidence is completed: stable trading business acquiring its operating premises with partial third-party rental income, clean conduct and current tax/super.',
        specialist: 'Not the natural first path unless valuation, zoning/environmental issues or servicing weakness emerges.',
        angle: 'Established 11-year light manufacturing / parts distribution business seeking to acquire its trading premises at 70% LVR. Borrower has clean conduct, current ATO/super and FY25 adjusted EBITDA of $510k. The transaction benefits from owner-occupation and rent-saving logic, with external tenant income as support. Key conditions are valuation, lease/WALE review, zoning and environmental comfort.',
      },
    },
  },
});

export const CASE_ORDER = Object.freeze(['CF-001', 'CF-002', 'CF-004']);

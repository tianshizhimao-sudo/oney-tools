/* =========================================================
   Macquarie Policy Check — schema-driven diagnostic
   Public consumer-facing policy fit signal for Macquarie Bank.
   General information only; not an approval prediction.
   ========================================================= */

import {
  toNumber,
  calcLVR,
  calcDTI,
  formatCurrency,
  formatPercent,
  formatRatio,
} from '../core/finance-math.js';

const POLICY = {
  source: 'Macquarie Broker Credit Guidelines v13.1 · public PDF · Policy Radar dataset verified 23 Mar 2026',
  minLoan: 150000,
  maxExposure: 10000000,
  minSurplusPa: 500,
  assessmentFloorPct: 5.30,
  assessmentBufferPct: 3.00,
  dtiMax: 8,
  dtiLvrTrigger: 6,
  lvr: {
    oo_pi: 0.95,
    oo_io: 0.80,
    inv_pi: 0.90,
    inv_io: 0.80,
    refinance: 0.90,
    construction: 0.90,
    equity_release: 0.80,
  },
};

function pct(n, digits = 0) {
  if (n === null || n === undefined) return '—';
  return formatPercent(n * 100, { fractionDigits: digits });
}

function choiceLabel(map, value) {
  return map[value] || value || '—';
}

const loanTypeLabels = {
  oo_pi: 'Owner occupied P&I',
  oo_io: 'Owner occupied interest only',
  inv_pi: 'Investment P&I',
  inv_io: 'Investment interest only',
  refinance: 'Refinance',
  construction: 'Construction',
  equity_release: 'Equity release',
};

function baseLvrCap(values) {
  return POLICY.lvr[values.loanType] ?? POLICY.lvr.oo_pi;
}

function effectiveLvrCap(values) {
  let cap = baseLvrCap(values);
  const reasons = [];

  const dti = calcDTI({ totalDebt: values.totalDebt, grossAnnualIncome: values.grossIncome });
  if (dti > POLICY.dtiLvrTrigger) {
    cap = Math.min(cap, 0.80);
    reasons.push('DTI above 6× caps the scenario around 80% LVR.');
  }

  if (values.loanType === 'oo_io' || values.loanType === 'inv_io') {
    cap = Math.min(cap, 0.80);
    reasons.push('Any interest-only portion generally caps LVR around 80%.');
  }

  if (values.propertyType === 'high_density') {
    const hdCap = values.loanType === 'oo_io' || values.loanType === 'inv_io' ? 0.70 : 0.80;
    cap = Math.min(cap, hdCap);
    reasons.push(`High-density apartment policy reduces max LVR to around ${pct(hdCap)}${hdCap === 0.70 ? ' when IO is involved' : ''}.`);
  }

  if (values.propertyType === 'valuation_risk') {
    cap = Math.min(cap, 0.75);
    reasons.push('Valuation or marketability red flags may cap LVR around 75%.');
  }

  if (values.propertyType === 'land_4_10') {
    cap = Math.min(cap, 0.80);
    reasons.push('Residential acreage 4–10ha generally caps LVR around 80%.');
  }
  if (values.propertyType === 'land_10_20') {
    cap = Math.min(cap, 0.70);
    reasons.push('Residential acreage 10–20ha generally caps LVR around 70%.');
  }
  if (values.propertyType === 'land_20_40') {
    cap = Math.min(cap, 0.60);
    reasons.push('Residential acreage 20–40ha generally caps LVR around 60%.');
  }
  if (values.leasehold === 'yes') {
    cap = Math.min(cap, Math.max(0, cap - 0.10));
    reasons.push('Leasehold property may receive a 10% LVR haircut and needs enough remaining lease term.');
  }

  return { cap, reasons };
}

function classify(values) {
  const loan = toNumber(values.loanAmount);
  const propertyValue = toNumber(values.propertyValue);
  const lvr = calcLVR({ loanAmount: loan, securityValue: propertyValue });
  const dti = calcDTI({ totalDebt: values.totalDebt, grossAnnualIncome: values.grossIncome });
  const { cap, reasons: capReasons } = effectiveLvrCap(values);

  const fail = [];
  const warn = [];
  const pass = [];

  if (loan < POLICY.minLoan) fail.push(`Loan amount is below Macquarie's public minimum loan size of ${formatCurrency(POLICY.minLoan)}.`);
  if (loan > POLICY.maxExposure) warn.push(`Loan size is above the public max exposure reference of ${formatCurrency(POLICY.maxExposure)} — this needs direct policy confirmation.`);

  if (['tax_liability', 'working_capital', 'business_over_50', 'vendor_finance', 'shared_equity', 'second_mortgage', 'development_over_2'].includes(values.purpose)) {
    fail.push('The stated purpose is listed as unavailable or not Macquarie-first in the public policy dataset.');
  }

  if (values.entity === 'company' || values.entity === 'trust') {
    fail.push('Company/trust borrower scenarios require current Macquarie broker-channel confirmation and should not be treated as Macquarie-first based on public Policy Radar data.');
  }
  if (values.entity === 'smsf') fail.push('SMSF lending is not shown as available in the Macquarie residential policy dataset.');
  if (values.entity === 'non_resident') warn.push('Non-resident / temporary resident policy is not confirmed in the public dataset. Treat as manual-policy-check required.');

  if (values.propertyType === 'serviced' || values.propertyType === 'student') fail.push('Serviced apartments / student accommodation are not a Macquarie-first security type in this dataset.');
  if (values.propertyType === 'mixed_use') fail.push('Mixed commercial/residential property is not shown as acceptable under the residential dataset.');
  if (values.propertyType === 'land_over_40') fail.push('Residential acreage over 40ha is shown as unacceptable.');

  if (lvr && cap && lvr > cap) fail.push(`Scenario LVR is about ${formatPercent(lvr * 100, { fractionDigits: 1 })}, above the effective Macquarie cap of about ${pct(cap)} for these inputs.`);
  else if (lvr && cap && lvr > cap - 0.03) warn.push(`LVR is close to the effective cap (${formatPercent(lvr * 100, { fractionDigits: 1 })} vs ${pct(cap)}). Valuation or LMI outcome could change the answer.`);
  else if (lvr) pass.push(`LVR sits inside the indicative Macquarie cap (${formatPercent(lvr * 100, { fractionDigits: 1 })} vs ${pct(cap)}).`);

  capReasons.forEach((r) => warn.push(r));

  if (dti > POLICY.dtiMax) fail.push(`DTI is about ${formatRatio(dti)}, above the public Macquarie maximum reference of ${POLICY.dtiMax}×.`);
  else if (dti > POLICY.dtiLvrTrigger) warn.push(`DTI is about ${formatRatio(dti)}. Above 6× does not automatically kill the file, but it normally tightens LVR and scrutiny.`);
  else if (dti > 0) pass.push(`DTI is about ${formatRatio(dti)}, below the 6× policy trigger.`);

  if (values.incomeType === 'foreign') warn.push('Foreign income is not confirmed in the public Macquarie dataset; treat as manual-policy-check required.');
  if (values.incomeType === 'low_doc') fail.push('Alt-doc / low-doc is not available in the public Macquarie residential dataset.');
  if (values.incomeType === 'self_employed' && toNumber(values.selfEmpYears) < 2) fail.push('Self-employed income usually needs 2 years of evidence under the public policy dataset.');
  if (values.incomeType === 'payg_new' && values.sameIndustry !== 'yes') warn.push('New PAYG employment under 6 months is a watch point unless same-industry continuity/evidence is strong.');
  if (values.incomeType === 'bonus_commission') warn.push('Bonus/commission/non-essential overtime may be shaded, often around 80%, so serviceability can differ from your gross income.');
  if (values.incomeType === 'casual') pass.push('Casual income is shown as usable in the dataset, subject to evidence and consistency.');

  if (lvr > 0.85 && values.purpose === 'purchase') {
    if (values.genuineSavings !== 'yes' && values.genuineSavings !== 'equity') fail.push('Above 85% LVR, genuine savings/equity evidence is normally required. Gifts, FHOG and borrowed funds are not enough by themselves.');
    else pass.push('Genuine savings/equity position appears aligned for an above-85% LVR purchase.');
  }

  if (values.docsReady === 'weak') warn.push('Document readiness is weak. Macquarie is full-doc; missing payslips/financials/bank statements can turn a policy fit into a packaging problem.');
  if (values.docsReady === 'ready') pass.push('Document readiness looks broadly aligned for a first-pass Macquarie file.');

  let band = 'Likely Macquarie fit';
  if (fail.length) band = 'Not Macquarie-first';
  else if (warn.length >= 3 || dti > POLICY.dtiLvrTrigger || (lvr && cap && lvr > cap - 0.03)) band = 'Policy watch zone';

  return { band, lvr, dti, cap, fail, warn, pass };
}

function toneFor(band) {
  if (band === 'Not Macquarie-first') return 'fail';
  if (band === 'Policy watch zone') return 'warn';
  return 'pass';
}

export const macquariePolicyCheckConfig = {
  id: 'macquarie-policy-check',
  group: 'assess',
  title: 'Macquarie 能不能批我？',
  eyebrow: 'Policy Radar diagnostic',
  subtitle: 'A public, first-pass Macquarie policy-fit check for Australian home-loan scenarios — based on Policy Radar’s Macquarie dataset.',
  scenarioReady: true,
  urlAlias: {
    loan: 'loanAmount',
    value: 'propertyValue',
    income: 'grossIncome',
    debt: 'totalDebt',
  },
  defaults: {
    purpose: 'purchase',
    loanType: 'oo_pi',
    loanAmount: 800000,
    propertyValue: 1000000,
    grossIncome: 180000,
    totalDebt: 800000,
    entity: 'individual',
    incomeType: 'payg',
    sameIndustry: 'yes',
    selfEmpYears: 2,
    propertyType: 'standard',
    leasehold: 'no',
    genuineSavings: 'yes',
    docsReady: 'mostly',
  },
  steps: [
    {
      id: 'loan',
      title: 'Loan scenario',
      desc: 'Start with the deal shape. This checks published policy fit, not rate, borrowing capacity or final approval.',
      fields: [
        {
          id: 'purpose', label: 'Main purpose', type: 'select', required: true,
          options: [
            { value: 'purchase', label: 'Purchase' },
            { value: 'refinance', label: 'Refinance' },
            { value: 'construction', label: 'Construction' },
            { value: 'equity_release', label: 'Equity release / home improvements' },
            { value: 'business_under_50', label: 'Business purpose under 50%' },
            { value: 'business_over_50', label: 'Business purpose over 50%' },
            { value: 'tax_liability', label: 'Tax liabilities' },
            { value: 'working_capital', label: 'Working capital' },
            { value: 'vendor_finance', label: 'Vendor finance' },
            { value: 'shared_equity', label: 'Shared equity scheme' },
            { value: 'second_mortgage', label: 'Standalone second mortgage' },
            { value: 'development_over_2', label: 'Development finance over 2 dwellings' },
          ],
        },
        {
          id: 'loanType', label: 'Loan type', type: 'select', required: true,
          options: [
            { value: 'oo_pi', label: 'Owner occupied — P&I' },
            { value: 'oo_io', label: 'Owner occupied — interest only' },
            { value: 'inv_pi', label: 'Investment — P&I' },
            { value: 'inv_io', label: 'Investment — interest only' },
            { value: 'refinance', label: 'Refinance' },
            { value: 'construction', label: 'Construction' },
            { value: 'equity_release', label: 'Equity release' },
          ],
        },
        { id: 'loanAmount', label: 'Proposed loan amount', type: 'currency', required: true, min: 1 },
        { id: 'propertyValue', label: 'Property/security value', type: 'currency', required: true, min: 1 },
      ],
    },
    {
      id: 'borrower',
      title: 'Borrower and income',
      desc: 'This section catches the common Macquarie policy blockers: entity type, DTI, income type and documentation pathway.',
      fields: [
        {
          id: 'entity', label: 'Borrower type', type: 'choice',
          options: [
            { value: 'individual', label: 'Individual / joint individuals', desc: 'Standard PAYG or self-employed borrowers' },
            { value: 'company', label: 'Company', desc: 'Requires current broker-channel confirmation' },
            { value: 'trust', label: 'Trust', desc: 'Requires current broker-channel confirmation' },
            { value: 'smsf', label: 'SMSF', desc: 'Not shown as available' },
            { value: 'non_resident', label: 'Temporary / non-resident', desc: 'Manual policy check' },
          ],
        },
        { id: 'grossIncome', label: 'Gross annual income', type: 'currency', required: true, min: 1 },
        { id: 'totalDebt', label: 'Total debt after this loan', type: 'currency', required: true, help: 'Used only for a rough DTI signal.' },
        {
          id: 'incomeType', label: 'Main income type', type: 'select', required: true,
          options: [
            { value: 'payg', label: 'PAYG base salary' },
            { value: 'payg_new', label: 'PAYG — under 6 months in role' },
            { value: 'casual', label: 'Casual income' },
            { value: 'bonus_commission', label: 'Bonus / commission / non-essential overtime' },
            { value: 'self_employed', label: 'Self-employed' },
            { value: 'foreign', label: 'Foreign income' },
            { value: 'low_doc', label: 'Alt-doc / low-doc' },
          ],
        },
        { id: 'selfEmpYears', label: 'If self-employed: years of evidence', type: 'number', min: 0, max: 20 },
        {
          id: 'sameIndustry', label: 'If new PAYG: same industry?', type: 'select',
          options: [
            { value: 'yes', label: 'Yes / not relevant' },
            { value: 'no', label: 'No' },
          ],
        },
      ],
    },
    {
      id: 'security',
      title: 'Security and evidence',
      desc: 'A deal can look fine on headline LVR but fail because the security type or savings evidence changes the policy cap.',
      fields: [
        {
          id: 'propertyType', label: 'Property type / red flag', type: 'select', required: true,
          options: [
            { value: 'standard', label: 'Standard house / townhouse / apartment' },
            { value: 'high_density', label: 'High-density apartment' },
            { value: 'valuation_risk', label: 'Valuation / marketability red flag' },
            { value: 'serviced', label: 'Serviced apartment' },
            { value: 'student', label: 'Student accommodation' },
            { value: 'mixed_use', label: 'Mixed commercial/residential' },
            { value: 'land_4_10', label: 'Rural residential 4–10ha' },
            { value: 'land_10_20', label: 'Rural residential 10–20ha' },
            { value: 'land_20_40', label: 'Rural residential 20–40ha' },
            { value: 'land_over_40', label: 'Rural residential over 40ha' },
          ],
        },
        {
          id: 'leasehold', label: 'Leasehold property?', type: 'select',
          options: [
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes' },
          ],
        },
        {
          id: 'genuineSavings', label: 'Genuine savings / equity position', type: 'select',
          options: [
            { value: 'yes', label: '5%+ genuine savings held 3 months' },
            { value: 'equity', label: 'Equity in real estate' },
            { value: 'gift', label: 'Gift / FHOG / borrowed funds only' },
            { value: 'no', label: 'No clear evidence yet' },
          ],
        },
        {
          id: 'docsReady', label: 'Document readiness', type: 'choice',
          options: [
            { value: 'ready', label: 'Ready', desc: 'Payslips / financials / statements available' },
            { value: 'mostly', label: 'Mostly ready', desc: 'Some evidence still to tidy up' },
            { value: 'weak', label: 'Weak', desc: 'Missing key documents or inconsistent evidence' },
          ],
        },
      ],
    },
  ],
  resolveResult(values) {
    const result = classify(values);
    const tone = toneFor(result.band);
    const lvrGap = result.cap ? result.cap - result.lvr : 0;

    const insights = [
      {
        tone,
        text: result.band === 'Likely Macquarie fit'
          ? 'On the policy items checked here, this looks like a plausible Macquarie pathway. The next risk is serviceability, valuation, LMI and document evidence.'
          : result.band === 'Policy watch zone'
            ? 'This is not an automatic no, but there are enough policy watch points that you should package the file carefully before relying on Macquarie.'
            : 'This scenario is not Macquarie-first on the public policy checks. It may need a different lender pathway or a manual broker/lender policy check.',
      },
      ...result.fail.slice(0, 5).map((text) => ({ tone: 'fail', text })),
      ...result.warn.slice(0, 6).map((text) => ({ tone: 'warn', text })),
      ...result.pass.slice(0, 4).map((text) => ({ tone: 'pass', text })),
    ];

    return {
      heroLabel: 'Macquarie policy signal',
      heroValue: result.band,
      metrics: [
        { label: 'Scenario LVR', value: result.lvr ? formatPercent(result.lvr * 100, { fractionDigits: 1 }) : '—' },
        { label: 'Effective LVR cap', value: pct(result.cap) },
        { label: 'LVR headroom', value: result.lvr && result.cap ? formatPercent(lvrGap * 100, { fractionDigits: 1 }) : '—' },
        { label: 'Rough DTI', value: result.dti ? formatRatio(result.dti) : '—' },
        { label: 'Assessment buffer', value: `${POLICY.assessmentBufferPct.toFixed(2)}%` },
        { label: 'Loan type', value: choiceLabel(loanTypeLabels, values.loanType) },
      ],
      insights,
      narrative: `Based on ${POLICY.source}. This diagnostic checks headline Macquarie policy fit only: purpose, borrower/entity type, LVR caps, common modifiers, broad income/documentation pathway and selected security rules. It is general information only. It is not credit advice, not a recommendation, not an approval prediction and not a substitute for a full broker/lender assessment. Policy, pricing, LMI, valuation and serviceability can change the result.`,
      actions: [
        { label: 'Compare in Policy Radar', href: '/policy-radar.html' },
        { label: 'Run Mortgage Stress Check', href: '/mortgage-stress-check.html' },
        { label: 'Run Bank-Ready Score', href: '/bank-ready-score.html' },
      ],
    };
  },
};

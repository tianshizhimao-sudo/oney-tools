/* =========================================================
   Servicing — schema-driven config (Phase 3)
   Commercial servicing: LVR + ICR + DSCR + WALE indicator.
   Single engine for both free and (future) Pro modes.
   ========================================================= */

import {
  toNumber,
  calcMonthlyRepayment,
  calcInterestOnly,
  calcLVR,
  calcICR,
  calcDSCR,
  calcNOI,
  lvrCapFor,
  formatCurrency,
  statusBand,
} from '../core/finance-math.js';

const ICR_PASS = 1.50;
const ICR_WARN = 1.20;
const DSCR_PASS = 1.35;
const DSCR_WARN = 1.25;
const WALE_PASS = 5;
const WALE_WARN = 2;

const PROPERTY_TYPE_OPTIONS = [
  { value: 'commercial-office',     label: 'Commercial — Office',      desc: 'LVR cap ~65%' },
  { value: 'commercial-retail',     label: 'Commercial — Retail',      desc: 'LVR cap ~65%' },
  { value: 'commercial-industrial', label: 'Commercial — Industrial',  desc: 'LVR cap ~65%' },
  { value: 'specialised',           label: 'Specialised',              desc: 'LVR cap ~50%' },
  { value: 'rural',                 label: 'Rural',                    desc: 'LVR cap ~50%' },
];

export const servicingConfig = {
  id: 'servicing',
  group: 'analyse',
  title: 'Commercial Servicing',
  eyebrow: 'Analyse',
  subtitle: 'LVR, ICR, DSCR and WALE — the four numbers every commercial credit assessor checks first.',
  scenarioReady: true,
  proImport: true,
  urlAlias: {
    rent: 'grossAnnualRent', // commercial deals quote annual
    value: 'propertyValue',
  },
  defaults: {
    loanAmount: 2_000_000,
    rate: 7.25,
    termYears: 15,
    repaymentType: 'pi',
    propertyValue: 3_500_000,
    propertyType: 'commercial-office',
    grossAnnualRent: 280_000,
    annualOutgoings: 35_000,
    waleYears: 4.0,
  },
  steps: [
    {
      id: 'loan',
      title: 'Loan structure',
      fields: [
        { id: 'loanAmount', label: 'Loan amount', type: 'currency', required: true },
        { id: 'rate', label: 'Interest rate', type: 'percent', required: true, min: 0, max: 25 },
        { id: 'termYears', label: 'Loan term', type: 'number', suffix: 'years', required: true, min: 1, max: 30 },
        {
          id: 'repaymentType',
          label: 'Repayment type',
          type: 'choice',
          options: [
            { value: 'pi', label: 'Principal & Interest' },
            { value: 'io', label: 'Interest Only', desc: 'DSCR will be N/A' },
          ],
        },
      ],
    },
    {
      id: 'security',
      title: 'Security and income',
      fields: [
        { id: 'propertyValue', label: 'Property value', type: 'currency', required: true },
        { id: 'propertyType', label: 'Property type', type: 'select', required: true, options: PROPERTY_TYPE_OPTIONS },
        { id: 'grossAnnualRent', label: 'Gross annual rent', type: 'currency', required: true },
        { id: 'annualOutgoings', label: 'Annual outgoings', type: 'currency', help: 'Council, water, strata, insurance, mgmt' },
        { id: 'waleYears', label: 'WALE', type: 'number', suffix: 'years', step: 0.1, min: 0, max: 30, help: 'Weighted average lease expiry across tenants' },
      ],
    },
  ],
  resolveResult(values) {
    const loan = toNumber(values.loanAmount);
    const propertyValue = toNumber(values.propertyValue);
    const propertyType = values.propertyType;
    const isIO = values.repaymentType === 'io';

    const noi = calcNOI({
      grossAnnualRent: values.grossAnnualRent,
      annualOutgoings: values.annualOutgoings,
    });

    const annualInterest = loan * (toNumber(values.rate) / 100);
    const monthlyDebt = isIO
      ? calcInterestOnly({ principal: loan, annualRatePct: values.rate })
      : calcMonthlyRepayment({ principal: loan, annualRatePct: values.rate, termYears: values.termYears });
    const annualDebtService = monthlyDebt * 12;

    const lvr = calcLVR({ loanAmount: loan, securityValue: propertyValue });
    const icr = calcICR({ noi, annualInterest });
    const dscr = isIO ? null : calcDSCR({ noi, annualDebtService });
    const wale = toNumber(values.waleYears);
    const lvrCap = lvrCapFor(propertyType);

    const lvrStatus = lvr <= lvrCap ? 'pass' : (lvr <= lvrCap + 0.10 ? 'warn' : 'fail');
    const icrStatus = statusBand(icr, { passAbove: ICR_PASS, warnAbove: ICR_WARN, higherIsBetter: true });
    const dscrStatus = dscr === null ? 'info' : statusBand(dscr, { passAbove: DSCR_PASS, warnAbove: DSCR_WARN, higherIsBetter: true });
    const waleStatus = statusBand(wale, { passAbove: WALE_PASS, warnAbove: WALE_WARN, higherIsBetter: true });

    const insights = [];
    insights.push({
      tone: lvrStatus,
      text: `LVR ${(lvr * 100).toFixed(1)}% vs ${(lvrCap * 100).toFixed(0)}% cap for ${labelForType(propertyType)}.`,
    });
    insights.push({
      tone: icrStatus,
      text: `ICR ${icr.toFixed(2)}x — pass ≥ ${ICR_PASS}, warn ${ICR_WARN}–${ICR_PASS}, fail < ${ICR_WARN}.`,
    });
    if (dscr === null) {
      insights.push({ tone: 'info', text: 'DSCR is N/A on interest-only — assess on ICR and exit strategy.' });
    } else {
      insights.push({
        tone: dscrStatus,
        text: `DSCR ${dscr.toFixed(2)}x — pass ≥ ${DSCR_PASS}, warn ${DSCR_WARN}–${DSCR_PASS}, fail < ${DSCR_WARN}.`,
      });
    }
    insights.push({
      tone: waleStatus,
      text: `WALE ${wale.toFixed(1)}y — pass > ${WALE_PASS}y, warn ${WALE_WARN}–${WALE_PASS}y, fail < ${WALE_WARN}y.`,
    });
    if (wale > 0 && Number(values.termYears) > wale + 1) {
      insights.push({
        tone: 'warn',
        text: `Loan term (${values.termYears}y) exceeds WALE (${wale.toFixed(1)}y) by more than a year — refinance/expiry risk.`,
      });
    }

    const allPass = lvrStatus === 'pass' && icrStatus === 'pass' && (dscr === null || dscrStatus === 'pass') && waleStatus === 'pass';
    const anyFail = lvrStatus === 'fail' || icrStatus === 'fail' || dscrStatus === 'fail' || waleStatus === 'fail';
    const heroLabel = allPass ? 'Servicing — clean' : (anyFail ? 'Servicing — fail' : 'Servicing — borderline');

    return {
      heroLabel,
      heroValue: `LVR ${(lvr * 100).toFixed(1)}% · ICR ${icr.toFixed(2)}x${dscr === null ? '' : ` · DSCR ${dscr.toFixed(2)}x`}`,
      metrics: [
        { label: 'NOI', value: formatCurrency(noi) },
        { label: 'Annual debt service', value: formatCurrency(annualDebtService) },
        { label: 'Annual interest', value: formatCurrency(annualInterest) },
        { label: 'Loan / value', value: `${(lvr * 100).toFixed(1)}%` },
        { label: 'WALE', value: `${wale.toFixed(1)} yrs` },
        { label: 'LVR cap', value: `${(lvrCap * 100).toFixed(0)}%` },
      ],
      insights,
      actions: [
        { label: 'Security assessment', href: '/tools/security-assessment.html' },
        { label: 'Investment yield', href: '/tools/investment-yield.html' },
      ],
    };
  },
};

function labelForType(value) {
  const opt = PROPERTY_TYPE_OPTIONS.find((o) => o.value === value);
  return opt ? opt.label : value;
}

/* =========================================================
   Oney Pro Workspace — schema-driven config (Phase 3)
   Single shared dataset across borrower, loan, security, servicing,
   risk and credit summary. Same form-engine + result-engine + finance-math
   used by every free tool — Pro is just a multi-step composition.
   ========================================================= */

import {
  toNumber,
  calcMonthlyRepayment,
  calcInterestOnly,
  calcLVR,
  calcICR,
  calcDSCR,
  calcNOI,
  calcDTI,
  lvrCapFor,
  formatCurrency,
  statusBand,
} from '../core/finance-math.js';

const ICR_PASS = 1.50;
const ICR_WARN = 1.20;
const DSCR_PASS = 1.35;
const DSCR_WARN = 1.25;

export const proWorkspaceConfig = {
  id: 'oney-pro',
  group: 'pro',
  title: 'Oney Pro Workspace',
  eyebrow: 'Pro · Case workspace',
  subtitle: 'One shared dataset feeds borrower, loan, security, servicing, risk and the credit summary.',
  defaults: {
    /* borrower */
    borrowerName: '',
    entityType: 'company',
    industry: '',
    grossAnnualIncome: 250_000,
    /* loan */
    loanAmount: 2_000_000,
    rate: 7.25,
    termYears: 15,
    repaymentType: 'pi',
    purpose: 'investment',
    /* security */
    propertyClass: 'commercial-office',
    propertyValue: 3_500_000,
    /* servicing */
    grossAnnualRent: 280_000,
    annualOutgoings: 35_000,
    waleYears: 4.0,
    /* risk */
    characterNotes: '',
    capacityNotes: '',
    collateralNotes: '',
    mitigants: '',
    /* exit */
    exitStrategy: 'refinance',
  },
  steps: [
    {
      id: 'borrower',
      title: 'Borrower',
      desc: 'Who is borrowing and the income picture.',
      fields: [
        { id: 'borrowerName', label: 'Borrower name', type: 'text', required: true, placeholder: 'e.g. Acme Holdings Pty Ltd' },
        {
          id: 'entityType', label: 'Entity', type: 'choice', required: true,
          options: [
            { value: 'individual', label: 'Individual' },
            { value: 'company', label: 'Pty Ltd' },
            { value: 'trust', label: 'Trust' },
            { value: 'smsf', label: 'SMSF' },
          ],
        },
        { id: 'industry', label: 'Industry', type: 'text', placeholder: 'e.g. Wholesale, Healthcare' },
        { id: 'grossAnnualIncome', label: 'Borrower gross annual income', type: 'currency', help: 'Used for DTI proxy' },
      ],
    },
    {
      id: 'loan',
      title: 'Loan structure',
      fields: [
        { id: 'loanAmount', label: 'Loan amount', type: 'currency', required: true },
        { id: 'rate', label: 'Indicative rate', type: 'percent', required: true, min: 0, max: 25 },
        { id: 'termYears', label: 'Term', type: 'number', suffix: 'years', required: true, min: 1, max: 30 },
        {
          id: 'repaymentType', label: 'Repayment type', type: 'choice',
          options: [
            { value: 'pi', label: 'Principal & Interest' },
            { value: 'io', label: 'Interest Only' },
          ],
        },
        {
          id: 'purpose', label: 'Purpose', type: 'choice',
          options: [
            { value: 'investment', label: 'Investment' },
            { value: 'owner-occupied', label: 'Owner-occupied' },
            { value: 'refinance', label: 'Refinance' },
            { value: 'development', label: 'Development' },
          ],
        },
      ],
    },
    {
      id: 'security',
      title: 'Security',
      fields: [
        {
          id: 'propertyClass', label: 'Property class', type: 'select',
          options: [
            { value: 'residential-investment', label: 'Residential investment' },
            { value: 'commercial-office', label: 'Commercial — Office' },
            { value: 'commercial-retail', label: 'Commercial — Retail' },
            { value: 'commercial-industrial', label: 'Commercial — Industrial' },
            { value: 'specialised', label: 'Specialised' },
            { value: 'rural', label: 'Rural' },
            { value: 'development', label: 'Development site' },
          ],
        },
        { id: 'propertyValue', label: 'Property value', type: 'currency', required: true },
      ],
    },
    {
      id: 'servicing',
      title: 'Servicing',
      desc: 'Income and lease assumptions used for ICR/DSCR.',
      fields: [
        { id: 'grossAnnualRent', label: 'Gross annual rent', type: 'currency' },
        { id: 'annualOutgoings', label: 'Annual outgoings', type: 'currency' },
        { id: 'waleYears', label: 'WALE', type: 'number', suffix: 'years', step: 0.1, min: 0, max: 30 },
      ],
    },
    {
      id: 'risk',
      title: 'Risk — three Cs',
      desc: 'Free-text notes used in the credit summary narrative.',
      fields: [
        { id: 'characterNotes', label: 'Character', type: 'text', placeholder: 'Track record, integrity, conduct' },
        { id: 'capacityNotes', label: 'Capacity', type: 'text', placeholder: 'Income strength, surplus, stress' },
        { id: 'collateralNotes', label: 'Collateral', type: 'text', placeholder: 'LVR, marketability, fallback' },
        { id: 'mitigants', label: 'Mitigants', type: 'text', placeholder: 'Personal guarantees, cross-coll, conditions' },
        {
          id: 'exitStrategy', label: 'Exit strategy', type: 'choice',
          options: [
            { value: 'refinance', label: 'Refinance' },
            { value: 'sale', label: 'Sale of asset' },
            { value: 'amortisation', label: 'Amortisation' },
          ],
        },
      ],
    },
  ],

  /**
   * The Pro summary pulls every metric from the same finance-math.js
   * functions used by Servicing, Security Assessment, Borrowing Power,
   * and Repayments. There is intentionally no Pro-only formula here.
   */
  resolveResult(values) {
    const loan = toNumber(values.loanAmount);
    const propertyValue = toNumber(values.propertyValue);
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
    const cap = lvrCapFor(values.propertyClass);
    const icr = calcICR({ noi, annualInterest });
    const dscr = isIO ? null : calcDSCR({ noi, annualDebtService });
    const dti = calcDTI({ totalDebt: loan, grossAnnualIncome: values.grossAnnualIncome });

    const lvrStatus = lvr <= cap ? 'pass' : (lvr <= cap + 0.10 ? 'warn' : 'fail');
    const icrStatus = statusBand(icr, { passAbove: ICR_PASS, warnAbove: ICR_WARN, higherIsBetter: true });
    const dscrStatus = dscr === null ? 'info' : statusBand(dscr, { passAbove: DSCR_PASS, warnAbove: DSCR_WARN, higherIsBetter: true });

    const allPass = lvrStatus === 'pass' && icrStatus === 'pass' && (dscr === null || dscrStatus === 'pass');
    const anyFail = lvrStatus === 'fail' || icrStatus === 'fail' || dscrStatus === 'fail';
    const recommendation = allPass ? 'Recommend approval'
      : (anyFail ? 'Recommend decline / restructure' : 'Recommend approval with conditions');
    const tone = allPass ? 'pass' : (anyFail ? 'fail' : 'warn');

    const insights = [
      { tone: lvrStatus, text: `LVR ${(lvr * 100).toFixed(1)}% vs ${(cap * 100).toFixed(0)}% cap.` },
      { tone: icrStatus, text: `ICR ${icr.toFixed(2)}x.` },
      dscr === null
        ? { tone: 'info', text: 'IO loan — DSCR not assessed; rely on ICR + exit strategy.' }
        : { tone: dscrStatus, text: `DSCR ${dscr.toFixed(2)}x.` },
      { tone: 'info', text: `Borrower DTI proxy ${dti.toFixed(2)}x against gross income.` },
      { tone, text: `${recommendation}. Exit: ${values.exitStrategy}.` },
    ];

    const narrative = buildNarrative({ values, lvr, cap, icr, dscr, recommendation });

    return {
      heroLabel: `Credit summary — ${recommendation}`,
      heroValue: `LVR ${(lvr * 100).toFixed(1)}% · ICR ${icr.toFixed(2)}x${dscr === null ? '' : ` · DSCR ${dscr.toFixed(2)}x`}`,
      metrics: [
        { label: 'Borrower', value: values.borrowerName || '—' },
        { label: 'Loan amount', value: formatCurrency(loan) },
        { label: 'Property value', value: formatCurrency(propertyValue) },
        { label: 'NOI', value: formatCurrency(noi) },
        { label: 'Annual debt service', value: formatCurrency(annualDebtService) },
        { label: 'Term / type', value: `${values.termYears}y ${isIO ? 'IO' : 'P&I'}` },
      ],
      insights,
      narrative,
      actions: [
        { label: 'Open Servicing', href: '/tools/servicing.html' },
        { label: 'Open Security', href: '/tools/security-assessment.html' },
      ],
    };
  },
};

function buildNarrative({ values, lvr, cap, icr, dscr, recommendation }) {
  const lines = [
    `${values.borrowerName || 'The borrower'} (${values.entityType}) is seeking ${formatCurrency(values.loanAmount)} for ${values.purpose}.`,
    `Security: ${values.propertyClass} valued at ${formatCurrency(values.propertyValue)}, producing NOI of ${formatCurrency(calcNOI({ grossAnnualRent: values.grossAnnualRent, annualOutgoings: values.annualOutgoings }))}.`,
    `LVR sits at ${(lvr * 100).toFixed(1)}% against a ${(cap * 100).toFixed(0)}% policy cap; ICR ${icr.toFixed(2)}x` + (dscr === null ? ` (IO).` : `, DSCR ${dscr.toFixed(2)}x.`),
    values.characterNotes ? `Character: ${values.characterNotes}.` : null,
    values.capacityNotes ? `Capacity: ${values.capacityNotes}.` : null,
    values.collateralNotes ? `Collateral: ${values.collateralNotes}.` : null,
    values.mitigants ? `Mitigants: ${values.mitigants}.` : null,
    `Exit: ${values.exitStrategy}. ${recommendation}.`,
  ];
  return lines.filter(Boolean).join(' ');
}

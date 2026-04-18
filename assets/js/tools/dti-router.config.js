/* =========================================================
   DTI Router — schema-driven config (Phase 2)
   APRA-aligned DTI = total debt balances / gross annual income.
   Three lender pathways: bank-friendly / approaching limits / non-bank.
   ========================================================= */

import {
  toNumber,
  calcDTI,
  formatCurrency,
} from '../core/finance-math.js';

const DTI_BANK = 6.0;
const DTI_STRETCH = 7.0;

export const dtiRouterConfig = {
  id: 'dti-router',
  group: 'assess',
  title: 'DTI Router',
  eyebrow: 'Assess',
  subtitle: 'Find out whether bank or non-bank is the better path before you apply.',
  defaults: {
    grossSalary: 120000,
    otherIncome: 0,
    proposedLoan: 600000,
    existingMortgage: 0,
    creditCardLimits: 0,
    otherDebt: 0,
  },
  steps: [
    {
      id: 'income',
      title: 'Annual gross income',
      desc: 'Pre-tax income across all sources. Rental is shaded by 20% later if relevant.',
      fields: [
        { id: 'grossSalary', label: 'Gross salary', type: 'currency', required: true, suffix: 'p.a.' },
        { id: 'otherIncome', label: 'Other income', type: 'currency', suffix: 'p.a.', help: 'Bonus, dividends, distributions' },
      ],
    },
    {
      id: 'debt',
      title: 'Total debt exposure',
      desc: 'APRA counts the total of all debt balances, including the proposed new loan.',
      fields: [
        { id: 'proposedLoan', label: 'Proposed new loan', type: 'currency', required: true },
        { id: 'existingMortgage', label: 'Existing mortgage balance', type: 'currency' },
        { id: 'creditCardLimits', label: 'Credit card limits', type: 'currency', help: 'Limits, not current balances' },
        { id: 'otherDebt', label: 'Other debt balances', type: 'currency', help: 'Personal loans, BNPL, car loans' },
      ],
    },
  ],
  resolveResult(values) {
    const income = toNumber(values.grossSalary) + toNumber(values.otherIncome);
    const totalDebt = toNumber(values.proposedLoan)
      + toNumber(values.existingMortgage)
      + toNumber(values.creditCardLimits)
      + toNumber(values.otherDebt);

    const dti = calcDTI({ totalDebt, grossAnnualIncome: income });

    let band, tone, headline, recommendation, pathway;
    if (dti < DTI_BANK) {
      band = 'Within safe range';
      tone = 'pass';
      headline = 'Bank-friendly';
      pathway = 'Major bank pathway';
      recommendation = 'You sit inside major bank comfort zones. Lead with rate and feature negotiation.';
    } else if (dti <= DTI_STRETCH) {
      band = 'Approaching limits';
      tone = 'warn';
      headline = 'Stretched bank';
      pathway = 'Order matters — pick lenders strategically';
      recommendation = 'Some majors will tighten at this DTI. Approach DTI-flexible lenders first to avoid burning credit enquiries.';
    } else {
      band = 'Above major bank limits';
      tone = 'fail';
      headline = 'Non-bank pathway';
      pathway = 'Non-bank or specialist lender';
      recommendation = 'Most majors will decline at this DTI. Specialist or non-bank lenders are the realistic path.';
    }

    return {
      heroLabel: 'Your DTI',
      heroValue: `${dti.toFixed(2)}x`,
      metrics: [
        { label: 'Total income', value: formatCurrency(income) },
        { label: 'Total debt', value: formatCurrency(totalDebt) },
        { label: 'Pathway', value: headline },
        { label: 'Band', value: band },
      ],
      insights: [
        { tone, text: recommendation },
        { tone: 'info', text: `Bank-friendly is below ${DTI_BANK}x. Stretched is ${DTI_BANK}x to ${DTI_STRETCH}x. Above ${DTI_STRETCH}x typically means non-bank.` },
      ],
      actions: [
        { label: 'Borrowing power', href: '/tools/borrowing-power.html' },
        { label: 'Repayments', href: '/tools/repayments.html' },
      ],
    };
  },
};

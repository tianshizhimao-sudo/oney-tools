/* =========================================================
   Borrowing Power — schema-driven config (Phase 2)
   Indicative capacity from income, expenses and existing debt.
   Uses HEM-style monthly expense floor as a sanity check.
   ========================================================= */

import {
  toNumber,
  calcMonthlyRepayment,
  formatCurrency,
} from '../core/finance-math.js';

// Conservative monthly living expense baseline used when expenses are missing.
const HEM_FLOOR_PER_DEPENDANT = 600;
const HEM_BASE = 2200;
const ASSESSMENT_BUFFER_PCT = 3.0; // serviceability buffer added to the rate
const DEFAULT_TERM_YEARS = 30;

function monthlyHEM(dependants) {
  return HEM_BASE + HEM_FLOOR_PER_DEPENDANT * Math.max(0, toNumber(dependants));
}

function assessRate(rate) {
  return toNumber(rate) + ASSESSMENT_BUFFER_PCT;
}

/**
 * Reverse the standard P&I formula to find the principal a given monthly
 * repayment can support at the assessment rate over the term.
 */
function principalFromRepayment({ monthly, annualRatePct, termYears }) {
  const r = annualRatePct / 100 / 12;
  const n = termYears * 12;
  if (!monthly || !n) return 0;
  if (!r) return monthly * n;
  return (monthly * (1 - Math.pow(1 + r, -n))) / r;
}

export const borrowingPowerConfig = {
  id: 'borrowing-power',
  group: 'calculate',
  title: 'Borrowing Power',
  eyebrow: 'Calculate',
  subtitle: 'Indicative borrowing capacity from income, expenses and existing liabilities.',
  scenarioReady: true,
  defaults: {
    grossSalary: 120000,
    otherIncome: 0,
    rentalIncome: 0,
    livingExpenses: 0,
    dependants: 0,
    creditCardLimits: 0,
    otherDebtMonthly: 0,
    rate: 6.5,
  },
  steps: [
    {
      id: 'inputs',
      title: 'Income, expenses, and existing debt',
      desc: 'Entered annually. Living expenses are floored at HEM if blank.',
      fields: [
        { id: 'grossSalary', label: 'Gross salary', type: 'currency', required: true, suffix: 'p.a.' },
        { id: 'otherIncome', label: 'Other income', type: 'currency', suffix: 'p.a.' },
        { id: 'rentalIncome', label: 'Rental income', type: 'currency', suffix: 'p.a.', help: 'Lenders typically shade by 20–25%' },
        { id: 'livingExpenses', label: 'Living expenses', type: 'currency', suffix: 'monthly', help: 'Leave blank to use HEM floor' },
        { id: 'dependants', label: 'Dependants', type: 'number', min: 0, max: 10, step: 1 },
        { id: 'creditCardLimits', label: 'Credit card limits', type: 'currency', help: '3.8% per month assumed' },
        { id: 'otherDebtMonthly', label: 'Other debt repayments', type: 'currency', suffix: 'monthly' },
        { id: 'rate', label: 'Assumed home loan rate', type: 'percent', required: true, min: 0, max: 25, step: 0.05 },
      ],
    },
  ],
  resolveResult(values) {
    const grossAnnual = toNumber(values.grossSalary)
      + toNumber(values.otherIncome)
      + toNumber(values.rentalIncome) * 0.80; // 20% shading

    // Simple PAYG net-of-tax estimate (FY2024-25 brackets, no Medicare detail).
    const tax = estimateTax(grossAnnual);
    const netAnnual = Math.max(0, grossAnnual - tax);
    const netMonthly = netAnnual / 12;

    const expensesMonthly = Math.max(toNumber(values.livingExpenses), monthlyHEM(values.dependants));
    const ccCommitment = toNumber(values.creditCardLimits) * 0.038;
    const debtMonthly = ccCommitment + toNumber(values.otherDebtMonthly);

    const monthlySurplus = netMonthly - expensesMonthly - debtMonthly;
    const surplusForRepayment = Math.max(0, monthlySurplus);

    const assessRatePct = assessRate(values.rate);
    const principal = principalFromRepayment({
      monthly: surplusForRepayment,
      annualRatePct: assessRatePct,
      termYears: DEFAULT_TERM_YEARS,
    });

    const indicative = Math.max(0, principal);
    const conservative = indicative * 0.85;
    const optimistic = indicative * 1.10;

    const insights = [];
    if (monthlySurplus <= 0) {
      insights.push({ tone: 'fail', text: 'No surplus after expenses and existing debt — capacity is effectively zero.' });
    } else if (surplusForRepayment / netMonthly < 0.10) {
      insights.push({ tone: 'warn', text: 'Tight surplus relative to income — minor expense changes will swing capacity sharply.' });
    } else {
      insights.push({ tone: 'pass', text: `Estimated monthly surplus of ${formatCurrency(monthlySurplus)} available for a new loan.` });
    }
    insights.push({
      tone: 'info',
      text: `Assessed at ${assessRatePct.toFixed(2)}% (${ASSESSMENT_BUFFER_PCT}% buffer above your input rate) over ${DEFAULT_TERM_YEARS} years.`,
    });

    const monthly30y = calcMonthlyRepayment({
      principal: indicative,
      annualRatePct: values.rate,
      termYears: DEFAULT_TERM_YEARS,
    });

    return {
      heroLabel: 'Indicative borrowing capacity',
      heroValue: formatCurrency(indicative, { fractionDigits: 0 }),
      metrics: [
        { label: 'Conservative', value: formatCurrency(conservative) },
        { label: 'Optimistic', value: formatCurrency(optimistic) },
        { label: 'Net monthly income', value: formatCurrency(netMonthly) },
        { label: 'Monthly surplus', value: formatCurrency(monthlySurplus) },
        { label: 'Repayment at your rate', value: `${formatCurrency(monthly30y)}/mo` },
      ],
      insights,
      actions: [
        { label: 'Repayments calculator', href: '/tools/repayments.html' },
        { label: 'DTI router', href: '/tools/dti-router.html' },
      ],
    };
  },
};

/* ---------- Local: PAYG tax estimate (FY 2024-25 stage 3) ---------- */
function estimateTax(income) {
  const i = toNumber(income);
  if (i <= 18200) return 0;
  if (i <= 45000) return (i - 18200) * 0.16;
  if (i <= 135000) return 4288 + (i - 45000) * 0.30;
  if (i <= 190000) return 31288 + (i - 135000) * 0.37;
  return 51638 + (i - 190000) * 0.45;
}

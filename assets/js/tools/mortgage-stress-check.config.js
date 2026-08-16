/* =========================================================
   Mortgage Stress Check — schema-driven config
   Free diagnostic for repayment pressure + refinance space.
   General information only; does not assess credit approval.
   ========================================================= */

import {
  toNumber,
  calcMonthlyRepayment,
  formatCurrency,
  formatPercent,
} from '../core/finance-math.js';

function repaymentShare(monthlyRepayment, annualIncome) {
  const income = toNumber(annualIncome) / 12;
  if (!income) return 0;
  return toNumber(monthlyRepayment) / income;
}

function monthlySurplus(annualIncome, repayment, livingExpenses, otherDebt) {
  const income = toNumber(annualIncome) / 12;
  return income - toNumber(repayment) - toNumber(livingExpenses) - toNumber(otherDebt);
}

function band({ repaymentRatio, stressedRatio, surplus, stressedSurplus, monthlySaving, equitySpace, comfort }) {
  let score = 0;

  if (repaymentRatio >= 0.40) score += 3;
  else if (repaymentRatio >= 0.32) score += 2;
  else if (repaymentRatio >= 0.26) score += 1;

  if (stressedRatio >= 0.45) score += 3;
  else if (stressedRatio >= 0.38) score += 2;
  else if (stressedRatio >= 0.32) score += 1;

  if (stressedSurplus < 0) score += 3;
  else if (stressedSurplus < 750) score += 2;
  else if (stressedSurplus < 1500) score += 1;

  if (surplus < 0) score += 3;
  else if (surplus < 500) score += 2;
  else if (surplus < 1200) score += 1;

  if (monthlySaving > 250) score -= 1;
  if (equitySpace > 50000) score -= 1;
  if (comfort === 'tight') score += 2;
  if (comfort === 'missing') score += 3;

  if (score >= 7) return 'High stress signal';
  if (score >= 4) return 'Watch zone';
  return 'Manageable signal';
}

function toneFor(resultBand) {
  if (resultBand === 'High stress signal') return 'fail';
  if (resultBand === 'Watch zone') return 'warn';
  return 'pass';
}

export const mortgageStressCheckConfig = {
  id: 'mortgage-stress-check',
  group: 'assess',
  title: 'Mortgage Stress Check',
  eyebrow: 'Free diagnostic',
  subtitle: 'Check repayment pressure, rate-buffer stress and refinance space before you decide what to do next.',
  scenarioReady: true,
  urlAlias: {
    loan: 'balance',
    income: 'grossIncome',
    rate: 'currentRate',
    value: 'propertyValue',
  },
  defaults: {
    balance: 650000,
    propertyValue: 900000,
    currentRate: 6.35,
    remainingTerm: 27,
    currentMonthly: '',
    grossIncome: 160000,
    livingExpenses: 4200,
    otherDebtMonthly: 450,
    refinanceRate: 5.89,
    refinanceTerm: 30,
    comfort: 'tight',
  },
  steps: [
    {
      id: 'loan',
      title: 'Your current mortgage',
      desc: 'Use rough numbers if you are only doing a first-pass check.',
      fields: [
        { id: 'balance', label: 'Loan balance', type: 'currency', required: true },
        { id: 'propertyValue', label: 'Estimated property value', type: 'currency', required: true, help: 'Used only to estimate refinance/equity headroom.' },
        { id: 'currentRate', label: 'Current interest rate', type: 'percent', required: true, min: 0, max: 25 },
        { id: 'remainingTerm', label: 'Remaining loan term', type: 'number', suffix: 'years', required: true, min: 1, max: 40 },
        { id: 'currentMonthly', label: 'Current monthly repayment', type: 'currency', help: 'Optional. Leave blank and we will estimate it from balance, rate and term.' },
      ],
    },
    {
      id: 'household',
      title: 'Household pressure',
      desc: 'This is a pressure signal, not a full lender serviceability assessment.',
      fields: [
        { id: 'grossIncome', label: 'Gross household income', type: 'currency', suffix: 'per year', required: true },
        { id: 'livingExpenses', label: 'Living expenses', type: 'currency', suffix: 'per month', required: true },
        { id: 'otherDebtMonthly', label: 'Other debt repayments', type: 'currency', suffix: 'per month', help: 'Credit cards, personal loans, car loans, HECS estimate, etc.' },
        {
          id: 'comfort',
          label: 'How does the repayment feel right now?',
          type: 'choice',
          options: [
            { value: 'comfortable', label: 'Comfortable', desc: 'No real pressure' },
            { value: 'tight', label: 'Tight', desc: 'Manageable but noticeable' },
            { value: 'missing', label: 'Missing / at risk', desc: 'Already behind or close' },
          ],
        },
      ],
    },
    {
      id: 'refinance',
      title: 'Refinance space',
      desc: 'Compare against a realistic refinance rate. This does not mean a lender will approve it.',
      fields: [
        { id: 'refinanceRate', label: 'Possible refinance rate', type: 'percent', required: true, min: 0, max: 25 },
        { id: 'refinanceTerm', label: 'New refinance term', type: 'number', suffix: 'years', required: true, min: 1, max: 40 },
      ],
    },
  ],
  resolveResult(values) {
    const balance = toNumber(values.balance);
    const propertyValue = toNumber(values.propertyValue);
    const grossIncome = toNumber(values.grossIncome);
    const currentEstimated = calcMonthlyRepayment({
      principal: balance,
      annualRatePct: values.currentRate,
      termYears: values.remainingTerm,
    });
    const currentRepayment = toNumber(values.currentMonthly) || currentEstimated;
    const stressedRepayment = calcMonthlyRepayment({
      principal: balance,
      annualRatePct: toNumber(values.currentRate) + 3,
      termYears: values.remainingTerm,
    });
    const refinanceRepayment = calcMonthlyRepayment({
      principal: balance,
      annualRatePct: values.refinanceRate,
      termYears: values.refinanceTerm,
    });

    const monthlySaving = currentRepayment - refinanceRepayment;
    const stressGap = stressedRepayment - currentRepayment;
    const currentShare = repaymentShare(currentRepayment, grossIncome);
    const stressedShare = repaymentShare(stressedRepayment, grossIncome);
    const currentSurplus = monthlySurplus(grossIncome, currentRepayment, values.livingExpenses, values.otherDebtMonthly);
    const stressedSurplus = monthlySurplus(grossIncome, stressedRepayment, values.livingExpenses, values.otherDebtMonthly);
    const maxLoanAt80 = propertyValue * 0.8;
    const equitySpace = Math.max(0, maxLoanAt80 - balance);
    const currentLvr = propertyValue ? balance / propertyValue : 0;

    const resultBand = band({
      repaymentRatio: currentShare,
      stressedRatio: stressedShare,
      surplus: currentSurplus,
      stressedSurplus,
      monthlySaving,
      equitySpace,
      comfort: values.comfort,
    });

    const insights = [
      {
        tone: toneFor(resultBand),
        text: resultBand === 'High stress signal'
          ? 'Repayment pressure is elevated. The next step is not guessing rates — it is a full Financial Health Check to understand income, expenses, debts and lender fit.'
          : resultBand === 'Watch zone'
            ? 'You are not automatically in trouble, but the numbers deserve a proper recheck before relying on your current loan position.'
            : 'The first-pass signal looks manageable. Still, lender assessment can differ once debts, living expenses and buffers are applied.',
      },
    ];

    if (monthlySaving > 0) {
      insights.push({ tone: 'pass', text: `A lower-rate refinance could reduce repayments by about ${formatCurrency(monthlySaving)}/mo before switching costs and lender assessment.` });
    } else {
      insights.push({ tone: 'warn', text: 'The refinance scenario does not reduce monthly repayments. Check rate, term and switching costs before assuming refinancing helps.' });
    }

    if (equitySpace > 0) {
      insights.push({ tone: 'info', text: `At 80% LVR, rough refinance/equity headroom is about ${formatCurrency(equitySpace)}. Usable equity still depends on serviceability and lender policy.` });
    } else {
      insights.push({ tone: 'warn', text: 'At 80% LVR, there may be limited refinance headroom. This makes lender fit and valuation assumptions more important.' });
    }

    if (stressedSurplus < 0) {
      insights.push({ tone: 'fail', text: 'Under a 3% rate buffer, your rough monthly surplus turns negative. Treat this as a strong recheck signal.' });
    } else if (stressedSurplus < 750) {
      insights.push({ tone: 'warn', text: 'Under a 3% rate buffer, surplus is thin. A lender may ask harder questions about expenses, debts and repayment conduct.' });
    }

    return {
      heroLabel: 'Stress signal',
      heroValue: resultBand,
      metrics: [
        { label: 'Current repayment', value: `${formatCurrency(currentRepayment)}/mo` },
        { label: '3% buffer repayment', value: `${formatCurrency(stressedRepayment)}/mo` },
        { label: 'Stress gap', value: `${formatCurrency(stressGap)}/mo` },
        { label: 'Refi saving', value: `${formatCurrency(monthlySaving)}/mo` },
        { label: 'Current LVR', value: formatPercent(currentLvr * 100, { fractionDigits: 1 }) },
        { label: '80% LVR headroom', value: formatCurrency(equitySpace) },
      ],
      insights,
      narrative: 'This is a general-information diagnostic only. It estimates repayment pressure, rough buffer sensitivity and refinance space. It does not consider full lender policy, credit conduct, tax treatment, valuation outcome, comprehensive living expense benchmarks, or whether credit is suitable for you.',
      actions: [
        { label: 'Start Financial Health Check', href: 'https://fhc.oneyco.com.au' },
        { label: 'Check Bank-Ready Score', href: '/tools/bank-ready-score.html' },
        { label: 'Run Refinance Breakeven', href: '/tools/refinance-breakeven.html' },
      ],
    };
  },
};

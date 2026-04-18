/* =========================================================
   Refinance Breakeven — schema-driven config (Phase 2)
   Compares two repayment streams (current vs new) plus switching costs.
   Returns months until cumulative savings recover the switch cost.
   ========================================================= */

import {
  toNumber,
  calcMonthlyRepayment,
  calcInterestOnly,
  formatCurrency,
} from '../core/finance-math.js';

function monthlyFor(type, principal, rate, term) {
  if (type === 'io') return calcInterestOnly({ principal, annualRatePct: rate });
  return calcMonthlyRepayment({ principal, annualRatePct: rate, termYears: term });
}

export const refinanceBreakevenConfig = {
  id: 'refinance-breakeven',
  group: 'calculate',
  title: 'Refinance Breakeven',
  eyebrow: 'Calculate',
  subtitle: 'See how many months of savings it takes to recover the cost of switching.',
  scenarioReady: true,
  urlAlias: {
    // Refinance has two rates — be explicit so generic ?rate=… doesn't ambiguously resolve.
    rate: 'newRate',
    loan: 'balance',
    cost: 'switchCost',
  },
  defaults: {
    balance: 500000,
    currentRate: 6.50,
    currentTerm: 25,
    currentType: 'pi',
    newRate: 5.99,
    newTerm: 30,
    newType: 'pi',
    switchCost: 850,
  },
  steps: [
    {
      id: 'current',
      title: 'Current loan',
      fields: [
        { id: 'balance', label: 'Outstanding balance', type: 'currency', required: true },
        { id: 'currentRate', label: 'Current rate', type: 'percent', required: true, min: 0, max: 25 },
        { id: 'currentTerm', label: 'Remaining term', type: 'number', suffix: 'years', required: true, min: 1, max: 40 },
        {
          id: 'currentType',
          label: 'Repayment type',
          type: 'choice',
          options: [
            { value: 'pi', label: 'Principal & Interest' },
            { value: 'io', label: 'Interest Only' },
          ],
        },
      ],
    },
    {
      id: 'new',
      title: 'New loan',
      fields: [
        { id: 'newRate', label: 'New rate', type: 'percent', required: true, min: 0, max: 25 },
        { id: 'newTerm', label: 'New term', type: 'number', suffix: 'years', required: true, min: 1, max: 40 },
        {
          id: 'newType',
          label: 'Repayment type',
          type: 'choice',
          options: [
            { value: 'pi', label: 'Principal & Interest' },
            { value: 'io', label: 'Interest Only' },
          ],
        },
        { id: 'switchCost', label: 'Total switching cost', type: 'currency', help: 'Discharge + break + government + new lender + valuation + legal' },
      ],
    },
  ],
  resolveResult(values) {
    const principal = toNumber(values.balance);
    const currentMonthly = monthlyFor(values.currentType, principal, values.currentRate, values.currentTerm);
    const newMonthly = monthlyFor(values.newType, principal, values.newRate, values.newTerm);
    const monthlySaving = currentMonthly - newMonthly;
    const switchCost = toNumber(values.switchCost);

    const breakevenMonths = monthlySaving > 0 ? switchCost / monthlySaving : Infinity;
    const breakevenYears = breakevenMonths / 12;

    const insights = [];
    if (monthlySaving <= 0) {
      insights.push({ tone: 'fail', text: 'New loan costs the same or more per month — refinancing does not pay back at any horizon.' });
    } else if (breakevenMonths > 60) {
      insights.push({ tone: 'warn', text: 'Breakeven is over 5 years. Only worth refinancing if you plan to hold the loan well past that.' });
    } else if (breakevenMonths > 24) {
      insights.push({ tone: 'warn', text: 'Breakeven is 2–5 years. Reasonable if you intend to keep the loan that long.' });
    } else {
      insights.push({ tone: 'pass', text: 'Breakeven inside 2 years — strong refinance signal.' });
    }

    if (toNumber(values.newTerm) > toNumber(values.currentTerm)) {
      insights.push({
        tone: 'info',
        text: `New term (${values.newTerm}y) is longer than the remaining current term (${values.currentTerm}y) — total interest will rise even if the monthly drops.`,
      });
    }

    const heroValue = monthlySaving <= 0
      ? 'Never'
      : (breakevenMonths >= 12
          ? `${breakevenYears.toFixed(1)} years`
          : `${Math.ceil(breakevenMonths)} months`);

    return {
      heroLabel: 'Breakeven',
      heroValue,
      metrics: [
        { label: 'Current repayment', value: `${formatCurrency(currentMonthly)}/mo` },
        { label: 'New repayment', value: `${formatCurrency(newMonthly)}/mo` },
        { label: 'Monthly saving', value: `${formatCurrency(monthlySaving)}/mo` },
        { label: 'Switching cost', value: formatCurrency(switchCost) },
      ],
      insights,
      actions: [
        { label: 'Repayments', href: '/tools/repayments.html' },
        { label: 'Investment yield', href: '/tools/investment-yield.html' },
      ],
    };
  },
};

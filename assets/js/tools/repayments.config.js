/* =========================================================
   Repayments — schema-driven config (Phase 2)
   Single-step calculator. Live-updates as inputs change.
   All math goes through finance-math.js.
   ========================================================= */

import {
  calcMonthlyRepayment,
  calcInterestOnly,
  calcTotalInterest,
  formatCurrency,
} from '../core/finance-math.js';

export const repaymentsConfig = {
  id: 'repayments',
  group: 'calculate',
  title: 'Repayments',
  eyebrow: 'Calculate',
  subtitle: 'Fast monthly repayment estimates with a shared math engine.',
  scenarioReady: true,
  defaults: {
    loanAmount: 500000,
    rate: 6.0,
    termYears: 30,
    repaymentType: 'pi',
  },
  steps: [
    {
      id: 'loan',
      title: 'Loan details',
      fields: [
        { id: 'loanAmount', label: 'Loan amount', type: 'currency', required: true, min: 0, step: 1000 },
        { id: 'rate', label: 'Interest rate', type: 'percent', required: true, min: 0, max: 25, step: 0.05 },
        { id: 'termYears', label: 'Term', type: 'number', suffix: 'years', required: true, min: 1, max: 40, step: 1 },
        {
          id: 'repaymentType',
          label: 'Repayment type',
          type: 'choice',
          options: [
            { value: 'pi', label: 'Principal & Interest', desc: 'Standard amortising loan' },
            { value: 'io', label: 'Interest Only', desc: 'Lower monthly, no principal' },
          ],
        },
      ],
    },
  ],
  resolveResult(values) {
    const isIO = values.repaymentType === 'io';
    const monthly = isIO
      ? calcInterestOnly({ principal: values.loanAmount, annualRatePct: values.rate })
      : calcMonthlyRepayment({
          principal: values.loanAmount,
          annualRatePct: values.rate,
          termYears: values.termYears,
        });
    const totalInterest = isIO
      ? calcInterestOnly({ principal: values.loanAmount, annualRatePct: values.rate }) * 12 * Number(values.termYears || 0)
      : calcTotalInterest({
          principal: values.loanAmount,
          annualRatePct: values.rate,
          termYears: values.termYears,
        });
    const totalRepaid = monthly * 12 * Number(values.termYears || 0);

    const insights = [];
    if (isIO) {
      insights.push({
        tone: 'warn',
        text: 'Interest-only loans cost more over the full term — principal is unchanged.',
      });
    }
    if (Number(values.rate) >= 8) {
      insights.push({
        tone: 'warn',
        text: 'Rate is unusually high — confirm against current bank pricing.',
      });
    }
    if (Number(values.loanAmount) > 0 && Number(values.rate) > 0) {
      insights.push({
        tone: 'info',
        text: `Over ${values.termYears} years you'll repay roughly ${formatCurrency(totalRepaid)} in total.`,
      });
    }

    return {
      heroLabel: isIO ? 'Interest-only repayment' : 'Monthly repayment',
      heroValue: `${formatCurrency(monthly, { fractionDigits: 0 })} / mo`,
      metrics: [
        { label: 'Loan amount', value: formatCurrency(values.loanAmount) },
        { label: 'Rate', value: `${Number(values.rate).toFixed(2)}%` },
        { label: 'Term', value: `${values.termYears} yrs` },
        { label: 'Total interest', value: formatCurrency(totalInterest) },
      ],
      insights,
      actions: [
        { label: 'Borrowing power', href: '/tools/borrowing-power.html' },
        { label: 'Refinance breakeven', href: '/tools/refinance-breakeven.html' },
      ],
    };
  },
};

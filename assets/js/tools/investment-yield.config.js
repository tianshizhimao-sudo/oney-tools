/* =========================================================
   Investment Yield — schema-driven config (Phase 2)
   Gross yield, net yield, and weekly cash flow.
   Slimmed from the legacy tool — keeps the core 80% of inputs.
   ========================================================= */

import {
  toNumber,
  calcMonthlyRepayment,
  calcInterestOnly,
  calcGrossYield,
  formatCurrency,
} from '../core/finance-math.js';

const WEEKS_PER_YEAR = 52;

export const investmentYieldConfig = {
  id: 'investment-yield',
  group: 'analyse',
  title: 'Investment Yield',
  eyebrow: 'Analyse',
  subtitle: 'Gross yield, net yield, and indicative weekly cash flow on a residential investment.',
  scenarioReady: true,
  proImport: true,
  urlAlias: {
    rent: 'weeklyRent', // weekly is the primary input; ?rent= is interpreted weekly
    deposit: 'depositPct',
  },
  defaults: {
    purchasePrice: 800000,
    weeklyRent: 550,
    depositPct: 20,
    rate: 6.20,
    termYears: 30,
    repaymentType: 'pi',
    purchaseCosts: 34000,
    annualHolding: 6000,
    mgmtPct: 7,
    vacancyPct: 3,
  },
  steps: [
    {
      id: 'property',
      title: 'Property and rent',
      fields: [
        { id: 'purchasePrice', label: 'Purchase price', type: 'currency', required: true },
        { id: 'weeklyRent', label: 'Weekly rent', type: 'currency', required: true },
        { id: 'purchaseCosts', label: 'Purchase costs', type: 'currency', help: 'Stamp duty + legal + inspection' },
      ],
    },
    {
      id: 'finance',
      title: 'Finance',
      fields: [
        { id: 'depositPct', label: 'Deposit', type: 'percent', required: true, min: 0, max: 100, step: 1 },
        { id: 'rate', label: 'Interest rate', type: 'percent', required: true, min: 0, max: 25 },
        { id: 'termYears', label: 'Loan term', type: 'number', suffix: 'years', required: true, min: 1, max: 40 },
        {
          id: 'repaymentType',
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
      id: 'holding',
      title: 'Holding costs',
      fields: [
        { id: 'annualHolding', label: 'Annual holding costs', type: 'currency', help: 'Council, water, strata, insurance, maintenance, land tax' },
        { id: 'mgmtPct', label: 'Property management', type: 'percent', min: 0, max: 15, step: 0.5 },
        { id: 'vacancyPct', label: 'Vacancy allowance', type: 'percent', min: 0, max: 30, step: 0.5 },
      ],
    },
  ],
  resolveResult(values) {
    const price = toNumber(values.purchasePrice);
    const weeklyRent = toNumber(values.weeklyRent);
    const annualRent = weeklyRent * WEEKS_PER_YEAR;
    const depositPct = toNumber(values.depositPct);
    const loan = price * (1 - depositPct / 100);
    const purchaseCosts = toNumber(values.purchaseCosts);
    const totalCashIn = price * (depositPct / 100) + purchaseCosts;

    const isIO = values.repaymentType === 'io';
    const monthlyDebt = isIO
      ? calcInterestOnly({ principal: loan, annualRatePct: values.rate })
      : calcMonthlyRepayment({ principal: loan, annualRatePct: values.rate, termYears: values.termYears });
    const annualDebt = monthlyDebt * 12;

    const vacancyLoss = annualRent * (toNumber(values.vacancyPct) / 100);
    const mgmtCost = annualRent * (toNumber(values.mgmtPct) / 100);
    const annualHolding = toNumber(values.annualHolding);
    const totalAnnualCosts = vacancyLoss + mgmtCost + annualHolding;

    const grossYield = calcGrossYield({ weeklyRent, purchasePrice: price }) * 100;
    const netRent = annualRent - totalAnnualCosts;
    const netYieldPct = price > 0 ? (netRent / price) * 100 : 0;
    const annualCashFlow = netRent - annualDebt;
    const weeklyCashFlow = annualCashFlow / WEEKS_PER_YEAR;
    const cashOnCash = totalCashIn > 0 ? (annualCashFlow / totalCashIn) * 100 : 0;

    const insights = [];
    if (annualCashFlow >= 0) {
      insights.push({ tone: 'pass', text: `Cash-flow positive by ${formatCurrency(annualCashFlow)} per year before tax.` });
    } else {
      insights.push({ tone: 'warn', text: `Negative cash flow of ${formatCurrency(Math.abs(annualCashFlow))} per year before tax — relies on capital growth or negative gearing.` });
    }
    if (grossYield < 4) {
      insights.push({ tone: 'info', text: 'Gross yield under 4% — typical of metro residential. Most return comes from capital growth.' });
    } else if (grossYield > 6) {
      insights.push({ tone: 'info', text: 'Gross yield above 6% — often regional or commercial. Validate the rent against current market.' });
    }
    if (isIO) {
      insights.push({ tone: 'warn', text: 'Interest-only inflates apparent cash flow — principal is unchanged.' });
    }

    return {
      heroLabel: 'Net yield',
      heroValue: `${netYieldPct.toFixed(2)}%`,
      metrics: [
        { label: 'Gross yield', value: `${grossYield.toFixed(2)}%` },
        { label: 'Annual cash flow', value: formatCurrency(annualCashFlow) },
        { label: 'Weekly cash flow', value: `${formatCurrency(weeklyCashFlow)}/wk` },
        { label: 'Cash on cash', value: `${cashOnCash.toFixed(2)}%` },
        { label: 'Loan amount', value: formatCurrency(loan) },
        { label: 'Total cash in', value: formatCurrency(totalCashIn) },
      ],
      insights,
      actions: [
        { label: 'Servicing analysis', href: '/commercial-servicing-calc.html' },
        { label: 'Repayments', href: '/tools/repayments.html' },
      ],
    };
  },
};

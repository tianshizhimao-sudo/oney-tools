/* =========================================================
   Bank-Ready Score — schema-driven config (Phase 2)
   8 weighted dimensions, score 0-100, lender-readiness band.
   Scoring rules ported from the legacy sme-score.html.
   ========================================================= */

import { toNumber, formatCurrency } from '../core/finance-math.js';

const WEIGHTS = {
  turnover: 0.05,
  profit: 0.05,
  years: 0.20,
  ato: 0.20,
  gearing: 0.05,
  industry: 0.20,
  credit: 0.20,
  cashflow: 0.05,
};

function bandTurnover(tc) {
  if (tc >= 10_000_000) return 100;
  if (tc >= 2_000_000) return 80;
  if (tc >= 500_000) return 60;
  return 40;
}
function bandProfitMargin(tc, pc) {
  const margin = tc > 0 ? (pc / tc) * 100 : 0;
  if (margin >= 20) return 100;
  if (margin >= 10) return 80;
  if (margin >= 5) return 60;
  return 30;
}
function bandYears(y) {
  if (y >= 3) return 100;
  if (y >= 2) return 75;
  if (y >= 1) return 50;
  return 20;
}
function bandATO(status) {
  switch (status) {
    case 'clean': return 100;
    case 'plan': return 65;
    case 'small': return 45;
    case 'large': return 15;
    default: return 100;
  }
}
function bandGearing(debt, assets) {
  const g = assets > 0 ? debt / assets : 0;
  if (g <= 0.3) return 90;
  if (g <= 0.5) return 70;
  if (g <= 0.7) return 50;
  return 30;
}
function bandIndustry(level) {
  if (level === 'low') return 100;
  if (level === 'medium') return 60;
  return 25;
}
function bandCredit(score) {
  if (score >= 800) return 100;
  if (score >= 700) return 85;
  if (score >= 600) return 55;
  if (score >= 500) return 30;
  return 10;
}
function bandCashflow(stability) {
  if (stability === 'stable') return 100;
  if (stability === 'seasonal') return 70;
  if (stability === 'lumpy') return 45;
  return 20;
}

function gradeBand(score) {
  if (score >= 80) return { label: 'Bank-ready', tone: 'pass', text: 'Strong profile — major banks should be receptive. Lead with rate.' };
  if (score >= 65) return { label: 'Mostly ready', tone: 'pass', text: 'A few gaps to tighten before approaching majors, but the profile is sound.' };
  if (score >= 50) return { label: 'Borderline', tone: 'warn', text: 'Selective majors, more likely a tier-2 / specialist lender pathway.' };
  if (score >= 35) return { label: 'Non-bank pathway', tone: 'warn', text: 'Specialist or non-bank lenders are the realistic starting point.' };
  return { label: 'Not yet bankable', tone: 'fail', text: 'Material weaknesses across dimensions — rebuild before applying.' };
}

export const bankReadyScoreConfig = {
  id: 'bank-ready-score',
  group: 'assess',
  title: 'Bank-Ready Score',
  eyebrow: 'Assess',
  subtitle: 'Self-assess business loan readiness across the eight criteria banks actually care about.',
  defaults: {
    turnover: 1_500_000,
    profit: 150_000,
    yearsInBusiness: 3,
    atoStatus: 'clean',
    totalDebt: 500_000,
    totalAssets: 2_000_000,
    industryRisk: 'low',
    creditScore: 700,
    cashflowStability: 'stable',
  },
  steps: [
    {
      id: 'size',
      title: 'Size and profitability',
      desc: 'Annual figures from the most recent financial year.',
      fields: [
        { id: 'turnover', label: 'Annual turnover', type: 'currency', required: true, step: 1000 },
        { id: 'profit', label: 'Net profit', type: 'currency', step: 1000, help: 'Profit before tax is fine' },
      ],
    },
    {
      id: 'history',
      title: 'Trading history and industry',
      fields: [
        {
          id: 'yearsInBusiness',
          label: 'Years in business',
          type: 'choice',
          required: true,
          options: [
            { value: 0, label: '< 1 year' },
            { value: 1, label: '1 year' },
            { value: 2, label: '2 years' },
            { value: 3, label: '3+ years' },
          ],
        },
        {
          id: 'industryRisk',
          label: 'Industry risk band',
          type: 'choice',
          required: true,
          options: [
            { value: 'low', label: 'Low risk', desc: 'Professional services, healthcare, established trades' },
            { value: 'medium', label: 'Medium risk', desc: 'Retail, hospitality, transport' },
            { value: 'high', label: 'High risk', desc: 'Construction, mining services, crypto' },
          ],
        },
      ],
    },
    {
      id: 'finances',
      title: 'Balance sheet and ATO',
      fields: [
        { id: 'totalDebt', label: 'Total business debt', type: 'currency', step: 1000 },
        { id: 'totalAssets', label: 'Total business assets', type: 'currency', step: 1000 },
        {
          id: 'atoStatus',
          label: 'ATO standing',
          type: 'choice',
          required: true,
          options: [
            { value: 'clean', label: 'Clean', desc: 'No arrears, no payment plan' },
            { value: 'plan', label: 'On a plan', desc: 'Active ATO payment arrangement' },
            { value: 'small', label: 'Small arrears', desc: '< $50k overdue' },
            { value: 'large', label: 'Large arrears', desc: '$50k+ overdue' },
          ],
        },
      ],
    },
    {
      id: 'director',
      title: 'Director and cash flow',
      fields: [
        {
          id: 'creditScore',
          label: 'Director credit score',
          type: 'number',
          min: 0, max: 1200, step: 10,
          help: 'Equifax / illion. Use 700 if unsure.',
        },
        {
          id: 'cashflowStability',
          label: 'Cash flow profile',
          type: 'choice',
          required: true,
          options: [
            { value: 'stable', label: 'Stable', desc: 'Consistent month to month' },
            { value: 'seasonal', label: 'Seasonal', desc: 'Predictable peaks/troughs' },
            { value: 'lumpy', label: 'Lumpy', desc: 'Project-based, irregular' },
            { value: 'volatile', label: 'Volatile', desc: 'Hard to predict 30 days out' },
          ],
        },
      ],
    },
  ],
  resolveResult(values) {
    const dims = {
      turnover: bandTurnover(toNumber(values.turnover)),
      profit: bandProfitMargin(toNumber(values.turnover), toNumber(values.profit)),
      years: bandYears(toNumber(values.yearsInBusiness)),
      ato: bandATO(values.atoStatus),
      gearing: bandGearing(toNumber(values.totalDebt), toNumber(values.totalAssets)),
      industry: bandIndustry(values.industryRisk),
      credit: bandCredit(toNumber(values.creditScore)),
      cashflow: bandCashflow(values.cashflowStability),
    };

    let weighted = 0;
    Object.keys(WEIGHTS).forEach((k) => { weighted += dims[k] * WEIGHTS[k]; });
    const score = Math.round(weighted);
    const grade = gradeBand(score);

    const entries = Object.entries(dims);
    const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    const worst = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
    const labelMap = {
      turnover: 'Turnover', profit: 'Profit margin', years: 'Trading history',
      ato: 'ATO standing', gearing: 'Gearing', industry: 'Industry risk',
      credit: 'Director credit', cashflow: 'Cash flow stability',
    };

    const margin = toNumber(values.turnover) > 0
      ? (toNumber(values.profit) / toNumber(values.turnover)) * 100
      : 0;

    return {
      heroLabel: grade.label,
      heroValue: `${score}/100`,
      metrics: [
        { label: 'Turnover', value: formatCurrency(values.turnover) },
        { label: 'Profit margin', value: `${margin.toFixed(1)}%` },
        { label: 'Strongest', value: labelMap[best[0]] },
        { label: 'Weakest', value: labelMap[worst[0]] },
      ],
      insights: [
        { tone: grade.tone, text: grade.text },
        { tone: 'info', text: `Strongest: ${labelMap[best[0]]} (${best[1]}/100). Focus area: ${labelMap[worst[0]]} (${worst[1]}/100).` },
      ],
      actions: [
        { label: 'DTI router', href: '/tools/dti-router.html' },
        { label: 'Borrowing power', href: '/tools/borrowing-power.html' },
      ],
    };
  },
};

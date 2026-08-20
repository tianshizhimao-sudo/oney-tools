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

const DOCUMENT_INTEGRITY_LABELS = {
  green: 'Green — evidence looks consistent',
  amber: 'Amber — clarify before applying',
  red: 'Red — fix disclosure gaps first',
};

const DOCUMENT_INTEGRITY_TONES = {
  green: 'pass',
  amber: 'warn',
  red: 'fail',
};

function documentIntegrity(values) {
  const checks = [
    values.incomeDeclared,
    values.otherDebtsDeclared,
    values.expensesRealistic,
    values.giftedDepositEvidence,
    values.selfEmployedIncomeEvidence,
    values.coApplicantDisclosure,
  ];
  const redFlags = checks.filter((v) => v === 'risk').length;
  const amberFlags = checks.filter((v) => v === 'review').length;

  if (redFlags >= 1 || amberFlags >= 3) {
    return {
      status: 'red',
      label: DOCUMENT_INTEGRITY_LABELS.red,
      text: 'There are disclosure or evidence gaps a lender may treat as material. Fix these before relying on the score.',
      cap: 49,
    };
  }
  if (amberFlags >= 1) {
    return {
      status: 'amber',
      label: DOCUMENT_INTEGRITY_LABELS.amber,
      text: 'The profile is not broken, but one or more evidence points should be clarified before a bank reviews the file.',
      cap: 69,
    };
  }
  return {
    status: 'green',
    label: DOCUMENT_INTEGRITY_LABELS.green,
    text: 'The core disclosure checks look consistent. The score can now be read as a cleaner readiness signal.',
    cap: 100,
  };
}

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
    incomeDeclared: 'clear',
    otherDebtsDeclared: 'clear',
    expensesRealistic: 'clear',
    giftedDepositEvidence: 'na',
    selfEmployedIncomeEvidence: 'clear',
    coApplicantDisclosure: 'na',
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
      id: 'document-integrity',
      title: 'Document Integrity Check',
      desc: 'Six quick disclosure checks before the score. Banks do not just read numbers — they test whether the file is complete and consistent.',
      fields: [
        {
          id: 'incomeDeclared',
          label: 'Income is fully declared and explainable',
          type: 'choice',
          required: true,
          options: [
            { value: 'clear', label: 'Yes — income sources match documents', desc: 'Payslips, BAS, financials or bank statements tell the same story' },
            { value: 'review', label: 'Needs review', desc: 'Some income needs explanation or add-back support' },
            { value: 'risk', label: 'No / uncertain', desc: 'Income is incomplete, inconsistent or hard to evidence' },
          ],
        },
        {
          id: 'otherDebtsDeclared',
          label: 'All other debts and limits are declared',
          type: 'choice',
          required: true,
          options: [
            { value: 'clear', label: 'Yes — all debts and limits included', desc: 'Credit cards, overdrafts, ATO, BNPL, car loans and guarantees' },
            { value: 'review', label: 'Needs review', desc: 'Some facilities or limits may need confirming' },
            { value: 'risk', label: 'No / uncertain', desc: 'Known debts or limits may be missing' },
          ],
        },
        {
          id: 'expensesRealistic',
          label: 'Living and business expenses look realistic',
          type: 'choice',
          required: true,
          options: [
            { value: 'clear', label: 'Yes — expenses are realistic', desc: 'Declared expenses broadly match account conduct' },
            { value: 'review', label: 'Needs review', desc: 'Some categories may look low or need explanation' },
            { value: 'risk', label: 'No / uncertain', desc: 'Expenses are likely understated or inconsistent' },
          ],
        },
        {
          id: 'giftedDepositEvidence',
          label: 'Gifted deposit / private funds are evidenced',
          type: 'choice',
          required: true,
          options: [
            { value: 'na', label: 'Not applicable', desc: 'No gifted deposit or private funds involved' },
            { value: 'clear', label: 'Yes — evidence is ready', desc: 'Gift letter, bank trail or source of funds is available' },
            { value: 'review', label: 'Needs review', desc: 'Source of funds is explainable but not packaged yet' },
            { value: 'risk', label: 'No / uncertain', desc: 'Source of funds may be unclear' },
          ],
        },
        {
          id: 'selfEmployedIncomeEvidence',
          label: 'Self-employed income can be evidenced',
          type: 'choice',
          required: true,
          options: [
            { value: 'clear', label: 'Yes — tax returns / BAS / financials support it', desc: 'Income can be reconciled across documents' },
            { value: 'review', label: 'Needs review', desc: 'Recent changes, add-backs or one-off items need explanation' },
            { value: 'risk', label: 'No / uncertain', desc: 'Income relies on unsupported estimates or stale documents' },
          ],
        },
        {
          id: 'coApplicantDisclosure',
          label: 'Co-applicant details are complete',
          type: 'choice',
          required: true,
          options: [
            { value: 'na', label: 'Not applicable', desc: 'Single applicant / single borrower file' },
            { value: 'clear', label: 'Yes — income, debts and expenses included', desc: 'Both applicants are fully disclosed' },
            { value: 'review', label: 'Needs review', desc: 'Some joint or individual liabilities need confirming' },
            { value: 'risk', label: 'No / uncertain', desc: 'A co-applicant may materially change serviceability' },
          ],
        },
      ],
    },
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
    const integrity = documentIntegrity(values);
    const score = Math.min(Math.round(weighted), integrity.cap);
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
        { label: 'Document integrity', value: integrity.label.replace(' — ', ': ') },
        { label: 'Turnover', value: formatCurrency(values.turnover) },
        { label: 'Profit margin', value: `${margin.toFixed(1)}%` },
        { label: 'Strongest', value: labelMap[best[0]] },
        { label: 'Weakest', value: labelMap[worst[0]] },
      ],
      insights: [
        { tone: DOCUMENT_INTEGRITY_TONES[integrity.status], text: `Document Integrity Check: ${integrity.text}` },
        { tone: grade.tone, text: grade.text },
        { tone: 'info', text: `Strongest: ${labelMap[best[0]]} (${best[1]}/100). Focus area: ${labelMap[worst[0]]} (${worst[1]}/100).` },
      ],
      narrative: `Document integrity is a front-door check, not a credit decision. If it is amber or red, the practical move is to fix disclosure and evidence gaps before approaching a lender. Current document signal: ${integrity.label}.`,
      actions: [
        { label: 'DTI router', href: '/tools/dti-router.html' },
        { label: 'Borrowing power', href: '/tools/borrowing-power.html' },
      ],
    };
  },
};

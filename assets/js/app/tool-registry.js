/* =========================================================
   Oney & Co — Tool registry (Phase 1)
   Single source of truth for which tools belong in which hub.
   `legacySlug` is the existing path; `slug` is the future
   schema-driven page (Phase 2+) that may not exist yet.
   ========================================================= */

export const GROUPS = {
  assess: {
    id: 'assess',
    title: 'Assess',
    eyebrow: 'Diagnose first',
    headline: 'Find out where you stand before you apply.',
    intro: 'Short, focused diagnostics that route you to the right calculator or to Oney Pro.',
    cta: { label: 'Start an assessment', href: '/assess/' },
    accent: 'green',
  },
  calculate: {
    id: 'calculate',
    title: 'Calculate',
    eyebrow: 'Run the numbers',
    headline: 'Fast math for the decisions you make every day.',
    intro: 'Repayments, borrowing power, refinance breakeven, LMI, stamp duty — instant answers, scenario-ready.',
    cta: { label: 'Open calculators', href: '/calculate/' },
    accent: 'blue',
  },
  analyse: {
    id: 'analyse',
    title: 'Analyse',
    eyebrow: 'Go deeper',
    headline: 'Deal-level analysis when a number isn\u2019t enough.',
    intro: 'Yield, servicing, security and structure tools — built for the moments before you commit.',
    cta: { label: 'Open analysis tools', href: '/analyse/' },
    accent: 'purple',
  },
  pro: {
    id: 'pro',
    title: 'Pro',
    eyebrow: 'Full case workspace',
    headline: 'One workspace, one shared dataset, one credit summary.',
    intro: 'Oney Pro unifies inputs across servicing, security, risk, and credit summary — for the cases that need it.',
    cta: { label: 'Open Oney Pro', href: '/suite/' },
    accent: 'gold',
  },
};

export const TOOL_REGISTRY = [
  /* ---------- Assess ---------- */
  {
    id: 'fhc',
    title: 'Financial Health Check',
    description: 'Five-minute readiness assessment for individuals and SMEs. Know where you stand before applying.',
    group: 'assess',
    tier: 'free',
    priority: 'hero',
    icon: '💚',
    slug: '/tools/fhc.html',
    legacySlug: 'https://fhc.oneyco.com.au',
    external: true,
    inputs: ['income', 'expenses', 'debt'],
    outputs: ['healthScore', 'pathway', 'nextStep'],
  },
  {
    id: 'dti-router',
    title: 'DTI Router',
    description: 'Check your Debt-to-Income ratio and see whether bank or non-bank is the better path.',
    group: 'assess',
    tier: 'free',
    priority: 'hero',
    icon: '🏦',
    slug: '/tools/dti-router.html',
    legacySlug: 'dti-router.html',
    inputs: ['income', 'debt', 'loanAmount'],
    outputs: ['dti', 'bankPath'],
  },
  {
    id: 'bank-ready-score',
    title: 'Bank-Ready Score',
    description: 'Self-assess business loan readiness across the eight criteria banks actually care about.',
    group: 'assess',
    tier: 'free',
    priority: 'hero',
    icon: '📊',
    slug: '/tools/bank-ready-score.html',
    legacySlug: 'sme-score.html',
    inputs: ['revenue', 'cashFlow', 'tax', 'debtConduct'],
    outputs: ['score', 'grade', 'actions'],
  },

  /* ---------- Calculate ---------- */
  {
    id: 'repayments',
    title: 'Repayments',
    description: 'Fast monthly repayment estimates with a shared math engine.',
    group: 'calculate',
    tier: 'free',
    priority: 'core',
    icon: '⚡',
    slug: '/tools/repayments.html',
    legacySlug: 'quick-quote-calculator.html',
    inputs: ['loanAmount', 'rate', 'term'],
    outputs: ['monthlyRepayment', 'interestTotal'],
  },
  {
    id: 'borrowing-power',
    title: 'Borrowing Power',
    description: 'Indicative borrowing capacity from income, expenses and existing liabilities.',
    group: 'calculate',
    tier: 'free',
    priority: 'core',
    icon: '💪',
    slug: '/tools/borrowing-power.html',
    legacySlug: 'borrowing-power-estimator.html',
    inputs: ['income', 'expenses', 'debt', 'rate'],
    outputs: ['indicativeCapacity'],
  },
  {
    id: 'refinance-breakeven',
    title: 'Refinance Breakeven',
    description: 'Compare costs against interest savings to see when refinancing pays off.',
    group: 'calculate',
    tier: 'free',
    priority: 'core',
    icon: '🔄',
    slug: '/tools/refinance-breakeven.html',
    legacySlug: 'refinance-breakeven.html',
    inputs: ['currentLoan', 'currentRate', 'newRate', 'switchCost'],
    outputs: ['breakevenMonths', 'monthlySaving'],
  },
  {
    id: 'lmi-calculator',
    title: 'LMI Calculator',
    description: 'Estimate Lenders Mortgage Insurance premium based on loan amount and LVR.',
    group: 'calculate',
    tier: 'free',
    priority: 'core',
    icon: '🛡️',
    slug: '/tools/lmi.html',
    legacySlug: 'lmi-calculator.html',
    inputs: ['loanAmount', 'propertyValue'],
    outputs: ['lmi', 'lvr'],
  },
  {
    id: 'stamp-duty',
    title: 'Stamp Duty',
    description: 'Stamp duty across Australian states for different buyer and property types.',
    group: 'calculate',
    tier: 'free',
    priority: 'core',
    icon: '🏠',
    slug: '/tools/stamp-duty.html',
    legacySlug: 'stamp-duty-calculator.html',
    inputs: ['state', 'price', 'buyerType'],
    outputs: ['stampDuty'],
  },
  {
    id: 'offset',
    title: 'Offset Calculator',
    description: 'Interest savings from an offset account, with and without offset funds.',
    group: 'calculate',
    tier: 'free',
    priority: 'secondary',
    icon: '🏦',
    slug: '/tools/offset.html',
    legacySlug: 'offset-calculator.html',
    inputs: ['loanAmount', 'rate', 'term', 'offsetBalance'],
    outputs: ['interestSaved', 'timeSaved'],
  },
  {
    id: 'extra-repayment',
    title: 'Extra Repayment',
    description: 'How extra repayments shorten your term and total interest.',
    group: 'calculate',
    tier: 'free',
    priority: 'secondary',
    icon: '➕',
    slug: '/tools/extra-repayment.html',
    legacySlug: 'extra-repayment-calculator.html',
    inputs: ['loanAmount', 'rate', 'term', 'extraMonthly'],
    outputs: ['interestSaved', 'timeSaved'],
  },

  /* ---------- Analyse ---------- */
  {
    id: 'investment-yield',
    title: 'Investment Yield',
    description: 'Gross and net rental yields with detailed cash-flow breakdowns.',
    group: 'analyse',
    tier: 'free',
    priority: 'core',
    icon: '📈',
    slug: '/tools/investment-yield.html',
    legacySlug: 'investment-yield-calculator.html',
    inputs: ['purchasePrice', 'weeklyRent', 'costs', 'rate'],
    outputs: ['grossYield', 'netYield', 'cashFlow'],
  },
  {
    id: 'commercial-investment',
    title: 'Commercial Investment',
    description: 'Yield, LVR, ICR, DSCR and cash-flow analysis for commercial deals.',
    group: 'analyse',
    tier: 'free',
    priority: 'core',
    icon: '🏢',
    slug: '/tools/commercial-investment.html',
    legacySlug: 'commercial-investment-calculator.html',
    inputs: ['purchasePrice', 'noi', 'loanAmount', 'rate'],
    outputs: ['lvr', 'icr', 'dscr'],
  },
  {
    id: 'servicing',
    title: 'Servicing',
    description: 'Commercial servicing with WALE, lease-doc shading, and portfolio support.',
    group: 'analyse',
    tier: 'free',
    priority: 'core',
    icon: '📊',
    slug: '/tools/servicing.html',
    legacySlug: 'commercial-servicing-calc.html',
    inputs: ['income', 'shading', 'buffer', 'debtService'],
    outputs: ['servicingResult', 'icr', 'dscr'],
  },
  {
    id: 'security-assessment',
    title: 'Security Assessment',
    description: 'Property collateral review — zoning, LVR, valuation, environmental flags.',
    group: 'analyse',
    tier: 'pro',
    priority: 'core',
    icon: '🛡️',
    slug: '/tools/security-assessment.html',
    legacySlug: 'oney-security/',
    inputs: ['address', 'securityValue', 'existingDebt'],
    outputs: ['lvr', 'riskFlags', 'lenderFit'],
  },
  {
    id: 'flow-visualiser',
    title: 'Flow Visualiser',
    description: 'Draw fund flows, group structures and entity relationships for complex deals.',
    group: 'analyse',
    tier: 'free',
    priority: 'secondary',
    icon: '🔀',
    slug: '/tools/flow-visualiser.html',
    legacySlug: 'flow-visualiser.html',
    inputs: ['entities', 'flows'],
    outputs: ['diagram'],
  },

  /* ---------- Pro ---------- */
  {
    id: 'oney-pro',
    title: 'Oney Pro Workspace',
    description: 'Unified case workspace — shared inputs feed servicing, security, risk and credit summary.',
    group: 'pro',
    tier: 'pro',
    priority: 'hero',
    icon: '⚡',
    slug: '/pro/',
    legacySlug: 'suite/',
    inputs: ['sharedClientData'],
    outputs: ['creditSummary', 'exportBundle'],
  },
];

export function getToolsByGroup(group) {
  return TOOL_REGISTRY.filter((tool) => tool.group === group);
}

export function getHeroTools(group) {
  const list = group ? getToolsByGroup(group) : TOOL_REGISTRY;
  return list.filter((tool) => tool.priority === 'hero');
}

export function getCoreTools(group) {
  const list = group ? getToolsByGroup(group) : TOOL_REGISTRY;
  return list.filter((tool) => tool.priority === 'core' || tool.priority === 'hero');
}

export function getToolById(id) {
  return TOOL_REGISTRY.find((tool) => tool.id === id) || null;
}

export function resolveToolHref(tool) {
  if (!tool) return '#';
  // Phase 1: schema-driven `slug` pages don't exist yet.
  // Use the legacy slug while migration is in progress.
  return tool.legacySlug || tool.slug || '#';
}

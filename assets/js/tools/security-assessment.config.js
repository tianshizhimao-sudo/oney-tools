/* =========================================================
   Security Assessment — schema-driven config (Phase 3)
   Property collateral risk: zoning, LVR, environmental, tenancy.
   Same engine for free + Pro. Pro gating reveals lender matrix detail.
   ========================================================= */

import {
  toNumber,
  calcLVR,
  lvrCapFor,
  formatCurrency,
} from '../core/finance-math.js';

const PASS_BAND = 70;
const WARN_BAND = 40;

/* ---------- Module scoring helpers ---------- */

function scoreZoning({ zoningClass, complianceStatus, planningRisk, heritage }) {
  let score = 80;
  if (complianceStatus === 'non-compliant') score -= 40;
  else if (complianceStatus === 'consent-required') score -= 15;
  if (zoningClass === 'specialised') score -= 20;
  else if (zoningClass === 'rural') score -= 12;
  if (planningRisk === 'high') score -= 15;
  else if (planningRisk === 'medium') score -= 8;
  if (heritage === 'listed') score -= 12;
  return clamp(score);
}

function scoreValuation({ propertyClass, lvr, marketCycle, location }) {
  const cap = lvrCapFor(propertyClass);
  let score = 75;
  if (lvr > 0.95) score -= 35;
  else if (lvr > cap) score -= 25;
  else if (lvr > cap - 0.10) score -= 8;
  if (marketCycle === 'peak') score -= 10;
  else if (marketCycle === 'decline') score -= 15;
  if (location === 'rural') score -= 12;
  else if (location === 'regional') score -= 5;
  return clamp(score);
}

function scoreEnvironmental({ flood, bushfire, contamination, insuranceGap }) {
  let score = 80;
  if (flood === 'high') score -= 25;
  else if (flood === 'medium') score -= 12;
  else if (flood === 'low') score -= 4;
  if (bushfire === 'BAL-FZ') score -= 35;
  else if (bushfire === 'BAL-40') score -= 20;
  else if (bushfire === 'BAL-29') score -= 12;
  else if (bushfire === 'BAL-19') score -= 5;
  if (contamination === 'confirmed') score -= 25;
  else if (contamination === 'suspected') score -= 12;
  if (insuranceGap === 'material') score -= 15;
  else if (insuranceGap === 'minor') score -= 6;
  return clamp(score);
}

function scoreTenancy({ tenancyMode, waleYears, vacancy, concentration }) {
  if (tenancyMode === 'owner-occupied') return 85;
  if (tenancyMode === 'vacant') return 35;
  let score = 80;
  const wale = toNumber(waleYears);
  if (wale < 2) score -= 20;
  else if (wale < 5) score -= 8;
  if (vacancy === 'partial') score -= 10;
  if (concentration === 'high') score -= 15;
  return clamp(score);
}

function clamp(n, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, Math.round(n))); }
function band(score) {
  if (score >= PASS_BAND) return 'pass';
  if (score >= WARN_BAND) return 'warn';
  return 'fail';
}
function bandLabel(score) {
  if (score >= PASS_BAND) return 'Green';
  if (score >= WARN_BAND) return 'Amber';
  return 'Red';
}

function lenderAppetite(overall, lvr, propertyClass) {
  const cap = lvrCapFor(propertyClass);
  if (overall >= PASS_BAND && lvr <= cap) return ['Major bank', 'Tier-2', 'Specialist'];
  if (overall >= WARN_BAND && lvr <= cap + 0.05) return ['Tier-2', 'Specialist'];
  if (overall >= WARN_BAND) return ['Specialist'];
  return ['Private / non-bank only'];
}

/* ---------- Config ---------- */

export const securityAssessmentConfig = {
  id: 'security-assessment',
  group: 'analyse',
  title: 'Security Assessment',
  eyebrow: 'Analyse',
  subtitle: 'Property collateral risk across zoning, LVR, environmental and tenancy. Same engine free and Pro — Pro reveals the full lender matrix.',
  defaults: {
    propertyClass: 'commercial-office',
    purchasePrice: 3_500_000,
    loanAmount: 2_000_000,
    zoningClass: 'commercial-zone',
    complianceStatus: 'compliant',
    planningRisk: 'low',
    heritage: 'none',
    marketCycle: 'growth',
    location: 'metro',
    flood: 'low',
    bushfire: 'none',
    contamination: 'none',
    insuranceGap: 'none',
    tenancyMode: 'tenanted',
    waleYears: 4.0,
    vacancy: 'fully-let',
    concentration: 'low',
  },
  steps: [
    {
      id: 'category',
      title: 'Property and pricing',
      fields: [
        {
          id: 'propertyClass', label: 'Property class', type: 'select', required: true,
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
        { id: 'purchasePrice', label: 'Purchase price / valuation', type: 'currency', required: true },
        { id: 'loanAmount', label: 'Loan amount', type: 'currency', required: true },
      ],
    },
    {
      id: 'zoning',
      title: 'Zoning and planning',
      fields: [
        {
          id: 'zoningClass', label: 'Zoning class', type: 'select',
          options: [
            { value: 'residential-zone', label: 'Residential' },
            { value: 'commercial-zone', label: 'Commercial / business' },
            { value: 'industrial-zone', label: 'Industrial' },
            { value: 'mixed-use', label: 'Mixed use' },
            { value: 'specialised', label: 'Specialised (SP1–SP3)' },
            { value: 'rural', label: 'Rural (RU1–RU6)' },
          ],
        },
        {
          id: 'complianceStatus', label: 'Use compliance', type: 'choice',
          options: [
            { value: 'compliant', label: 'Compliant', desc: 'Permitted use' },
            { value: 'consent-required', label: 'Consent required' },
            { value: 'non-compliant', label: 'Non-compliant' },
          ],
        },
        {
          id: 'planningRisk', label: 'Planning risk', type: 'choice',
          options: [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High', desc: 'Active scheme amendments' },
          ],
        },
        {
          id: 'heritage', label: 'Heritage', type: 'choice',
          options: [
            { value: 'none', label: 'None' },
            { value: 'item-of-interest', label: 'Item of interest' },
            { value: 'listed', label: 'Heritage listed' },
          ],
        },
      ],
    },
    {
      id: 'market',
      title: 'Market and environmental',
      fields: [
        {
          id: 'marketCycle', label: 'Market cycle', type: 'choice',
          options: [
            { value: 'growth', label: 'Growth' },
            { value: 'peak', label: 'Peak' },
            { value: 'decline', label: 'Decline' },
            { value: 'trough', label: 'Trough' },
          ],
        },
        {
          id: 'location', label: 'Location quality', type: 'choice',
          options: [
            { value: 'metro', label: 'Metro / prime' },
            { value: 'secondary', label: 'Secondary' },
            { value: 'regional', label: 'Regional' },
            { value: 'rural', label: 'Rural' },
          ],
        },
        {
          id: 'flood', label: 'Flood risk', type: 'choice',
          options: [
            { value: 'none', label: 'None' },
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ],
        },
        {
          id: 'bushfire', label: 'Bushfire BAL', type: 'select',
          options: [
            { value: 'none', label: 'No BAL rating' },
            { value: 'BAL-LOW', label: 'BAL-Low' },
            { value: 'BAL-12.5', label: 'BAL-12.5' },
            { value: 'BAL-19', label: 'BAL-19' },
            { value: 'BAL-29', label: 'BAL-29' },
            { value: 'BAL-40', label: 'BAL-40' },
            { value: 'BAL-FZ', label: 'BAL-FZ (flame zone)' },
          ],
        },
        {
          id: 'contamination', label: 'Contamination', type: 'choice',
          options: [
            { value: 'none', label: 'None known' },
            { value: 'suspected', label: 'Suspected' },
            { value: 'confirmed', label: 'Confirmed' },
          ],
        },
        {
          id: 'insuranceGap', label: 'Insurance gap', type: 'choice',
          options: [
            { value: 'none', label: 'Fully insured' },
            { value: 'minor', label: 'Minor gap' },
            { value: 'material', label: 'Material gap' },
          ],
        },
      ],
    },
    {
      id: 'tenancy',
      title: 'Tenancy',
      fields: [
        {
          id: 'tenancyMode', label: 'Status', type: 'choice',
          options: [
            { value: 'tenanted', label: 'Tenanted' },
            { value: 'owner-occupied', label: 'Owner-occupied' },
            { value: 'vacant', label: 'Vacant' },
          ],
        },
        { id: 'waleYears', label: 'WALE', type: 'number', suffix: 'years', step: 0.1, min: 0, max: 30 },
        {
          id: 'vacancy', label: 'Occupancy', type: 'choice',
          options: [
            { value: 'fully-let', label: 'Fully let' },
            { value: 'partial', label: 'Partial vacancy' },
          ],
        },
        {
          id: 'concentration', label: 'Tenant concentration', type: 'choice',
          options: [
            { value: 'low', label: 'Diversified' },
            { value: 'medium', label: 'Moderate' },
            { value: 'high', label: '>50% one tenant' },
          ],
        },
      ],
    },
  ],
  resolveResult(values) {
    const lvr = calcLVR({ loanAmount: values.loanAmount, securityValue: values.purchasePrice });
    const cap = lvrCapFor(values.propertyClass);

    const z = scoreZoning(values);
    const v = scoreValuation({ ...values, lvr });
    const e = scoreEnvironmental(values);
    const t = scoreTenancy(values);
    const overall = Math.round((z + v + e + t) / 4);
    const overallBand = band(overall);

    // Free view: qualitative bands only — no module numbers leak.
    const insights = [
      { tone: band(z), text: `Zoning — ${bandLabel(z)}. ${z < WARN_BAND ? 'Material zoning/planning risk — likely lender refusal.' : 'Within standard appetite.'}` },
      { tone: band(v), text: `LVR ${(lvr * 100).toFixed(1)}% vs ${(cap * 100).toFixed(0)}% cap — ${bandLabel(v).toLowerCase()}.` },
      { tone: band(e), text: `Environmental — ${bandLabel(e)}.` },
      { tone: band(t), text: `Tenancy — ${bandLabel(t)}.` },
    ];

    const lenders = lenderAppetite(overall, lvr, values.propertyClass);

    return {
      heroLabel: `Overall security — ${bandLabel(overall)}`,
      heroValue: `${overall}/100`,
      metrics: [
        { label: 'LVR', value: `${(lvr * 100).toFixed(1)}%` },
        { label: 'LVR cap', value: `${(cap * 100).toFixed(0)}%` },
        { label: 'Loan amount', value: formatCurrency(values.loanAmount) },
        { label: 'Property value', value: formatCurrency(values.purchasePrice) },
      ],
      insights,
      gated: {
        label: 'Lender matrix (Pro)',
        metrics: [
          { label: 'Zoning score', value: `${z}/100` },
          { label: 'Valuation score', value: `${v}/100` },
          { label: 'Environmental score', value: `${e}/100` },
          { label: 'Tenancy score', value: `${t}/100` },
        ],
        insights: [
          { tone: overallBand, text: `Lender appetite: ${lenders.join(' · ')}.` },
          { tone: 'info', text: `Forced-sale stress test at 70% of valuation: ${formatCurrency(toNumber(values.purchasePrice) * 0.70)}; recovery LVR ${((toNumber(values.loanAmount) / (toNumber(values.purchasePrice) * 0.70)) * 100).toFixed(1)}%.` },
        ],
      },
      actions: [
        { label: 'Servicing', href: '/tools/servicing.html' },
        { label: 'Investment yield', href: '/tools/investment-yield.html' },
      ],
    };
  },
};

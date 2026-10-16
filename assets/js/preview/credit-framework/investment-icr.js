// Reuse Oney's shared ICR arithmetic; guard inputs before its zero fallback.
import { calcICR } from '../../core/finance-math.js';
export const INVESTMENT_TYPES = Object.freeze(['commercial_investment', 'resi_investor_complex']);
export const ICR_KEYS = Object.freeze(['icrNOI', 'icrInterest', 'icrPeriod']);
export const ICR_BOUNDARY = 'Illustrative calculation only, not reviewed evidence, a risk rating or lender eligibility. ICR excludes principal repayments, tax and other commitments; it is not DSCR or a complete servicing assessment.';
export const ICR_ASSUMPTIONS = 'Use net operating income after property operating costs but before interest and tax, and interest for the same property/debt scope and period. Monthly inputs are multiplied by 12 with no seasonal adjustment. No vacancy, rate buffer, income shading or lender threshold is assumed.';
export const isInvestment = type => INVESTMENT_TYPES.includes(type);
export function changeDealType(intake, nextType) {
  if (intake.dealType !== nextType) for (const key of ICR_KEYS) delete intake[key];
  intake.dealType = nextType;
}
function amount(raw) {
  const text=String(raw??'').trim();
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) return null;
  const value=Number(text.replaceAll(',',''));
  return Number.isFinite(value)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER/12 ? value : null;
}
export function investmentICR(intake) {
  if (!isInvestment(intake.dealType)) return {applicable:false};
  const noi=amount(intake.icrNOI),interest=amount(intake.icrInterest),period=intake.icrPeriod;
  const errors={};
  if (noi===null) errors.icrNOI='Enter net operating income in AUD (up to two decimals); zero or a loss is allowed.';
  if (interest===null||interest<=0) errors.icrInterest='Enter interest greater than zero in AUD. Missing or zero interest does not produce an ICR.';
  if (!['annual','monthly'].includes(period)) errors.icrPeriod='Choose the common period for both amounts.';
  if(Object.keys(errors).length)return {applicable:true,valid:false,errors};
  const factor=period==='monthly'?12:1,annualNOI=noi*factor,annualInterest=interest*factor;
  return {applicable:true,valid:true,noi,interest,period,factor,annualNOI,annualInterest,ratio:calcICR({noi:annualNOI,annualInterest})};
}
const money=n=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
export function investmentICRText(result) {
  if(!result.applicable)return '';
  const lines=['Investment interest coverage (ICR) — calculation only'];
  if(!result.valid)lines.push('ICR unavailable. '+Object.values(result.errors).join(' '));
  else lines.push(`Provided ${result.period} inputs (unverified): net operating income ${money(result.noi)}; interest ${money(result.interest)}.`,
    `Annualization: both amounts × ${result.factor}. Annual net operating income ${money(result.annualNOI)}; annual interest ${money(result.annualInterest)}.`,
    `ICR = annual net operating income ÷ annual interest = ${result.ratio.toFixed(2)}x. No pass/fail threshold applied.`);
  lines.push(ICR_ASSUMPTIONS,ICR_BOUNDARY,'Formula follows Oney Tools Commercial Servicing: net operating income divided by interest expense.');
  return lines.join('\n');
}

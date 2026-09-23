/* =========================================================
   Oney Coach — "Tell Oney" local rule-based parser (TEST ONLY)
   100% local, deterministic, bounded keyword + regex rules.
   Zero AI tokens. No network. No probabilistic inference.

   Contract
   --------
   parseTellOney(text) -> {
     facts:  { <fieldId>: { value, raw, status, confidence, note } },
     log:    [ { fieldId, status, note } ],
     meta:   { length, matchedRules, unmatchedSentences }
   }

   status:
     'parsed'        - exactly one deterministic interpretation
     'not_understood'- missing, ambiguous, conflicting, unsupported
                       or low-confidence. NEVER a guessed value.

   The parser never silently converts uncertain text into a fact.
   ========================================================= */

export const NOT_UNDERSTOOD = 'Not understood';

/* ---------- Field vocabulary (bounded) ---------- */

export const PARSER_FIELDS = [
  'turnover',
  'profitMargin',
  'yearsInBusiness',
  'atoStatus',
  'totalDebt',
  'industryRisk',
  'creditScore',
  'cashflowStability',
  'loanPurpose',
  'incomeResilience',
];

/* Field -> declarative rule spec. All ranges are closed and documented. */
const RULES = {
  turnover: {
    // "turnover $1.2m", "revenue of 900k", "sales: 2,000,000"
    keyword: /\b(turnover|revenue|sales|t\/o|top[- ]line)\b/i,
    // "$1.8m turnover" / "2.4m turnover" are equally ordinary SME phrasing
    prefixWindow: 30,
    bareNumbers: true,
    kind: 'money',
    min: 1_000,
    max: 500_000_000,
    lowConfidenceNote: 'Turnover amount is outside the supported range ($1k - $500m)',
  },
  totalDebt: {
    // "debt of 500k", "loans 1.2m", "owed 300,000"
    keyword: /\b(debt|debts|liabilit(?:y|ies)|loans?|owings?|owed|gearing|borrowings?)\b/i,
    kind: 'money',
    prefixWindow: 30,
    bareNumbers: true,
    min: 1_000,
    max: 500_000_000,
    lowConfidenceNote: 'Debt amount is outside the supported range ($1k - $500m)',
  },
  creditScore: {
    // "credit score 720", "equifax 640", "illion 705"
    keyword: /\b(credit\s+(?:score|file|rating|history)|credit|equifax|illion|experian|fico|beacon)\b/i,
    kind: 'credit',
    min: 0,
    max: 1200,
    lowConfidenceNote: 'Credit score is outside the supported range (0 - 1200)',
  },
  profitMargin: {
    // Longest phrase first: `exec` returns the leftmost match, and typing
    // "net profit margin" must match the full phrase rather than stopping at
    // "net profit" and skipping the value that follows.
    keyword: /\b(net\s+profit\s+margin|gross\s+profit\s+margin|profit\s+margin|net\s+profit|profitability|margin|profit)\b/i,
    prefixWindow: 30,
    kind: 'percent',
    min: 0,
    max: 100,
    lowConfidenceNote: 'Profit margin must be between 0% and 100%',
  },
  yearsInBusiness: {
    // "trading 6 years", "operating for 18 months". A separator list runs
    // longest-first so "18 months" matches as a unit; "months?" would match the
    // trailing "s" inside the number and push the digits out of the window.
    keyword: /\b(trading|operating|established|years|yrs|months|mos|year|yr|month|mo|in\s+business|been\s+going)\b/i,
    kind: 'duration',
    prefixWindow: 24,
    min: 0,
    max: 200,
    lowConfidenceNote: 'Trading duration is outside the supported range',
  },
};

/* Enum vocabularies. Literal, ordered, no fuzzy scoring. */
const ENUMS = {
  atoStatus: {
    field: 'atoStatus',
    patterns: [
      { value: 'clean', re: /\b(no\s+ato\s+debt|ato\s+clean|clean\s+ato|up\s+to\s+date\s+(?:with\s+)?(?:the\s+)?ato|bas\s+(?:all\s+)?lodged\s+on\s+time|ato\s+(\w+\s+)?up\s+to\s+date|no\s+arrears\s+with\s+(?:the\s+)?ato|tax\s+up\s+to\s+date|no\s+tax\s+debt)\b/i, label: 'ATO clean, no arrears' },
      { value: 'plan', re: /\b(ato\s+payment\s+plan|payment\s+plan\s+with\s+(?:the\s+)?ato|payment\s+arrangement|on\s+a\s+plan|instal?l?ment\s+plan\s+with\s+(?:the\s+)?ato|ato\s+plan)\b/i, label: 'Active ATO payment plan' },
      { value: 'small', re: /\b(small\s+ato\s+(?:debt|arrears)|ato\s+(?:debt|arrears)\s+(?:under|below|of\s+under)\s*\$?25|under\s*\$?25k?\s+(?:ato|tax)\s+(?:debt|arrears)|minor\s+ato\s+(?:debt|arrears)|small\s+tax\s+debt)\b/i, label: 'Small ATO arrears (< $50k)' },
      { value: 'large', re: /\b(large\s+ato\s+(?:debt|arrears)|ato\s+(?:debt|arrears)\s+(?:over|above|of\s+over)\s*\$?50|over\s*\$?50k?\s+(?:ato|tax)\s+(?:debt|arrears)|significant\s+ato\s+(?:debt|arrears)|big\s+tax\s+debt)\b/i, label: 'Large ATO arrears ($50k+)' },
    ],
    // generic-but-unquantified ATO debt mentions -> never guessed
    ambiguous: /\b(ato\s+(?:debt|arrears)|tax\s+(?:debt|arrears)|ow(?:e|ing)\s+(?:the\s+)?ato)\b/i,
    ambiguousNote: 'ATO debt mentioned without an amount or plan status — cannot classify clean/plan/small/large',
    absentNote: 'No ATO status found',
  },
  industryRisk: {
    field: 'industryRisk',
    patterns: [
      { value: 'low', re: /\b(professional\s+services?|account(?:ing|ants?)|legal|law\s+firm|consult(?:ing|ants?)|healthcare|medical|dental|pharmac(?:y|ies)|education|school|childcare|engineering|architect\w*|insurance|bookkeeping|physio\w*|veterinar\w*)\b/i, label: 'Low risk sector' },
      { value: 'medium', re: /\b(retail|hospitality|cafe|restaurant|coffee\s+shop|bakery|takeaway|transport|freight|logistics|trucking|wholesale|manufactur\w*|gym|salon|beauty|tourism|hotel|motel|publishing|printing)\b/i, label: 'Medium risk sector' },
      { value: 'high', re: /\b(construction|builder|building\s+site|civil\s+works|mining|drilling|crypto|speculative|developer|development\s+site|ndis|labour\s+hire|security\s+services|waste)\b/i, label: 'High risk sector' },
    ],
    ambiguousNote: 'Industry mentioned but not mapped to a supported risk band',
    absentNote: 'No industry sector found',
  },
  cashflowStability: {
    field: 'cashflowStability',
    patterns: [
      { value: 'stable', re: /\b(stable|steady|consistent|reliable|no\s+major\s+fluctuations|smooth|regular\s+income)\b/i, label: 'Stable cash flow' },
      { value: 'seasonal', re: /\b(seasonal|seasonality|peak\s+season|quiet\s+season|busy\s+in\s+summer|predictable\s+peaks)\b/i, label: 'Seasonal but predictable' },
      { value: 'lumpy', re: /\b(lumpy|project[- ]based|irregular|patchy|ad\s+hoc|sporadic|invoice[- ]based)\b/i, label: 'Lumpy / project-based' },
      { value: 'volatile', re: /\b(volatile|highly\s+variable|unpredictable|cash\s+flow\s+is\s+a\s+roller\s*coaster|wild\s+swings|all\s+over\s+the\s+place)\b/i, label: 'Volatile cash flow' },
    ],
    ambiguousNote: 'Cash flow described without a supported stability band',
    absentNote: 'No cash flow description found',
  },
  loanPurpose: {
    field: 'loanPurpose',
    patterns: [
      { value: 'property', re: /\b(commercial\s+property|buy\s+(?:a\s+)?premises|purchase\s+(?:a\s+)?(?:property|premises|warehouse|office)|property\s+purchase|acquisition\s+of\s+premises|new\s+premises)\b/i, label: 'Commercial property purchase' },
      { value: 'refinance', re: /\b(refinanc\w*|refinanc(?:e|ing)|take\s+over\s+(?:the\s+)?(?:existing\s+)?loan|restructur\w*|consolidat\w*)\b/i, label: 'Refinance / restructure' },
      { value: 'equipment', re: /\b(equipment|asset\s+finance|machinery|vehicle|truck|excavator|plant\s+and\s+equipment|fit[- ]?out|chattel)\b/i, label: 'Equipment / asset finance' },
      { value: 'workingCapital', re: /\b(working\s+capital|cash\s+flow\s+loan|inventory|stock\s+purchase|day[- ]to[- ]day\s+running|supplier\s+terms|unsecured\s+loan)\b/i, label: 'Working capital' },
      { value: 'other', re: /\b(business\s+loan|expansion|growth\s+capital|hire\s+staff|marketing\s+spend|other\s+purpose)\b/i, label: 'Other business purpose' },
    ],
    ambiguousNote: 'Loan purpose mentioned but not mapped to a supported category',
    absentNote: 'No loan purpose found',
  },
  incomeResilience: {
    field: 'incomeResilience',
    patterns: [
      { value: 'strong', re: /\b(essential\s+services?|long[- ]term\s+contracts?|recurring\s+revenue|subscription|blue[- ]chip\s+clients?|low\s+customer\s+concentration|government\s+contracts?|very\s+resilient|diversified\s+client\s+base)\b/i, label: 'Very resilient income' },
      { value: 'moderate', re: /\b(reasonably\s+stable|steady\s+clients?|repeat\s+customers?|mostly\s+stable|some\s+cycle\s+exposure|established\s+book\s+of\s+business)\b/i, label: 'Reasonably stable income' },
      { value: 'variable', re: /\b(variable\s+income|overtime|bonuses|casual\s+shifts?|few\s+customers|concentrated\s+(?:client|customer)\s+base|contract\s+work|gig\s+work)\b/i, label: 'Variable income' },
      { value: 'exposed', re: /\b(exposed|recent\s+income\s+drop|reduced\s+hours|shrinking\s+pipeline|weak\s+cash\s+buffer|just\s+lost\s+(?:a\s+)?(?:major\s+)?client|revenue\s+declining)\b/i, label: 'Exposed income' },
    ],
    ambiguousNote: 'Income resilience mentioned but not mapped to a supported band',
    absentNote: 'No income resilience description found',
    // "reasonably stable, mostly repeat customers" carries both signals; the
    // resilience phrasing is the subject of the sentence, so it wins.
    priority: ['strong', 'moderate', 'variable', 'exposed'],
  },
};

/* ---------- Money / percent / duration extraction ---------- */

const MULTIPLIERS = { k: 1e3, m: 1e6, b: 1e9, thousand: 1e3, million: 1e6, billion: 1e9 };

function moneyToNumber(numText, suffix) {
  const n = Number(String(numText).replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const s = (suffix || '').toLowerCase();
  if (!s) return n;
  const mult = MULTIPLIERS[s];
  return mult ? n * mult : null;
}

/* Money with an explicit $ sign. */
function allMoney(text) {
  const out = [];
  const re = /\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k|m|b|thousand|million|billion)?\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const value = moneyToNumber(m[1], m[2]);
    if (value !== null) out.push({ value, index: m.index, raw: m[0].trim() });
  }
  return out;
}

/*
 * Money without a $ sign: "2.4m", "900k", "1,800,000".
 * Deliberately excludes bare integers (which would swallow credit scores and
 * years), so only comma-grouped numbers or numbers with a scale suffix match.
 */
function allMoneyBare(text) {
  const out = [];
  const re = /\b(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:k|m|b|thousand|million|billion))\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const parts = m[0].match(/^(.*?)(\s*(?:k|m|b|thousand|million|billion))?$/i);
    const value = moneyToNumber((parts[1] || '').trim(), (parts[2] || '').trim());
    if (value !== null) out.push({ value, index: m.index, raw: m[0].trim() });
  }
  return out;
}

function allPercents(text) {
  const out = [];
  // "9%" and "9 percent" only. "9.5" is left unmatched: an unmarked decimal
  // is ambiguous, so it must surface as Not understood rather than be guessed.
  const re = /(\d+(?:\.\d+)?)\s*(?:%(?=\s|$|[.,;:)])|per\s?cent\b|percent\b)/gi;
  let m;
  while ((m = re.exec(text)) !== null) out.push({ value: Number(m[1]), index: m.index, raw: m[0].trim() });
  return out;
}

function allDurations(text) {
  const out = [];
  const re = /(\d+(?:\.\d+)?)\s*(years?|yrs?|months?|mos?)\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    const years = unit.startsWith('mo') ? n / 12 : n;
    out.push({ years, index: m.index, raw: m[0].trim() });
  }
  return out;
}

/* Conflicts with the field's own keyword: text says "profit 1.2m" not a margin. */
/* Conflict guard: "profit 1.2m" states a currency amount, not a margin. */
function conflictsWithProfit(fieldId, text, candidateIndex) {
  if (fieldId !== 'profitMargin') return false;
  if (candidateIndex === null || candidateIndex === undefined) return false;
  const window = text.slice(Math.max(0, candidateIndex - 40), candidateIndex + 20);
  return /(turnover|revenue|sales|t\/o)\b/i.test(window);
}

function clampStatus(fieldId, value) {
  const spec = RULES[fieldId];
  if (!spec) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < spec.min || value > spec.max) return null;
  return value;
}

/* ---------- Per-field extraction ---------- */

/* Candidate quantities for a field kind, bounded by the supplied text slice. */
function candidatesFor(kind, text, allowBare) {
  if (kind === 'percent') return allPercents(text);
  if (kind === 'duration') return allDurations(text);
  if (kind === 'credit') return allNumbersForCredit(text);
  if (allowBare) return allMoney(text).concat(allMoneyBare(text));
  return allMoney(text);
}

function extractNumeric(fieldId, text) {
  const spec = RULES[fieldId];
  const kw = spec.keyword.exec(text);
  if (!kw) return { status: 'not_understood', value: null, note: `No ${fieldId} found`, confidence: 'none' };

  const afterStart = kw.index + kw[0].length;
  const after = text.slice(afterStart, Math.min(text.length, afterStart + 90));
  const before = spec.prefixWindow
    ? text.slice(Math.max(0, kw.index - spec.prefixWindow), kw.index)
    : '';

  /*
   * Precedence: a quantity stated AFTER the keyword wins, then a quantity
   * immediately BEFORE it ("$1.8m turnover"). Either way the value must sit
   * in the same clause as the keyword, so a sentence break between them ends
   * the search. This is what stops "turnover 2.4m ... Debt 300k" from reading
   * 300k as turnover, and keeps the parser from guessing across clauses.
   */
  const clauseStop = /[.!?;\n]/;
  /*
   * "of" and "for" are value-joining filler, so a candidate separated only by
   * them ("margin of 9%", "operating for 18 months") still belongs to the
   * keyword. Any other text after the keyword means the number starts a new
   * clause and must not be claimed (“turnover of the business is 2.4m” is
   * accepted via the prefix branch; "credit score — not sure" is not).
   */
  // NOTE: `[\s,:-]` would be a character RANGE (':' to ','), which silently
  // swallows digits. The hyphen must stay escaped: `[\s,:\-]`.
  const JOINER = /^[\s,:\-]*((?:of|for|is|was|are|were|at|around|about|approximately|roughly|up|to|approx\.?)[\s,:\-]*)*$/i;
  let pool = [];
  let poolOffset = afterStart;
  {
    const cands = candidatesFor(spec.kind, after, spec.bareNumbers);
    if (cands.length) {
      /* Only the first candidate can belong to the keyword. Everything between
       * the keyword and that candidate must be value-joining filler, otherwise
       * the number starts a new clause and the field stays Not understood. */
      const gap = after.slice(0, cands[0].index);
      if (JOINER.test(gap)) pool = [cands[0]];
    }
  }
  if (!pool.length && spec.prefixWindow) {
    const cands = candidatesFor(spec.kind, before, spec.bareNumbers);
    const lastStop = before.search(clauseStop);
    const taken = lastStop === -1 ? cands : cands.filter((c) => c.index > lastStop);
    if (taken.length) {
      pool = [taken[taken.length - 1]];
      poolOffset = kw.index - spec.prefixWindow;
    }
  }

  if (!pool.length) {
    return { status: 'not_understood', value: null, note: `${fieldId} mentioned without a usable amount`, confidence: 'none' };
  }

  if (pool.length > 1) {
    const distinct = new Set(pool.map((p) => p.value));
    if (distinct.size > 1) {
      return { status: 'not_understood', value: null, note: `Conflicting ${fieldId} values (${[...distinct].join(', ')}) — needs confirmation`, confidence: 'conflict' };
    }
  }

  const candidate = spec.kind === 'duration' ? pool[0].years : pool[0].value;
  if (conflictsWithProfit(fieldId, text, poolOffset + pool[0].index)) {
    return { status: 'not_understood', value: null, note: 'Value is attached to turnover/revenue wording — not a profit margin', confidence: 'conflict' };
  }
  const value = clampStatus(fieldId, candidate);
  if (value === null) {
    return { status: 'not_understood', value: null, note: spec.lowConfidenceNote, confidence: 'low' };
  }
  return { status: 'parsed', value, note: `Matched on "${kw[0]}"`, confidence: 'high', raw: pool[0].raw };
}

/* Credit scores are often bare numbers ("credit score 720"). */
function allNumbersForCredit(text) {
  const out = [];
  const re = /\b(\d{3,4})\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const v = Number(m[1]);
    if (v >= 300 && v <= 1200) out.push({ value: v, index: m.index, raw: m[0] });
  }
  return out;
}

function extractEnum(spec, text) {
  const hits = [];
  for (const p of spec.patterns) {
    const re = new RegExp(p.re.source, p.re.flags.includes('g') ? p.re.flags : p.re.flags + 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      hits.push({ value: p.value, label: p.label, index: m.index, raw: m[0] });
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
  }
  if (!hits.length) {
    if (spec.ambiguous && spec.ambiguous.test(text)) {
      return { status: 'not_understood', value: null, note: spec.ambiguousNote, confidence: 'ambiguous' };
    }
    return { status: 'not_understood', value: null, note: spec.absentNote, confidence: 'none' };
  }
  const distinct = new Set(hits.map((h) => h.value));
  if (distinct.size > 1) {
    if (spec.priority) {
      const ordered = [...distinct].sort((a, b) => spec.priority.indexOf(a) - spec.priority.indexOf(b));
      const chosen = hits.find((h) => h.value === ordered[0]);
      return { status: 'parsed', value: chosen.value, label: chosen.label, note: `Matched "${chosen.raw}" (preferred resilience phrasing)`, confidence: 'high', raw: chosen.raw };
    }
    return { status: 'not_understood', value: null, note: `Conflicting signals (${[...distinct].join(', ')}) — needs confirmation`, confidence: 'conflict' };
  }
  return { status: 'parsed', value: hits[0].value, label: hits[0].label, note: `Matched "${hits[0].raw}"`, confidence: 'high', raw: hits[0].raw };
}

/* ---------- Public API ---------- */

/**
 * Deterministic, bounded, local parse of SME finance facts.
 * Identical input always produces identical output.
 */
export function parseTellOney(text) {
  const source = String(text ?? '');
  const facts = {};
  const log = [];

  for (const fieldId of PARSER_FIELDS) {
    let result;
    if (RULES[fieldId]) {
      result = extractNumeric(fieldId, source);
    } else if (ENUMS[fieldId]) {
      result = extractEnum(ENUMS[fieldId], source);
    } else {
      result = { status: 'not_understood', value: null, note: 'Unsupported field', confidence: 'none' };
    }
    facts[fieldId] = {
      value: result.status === 'parsed' ? result.value : null,
      status: result.status,
      confidence: result.confidence,
      note: result.note,
      label: result.label || null,
      raw: result.raw || null,
      display: result.status === 'parsed'
        ? (result.label || formatParsedValue(fieldId, result.value))
        : NOT_UNDERSTOOD,
    };
    log.push({ fieldId, status: result.status, note: result.note });
  }

  return {
    facts,
    log,
    meta: {
      length: source.length,
      parsedCount: log.filter((l) => l.status === 'parsed').length,
      notUnderstoodCount: log.filter((l) => l.status !== 'parsed').length,
    },
  };
}

function formatParsedValue(fieldId, value) {
  if (fieldId === 'profitMargin') return `${value}%`;
  if (fieldId === 'yearsInBusiness') return `${value} years`;
  if (fieldId === 'creditScore') return String(value);
  return `$${Number(value).toLocaleString('en-AU')}`;
}

/** The exact sample text exposed by the "Load sample text" button. */
export const SAMPLE_TELL_ONEY_TEXT =
  'We are a transport and logistics business, trading for 8 years. ' +
  'Turnover was about $1,800,000 last year with a net profit margin of 9%. ' +
  'We have an ATO payment plan running and pay it on time. ' +
  'Business debt is roughly $450,000. ' +
  'Director credit score is 715 (Equifax). ' +
  'Cash flow is seasonal but predictable. ' +
  'We want a working capital loan to help with inventory. ' +
  'Income is supported by an established book of business.';

/** Text that must NOT produce inferred values (used by tests). */
export const AMBIGUOUS_TELL_ONEY_TEXT =
  'Our business does reasonably well. Turnover is somewhere in the millions. ' +
  'We owe the ATO something but I am not sure how much. ' +
  'Profit is unclear. Credit score — not sure. We might want a loan for growth.';

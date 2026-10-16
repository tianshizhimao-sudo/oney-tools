# Example Library and investment ICR — review

## Result

A single collapsible Example Library contains six explicitly synthetic scenarios, with Blank kept separate. The original three guided cases are unchanged. Three new rule-only exercises add distinct investment and equipment transactions:

| ID | Exercise | Main teaching points | ICR inputs |
| --- | --- | --- | --- |
| CF-001 | Existing SME refinance / growth | Valuation, contract and working-capital evidence | Not applicable |
| CF-002 | Existing ATO debt restructure | Conduct, tax/super, debt and security pressure | Not applicable |
| CF-004 | Existing owner-occupied commercial purchase | Lease expiry, valuation, due diligence and related parties | Not applicable |
| CF-005 | Synthetic industrial investment purchase | Lease, valuation and property due diligence | Annual NOI $120,000 / interest $84,000 = 1.43x |
| CF-006 | Synthetic retail investment refinance | Short lease, renewal uncertainty and stale terms | Monthly NOI $4,500 / interest $6,000 = 0.75x; annualized $54,000 / $72,000 |
| CF-007 | Synthetic equipment / contract expansion | Unsigned contract, supplier arrears and unproven turnaround | Not applicable |

New exercises have an illustrative Amber starting input and no calibrated model judgement. Evidence entries cannot automatically upgrade them to Green. Original calibration fixtures and rule logic remain intact. Each case loads a fresh intake, trigger set and evidence map; UI reset also clears manual views, materials receipts and draft inputs. Tier changes preserve the active case.

## Existing ICR source and formula

`assets/js/core/finance-math.js` exports `calcICR({ noi, annualInterest })`: NOI divided by annual interest. `assets/js/tools/servicing.config.js` uses it with annual interest equal to loan amount times annual percentage rate divided by 100. The older `commercial-investment-calculator.html` uses the same ratio, deriving net income from gross rent after vacancy and expense ratios. No dedicated existing finance-math test was found; this change adds arithmetic and input-boundary tests around the reused function.

The Credit Framework imports `calcICR` unchanged. It asks explicitly for net operating income after property operating costs but before interest/tax, interest expense, and a common annual or monthly period. Both amounts must cover the same property/debt scope. Monthly figures are multiplied by 12; no seasonality, vacancy, rate buffer, income shading, threshold or lender assumption is introduced. Unlike the existing helper's zero fallback, the input guard refuses missing or zero interest. Missing/malformed/out-of-range figures are unavailable; zero and negative NOI remain meaningful numeric results.

Applicability is explicit: Commercial property investment or Residential investment (complex). Generic commercial property, refinance, business and equipment types do not silently activate the panel. Changing type clears calculator inputs, including switching between investment types. The existing owner-occupied property case does not become an investment case.

## UI, reports and safeguards

ICR inputs sit inside Financial Snapshot, preserving the existing nine-step mobile intake. A neutral calculation panel appears in both output tiers only for investment types. Its inputs, annualization, formula and limitations appear in copied broker reports and printed output. No pass/fail colouring, eligibility statement, evidence status or automatic risk change comes from the calculation. It excludes principal repayments and is not DSCR or a full servicing assessment. Changes invalidate confirmed manual views through the existing stale-state mechanism.

The example library uses native disclosure and labelled fieldsets/buttons, keeps Blank outside the library, and returns focus to the library summary after loading. New text is English. No personal data, backend, storage or uploads are added. All browser test scenarios are synthetic; external requests are blocked.

## Validation

Automated checks cover all six examples in both tiers; reload and blank isolation; investment applicability; annual/monthly ICR arithmetic; zero, negative, missing, malformed and unsafe values; no automatic rating improvement; stale manual views; copy output; and existing regression behavior. Local headless Chromium checks cover six cases × two tiers at 1440px and 390px, collapsed library interaction, no horizontal page overflow, input visibility, print detail visibility and PDF output. The regression suite passed 109 tests with zero failures or skips. Headless Chromium passed all six cases in both tiers at both widths, with zero external requests; screenshots and a synthetic report PDF were generated locally. The library and phone ICR screenshots were visually inspected. `git diff --check` passed.

Release scope is the existing protected preview branch only. Production main remains untouched.

## Independent review

A separate read-only reviewer found that the new commercial-investment type was absent from two existing property classification/suggestion guards. Both guards now include it; a minimal-input regression confirms the existing commercial tag and due-diligence suggestion are preserved without selecting a trigger or changing a rating. No other material findings were reported for arithmetic, validation, reset or stale-state handling.

The aggregate command `node --test tests/credit-framework-*.test.mjs` covers all 18 Credit Framework Node test files. The original 104 tests plus five new test blocks yield 109. The separate examples-browser script is a standalone headless smoke test, outside that aggregate.

Actual generated library/input screenshots were inspected, along with rendered PDF pages 1, 3, 4 and 16. A print pagination issue was fixed so the ICR calculation and source note stay together. Phone input scrolling was also checked against the bottom navigation. This is local Chromium verification, not a deployed-browser or Safari check.

The independent reviewer rechecked the fix and confirmed the finding resolved, with no further material findings. The older general browser harness needed explicit phone navigation, opening folded controls through their visible summaries, actual feedback print-visibility checks, and fresh clipboard completion. All original assertions remain intact.

A detached, clean baseline at `f0ef1ef` reproduced unintended mobile selections with the diagnostic harness. Pointer-event tracing identified a harness selector collision: `[data-mobile-view="inputs"]` matched the body as well as the navigation button. A click on the body center could select a deferral checkbox. Both browser scripts now target navigation buttons explicitly; case clicks are scoped to the case picker. The general smoke additionally asserts that navigation preserves selected triggers and deferrals. Output visibility assertions switch to Results first. No application behavior was changed to repair these test interactions.

Final verification: the unchanged baseline passes the corrected mobile diagnostic workflow. The working branch passes the complete legacy smoke on desktop and mobile, including custom/calibrated deferral statuses, copied reports, suggestions, feedback, layout and print assertions. The standalone six-example browser check also passes with explicit button selectors. All browser requests remain local; generated screenshots, PDF and diagnostic logs stay local.

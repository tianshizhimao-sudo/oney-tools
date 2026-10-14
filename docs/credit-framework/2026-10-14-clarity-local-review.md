# Credit Framework: clearer results and numeric input

Date: 14 October 2026
Status: combined usability release candidate. The user approved direct live publication and will phone-test. Deployment outcome is recorded separately in the release pull request.
Baseline: tianshizhimao-sudo/oney-tools, main at 020af703b3c1fcd8eb5997d82e4b3850fc10a145.

## What changed

### Less typing and clearer risk selection
- Seven intake areas now have quick choices: purpose, proposed security, trading picture, existing commitments, reported conduct, document availability and urgency.
- Unknown and Other remain available. Unknown is never a no-debt/no-risk answer, and is mutually exclusive with specific quick choices.
- Manual details are kept separately and combined with a visible “Broker-selected options (unverified)” prefix. Toggling choices does not overwrite narrative or any numeric amount. When both are present, a reminder asks the user to check for contradictions.
- Optional scenario, structure and exact lender wording are tucked into expandable detail areas; deal label is a single-line input.
- The 16 existing triggers are grouped into six expandable categories with plain-English explanations, selected/suggested counts, and an always-visible selected-trigger summary. Selected chips open the relevant category for review.
- Suggestions are still not automatically selected. Document availability does not update reviewed-evidence status.

### A clearer first view
- Added an always-visible “What needs attention?” overview before the existing detailed report.
- Shows the existing current rating with its source, selected Critical trigger counts, and the intake evidence-checklist counts.
- Puts up to three priority issues, their existing “why it matters” explanations, the next exact client question and related evidence requests together.
- Provides direct buttons to open and focus the full questions, evidence checklist, rating context or review tracker.
- Flags suggested triggers that have not been selected. An empty scenario explicitly says potential blockers and evidence gaps have not been assessed.
- Comprehensive shows separate broker-set evidence statuses and the existing evidence re-rate. A client reply does not count as reviewed supporting evidence.
- Simple retains its existing tier boundaries. Comprehensive-only wording, owners and evidence re-rate are not exposed there.
- Distinguishes potential issues from verified findings, and evidence requests from documents confirmed missing. Sample checklist counts are labelled as the original intake checklist and do not claim to update with tracker status.
- Uses the existing Oney colours, type, cards and responsive breakpoints. No invented score, confidence percentage or approval recommendation was added.

### Readable amounts
- Loan amount, security estimate and proposed total secured debt display comma grouping while editing, for example 1,250,000.50.
- The underlying engine still receives a number or an empty value, never a comma-formatted string. Formatting does not round entered decimal places.
- Supports ordinary comma-grouped paste, an optional dollar prefix, selection replacement, cursor position, deletion around a grouping comma, blanks and zero.
- Ambiguous comma-decimal paste such as 1,50 stays visibly invalid, including after a partial edit or another paste. Invalid values are excluded from calculations and named in a visible warning.
- Invalid drafts and decimal formatting survive a tier switch; choosing a sample or blank scenario resets the drafts.
- Rejects negative, non-numeric, exponential, non-finite and greater-than-JavaScript-safe-integer amounts instead of silently interpreting them.
- Restores keyboard focus after changing an evidence-review selector.

## Unchanged protections

engine.js, rules.js, cases.js and deferral-reasons.js are unchanged. The baseline files were verified against their GitHub blob hashes.

The manual rating, deterministic calculations, Medium confidence cap, reviewed-evidence requirement and custom-scenario no-auto-upgrade guardrail remain in place. A Black rating retains the existing pause/refer direction in either tier. No network calls, uploads, storage, submission or external service were added. Existing CSP and noindex controls remain intact. The full copied report continues to use the unchanged report engine; the overview is a presentation of the same source assessment.

No unrelated Tools-shell files are included.

## Verification

Passed on the final patch:
- Existing Credit Framework deterministic suite: 35/35.
- New input/overview regression suite: 8/8.
- New mounted DOM integration test: 1/1.
- Structured intake/grouping suite: 6/6 (five pure tests, one DOM integration).
- Combined run: 50/50, zero skipped.
- JavaScript syntax checks for shipped modules and new test files.
- Independent source and DOM review, including Simple/Comprehensive gating, empty/custom states, invalid-paste recovery, cursor editing and review-selector focus.
- Patch application check against the exact baseline and whitespace check.

The DOM run used an already installed jsdom. It is not a real-browser layout test. No new dependency is required by the application.

### Verification still needed

Real-browser desktop, narrow-screen/mobile and print layout have not been visually verified. The available cloud browser returned net::ERR_CONNECTION_REFUSED for the locally served patch. No DevTools/mobile-emulation workaround was attempted. No mobile screenshots or visual certification are supplied. The user explicitly approved direct live testing and will check the phone layout. Desktop live smoke will be attempted after deployment.

## Apply and review

From a clean repository based on the commit above:

1. Review credit-framework-clarity.patch.
2. Run git apply --check /path/to/credit-framework-clarity.patch.
3. Run git apply /path/to/credit-framework-clarity.patch.
4. Run node --test tests/credit-framework-mvp-wrapper.test.mjs tests/credit-framework-clarity.test.mjs tests/credit-framework-structured-intake.test.mjs.
5. For DOM integration, use an existing jsdom: CF_JSDOM_MODULE=/absolute/path/to/jsdom/lib/api.js node --test tests/credit-framework-clarity-dom.test.mjs. Without jsdom this optional test reports a skip, not a pass.
6. Serve the repository root with python3 -m http.server 8765 and visit http://localhost:8765/preview/credit-framework.html?tier=comprehensive. The page uses root-relative modules, so opening the HTML directly as file:// is not supported.

Suggested visual review: the three synthetic samples; a blank custom case; Simple/Comprehensive switching; comma input and invalid paste; all supporting evidence on a custom case; a Black manual rating; narrow layout; print preview. Use synthetic or de-identified input only.

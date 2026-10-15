# Case-linked materials preview

Base: released main `a37a7df945070a1eda376e2d6ed94fa5f307726f`. Preview only; no production merge or promotion.

## Design and boundaries

- The existing trigger-level Re-rate tracker is unchanged. Receipt notes live in a separate in-page Set and never write evidence status, readiness, rating or confidence. Received is not verified. Changing intake, trigger selection or rating clears receipt notes; reload/reset loses them. A tier switch alone preserves notes.
- Case-linked materials are derived from existing selected-trigger evidence names. Exact normalized names are deduplicated, preserving every linked reason and the highest priority. No fuzzy merging of potentially different documents.
- Conditional items come only from the existing deterministic intake suggestions that have not been selected. They remain unconfirmed, cannot be marked received, and are not lender-specific requirements. Selected evidence takes precedence where a document is shared with a conditional trigger.
- Broker list shows priority, why/trigger links and existing trigger review labels, explicitly separate from document-level verification. Unrecorded receipt means availability unknown; it does not assert absence. No completeness or lending-outcome claims.
- Comprehensive includes an applicant wording preview and an explicit Copy applicant list action. This is a draft for broker review, with scope and variable-lender/case caveats. Its allowlisted projection excludes raw intake, risk reasons, ratings, priorities and review judgments. Abbreviations are expanded without adding document periods or policies. Some entries are alternatives, information or broker-prepared work; the broker must confirm who should supply each.
- Simple includes only documents from its existing selected questions, with omitted-trigger disclosure. No applicant draft, receipt controls or conditional expansion. Applicant wording is not included in full-report copy/print. Full-report copy/print stays Broker-labelled even while viewing the applicant draft.
- No uploads, accounts, persistent storage, services, payment or client sending. Existing de-identification guidance, security policy, PWA navigation, manual-risk stale semantics and SME/commercial scope remain in place. Engine, rule library, cases, manual-risk modules and mobile controller are unchanged.

## Verification

Run the full existing and new deterministic/DOM suite:

`CF_JSDOM_MODULE=/path/to/jsdom/lib/api.js node --test tests/*.test.mjs`

New tests cover normalized deduplication, linked priorities, independent receipts, unchanged assessment/report, conditional/unknown/empty states, reset/stale/revert semantics, Simple gates, allowlisted applicant copy, per-sample wording lint, mounted receipt focus and tier/case changes. Existing manual-risk, PWA, print-source and action-matrix regressions are included. Syntax and whitespace checks are also run.

Independent review found and fixed a native DOM append-array rendering defect before publication, and caught test-fixture IDs and a wording-lint conflict. Final test results and deployment verification are reported with delivery.

## Remaining verification

DOM tests are not visual or native-device acceptance. Browser layout, real iOS/Android install/keyboard behavior and native print/PDF pagination remain unverified for this preview. Prior denied mobile-emulation/print routes were not used. Protected preview access is retained; no new access link or bypass has been created. Before any broader release, test with de-identified cases and verify applicant wording/alternatives with the responsible broker.

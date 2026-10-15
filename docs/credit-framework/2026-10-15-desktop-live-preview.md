# Desktop live comparison preview

Built on four-domain preview cd686e2a. Presentation only; no financial rules, document mappings, rating calculations or data persistence added.

- At 1450 CSS pixels and wider: input, full results with current-change explanation, compact sticky four-domain overview.
- At 1101–1449: existing two-column layout plus the current-change panel; no side rail.
- At 1100 and below: existing responsive flow, with both new projections hidden. No mobile redesign.
- Printing excludes both new projections; the original complete report, chart, source legend and single editor remain authoritative. Copy output is unchanged.

The inner compact ring projects selected review triggers in purple or grey; the outer projects existing manual status. Numbered buttons open the original editor rather than creating additional inputs or manual state. A changed outline is not a risk severity.

The middle panel compares the latest mapped display with the previous in-page render: shown selected triggers, input-derived reasons, unconfirmed suggestions, Comprehensive trigger-review entries and manual draft/stale/confirmed status. Tier changes are labelled as visibility changes. An input change without a mapped change explicitly does not establish unchanged risk. Counts of open trigger reviews are not document-gap counts. No-trigger domains remain unassessed.

Changing/loading/resetting a case starts a new comparison baseline. Existing receipt invalidation, monotonic manual staleness and blank/sample separation remain intact. Duplicate navigation summaries do not introduce duplicate editor IDs; the existing screen/print logo gradient IDs predate this change.

Verification includes pure projection tests, mounted update/focus/editor/reset/tier/copy checks and full existing regression tests. Responsive and print CSS are source/DOM checked. Actual-device appearance, scroll behaviour and native print/PDF pagination remain unverified; no protection bypass or access token was created.

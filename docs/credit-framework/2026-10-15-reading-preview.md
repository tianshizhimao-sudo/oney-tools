# Reading and theme preview iteration

Baseline: protected materials preview commit `ff4110826673106531748bc2e020095a004be012` (local source hashes verified against its Git tree). Updates the same preview branch only.

- Default light theme uses off-white, soft blue and lavender surfaces; a labelled Light / Dark switch is session-only. No preferences or case data are persisted. Theme changes do not rerender inputs or assessments.
- Topic labels and subtle section borders distinguish deal context, assessment, evidence/preparation and next steps. Topic colors do not encode credit outcomes. Existing risk labels and red/amber/green meaning remain.
- The main overview keeps priority issues, counts and next action visible. Why/evidence explanations, manual chart/editors, the legend and feedback are folded by default. The manual fold exposes all four current text statuses, including stale/unconfirmed states, outside its hidden body.
- Existing report summaries and details remain, with material counts and tier scope. Critical direct notices, material reset/unknown notices, Simple scope and re-rate guardrails remain outside collapsed bodies. Next-action links open/focus their target. Expand all includes the new reading folds but excludes optional feedback.
- Printing keeps existing section-body expansion. Native reading folds open for beforeprint, restore for afterprint, and tolerate repeated beforeprint events. Applicant preview stays excluded from broker printing. No actual print operation was performed.
- Engine, rules, cases, manual-risk state/validation, materials builder and applicant/report text builders are unchanged. Tests adapted only where deliberate folding changes the accessible UI path and where the new same-origin stylesheet is allowlisted.

## Verification

The full test suite includes deterministic rules, receipts, applicant isolation, tiers, mobile navigation, manual-risk stale behavior, DOM reading controls and print-source contracts. New palette tests calculate WCAG AA text contrast for major foregrounds against four light surfaces; these are not a substitute for rendered accessibility testing. Syntax and git whitespace checks are included, plus independent review.

Browser rendering through the authenticated deployment, actual-device PWA behavior, native print/PDF pagination and assistive-technology interaction remain unverified. No new preview access link, authentication bypass or production deployment is authorized or created by this iteration.

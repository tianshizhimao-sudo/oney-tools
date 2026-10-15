# Dual-ring comparison preview

Baseline: protected reading/materials preview `5dd353112b77ee3218edc48acafa8f0b124fd840`. Same preview branch; no production change.

## Exact aggregation

The existing RISK_AREAS maps all 16 existing triggers into four equal navigation areas. The inner ring uses only questions shown by the selected Simple/Comprehensive tier:

- At least one existing Critical-priority selected trigger: red, labelled **Critical review trigger**.
- Selected Important/Helpful triggers only: amber, labelled **Important / Helpful review trigger**.
- No selected trigger shown in this tier: grey, labelled **Not assessed — no selected trigger in this tier**. This is not a safe finding. Simple can omit Important/Helpful triggers; scope and total omitted-trigger count stay visible.

This is a display of existing rule priorities, not an automatic risk rating or new underwriting model. No auto-green state is generated. Existing intake suggestions remain separately labelled unconfirmed and never colour a ring unless the user selects the trigger. Selected-trigger provenance distinguishes a matching intake suggestion from manual selection without a current match; all input is unverified. Exact existing rule reasons are shown rather than inferred lender criteria.

Receipt notes, supporting/weak evidence marks and proposed mitigation do not change the inner rule priority. Removing/changing a selected trigger can change it, visibly, because the trigger set changed. The overall Black pause remains a separate visible warning and is included in copied output; it is not collapsed into a red segment.

## Outer ring and comparison

The outer ring retains existing manual Green/Amber/Red/grey states, required basis, required proposed next step for Red, draft handling, and monotonic stale semantics. Mitigation adequacy is unverified. Inner red beside outer green does not mean resolution or an upgrade. Neither ring changes overall rating, confidence, evidence re-rate or lender outcomes.

Both rings have four equal-angle segments, never weighted slices or probabilities. Numbered accessible links open the corresponding reasons and manual editor. Source legend, four-area text summary, tier scope and stop warnings remain outside collapsed detail. Printed content includes both source descriptions and reason/readout text; copied broker output contains inner indicators followed by the existing manual view. Applicant-material copy remains unchanged.

## Checks and limits

Tests cover existing-priority aggregation, suggestions-only grey, no auto-green after evidence/receipt/mitigation, input provenance, Simple omissions, unknown triggers, Black stop warning, assessment immutability, inner keyboard navigation, outer stale handling and copied sources. Existing theme, materials, manual-risk, mobile DOM and print-source checks remain included. Independent review is required before publication.

No uploads, account, persistence, extra service or pricing added. Actual protected-page rendering, real-device interaction and native print/PDF pagination remain unverified. No new access links or protection bypass were used.

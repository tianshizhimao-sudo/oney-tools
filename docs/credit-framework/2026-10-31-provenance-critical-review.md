# Credit Framework provenance, access history and whole-case summary

Local acceptance snapshot, 2026-10-31 (recorded before release authorization). Base: upstream main `4e9f03b` fetched from
`https://github.com/tianshizhimao-sudo/oney-tools.git`. Branch:
`fix/cf-provenance-critical-20261031`. At this acceptance checkpoint: no push, merge, deployment or live-site write.

## Existing implementation and acceptance criteria

The existing manual partial-support record already stored source ID, optional version/locator,
owner review date, confirmation time and reviewer judgement. Source edits already invalidated
confirmation. There was no independent access observation. The overview truncated issues at three,
although the full question list retained Critical items.

1. Missing source ID/version/locator (including whitespace) must be explicitly disclosed in editor,
   confirmed/draft record and copied report. Supplying citation fields must never imply verification.
2. Retain the existing owner review date as historical, supplied by the reviewer; keep it separate
   from manual access observation time and observation-recording time. Failed or successful access
   must not mutate confirmation, judgement, counterevidence, rating, confidence or Critical counts.
   Retain prior observations and their citation snapshots. A changed current citation must not inherit
   a prior citation's access result. No network check is performed.
3. Every unresolved selected Critical trigger must appear in the overview, even when there are more
   than three. Preserve engine ordering, statuses, tier gates, manual input and advisory actions.
   Simple retains its existing intake-only scope; Comprehensive respects manual supports status.
   The sample intake checklist remains separately labelled and accessible from the overview.

## Changes

- `evidence-review.js`: explicit provenance wording, separately recorded access observations with
  captured citations, historical date label and copy-report output. No change to existing confirmation
  requirements: incomplete provenance is disclosed, not silently promoted to verified evidence.
- `app.js`: provenance shown beside citation fields and review records; optional manual access form;
  independent observations survive tier changes and closing an unconfirmed editor. A source ID and
  observation time are required to record an observation. No link is fetched or opened.
- `overview.js`: retain all open Critical rows, then fill up to three rows with lower priorities only
  when fewer than three Critical rows exist. The existing route to all questions remains available.
- Added focused unit/DOM acceptance tests. Updated two older assertions that banned the bare word
  “verified”, so explicit “not verified” disclosures are allowed while positive verification claims
  remain prohibited.

## Verification

Command, using an existing installed jsdom without changing project dependencies:

```sh
CF_JSDOM_MODULE=/opt/homebrew/lib/node_modules/n8n/node_modules/jsdom/lib/api.js node --test tests/*.test.mjs
```

Result: **121 passed, 0 failed, 0 skipped**, exit 0. Includes four new acceptance tests and the
existing **128 rendered action combinations**, partial-record draft/stale/conflict/weak transitions,
network-policy classifier tests, rule/fixture parity, tier gates, print-source contracts and navigation.
The test log is delivered separately as `regression-final.log`. `git diff --check` passed.

Real in-app browser, local static HTTP server only:

- CF-002 Simple and Comprehensive each displayed all six selected Critical issues.
- Confirmed a synthetic partial record with source ID only: missing version and locator warning visible.
- Recorded “Could not open (reviewer reported)” dated 2026-10-31. Historical review date 2026-10-23,
  supported scope, remaining gap and CURRENT manual confirmation remained visible and unchanged;
  overview stayed at 6 / 6 Critical and red → red, Medium.
- At a requested 390 × 844 viewport (375px content area), Results had no horizontal overflow:
  `scrollWidth = clientWidth = 375`. All six Critical rows and access history survived switching to Simple.
- Screenshot: `provenance-access-desktop.png` delivered beside the patch.
- Temporary viewport reset and preview tab/server closed after verification.

## Boundaries and residual limits

This is a local reviewable change, not a live rollout. Manual dates and access observations are
self-reported, not independently verified. Source metadata improvements apply to the existing
manual partial-support record editor, not a new global document repository. No existing engine,
rule, sample judgement, source fixture, original input or persistent data file changed.

Records remain page-session-only, as before; reload/closing the page or explicitly removing a record
can discard them. The browser run checked UI behavior and layout, not a captured full network trace.
Static guards and network-policy classifier regressions passed; no source URL was requested.
Print content contracts passed, but a fresh multi-page PDF pagination run was not performed.

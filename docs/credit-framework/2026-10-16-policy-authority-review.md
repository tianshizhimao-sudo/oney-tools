# Policy Radar source integration — review

## Public content inventory

The canonical library is https://policy.oneyco.com.au/: Oney's primarily residential published policy and glossary library. It is the authoritative Oney publication, not a substitute for current lender policy. The UI uses neutral 'Reviewed and published by Oney' wording without freshness claims.

Public pages observed on 2026-10-16 between 10:02 and 10:07 UTC support these editorial summaries. This revision uses that existing observation record; no additional policy-site browsing was performed.

| Placement | Public source | Summary and scope |
| --- | --- | --- |
| Management supplementary reading | https://policy.oneyco.com.au/60-Policy-Publish/Glossary/Credit+Impairment | Common adverse credit-file events and credit-history review. General concept with predominantly residential examples; no commercial conduct, ATO, SG or management requirements. |
| Transaction supplementary reading | https://policy.oneyco.com.au/60-Policy-Publish/Topics/Loan+Purpose+Guide | Loan-purpose categories and intended-use questions. Primarily residential with some business-purpose discussion; not a commercial acceptance matrix. |
| Servicing supplementary reading | https://policy.oneyco.com.au/60-Policy-Publish/Topics/Serviceability+Comparison | Residential assessment rates, expenses, existing debts and rental income. Not SME cash-flow or commercial servicing rules. |
| Security supplementary reading | https://policy.oneyco.com.au/60-Policy-Publish/Topics/Security+Type+Guide | Property characteristics and title-related issues. Primarily residential; no commercial GSA, ranking or guarantee adequacy determination. |
| Transaction, Servicing and Security commercial research | https://policy.oneyco.com.au/60-Policy-Publish/Lenders/Thinktank | Mixed residential/commercial overview covering documentation, servicing and property security. Sections must be distinguished. Oney-reported verification 2026-04-08, medium confidence; no linked primary source observed and no current lender-appetite confirmation. |

## Date and applicability boundaries

The observation date is distinct from source publication dates and policy verification. Full-page dates for the four supplementary sources are unknown. Security's Bankwest construction correction dated 2026-10-01 is labelled as a specific correction, not full-page verification. Thinktank retains its dated 2026-04-08 verification claim. No numerical lender acceptance criteria were imported.

Supplementary residential/general records use a separate reading-domain map, with empty commercial-domain and trigger maps. They appear inside an additional collapsed disclosure labelled 'Supplementary residential / general reading — not commercial policy'. Thinktank is a separately labelled dated commercial reference, with no trigger matches. Source dates and limitations are folded; the summary and scope remain visible when a card is opened.

## Changes and safeguards

The shortcut and references use the canonical publication and exact source deep links, preserving literal plus signs. Legacy Commercial-tab directions are removed. Existing lender/government references and glossary content remain. No ratings, evidence status, eligibility decisions, lending calculations or applicant requirements change. Links carry no case data and suppress referrers. References remain outside copy/print output. No background fetching, storage or synchronisation is introduced.

Only concise editorial summaries of confirmed public content are included. No private files or unpublished text are included. No push or deployment occurred; production main is untouched.

## Verification

Tests cover canonical URLs and exact deep links, separate supplementary mappings, empty Policy Radar trigger matches, observed versus source-verified dates, safe links, collapsed details, English UI, print/copy boundaries and existing assessment behavior. Full Credit Framework regression suite: 104 tests passed, zero failed or skipped, using the existing local JSDOM runtime. `git diff --check` passed. Newly added public content was inspected for private paths, personal identifiers, internal tooling and non-English copy; none were found. Browser visual geometry was not tested.

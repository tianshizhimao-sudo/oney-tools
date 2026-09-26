# Oney Credit Framework — Current-State Audit vs 2026-10-01 MVP

> Date: 2026-09-26 (Sydney) · Branch: `feat/credit-framework-mvp-wrapper` · Author: Claude (task-04)
> Scope: evidence-based audit before building the internal MVP wrapper. Checkboxes and status labels in notes were **not** accepted as evidence on their own.

## 1. Source-of-truth set

| Role | Path | Version marker |
|---|---|---|
| Primary (authoritative) | `~/Documents/Oney-Brain - Local/20-Projects/Oney-Co/Oney-Credit-Framework/` (32 files) | Index "Last synced 2026-08-22"; newest file mtime 2026-08-22 09:35 AEST |
| Source workspace | `~/clawd/oney-co/products/credit-framework/` | Byte-identical to primary for all 31 shared files (`cmp`), no Index file |
| iCloud fallback | `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Oney-Brain/20-Projects/Oney-Co/Oney-Credit-Framework/` | Older snapshot, newest mtime 2026-08-15 12:17 |

Authoritative specs used: `mvp-wrapper-spec-v0.1.md` (2026-08-22), `tiered-output-pricing-logic-v0.1.md` (2026-08-15), `deferral-follow-up-engine-spec-v0.1.md` (2026-08-15), `FRAMEWORK-v0.1.md` (2026-08-05, safety-tightened 2026-08-06), `assets/follow-up-engine/rules-v0.1.json` (v0.1, 2026-08-15), `case-pack-v0.1.md`, `deal-coaching-report-template-v0.1.md` and the three sample reports.

### Cloud-stub fallback record

- 17 of 32 primary files were macOS `compressed,dataless` iCloud stubs; the Linux read path returned `Resource deadlock avoided`.
- Resolution: the files were hydrated by a native macOS read of the **same primary path**, then read in full. Fallback content was **not** substituted.
- Comparison (md5): 21 fallback files are identical to primary (16 notes + the 5 engine assets, which sit under `follow-up-engine/` instead of `assets/follow-up-engine/`); `README.md` differs (fallback lacks the `mvp-wrapper-spec` row, step-8 ✅ and the new "Next immediate task"); 10 primary notes (incl. `mvp-wrapper-spec-v0.1.md`, `FRAMEWORK-v0.1.md`, `case-pack-v0.1.md`, `evaluator-scorecard-v0.1.md`, all benchmark files, Index) are absent from the fallback. Fallback-only files: `Oney-Credit-Framework-Project.md`, `Daily Development Log.md` (both 2026-08-03 → 08-15; read as history).
- Follow-up engine assets are identical across all three locations (sha256 `rules-v0.1.json` = `9c92ed54…b006`).
- Conclusion: primary is the newest version; no divergence affects implementation requirements. **No blocking conflict.**

## 2. Status by MVP workstream

MVP definitions compared: blueprint §9 "Must-have v1" (`~/clawd/oney-co/products/oney-framework-v1-blueprint-2026-08-03.md`), fallback project note "MVP Scope for 2026-10-01", and the narrower, later `mvp-wrapper-spec-v0.1.md` §12–15.

| Workstream | Status | Evidence |
|---|---|---|
| Framework spec (dimensions, ratings, confidence calibration, wording rules) | **Completed and verified** | `FRAMEWORK-v0.1.md` §3, §6.2–6.4; safety tightening mirrored in `benchmark-prompt-v0.1.md` "Non-Negotiable Rules" |
| Synthetic case pack (5 cases) | **Completed and verified** | `case-pack-v0.1.md` CF-001…CF-005 with expected rating/risks/missing evidence |
| Evaluator scorecard (50-pt) | **Completed and verified** | `evaluator-scorecard-v0.1.md` §2–3 |
| Model benchmarks | **Partially completed** | Runs cover CF-002 and CF-003 only (run-002 45/46, run-003-gemini 38/38, run-003-analyst 47/47). CF-001/004/005 never benchmarked against a model. |
| Report template + samples | **Completed and verified** | Template + samples for CF-001 (Green), CF-002 (Red), CF-004 (Amber) |
| Deferral Follow-Up Engine (rules + generator) | **Completed and verified** (as CLI prototype) | `rules-v0.1.json` 16 rules; `generate_followups.py --tier simple|comprehensive` re-run 2026-09-26, output matches the committed tier demos |
| Engine embedded in report template | **Missing** | `deferral-follow-up-engine-spec-v0.1.md` §12 step 4 unchecked; template §10 is still static |
| Simple vs Comprehensive tiering | **Partially completed** | Logic spec'd; demos exist for CF-002 and CF-004 only; no CF-001 tier demo |
| MVP wrapper (intake → classification → tiers → re-rate) | **Missing (spec only)** | README "8. MVP wrapper / product packaging ✅" refers to the **spec**; no implementation found in `oney-tools` (grep for `credit-framework`, `Package Ready`, `Rework First`: no matches) |
| Scenario classification tags | **Missing** | Spec §6 only |
| Re-rate loop | **Missing** | Spec §10 only |
| Input schema v1 / structured JSON deal profile | **Partially completed** | Follow-up case JSON (dealId/rating/triggers) exists; full intake schema (spec §5) not implemented |
| 10–15 ANZSIC industry profiles | **Missing** | Not in project folder; 103-industry data lives in Bank-Ready Score (protected, not touched) |
| Credit Proposal Draft output | **Stale or superseded** | Blueprint output; superseded by Deal Coaching Report direction (Aug 15/22) |
| AI generation flow (hosted / BYO) | **Missing — deliberately deferred** | Wrapper spec §15 "Do not overbuild … AI orchestration yet" |
| Landing page, pricing display, payment, accounts | **Blocked (needs Dong decision)** | Wrapper spec §13 "Needs Dong decision"; Index "Decisions needed later" |
| Beta with 3–5 brokers | **Missing** | No feedback records found |

## 3. Duplicated / contradictory / stale artifacts

- **Duplicated:** `follow-up-checklist-demo-CF-002-red-v0.1.md` ≡ `tier-demo-CF-002-comprehensive-followup-v0.1.md` minus the tier-scope and re-rate blocks (diffed). Same pattern for CF-004. Checklist demos are the pre-tiering generator output.
- **Duplicated/confusing naming:** two "run 003" files — `benchmark-run-003-gemini.md` (real Gemini CLI) and `benchmark-run-003-analyst-gemini.md` (self-described "simulated second-model assessment"). README lists only the former.
- **Contradictory (calibration):** CF-001 sample/case pack give **Medium-High** confidence while three critical items are outstanding; `FRAMEWORK-v0.1.md` §6.3 and the later `mvp-wrapper-spec` §8 cap confidence at Medium when critical evidence is missing. Wrapper applies the later spec (Medium) and shows the discrepancy. **Needs Dong confirmation.** _Resolved 2026-09-26: Dong chose Medium until Critical evidence is resolved; the Medium-High benchmark expectation is annotated as superseded in the source notes._
- **Calibration observation:** the generator sorts by priority → category (alphabetical) → id and the Simple tier keeps 5. For CF-002 that drops `sg_unevidenced` (Critical) from Simple while keeping the MCA question, even though the case pack treats SG evidence as critical. Behaviour preserved for parity; flagged for Dong. _Resolved 2026-09-26 (release red team RT-02): Simple now keeps every Critical question — see the verification doc, red-team section._
- **Wording outside the compliance boundary in source notes:** case-pack CF-002 title ("Viable Business"), CF-004 ideal next step ("make approval conditional"), CF-002 sample missing-evidence #10 ("viable secured-lending route"), CF-004 sample environmental item ("decline to rely"), `FRAMEWORK` Black action ("Decline, refer"). These are not shown verbatim; the wrapper uses reworded, compliance-safe equivalents.
- **Stale:** fallback `Oney-Credit-Framework-Project.md` week-by-week checkboxes (all Week 2–8 items unchecked since 2026-08-03); `CLAUDE.md` strategy section dated 2026-04.

## 4. Reusable assets

`rules-v0.1.json` (all 16 rules, verbatim), the three case JSONs, `generate_followups.py` sorting/tier logic, case-pack facts tables, sample-report judgement (risks, dimension ratings, missing-evidence decision impact, packaging angle), wrapper-spec boundary sentence and wording table. Repo patterns: `preview/*.html` noindex test pages with logic in `assets/js/preview/*.js` ES modules and `node tests/*.mjs` checks (`bb2b68e`).

## 5. Missing P0 capabilities (for a sellable 2026-10-01 v1)

1. Runnable wrapper connecting engine + tiers + re-rate (this task).
2. Dong walkthrough/calibration of the wrapper output (spec §13 item 7).
3. Decisions: public launch, pricing display, payment path, real-data collection, compliance wording sign-off. _(Real data: Dong decided 2026-09-26, `d77d437` — invited beta may use de-identified real deals only.)_
4. Model layer (hosted or BYO) — deferred by spec.
5. Industry profiles — not started.

## 6. Recommended next P0 increment

Build the internal, unlisted/noindex static wrapper defined by `mvp-wrapper-spec-v0.1.md` §12–13 using the existing rule library and CF-001/002/004. This is the spec's own "Next Immediate Task" (§15), Index "Near-term build queue" items 1–6, and README "Next immediate task". **Confirmed as the correct next increment; no blocking conflict.**

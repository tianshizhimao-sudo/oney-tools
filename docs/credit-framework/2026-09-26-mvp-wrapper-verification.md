# Credit Framework MVP Wrapper — Verification Evidence

> Date: 2026-09-26 · Branch: `feat/credit-framework-mvp-wrapper` · Page: `preview/credit-framework.html`
> Open locally: from the repo root run any static server (e.g. `python3 -m http.server 8765`) and visit `/preview/credit-framework.html` (`?case=CF-001|CF-002|CF-004&tier=simple|comprehensive` optional). The page uses absolute `/assets/...` module paths, so it must be served from the repo root, not opened as `file://`.

## Commands and results

| Command | Where | Result |
|---|---|---|
| `git diff --check` (new files added with `git add -N`) | macOS repo | clean |
| `node --test tests/credit-framework-mvp-wrapper.test.mjs` | macOS, Node v25.7.0 | **16/16 pass** |
| same | Linux, Node v22 | 16/16 pass |
| `node tests/oney-coach-bank-ready-test.mjs` (existing) | macOS | pass (unchanged) |
| `node scripts/test-ato-disclosure-alert.cjs` (existing) | macOS | 4/4 pass (unchanged) |
| `node --check` on all new JS/MJS | macOS | syntax OK |
| `node tests/credit-framework-browser-smoke.mjs` | macOS (no Playwright installed) | `{"skip":true}` — no dependency added |
| `PLAYWRIGHT_MODULE=… node tests/credit-framework-browser-smoke.mjs` | Linux sandbox, Playwright 1.56 bundled **Chromium 141.0.7390.37**, headless | **pass** |

Browser run served sha256-identical copies of the five shipped files (`credit-framework.html` `5e0a2e18…`, `engine.js` `29394a66…`, `app.js` `593a809e…`, `cases.js` `96a995f7…`, `rules.js` `8dc034cc…`).

## Browser smoke — desktop 1440×900 and mobile 390×844 (DPR 3, touch)

| Check | Desktop | 390px |
|---|---|---|
| Requests | 5, all same-origin GET (page + 4 modules) | same |
| External / non-GET requests | 0 / 0 | 0 / 0 |
| CSP probe `fetch('https://example.com')` from page | blocked (`connect-src 'none'`) | blocked |
| Console errors | only the two intentional CSP-probe refusals | same |
| `meta robots` | `noindex,nofollow,noarchive,nosnippet` | same |
| CF-001 questions Simple / Comprehensive | 3 / 3 | 3 / 3 |
| CF-002 questions Simple / Comprehensive | 5 / 7 | 5 / 7 |
| CF-004 questions Simple / Comprehensive | 4 / 4 | 4 / 4 |
| Simple: locked sections / gated fields / email | 4 / 0 / none | same |
| Comprehensive: gated fields (4 per question) / email / re-rate selects | present | present |
| Kinds visible (fact, calculation, assumption, rule, judgement) | all 5, every case | all 5 |
| Wording linter badge | pass on every case × tier | pass |
| Copy → clipboard read-back | boundary present; Simple copy has no `If strong:`; Comprehensive has it | same |
| Re-rate CF-002: all "client replied" → | `red → red (unchanged)` | same |
| Re-rate CF-002: all "supports" → | `red → amber (up)`, confidence Medium | same |
| Editing CF-004 loan amount | judgement withdrawn notice shown | same |
| Horizontal overflow (scrollWidth vs clientWidth) | 1440 / 1440, 0 offenders | **390 / 390, 0 offenders** |
| Tier button height | 53px | 44px |
| Logo + watermark | visible | visible |
| Print media: intake / controls hidden, print header shown, white background, watermark shown | yes | yes |
| `page.pdf()` A4, CF-002 Comprehensive | 331 KB, 12 pages | — |

Screenshots and the PDF are stored in the Obsidian project folder under `assets/mvp-wrapper-evidence/2026-09-26/`.

## Manual observations

- Mobile: intake sections start collapsed below 1100px and a "View output ↓" link jumps to results.
- Print: boundary, legend, kind badges, logo and a diagonal "ONEY & CO · INTERNAL PROTOTYPE" watermark print on every page.

## Protected systems

No existing file was modified. Not touched: Commercial Intake, FHC, Bank-Ready Score, Supabase schema/Edge Functions, credentials, DNS, `sitemap.xml`, `robots.txt`, `index.html`, `tools.html`, tool registries. Nothing pushed, merged or deployed.

---

## Release red-team remediation — 2026-09-26 (post-`d77d437`)

> Branch: `fix/credit-framework-red-team-remediation` from `main` @ `d77d437` (live invited beta). Not merged, pushed or deployed.
> Input: ChatGPT Routine 02 release red team (HOLD, RT-01..RT-05), re-triaged in `claude-tasks/task-05`. The sections above are the original 2026-09-26 build evidence and are kept as history.

### Current state at `d77d437` (what the red team reviewed)

- Page `preview/credit-framework.html` live as unlisted, noindex invited beta; not in sitemap/nav/registries.
- Dong decision (commit `d77d437`): invited brokers may enter real deals **de-identified only** — no names, ABNs/ACNs, addresses, dates of birth or account numbers. Everything runs in the browser; CSP `default-src 'none'`, `connect-src 'none'`, `form-action 'none'`; no storage, upload or submission. RT-01 is therefore a source-of-truth sync item, not a live defect.
- CF-001 confidence: Dong chose **Medium** with watch points (RT-05 runtime already aligned; notes now annotated).

### Disposition and change

| ID | Disposition | Change on this branch | Proof |
|---|---|---|---|
| RT-01 | Product decision already made (`d77d437`) | Obsidian/source notes annotated (FRAMEWORK §10, wrapper spec §13, Index, build note). Page copy unchanged. | Existing test `beta data notice` |
| RT-02 | Confirmed P1 → fixed | `generateFollowUps(…, 'simple')` keeps every triggered Critical question, then fills to 5 with non-critical ones. Over 5 Critical → all shown + "Simple expanded" note (UI + copy). Simple top-missing-evidence discloses Critical items beyond its five. | Node test `RT-02` (CF-002 includes `sg_unevidenced`; exhaustive 65,536 trigger sets: no Critical ever dropped, parity with the Python slice whenever ≤5 Critical); browser: SG visible in CF-002 Simple, desktop + 390px |
| RT-03 | P2 hardening → done | Status labels: *Not received / not yet reviewed* · *Client reply only — does not count* · *Reviewed evidence — supports* · *Reviewed evidence — weak/contradicts*; guardrail says "reviewed evidence"; new "Reviewed evidence only" rule shown in the tracker and copied text. No upload/storage. | Node test `RT-03` (exhaustive 4ⁿ status combos for all 3 cases = 16,704: no upward move unless every Critical is reviewed-supports; reply-only ≡ not received); browser checks labels + rule visible |
| RT-04 | Evidence gap → closed | `tests/fixtures/credit-framework/rerate-matrix.json` shared by Node tests and browser smoke. | Node test `RT-04`; browser drives every row through the selects at 1440 and 390 |
| RT-05 | Documentation debt → closed | Case pack + CF-001 sample/demo annotated "Medium-High superseded by Medium". | Existing confidence test |

Deliberate divergence: `generate_followups.py` (Python CLI) still slices Simple to 5; the wrapper no longer does. Only the Critical-overflow case differs (CF-002 among the samples).

### Re-rate matrix (Comprehensive; identical in Node and in the browser at 1440 and 390px)

> **Superseded by the 2026-09-27 calibration follow-up below** (Medium-High removed; Important weak moves Green to Amber). Kept as the `bf19377` record.

Scenarios: **outstanding** = nothing reviewed · **reply_only** = every item client reply only · **critical_supported** = every Critical reviewed-supports, non-critical outstanding · **all_supported** · **one_critical_weak** = first Critical reviewed-weak, rest supports · **mixed_critical_reply** = all supports except the last Critical = reply only · **important_weak** = all Critical supports, first non-critical weak.

| Case (start) | outstanding | reply_only | critical_supported | all_supported | one_critical_weak | mixed_critical_reply | important_weak |
|---|---|---|---|---|---|---|---|
| CF-001 (Green; 1 Critical, 2 Important) | Green · Medium | Green · Medium | Green · Medium-High | Green · Medium-High | **Amber ↓** · Low | Green · Medium | Green · Medium-High |
| CF-002 (Red; 6 Critical, 1 Important; specialist path) | Red · Medium | Red · Medium | **Amber ↑** · Medium | **Amber ↑** · Medium | Red · Low | Red · Medium | Red · Medium |
| CF-004 (Amber; 3 Critical, 1 Important) | Amber · Medium | Amber · Medium | **Green ↑** · Medium-High | **Green ↑** · Medium-High | **Red ↓** · Low | Amber · Medium | Amber · Medium-High |

Observations for Dong (behaviour unchanged — outside this task's scope): _Both resolved 2026-09-27 — see below._
1. "Medium-High" appears in re-rate output when every Critical is reviewed-supports on a non-specialist case; FRAMEWORK §6.3 defines only High / Medium / Low.
2. A weak Important item holds the rating rather than lowering it (CF-001 contract/use-of-funds weak stays Green), whereas the Green re-rate note says such weakness should move to Amber.

### Commands and results (this branch)

| Command | Where | Result |
|---|---|---|
| `git diff --check` | macOS repo | clean |
| `node --test tests/credit-framework-mvp-wrapper.test.mjs` | macOS VM, Node v22 | **27/27 pass** (was 24) |
| Mutation check: revert Simple to `slice(0,5)` | scratch copy | 4 tests fail (as intended) |
| Mutation check: count reply-only as supports | scratch copy | 3 tests fail (as intended) |
| `PLAYWRIGHT_MODULE=… node tests/credit-framework-browser-smoke.mjs` | Linux, Playwright bundled Chromium 141.0.7390.37 | **pass**, desktop 1440×900 + mobile 390×844 |

Browser smoke (both viewports): 6 same-origin GETs (page + 5 modules), 0 external, 0 non-GET; CSP blocks `fetch('https://example.com')`; `noindex,nofollow,noarchive,nosnippet`; wording check pass on every case, tier and matrix row; CF-001/002/004 Simple questions 3/**6**/4, Comprehensive 3/7/4; "Simple expanded" note only on CF-002; SG question visible in CF-002 Simple; re-rate matrix above reproduced row-for-row; no horizontal overflow (1440/1440, 390/390); print media and 14-page A4 PDF.

Smoke-test fix: case buttons are now addressed as `#case-picker [data-case=…]`. `<body data-case>` mirrors the current case, so the old bare selector clicked `<body>` when re-selecting the current case and silently did not reset evidence (found while adding the matrix).

Evidence (screenshots, PDF, smoke JSON): Obsidian project `assets/mvp-wrapper-evidence/2026-09-26-red-team/`.

---

## Calibration follow-up — 2026-09-27 (same branch, after `bf19377`)

Dong/Oney review of task-05 passed with two calibration fixes requested (not merged or deployed):

1. **Confidence is strictly High / Medium / Low** (FRAMEWORK §6.3). The undefined "Medium-High" category is removed from runtime (`CONFIDENCE_LEVELS = ['Low','Medium','High']`). Invited beta has no independent document verification or banker review, so **post-evidence confidence is capped at Medium** even when every Critical item is marked reviewed-supports; a weak Critical item still gives Low. The cap is shown in the re-rate tracker and copied text ("Confidence cap: …").
2. **Important weak on Green → Amber.** If the current rating is Green and any triggered Important item is marked reviewed evidence weak/contradicts, the re-rate moves Green → Amber (also while Critical items are still outstanding). Amber or Red is not downgraded again by an Important weakness alone. Critical-weak behaviour is unchanged (one level down; Red stays Red; Black never moves).

### Re-rate matrix (current — Node and browser, 1440 and 390px)

Scenarios as above, plus **last_important_weak** = all Critical supports, last Important item weak (CF-001: `working_capital_vague`; **important_weak** is CF-001 `contract_growth`).

| Case (start) | outstanding | reply_only | critical_supported | all_supported | one_critical_weak | mixed_critical_reply | important_weak | last_important_weak |
|---|---|---|---|---|---|---|---|---|
| CF-001 (Green) | Green · Medium | Green · Medium | Green · Medium | Green · Medium | **Amber ↓** · Low | Green · Medium | **Amber ↓** · Medium | **Amber ↓** · Medium |
| CF-002 (Red, specialist) | Red · Medium | Red · Medium | **Amber ↑** · Medium | **Amber ↑** · Medium | Red · Low | Red · Medium | Red · Medium | Red · Medium |
| CF-004 (Amber) | Amber · Medium | Amber · Medium | **Green ↑** · Medium | **Green ↑** · Medium | **Red ↓** · Low | Amber · Medium | Amber · Medium | Amber · Medium |

### Tests (follow-up)

| Check | Result |
|---|---|
| `git diff --check` | clean |
| `node --test tests/credit-framework-mvp-wrapper.test.mjs` (macOS VM, Node v22) | **28/28 pass** |
| New Node test "calibration 2026-09-27" | explicit pins: CF-001 `contract_growth` weak → Amber, `working_capital_vague` weak → Amber; all-supported CF-001 Green·Medium, CF-002 Amber·Medium, CF-004 Green·Medium; reply-only never moves; Amber/Red not downgraded by Important weak; Critical-weak unchanged. Exhaustive over all 16,704 status combinations: confidence only Low/Medium, Low ⇔ a Critical item weak, Green + Important weak never stays Green. No "Medium-High" in engine.js, app.js or the page. |
| Mutation: remove Green/Important rule | 2 tests fail (as intended) |
| Mutation: return High when all Critical supported | 3 tests fail (as intended) |
| Browser smoke, Chromium 141, desktop 1440 + mobile 390 | **pass** — every matrix row reproduced through the UI; explicit pins above asserted; "Confidence cap" visible; no "Medium-High" text on the page; CSP blocks external fetch; noindex; 0 external / non-GET requests; no horizontal overflow (1440/1440, 390/390); CF-002 Simple still 6 questions with SG visible |

---

## Custom-scenario re-rate guardrail — 2026-09-27 (task-06, branch `fix/credit-framework-custom-rerate-guardrail` from `main` @ `29ce13c`)

**Gap (Adversarial Case Lab R03 v2, reproduced on `29ce13c`):** a custom Amber case with weak capacity moved to Green · Medium when an unrelated selected Critical trigger (e.g. `valuation_sensitive`) was marked reviewed-supports. The v0.1 rule library has no generic SME capacity/serviceability trigger.

**Rule (invited beta):** only untouched, calibrated samples (CF-001/002/004, `isPristine`) re-rate upward automatically. For custom or edited scenarios `rerate()` computes `upwardEligible`, then holds the rating (`upwardBlocked`), adds the reason "Upward movement held (… not applied)", strategy "Hold at … — banker review required before any upward movement" and next step "Book banker review …". Downgrades (Critical weak → one level + Low; Green + Important weak → Amber) are unchanged. `rerate()` defaults to `calibrated: false`; the assessment passes `calibrated: pristine`, never anything derived from the deal ID. Shown in the Comprehensive re-rate tracker ("Banker review before any upgrade") and in copied text ("Custom-scenario guardrail: …"); Simple unchanged. No capacity trigger, DSCR threshold or lender-policy rule was added.

**Calibrated matrix:** `rerate-matrix.json` byte-identical; the matrix tests now pass `calibrated: true` explicitly.

### Adversarial fixtures (`tests/fixtures/credit-framework/adversarial-cases.json`, synthetic)

| Case | Role | Triggers inferred from intake | All Critical reviewed-supports | One Critical weak | Arithmetic pins |
|---|---|---|---|---|---|
| AC-01 (Amber) | fixture | `supplier_arrears`, `sg_unevidenced` (Critical), `working_capital_vague` | Amber · Medium, upgrade held (eligible only when **both** Critical support) | Red · Low | LVR 58.33% (shown 58.3%), facility/EBITDA 1.4516x, arrears/EBITDA 0.50 |
| AC-03 (Red) | fixture | `mca_present`, `dishonours_recent` (Critical), `working_capital_vague` | Red · Medium, upgrade held (eligible only when **both** support) | Red · Low | MCA annualised $546,000; proposed annual $138,000; nominal repayment reduction $408,000 (never "free cash flow"); facility/EBITDA 1.1707x |
| AC-02 (Amber) | **sentinel only** | `zoning_environmental_missing` (Critical), `related_party_security` — low LVR does **not** infer `valuation_sensitive` | Amber · Medium, upgrade held; the calibrated rule alone would give Green — the gap the guardrail closes | Red · Low | LVR 35.0%; combined debt service $300,000; EBITDA/debt-service proxy 0.8667x (proxy, not lender DSCR); facility/EBITDA 4.0385x |

### Tests

| Check | Result |
|---|---|
| `git diff --check` | clean |
| `node --test tests/credit-framework-mvp-wrapper.test.mjs` | **34/34 pass** (6 new task-06 tests) |
| Exhaustive custom property (AC-01/02/03 × 4 ratings × every status combination = 576) | never "up"; identical to the calibrated rule except blocked upgrades; reply-only ≡ outstanding |
| `node tests/oney-coach-bank-ready-test.mjs`, `node scripts/test-ato-disclosure-alert.cjs` | pass |
| Mutations (scratch copy): M1 bypass guardrail → 5 fail · M2 assessment always calibrated → 4 fail · M3 trust from deal name/trigger set → 2 fail · M4 default `calibrated = true` → 2 fail · M5 guardrail removed from copied text → 1 fail | all caught |
| Browser smoke, Chromium 141, desktop 1440 + mobile 390 | **pass** — AC-01/02/03 typed through the form: triggers match, Simple shows every Critical and no guardrail, all-Critical-supported held (Amber/Red · Medium) with guardrail visible and `data-upward-blocked=true`, reply-only unchanged, Critical weak → Red · Low, custom Green + Important weak → Amber · Medium, AC-02 copied text carries the guardrail; calibrated CF matrix unchanged with no custom guardrail; CSP blocks external fetch; noindex; 6 same-origin GETs, 0 external/non-GET; no overflow (1440/1440, 390/390) |

~~Known limitation: the deferral-recovery status ("ready to resubmit") for a custom scenario still follows linked evidence statuses.~~ Resolved in the follow-up below.

### Follow-up — deferral status and AC-02 wording (same branch, after `2344f37`)

**1. Deferral/re-rate contradiction resolved.** `buildDeferralPlan(codes, questions, evidence, { calibrated })` now takes the same untouched-sample signal as `rerate()` (assessment passes `pristine`; direct calls default to `calibrated: false`). Per deferral reason:

| Linked evidence | Calibrated sample | Custom / edited |
|---|---|---|
| any reviewed weak | Pause | Pause |
| outstanding or reply-only (reply-only never counts) | Rework | Rework |
| all reviewed-supporting | Ready to resubmit (unchanged) | **Evidence ready for banker review — do not resubmit automatically** (new `banker_review` status) |

Custom UI chip, section summary ("… · evidence ready for banker review.") and copied text never say "Ready to resubmit"; the re-rate for the same state holds the upgrade for banker review, so both messages agree.

**2. AC-02 wording.** The $72,000 is now explicitly retained vehicle and equipment leases: kept after settlement, not refinanced, not part of the $228,000 proposed repayments (purpose = "term debt only"; `retainedObligations` block in the fixture). Arithmetic unchanged: $72,000 retained + $228,000 proposed = $300,000; EBITDA/debt-service proxy 0.8667x (proxy, not a lender DSCR). No threshold added.

| Check | Result |
|---|---|
| `git diff --check` | clean |
| Credit Framework Node suite | **35/35 pass** (new deferral test incl. exhaustive AC-01/02/03 × every evidence combination × all 9 deferral reasons: custom never "resubmit"; only the ready state differs from calibrated) |
| Oney Coach, ATO disclosure tests | pass |
| Mutations: D1 bypass custom deferral guardrail → 1 fail · D2 plan always calibrated → 1 fail · D3 unsafe default for direct calls → 1 fail · D4 weak no longer pauses → 2 fail · D5 reply-only counted as reviewed → 2 fail | all caught |
| Browser smoke, Chromium 141, 1440 + 390 | **pass** — custom AC-03 + "conduct" deferral: weak → pause, outstanding → rework, reply-only → rework, all supported → "evidence ready for banker review"; "Ready to resubmit" nowhere on the page or in copied text; calibrated CF-002: pause / rework / rework / ready to resubmit (unchanged); custom re-rate guardrail rows unchanged; CSP blocks external fetch; noindex; 6 same-origin GETs, 0 external/non-GET; no overflow (1440/1440, 390/390) |

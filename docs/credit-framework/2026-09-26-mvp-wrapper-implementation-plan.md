# Credit Framework MVP Wrapper — Implementation Plan

> Date: 2026-09-26 · Branch: `feat/credit-framework-mvp-wrapper` · Written before implementation code.
> Audit: [2026-09-26-current-state-audit.md](2026-09-26-current-state-audit.md)

## Scope

One internal, noindex static page that runs the `mvp-wrapper-spec-v0.1.md` flow for synthetic cases CF-001 (Green), CF-002 (Red/ATO) and CF-004 (Amber/commercial property):

intake (sample loader + editable facts + manual trigger selection + tier) → scenario tags → rating + evidence-weighted confidence → Deferral Follow-Up Engine → Simple or Comprehensive output → Comprehensive re-rate tracker → copy / print-to-PDF.

## Source-of-truth specs

`mvp-wrapper-spec-v0.1.md` (§3 boundary + wording, §6 tags, §7 tiers, §8 rating/confidence, §9 engine I/O, §10 re-rate, §11 page structure), `tiered-output-pricing-logic-v0.1.md` §4 gating table, `deferral-follow-up-engine-spec-v0.1.md` §3/§5/§7/§11, `FRAMEWORK-v0.1.md` §3 fact/judgement taxonomy + §6.3 confidence rules, `rules-v0.1.json`, `case-pack-v0.1.md`, CF-001/002/004 sample reports.

## Files and architecture

| Path | Purpose |
|---|---|
| `preview/credit-framework.html` | Page shell: markup + CSS only; CSP `connect-src 'none'`; noindex |
| `assets/js/preview/credit-framework/rules.js` | `rules-v0.1.json` converted verbatim to a browser/Node ES module |
| `assets/js/preview/credit-framework/cases.js` | CF-001/002/004: case-pack facts, follow-up case JSON, pre-generated judgement |
| `assets/js/preview/credit-framework/engine.js` | Pure deterministic engine (no DOM): generator port, tags, confidence, gating, re-rate, email, plain-text report, compliance linter |
| `assets/js/preview/credit-framework/app.js` | DOM wiring (render, tabs, copy, print) |
| `tests/credit-framework-mvp-wrapper.test.mjs` | Node `assert` tests, no dependencies |
| `tests/credit-framework-browser-smoke.mjs` | Optional headless-Chromium smoke test; skips cleanly if Playwright is not resolvable |
| `tests/fixtures/credit-framework/*.json` | Verbatim copies of the Obsidian engine assets (sha256 recorded in audit) |
| `docs/credit-framework/*.md` | Audit, this plan, verification evidence |

Follows the `bb2b68e` preview pattern (`preview/*.html` + `assets/js/preview/*` + `tests/*.mjs`). No package.json, no build step, no new dependency.

## Reuse strategy

- Rules: `rules.js` is a verbatim transcription; a test deep-equals it against the fixture JSON.
- Generator: `generateFollowUps(case, tier)` ports `generate_followups.py` exactly (priority → category → id sort, Simple = first 5, unknown triggers reported, same engine-view strings). Tests pin the Python output order for all 3 cases × 2 tiers.
- Case JSON: `dealId`, `dealName`, `currentRating`, `scenario`, `triggers` taken unchanged from the case fixtures (test enforces equality).

## Deterministic rule boundaries (labelled **Rule** in UI)

Trigger → question/evidence/if-strong/if-weak/owner/wording; question ordering + Simple cap; scenario tags (trigger → tag map, spec §6); calculations (LVR from facts); confidence ceiling (Critical evidence outstanding → max Medium; specialist/private path → never High; appetite-driving evidence missing → Low-cap review flag); tier gating; re-rate movement + guardrail; required boundary sentence; banned-wording linter.

## Model-judgement representation (labelled **Judgement**)

No live AI call. Judgement shown is the pre-generated, banker-calibrated content from the v0.1 sample reports (rating, one-line view, dimension ratings, risks + mitigants, missing-evidence decision impact, packaging angle), tagged with its source file. If the user edits facts or triggers, judgement is withdrawn and replaced by a "custom scenario — no model judgement in this prototype" notice; rule output still runs.

Every rendered item carries one kind: **Fact** (case input), **Calculation**, **Assumption**, **Rule**, **Judgement**, visibly distinguished by colour-coded tag + legend, and by `[FACT]`-style prefixes in copied text.

## Simple vs Comprehensive gating (tiered-output §4)

Simple: snapshot, rating, confidence, top 5 risks, top 5 missing-evidence items (limited impact), highest-impact questions (Priority / Trigger / Question / Why / Evidence), one next step, upgrade + Dong-review CTA (inert).
Comprehensive adds: dimension-by-dimension table, risks + mitigants, Critical/Important/Helpful evidence with decision impact + if weak, full question workflow (+ if strong / if weak / owner / client wording), deferral-recovery note, packaging strategy, client email draft, re-rate tracker. Gated content is **not rendered** in Simple (locked placeholders only) and is excluded from Simple copy/print.

## Compliance controls

Required boundary sentence on every output view, copy and print. Wording table applied to all copy. `lintCompliance(text)` flags approval/decline, bankable, viable/viability, financeable/fundable, "will pass", "lender will accept", guarantee claims; the only allow-listed occurrences are the exact required boundary sentences. Tests lint every case × tier × re-rate state; the page runs the linter live and shows a pass/fail badge.

## No-network / no-production-data controls

CSP meta `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'`. No external fonts/scripts, no `fetch`/XHR/WebSocket/EventSource/`sendBeacon`, no localStorage writes, no forms with actions, no Supabase/Resend references. Synthetic cases only; free-text entry discouraged via notice. Page not added to `sitemap.xml`, `index.html`, `tools.html`, tool registries or `robots.txt`.

## Responsive and print/PDF

Mobile-first CSS; single column below 820px; tables collapse to cards; no horizontal overflow at 390px. Print: `@media print` hides intake/controls, white background, keeps legend, boundary, watermark and Oney logo; "Export PDF" = `window.print()`.

## Automated tests

Node test (`node tests/credit-framework-mvp-wrapper.test.mjs`): rule/case parity, generator parity, tags, calculations, confidence caps, tier gating (data + plain text), expected risks / missing evidence / questions per case, re-rate outcomes + guardrail, email gating, compliance linter (positive + negative), boundary presence, kind labels, static HTML/JS scans (noindex, CSP, no network APIs, no external URLs, no secrets, no storage writes), not-linked checks.

## Browser smoke strategy

Headless Chromium (Playwright's bundled build) against a local static server: desktop 1440×900 and 390×844. Record console errors, every request (must be same-origin static GETs only), run CF-001/002/004 in both tiers, check gating, questions, boundary text, copy (clipboard read-back), print media emulation + `page.pdf()`, watermark/logo visibility, no horizontal overflow at 390px; save screenshots.

## Non-goals

No deployment, push or merge; no backend, Supabase, Edge Functions, auth, payment, pricing display, email sending, AI/model calls, real data, production nav/DNS changes; no edits to Commercial Intake, FHC, Bank-Ready Score or any existing tool; no new dependencies.

## Definition of done

Plan + audit committed; page runnable from a static server; all Node tests pass; `git diff --check` clean; browser smoke passes at desktop and 390px (or unavailability evidenced); single conventional commit on `feat/credit-framework-mvp-wrapper`; nothing pushed.

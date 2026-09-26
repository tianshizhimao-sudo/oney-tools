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

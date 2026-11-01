# Credit Framework print/PDF acceptance — 2026-11-01

Status: accepted locally for the coverage below; NOT published, pushed or merged.
Branch: `fix/cf-print-acceptance-20261101`.
Production/base commit: `10763458f92026f9939c3e140cb94544a8cb0395`.
Production route: https://tools.oneyco.com.au/preview/credit-framework.html

Production HTML, app.js, overview.js and evidence-review.js hashes matched this commit.
Nine baseline PDFs were generated from the public production route with synthetic data.
The final PDFs were generated from the local candidate, not the unchanged live site.
The delivery manifest records the candidate commit and individual PDF SHA-256 hashes.

## Defects and corrections

1. Closed native review details in Simple omitted their contents in Chromium PDF output.
   The production history Simple PDF omitted `Incomplete provenance` and `2026-10-23`.
   Print now temporarily opens review records and restores the original disclosure state
   after printing. Existing-open records remain open. Repeated beforeprint is idempotent.
2. An unbroken 180-character source suffix overflowed the production stress PDF's right
   edge. Review records now wrap arbitrary citations and can span pages; confirmed and
   draft citations stay distinct and no characters are removed.
3. Light status badges were difficult to read against white paper. Print-only badge text
   and borders are darker. Short advisory text, email bodies and re-rate summaries stay
   together where they fit. Screen layout wrappers are flattened only in print so the
   final boundary and privacy footer stay together rather than orphaning the footer.

Changes are confined to print styling, before/after-print disclosure handling, tests and
this evidence. Risk rules, rating logic, inputs, evidence status, access history and
privacy/storage/network policy are unchanged.

## Actual PDF matrix

Chromium 145.0.7632.6, macOS headless Playwright print pipeline. A4 portrait, scale 1,
CSS margins 14 mm, backgrounds disabled, synthetic-test page-number footer enabled.

| Fixture | Simple pages | Comprehensive pages |
| --- | ---: | ---: |
| CF-001 Green sample | 7 | 11 |
| CF-002 Red sample, six Critical triggers | 8 | 15 |
| CF-004 Amber sample | 7 | 12 |
| CF-002 partial review, missing version/locator, historical date and unavailable access | 9 | 16 |
| CF-002 stale citation, 180-character suffix, long unconfirmed notes/gap | — | 16 |

Nine final PDFs, 101 pages. Every final page was rendered and visually inspected in
contact sheets; key provenance/history, long-citation/draft and closing-notice pages
were also inspected at full page resolution. No visible clipping, overlapping text or
lost essential content was found. Sparse final pages and some section continuations
remain; the Simple history ending keeps the boundary and footer together on page 9.

PyMuPDF rendered the pages and extracted their text because the installed Poppler
binary could not load libtiff. No PDF content was edited after browser generation.

## Checks and evidence

- Full automated regression: 122 passed, zero failed/skipped. Includes 128 rendered
  action-matrix combinations and a print lifecycle test that preserves critical count,
  re-rate output, recorded evidence text and original disclosure state.
- Actual browser capture: nine PDFs, zero JavaScript page errors; disclosure state
  restored after each capture. Final browser request log contains only local GETs.
- Extracted text bounds: every final text span is inside its PDF page.
- CF-002 documents retain all six Critical trigger names. Simple also explicitly
  directs the reader to Comprehensive for five additional Critical evidence items;
  it does not suggest they are resolved or that the SG example represents the case.
- Historical review `2026-10-23` and reported inability to open on `2026-11-01` both
  remain visible in both history tiers. Missing source version/locator and the warning
  that source ID is not verification are preserved.
- AUD 0.00 is limited to the synthetic supported summary; payment timing and receipt
  remain unproven. Draft/stale warnings and earlier confirmed judgement survive print.
- Boundary, synthetic-data notice, human review and privacy text remain present.

Reproduce the browser matrix using an existing Playwright installation and a local
static server; no runtime dependency was added:

```sh
CF_JSDOM_MODULE=/absolute/path/to/jsdom/lib/api.js node --test tests/*.test.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CF_BASE=http://127.0.0.1:8765 CF_PDF_OUT=/tmp/cf-pdf node tests/credit-framework-print-browser.mjs
```

Delivery evidence lives in the sibling `pdf-acceptance/` directory: final PDFs,
`pdf-content-acceptance.json`, `production-version.json`, `regression-final.log`, browser
request/output evidence, final page contact sheets, and a portable source patch.

## Coverage limits / release status

No physical printer, native print-preview dialog, Safari/WebKit, Firefox, Letter paper,
mobile printing or all arbitrary user inputs were tested. Native before/afterprint
behavior is exercised through Chromium PDF and synthetic DOM lifecycle tests; a real
native dialog cancel was not exercised. The runtime relies on browser print events.
Manual access results are synthetic reviewer entries, not live source checks.

Production still has the identified defects until a separately authorized release.
No PR approval, remote write, merge or deployment was attempted. No outstanding local
blocker; release approval is pending separately. An initial sandboxed Chromium launch
failed before capture because macOS denied its Mach bootstrap port; an authorized
escalated local launch succeeded. No automatic approval-review rejection occurred.

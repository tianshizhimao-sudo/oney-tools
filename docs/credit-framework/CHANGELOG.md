# Local Credit Framework change log

## 2026-11-01 — print/PDF acceptance (local candidate, not published)

- Preserve closed review records in PDF and restore screen disclosure after printing.
- Wrap long citations, improve printed badge contrast and keep closing notices together.
- Nine synthetic A4 PDFs / 101 pages visually inspected; provenance, historical access
  distinctions, pending edits and all six CF-002 Critical triggers retained.
- Full regression: 122 passed, no failures/skips. No risk logic or privacy changes.
- See `2026-11-01-print-pdf-acceptance.md` for exact coverage and limitations.

## 2026-10-31 — provenance and complete Critical summary (release candidate)

- Disclose incomplete source provenance without interpreting an ID as verification.
- Separate historical reviewer dates from manual access observations; retain earlier observations
  and their exact citations without changing evidence judgements or credit-engine state.
- Show every open selected Critical issue in the whole-case overview, retaining advisory actions.
- Verified with 121 automated tests (zero failures/skips) plus local desktop/mobile browser checks.
- Release authorized after local acceptance; publication status is recorded in the release PR.
- See `2026-10-31-provenance-critical-review.md` for acceptance evidence and limitations.

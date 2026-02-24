# Oney Security — Development Guide

## Current Version: v1.8

Single-file vanilla HTML/CSS/JS tool. No build step, no dependencies beyond what's embedded.

---

## Development Workflow (OpenSpec)

All changes to this product MUST follow the OpenSpec workflow:

```bash
# 1. Start a new change
cd [this directory]
openspec new change <change-name>
# e.g.: openspec new change valuation-residential-fix

# 2. Work through artifacts
openspec instructions proposal --change <name> --json
openspec instructions specs    --change <name> --json
openspec instructions design   --change <name> --json
openspec instructions tasks    --change <name> --json

# 3. Implement
# Edit index.html following tasks.md

# 4. Validate & Archive
openspec validate <name>
openspec archive  <name> --yes
```

---

## Tab Structure (v1.8 baseline)

| # | Tab ID | Purpose | Feeds Score? |
|---|--------|---------|-------------|
| 1 | `category` | Property type + address — gates all downstream | — |
| 2 | `zoning` | Zoning compliance, risk flags, DA status | ✅ |
| 3 | `valuation` | LVR test (resi vs commercial), lender appetite | ✅ |
| 4 | `development` | DA/feasibility (only for development deals) | ✅ |
| 5 | `tenancy` | Lease schedule, WALE, net yield | ✅ |
| 6 | `environmental` | Risk flags detail, insurance adequacy | ✅ |
| 7 | `portfolio` | Cross-collateral, A/L import, portfolio LVR | ✅ |
| 8 | `score` | Composite score, lender matrix, recommendations | — |

---

## Key Rules for Developers

1. **Single file** — all code stays in `index.html`. No external JS/CSS files.
2. **Tab data flow** — each tab writes to `appState`. `recalcAll()` must be called after any state change.
3. **localStorage key** — `oney-security-data-v1.8`. Don't change without migration.
4. **Category gates everything** — always check `appState.category` before rendering tab content.
5. **Backward compatibility** — exported JSON from v1.7 must still import correctly.
6. **Brand** — Oney green `#2ECC85`, Inter font, dark/light mode toggle must work.
7. **Disclaimer** — "General information only — not financial advice" must be visible on every view.

---

## Integration Points

| Tool | Direction | Format |
|------|-----------|--------|
| Oney A/L Tool | Import → Portfolio tab | JSON |
| Oney Tenancy Schedule | Import → Tenancy tab | JSON / CSV |
| Oney Analyse (MLL) | Future: import → Valuation tab | JSON |

---

## Specs Location

`openspec/specs/` — baseline v1.8 specs (source of truth)
`openspec/changes/` — active + archived changes

See `openspec/config.yaml` for project context and rules.

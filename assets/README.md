# Oney & Co — Shared core (`assets/`)

Phase 1 scaffolding for the **single-input → shared-engine → schema-driven tool** architecture.
This directory is the future home for everything new. Existing top-level HTML tool pages
(e.g. `dti-router.html`, `quick-quote-calculator.html`) remain untouched until Phase 2.

```
assets/
├── css/
│   ├── brand.css        # design tokens, nav, hero, cards, motion (used by hubs + home)
│   └── tool-shell.css   # tool-page layout: header, side-rail, step form, results
├── js/
│   ├── app/
│   │   ├── tool-registry.js   # single source of truth for tools and groups
│   │   ├── route-map.js       # render hub grids and home cards
│   │   └── storage.js         # namespaced localStorage (`oney-tools-<scope>-<key>`)
│   ├── core/
│   │   ├── finance-math.js    # repayments / DTI / LVR / yield / formatting
│   │   ├── form-engine.js     # schema-driven multi-step form state
│   │   └── result-engine.js   # normalises tool config `resolveResult()` output
│   └── ui/
│       └── motion.js          # fade-up reveal + mobile nav toggle
└── data/                # reserved for shared JSON (lender rules, groups, content links)
```

## Importing

All app/core JS uses native ES modules. From a hub page:

```html
<script type="module">
  import { renderGroupPage } from '/assets/js/app/route-map.js';
  import { initAll } from '/assets/js/ui/motion.js';
  renderGroupPage('calculate', document.getElementById('group-tools'));
  initAll();
</script>
```

From a future tool page:

```js
import { calcMonthlyRepayment, formatCurrency } from '/assets/js/core/finance-math.js';
import { createFormEngine } from '/assets/js/core/form-engine.js';
import { resolveResult } from '/assets/js/core/result-engine.js';
```

## Storage namespacing

Always use the namespaced helper to avoid cross-tool pollution:

```js
import { storage, SCOPES } from '/assets/js/app/storage.js';
storage.set(SCOPES.CALC, 'repayments', { loanAmount: 500000, rate: 6.0 });
storage.get(SCOPES.CALC, 'repayments');
```

Resulting key: `oney-tools-calc-repayments`.

## What lives here vs. `core/`

The legacy `/core/` module (brand.css, components.js, storage.js, utils.js) was a partial
v1 attempt. Phase 1 keeps it in place so existing top-level tool pages keep working. Phase 2
will migrate tool pages off `/core/` and onto `/assets/` one at a time, then remove `/core/`.

## Phase 2 next steps

1. Migrate `dti-router.html` → `/tools/dti-router.html` (schema-driven, uses form-engine).
2. Migrate `sme-score.html` → `/tools/bank-ready-score.html`.
3. Migrate `quick-quote-calculator.html` → `/tools/repayments.html`.
4. Add JS-redirect shims at the legacy slugs so direct links keep working.
5. Remove duplicate calc helpers from each migrated page in favour of `finance-math.js`.

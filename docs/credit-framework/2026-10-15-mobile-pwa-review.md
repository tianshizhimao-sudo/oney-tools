# Phone-first PWA preview

## Baseline and scope

Based on the reviewed PR7 head `b83116fc2f1e8ade35534d125a7f757615b9ad45`, merged as main `8aa22159e976a6818a99902b810137a4de74802e` (same tree). This patch is a separate preview candidate, not a production release.

- At widths up to 640px, existing intake sections become nine navigable steps. Previous / Next and a persistent Inputs / Results / Install bar navigate without recreating case state.
- The same quick choices and optional details remain; no new underwriting logic or required text entry.
- Results retain existing details, evidence gates, manual four-area view, manual rating, Medium confidence cap and export/report logic.
- Manifest, 192px / 512px icons and Apple touch icon support home-screen installation in compatible browsers. Safari instructions and Android browser-menu guidance are always available in the phone Install view. A browser-provided install prompt is offered only when available; dismissal is handled without retry loops.
- Home-screen launch is a new open page. Case inputs are not persisted. No accounts, backend, cloud saving, service worker, case/report cache, analytics or other external service is added. Internet is required to open/reload. Installation and launching on actual iOS / Android devices are not yet verified.
- Desktop content remains in the existing layout. All new panel/step hiding is screen-only; print continues to include the selected report even when Inputs or Install is selected. Export/copy remains an explicit user action.

## Security-policy review

One directive is added: `manifest-src 'self'`. With `default-src 'none'`, this is required to allow the local manifest. It does not permit cross-origin manifests or case requests. `connect-src 'none'`, `form-action 'none'`, `object-src 'none'`, `base-uri 'none'`, `script-src 'self'`, noindex and no-referrer remain unchanged. Existing same-origin image/style permissions cover the new icons and stylesheet. Existing inline-style permission is not broadened.

If the host also supplies a stricter response-header CSP, the manifest must be permitted there as well; a meta directive cannot override a stricter header. Preview verification should inspect this rather than weakening policy. Hosting authentication/protection must remain unchanged.

## Verification

- Final combined deterministic, input, DOM, manual-risk, action-matrix, print and mobile suite: 67 passed, zero failed, zero skipped. Focused final mobile/clarity/manual-risk suite: 20 passed.
- New manifest/assets and mounted DOM test covers nine steps, back/next, case reset, tier rerender, report-to-trigger navigation, manual Red mitigation requirement, stale-view invalidation, resize behavior, install dismissal and repeated clicks.
- Engine, rules, cases, manual-risk view modules and deferral logic are unchanged from baseline.
- `CF_JSDOM_MODULE=/absolute/path/to/jsdom/lib/api.js node --test tests/*.test.mjs` runs the full suite with an existing test dependency. Runtime has no new dependency.
- Independent source/DOM review found no functional or data-safety blocker. A top safe-area offset was added to the sticky step controls after review.
- These DOM checks do not verify browser rendering, installed-app behavior, OS lifecycle, on-screen keyboard or native sharing/printing.

## Actual-device acceptance checks still needed

Use synthetic or de-identified input only.

1. iPhone Safari: Add to Home Screen; confirm icon/title and standalone launch. Android Chrome: Install app or Add to Home screen as offered; launch it.
2. Navigate all nine steps, enter amounts with decimals, use quick choices, change tiers, and move between Inputs and Results. Check keyboard, notch/safe area, focus, text zoom, portrait/landscape and long notes.
3. Confirm triggers from Results opens the risk step. Set a manual Red view: basis and next step are required. Edit an intake input; the old view must turn grey and require recheck.
4. Verify Simple/Comprehensive gates, evidence review controls and Medium cap. Print/export from Results and inspect full report, final sections and boundaries on the device.
5. Reload/reopen and confirm there is no saved case. Installing is not a save operation. Test dismissal of install prompts and repeated tab switches.
6. Recheck desktop rendering and print preview before any production approval.

Reference: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable (accessed 15 October 2026). Installability does not require a service worker; manifest requirements and OS/browser installation flows vary.

# Desktop overview correction

- Optional warning nodes are omitted before DOM replaceChildren; absence no longer serializes as null text. Regression covers absent, pause-only, unknown-only and combined warnings in both live panels.
- Desktop html/body use overflow-x:clip (visible fallback) and overflow-y:visible so they do not create an unintended sticky scrolling ancestor.
- At 1450px and wider, the rail remains sticky in its own column. Ring, domain key, legend and current stop warnings remain outside the independently keyboard-scrollable review-link region. No fixed overlay. The rail itself has an overflow safety fallback for enlarged text or unusually long warnings; in that exceptional overflow case the whole rail can scroll so nothing is trapped.
- At 1101–1449px, retain two columns and provide an overview/review jump button. At heights below 600px, use natural scrolling to keep all content reachable. Mobile and print exclusion remain unchanged.
- Actual screenshot supplied by user was inspected. Cloud browser local-server connection was refused; protected deployment required Vercel login. Browser geometry and native printing are not verified; no access bypass was created.

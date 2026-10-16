# Input readability polish

Screen-only presentation update: entry controls 17px, monetary amounts 18px, question labels 15px, section headings 16px, and secondary text generally 13px. Increased spacing separates questions; quick choices and the existing output jump have larger touch targets. Existing input and risk-category disclosures are retained.

The intake introduction separates privacy guidance from optional usage help. Privacy restrictions and the custom-scenario consequence remain visible. No input, required label, warning, calculation, evidence rule, or risk state was removed or changed. No new field or required response was added.

The accepted sticky ring and desktop column breakpoints remain unchanged. Text can wrap, input widths remain bounded, and the mobile control font stays at least 17px. Print sizing is untouched because the new type rules are screen-only.

Verification covers the full regression suite, input font cascade, labels, invalid-amount visibility, optional help separation, and breakpoint/print source contracts. Browser geometry and native print appearance remain unverified: the cloud browser cannot reach the local server, and the protected deployment requires login. No access bypass was created.

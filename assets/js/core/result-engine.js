/* =========================================================
   Oney & Co — Result engine (Phase 1)
   Resolves a tool config's `resolveResult(values)` into a
   normalised result shape that the UI layer can render directly.
   ========================================================= */

const DEFAULT_SHAPE = {
  heroLabel: 'Result',
  heroValue: '—',
  metrics: [],
  actions: [],
  insights: [],
  narrative: null,
  gated: null,
};

export function resolveResult(config, values) {
  if (!config || typeof config.resolveResult !== 'function') {
    return { ...DEFAULT_SHAPE };
  }
  let raw;
  try {
    raw = config.resolveResult(values) || {};
  } catch (err) {
    return {
      ...DEFAULT_SHAPE,
      heroLabel: 'Error',
      heroValue: '—',
      insights: [{ tone: 'fail', text: err && err.message ? err.message : String(err) }],
    };
  }
  return {
    ...DEFAULT_SHAPE,
    ...raw,
    metrics: Array.isArray(raw.metrics) ? raw.metrics : [],
    actions: Array.isArray(raw.actions) ? raw.actions : [],
    insights: Array.isArray(raw.insights) ? raw.insights : [],
  };
}

export function compareResults(configsAndValues) {
  return configsAndValues.map(({ config, values, label }) => ({
    label: label || config.title || config.id,
    result: resolveResult(config, values),
  }));
}

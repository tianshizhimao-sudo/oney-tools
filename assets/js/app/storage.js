/* =========================================================
   Oney & Co — Namespaced storage (Phase 1)
   Single prefix to prevent cross-tool pollution. JSON in/out.
   ========================================================= */

const PREFIX = 'oney-tools';

function key(scope, name) {
  return `${PREFIX}-${scope}-${name}`;
}

export const storage = {
  get(scope, name, fallback = null) {
    try {
      const raw = localStorage.getItem(key(scope, name));
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(scope, name, value) {
    try {
      localStorage.setItem(key(scope, name), JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(scope, name) {
    try { localStorage.removeItem(key(scope, name)); } catch {}
  },
  clearScope(scope) {
    try {
      const prefix = `${PREFIX}-${scope}-`;
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) localStorage.removeItem(k);
      }
    } catch {}
  },
};

export const SCOPES = {
  THEME: 'theme',
  ASSESS: 'assess',
  CALC: 'calc',
  ANALYSE: 'analyse',
  PRO: 'pro',
};

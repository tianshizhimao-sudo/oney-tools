/* =========================================================
   Oney & Co — Form engine (Phase 1)
   Schema-driven multi-step form state. No DOM coupling.
   Tool pages provide a config; UI layer renders from state.
   ========================================================= */

export function createFormEngine(config) {
  if (!config || !Array.isArray(config.steps) || !config.steps.length) {
    throw new Error('createFormEngine: config.steps is required');
  }

  const state = {
    step: 0,
    values: structuredClone(config.defaults || {}),
    errors: {},
    touched: {},
  };

  const listeners = new Set();
  function emit() { listeners.forEach((fn) => fn(state)); }

  function setValue(key, value) {
    state.values[key] = value;
    state.touched[key] = true;
    if (state.errors[key]) delete state.errors[key];
    emit();
  }

  function setValues(patch) {
    Object.assign(state.values, patch);
    emit();
  }

  function reset() {
    state.step = 0;
    state.values = structuredClone(config.defaults || {});
    state.errors = {};
    state.touched = {};
    emit();
  }

  function getCurrentStep() {
    return config.steps[state.step];
  }

  function fieldsForStep(stepIndex) {
    const step = config.steps[stepIndex] || {};
    return Array.isArray(step.fields) ? step.fields : [];
  }

  function validateField(field) {
    const value = state.values[field.id];
    if (field.required && (value === undefined || value === null || value === '')) {
      return field.requiredMessage || 'Required';
    }
    if (typeof field.validate === 'function') {
      return field.validate(value, state.values) || null;
    }
    return null;
  }

  function validateCurrentStep() {
    const fields = fieldsForStep(state.step);
    const errors = {};
    fields.forEach((field) => {
      const err = validateField(field);
      if (err) errors[field.id] = err;
    });
    state.errors = errors;
    emit();
    return Object.keys(errors).length === 0;
  }

  function next() {
    if (!validateCurrentStep()) return false;
    state.step = Math.min(state.step + 1, config.steps.length - 1);
    emit();
    return true;
  }

  function prev() {
    state.step = Math.max(state.step - 1, 0);
    emit();
  }

  function goTo(index) {
    state.step = Math.max(0, Math.min(index, config.steps.length - 1));
    emit();
  }

  function isComplete() {
    return state.step >= config.steps.length - 1 && validateCurrentStep();
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return {
    state,
    config,
    setValue,
    setValues,
    reset,
    getCurrentStep,
    validateCurrentStep,
    next,
    prev,
    goTo,
    isComplete,
    subscribe,
  };
}

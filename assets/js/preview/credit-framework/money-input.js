/* Presentation-only amounts. The engine receives a number or an empty string,
   never a comma-formatted string. No rounding is applied to entered decimals. */

const ERROR = 'Enter a non-negative amount, for example 1,250,000.50. Use a dot for decimals.';
const countChars = (text) => (text.match(/[0-9.]/g) || []).length;

export function parseMoneyInput(value) {
  const raw = String(value ?? '').trim().replace(/^\$\s*/, '');
  if (!raw) return String(value ?? '').trim() ? { valid: false, value: '', error: ERROR } : { valid: true, value: '' };
  // Pasted grouping must be unambiguous. Do not silently turn 1,50 into 150.
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)?(?:\.\d*)?$/.test(raw) || raw === '.') {
    return { valid: false, value: '', error: ERROR };
  }
  const number = Number(raw.replaceAll(',', ''));
  return Number.isFinite(number) && number >= 0 && number <= Number.MAX_SAFE_INTEGER
    ? { valid: true, value: number }
    : { valid: false, value: '', error: ERROR };
}

function positionAfter(formatted, count) {
  if (!count) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/[0-9.]/.test(formatted[i]) && ++seen === count) return i + 1;
  }
  return formatted.length;
}

export function formatMoneyEdit(value, start = String(value ?? '').length, end = start, { paste = false } = {}) {
  const text = String(value ?? '');
  // Commas already in a field are display separators; an edit may break a group.
  // Paste is checked before removing them to catch decimal-comma ambiguity.
  const raw = text.trim().replace(/^\$\s*/, '').replaceAll(',', '');
  const parsed = parseMoneyInput(paste || !raw ? text : raw);
  if (!parsed.valid) return { ...parsed, text, start, end };
  const [integer, fraction] = raw.split('.');
  const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`);
  return {
    ...parsed,
    text: formatted,
    start: positionAfter(formatted, countChars(text.slice(0, start))),
    end: positionAfter(formatted, countChars(text.slice(0, end))),
  };
}

// Backspace/Delete beside an inserted comma should remove the adjacent digit,
// rather than appear to do nothing when the comma is immediately reinserted.
export function deleteMoneySeparator(value, start, end, inputType) {
  if (start !== end) return null;
  if (inputType === 'deleteContentBackward' && start > 1 && value[start - 1] === ',') {
    return { text: value.slice(0, start - 2) + value.slice(start), caret: start - 2 };
  }
  if (inputType === 'deleteContentForward' && value[start] === ',') {
    return { text: value.slice(0, start) + value.slice(start + 2), caret: start };
  }
  return null;
}

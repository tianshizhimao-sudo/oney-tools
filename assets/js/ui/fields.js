/* =========================================================
   Oney & Co — Field renderers (Phase 2)
   Pure markup. The shell binds events; we only emit DOM strings.
   ========================================================= */

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeHtml(value) { return escapeAttr(value); }

export function renderField(field, currentValue, error) {
  const id = `field-${field.id}`;
  const value = currentValue === undefined || currentValue === null ? '' : currentValue;
  const help = field.help ? `<span class="field-help">${escapeHtml(field.help)}</span>` : '';
  const errBlock = error ? `<span class="field-help" style="color:var(--danger)">${escapeHtml(error)}</span>` : '';
  const cls = `field-row ${error ? 'is-invalid' : ''}`;
  const labelText = field.label
    + (field.suffix ? ` <small style="color:var(--text-muted);font-weight:400">(${escapeHtml(field.suffix)})</small>` : '');

  switch (field.type) {
    case 'choice':
      return `
        <div class="${cls}" data-field="${escapeAttr(field.id)}">
          <label>${labelText}</label>
          <div class="choice-grid">
            ${(field.options || []).map((opt) => {
              const selected = String(value) === String(opt.value);
              return `
                <button type="button"
                        class="choice-card ${selected ? 'is-selected' : ''}"
                        data-choice="${escapeAttr(field.id)}"
                        data-value="${escapeAttr(opt.value)}">
                  <strong style="display:block;margin-bottom:4px">${escapeHtml(opt.label)}</strong>
                  ${opt.desc ? `<span style="font-size:12px;color:var(--text-muted)">${escapeHtml(opt.desc)}</span>` : ''}
                </button>
              `;
            }).join('')}
          </div>
          ${help}${errBlock}
        </div>
      `;

    case 'select':
      return `
        <div class="${cls}" data-field="${escapeAttr(field.id)}">
          <label for="${id}">${labelText}</label>
          <select id="${id}" data-input="${escapeAttr(field.id)}">
            ${(field.options || []).map((opt) => `
              <option value="${escapeAttr(opt.value)}" ${String(value) === String(opt.value) ? 'selected' : ''}>
                ${escapeHtml(opt.label)}
              </option>
            `).join('')}
          </select>
          ${help}${errBlock}
        </div>
      `;

    case 'number':
    case 'currency':
    case 'percent': {
      const inputType = field.type === 'currency' || field.type === 'percent' ? 'number' : 'number';
      const step = field.step ?? (field.type === 'percent' ? '0.01' : (field.type === 'currency' ? '1000' : '1'));
      const min = field.min !== undefined ? `min="${escapeAttr(field.min)}"` : '';
      const max = field.max !== undefined ? `max="${escapeAttr(field.max)}"` : '';
      const placeholder = field.placeholder ? `placeholder="${escapeAttr(field.placeholder)}"` : '';
      const prefix = field.type === 'currency' ? '$' : '';
      const suffix = field.type === 'percent' ? '%' : '';
      return `
        <div class="${cls}" data-field="${escapeAttr(field.id)}">
          <label for="${id}">${labelText}</label>
          <div style="position:relative">
            ${prefix ? `<span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-muted)">${prefix}</span>` : ''}
            <input type="${inputType}" id="${id}"
                   data-input="${escapeAttr(field.id)}"
                   value="${escapeAttr(value)}"
                   step="${escapeAttr(step)}" ${min} ${max} ${placeholder}
                   style="${prefix ? 'padding-left:26px;' : ''}${suffix ? 'padding-right:30px;' : ''}">
            ${suffix ? `<span style="position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--text-muted)">${suffix}</span>` : ''}
          </div>
          ${help}${errBlock}
        </div>
      `;
    }

    case 'text':
    default:
      return `
        <div class="${cls}" data-field="${escapeAttr(field.id)}">
          <label for="${id}">${labelText}</label>
          <input type="text" id="${id}"
                 data-input="${escapeAttr(field.id)}"
                 value="${escapeAttr(value)}"
                 ${field.placeholder ? `placeholder="${escapeAttr(field.placeholder)}"` : ''}>
          ${help}${errBlock}
        </div>
      `;
  }
}

export function readFieldValue(field, raw) {
  if (raw === '' || raw === null || raw === undefined) return '';
  if (field.type === 'currency' || field.type === 'number' || field.type === 'percent') {
    const n = Number(String(raw).replace(/[, _]/g, ''));
    return Number.isFinite(n) ? n : '';
  }
  return raw;
}

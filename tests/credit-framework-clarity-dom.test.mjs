// DOM integration, not browser/layout verification. Optional existing jsdom:
// CF_JSDOM_MODULE=/absolute/path/to/jsdom/lib/api.js node --test tests/credit-framework-clarity-dom.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
let JSDOM;
try { ({ JSDOM } = await import(process.env.CF_JSDOM_MODULE || 'jsdom')); } catch {}
const integration = JSDOM ? test : test.skip;
integration('mounted UI: formatted amount entry, paste, edit, clearing, invalid state and tier persistence', async () => {
  const html = await readFile(new URL('../preview/credit-framework.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.test/preview/credit-framework.html', pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false });
  window.HTMLElement.prototype.scrollIntoView = function () {};
  for (const key of ['window', 'document', 'Node', 'location']) globalThis[key] = window[key];
  await import('../assets/js/preview/credit-framework/app.js');
  const $ = (selector) => window.document.querySelector(selector);
  const click = (selector) => $(selector).click();
  const enter = (selector, value, caret = value.length) => {
    const field = $(selector); field.focus(); field.value = value; field.setSelectionRange(caret, caret);
    field.dispatchEvent(new window.Event('input', { bubbles: true })); return field;
  };
  const paste = (selector, text) => {
    const field = $(selector); field.focus(); field.select();
    const event = new window.Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
    field.dispatchEvent(event); return field;
  };
  assert.equal($('#f-loanAmount').value.includes(','), true);
  assert.equal(document.body.dataset.pristine, 'true');
  assert.doesNotMatch($('#sugg-panel').textContent, /\bnull\b/);
  click('#case-picker [data-case="custom"]');
  assert.match($('#overview-empty').textContent, /No triggers selected/);
  assert.doesNotMatch($('#sugg-panel').textContent, /\bnull\b/);
  assert.match($('#overview-next-step').textContent, /Confirm the triggers/);
  const amount = enter('#f-loanAmount', '1234567.50');
  assert.equal(amount.value, '1,234,567.50'); assert.equal(amount.selectionStart, 12);
  assert.equal(document.activeElement, amount);
  enter('#f-securityValue', '1200000'); enter('#f-totalSecuredDebt', '840000');
  assert.match($('#sec-snapshot').textContent, /70\.0%/);
  enter('#f-totalSecuredDebt', '0'); assert.match($('#sec-snapshot').textContent, /0\.0%/);
  enter('#f-totalSecuredDebt', ''); assert.doesNotMatch($('#sec-snapshot').textContent, /Estimated total LVR/);
  paste('#f-totalSecuredDebt', '$840,000.50'); assert.equal($('#f-totalSecuredDebt').value, '840,000.50');
  assert.match($('#sec-snapshot').textContent, /70\.0%/);
  paste('#f-totalSecuredDebt', '1,50');
  assert.equal($('#f-totalSecuredDebt').getAttribute('aria-invalid'), 'true');
  assert.equal($('#f-totalSecuredDebt').value, '1,50'); assert.ok($('#amount-warning'));
  assert.doesNotMatch($('#sec-snapshot').textContent, /Estimated total LVR/);
  enter('#f-totalSecuredDebt', '1,5');
  assert.equal($('#f-totalSecuredDebt').getAttribute('aria-invalid'), 'true');
  assert.equal($('#f-totalSecuredDebt').value, '1,5');
  const invalid = $('#f-totalSecuredDebt'); invalid.setSelectionRange(3, 3);
  const appendPaste = new window.Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(appendPaste, 'clipboardData', { value: { getData: () => '.5' } });
  invalid.dispatchEvent(appendPaste);
  assert.equal(invalid.getAttribute('aria-invalid'), 'true'); assert.equal(invalid.value, '1,5.5');
  click('#tier-output [data-tier="comprehensive"]');
  assert.equal($('#f-totalSecuredDebt').value, '1,5.5'); assert.ok($('#amount-warning'));
  assert.equal($('#f-loanAmount').value, '1,234,567.50');
  assert.match($('#overview-next-step').textContent, /Confirm the triggers/);
  enter('#f-totalSecuredDebt', '12345', 3);
  assert.equal($('#f-totalSecuredDebt').value, '12,345'); assert.equal($('#f-totalSecuredDebt').selectionStart, 4);
  assert.equal($('#amount-warning'), null);
  const field = $('#f-totalSecuredDebt'); field.setSelectionRange(3, 3);
  field.dispatchEvent(new window.InputEvent('beforeinput', { inputType: 'deleteContentBackward', bubbles: true, cancelable: true }));
  assert.equal(field.value, '1,345'); assert.equal(field.selectionStart, 1);
  // Open links are actionable, focus the relevant full detail, and survive rerenders.
  click('[data-open-section="questions"]');
  assert.equal($('#body-questions').hidden, false); assert.equal(document.activeElement.id, 'sec-questions');
  enter('#f-loanAmount', '10000'); assert.equal($('#body-questions').hidden, false);
  // Rule-derived custom reviews never auto-upgrade after all evidence supports.
  click('#t-valuation_sensitive');
  assert.equal($('#overview-critical-count').textContent, '1 / 1');
  click('[data-open-section="rerate"]');
  const reviewed = document.querySelector('[data-rerate="valuation_sensitive"]');
  reviewed.value = 'supports'; reviewed.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(document.activeElement.dataset.rerate, 'valuation_sensitive');
  assert.equal($('#overview-critical-count').textContent, '0 / 1');
  assert.match($('#overview-next-step').textContent, /Book banker review/);
  assert.equal($('#rerate-custom-guardrail').dataset.upwardBlocked, 'true');
  assert.equal(document.body.dataset.lint, 'pass');
  click('#tier-output [data-tier="simple"]');
  assert.equal(document.querySelector('.overview-rerate'), null);
  assert.equal(document.querySelector('.client-wording'), null);
  assert.equal(document.querySelector('.review-statuses'), null);
  assert.equal($('#overview-critical-count').textContent, '1');
  click('#case-picker [data-case="CF-001"]');
  assert.equal(document.body.dataset.pristine, 'true');
  assert.equal($('#f-loanAmount').value, '650,000');
  assert.equal($('#amount-warning'), null);
  // Lender deferrals lead the action card even with no or unrelated triggers.
  click('#case-picker [data-case="custom"]');
  click('#d-ato_position');
  for (const tier of ['simple', 'comprehensive']) {
    click(`#tier-output [data-tier="${tier}"]`);
    for (const unrelated of [false, true]) {
      if (unrelated) click('#t-valuation_sensitive');
      assert.match($('#overview-next-step').textContent, /deferral recovery plan/);
      assert.equal($('#overview-question'), null, 'no unrelated question in deferral action card');
      assert.match($('#overview-deferral').textContent, /Lender deferral entered \(1\)/);
      const link = $('#review-overview [data-open-section="deferral"]');
      link.click(); assert.equal(document.activeElement.id, 'sec-deferral');
      if (tier === 'simple') {
        assert.equal($('#overview-exact-doc'), null);
        assert.equal($('#overview-deferral-status'), null);
        assert.doesNotMatch($('#review-overview').textContent, /ATO integrated client account|exact documents credit asked for/);
        assert.match($('#sec-deferral').textContent, /Available in Comprehensive/);
      } else {
        assert.equal($('#body-deferral').hidden, false);
        assert.match($('#overview-exact-doc').textContent, /exact documents credit asked for/);
        assert.match($('#overview-deferral-status').textContent, /Rework/);
        assert.match($('#body-deferral').textContent, /ATO integrated client account/);
      }
      assert.equal(document.body.dataset.lint, 'pass');
      const rating = $('#f-rating'); rating.value = 'Black — Do Not Proceed';
      rating.dispatchEvent(new window.Event('change', { bubbles: true }));
      assert.match($('#overview-next-step').textContent, /Do not proceed.*refer or pause/);
      assert.equal($('#overview-question'), null);
      assert.equal($('#overview-deferral-status'), null, 'Black pause suppresses recovery status action');
      const pauseAction = $('.overview-action').querySelector('button');
      assert.equal(pauseAction.dataset.openSection, 'rating');
      pauseAction.click(); assert.equal(document.activeElement.id, 'sec-rating');
      assert.equal($('#overview-secondary-deferral').open, false);
      assert.equal($('#overview-exact-doc'), null);
      rating.value = 'Amber — Package Better';
      rating.dispatchEvent(new window.Event('change', { bubbles: true }));
      if (unrelated) click('#t-valuation_sensitive');
    }
  }
  click('#d-ato_position');
  assert.equal($('#overview-deferral'), null);
  assert.match($('#overview-next-step').textContent, /Confirm the triggers/);
  dom.window.close();
});

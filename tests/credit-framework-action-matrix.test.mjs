// Rendered-action regression: actual clicks and destinations, not just view-model text.
// CF_JSDOM_MODULE=/absolute/path/to/jsdom/lib/api.js node --test tests/credit-framework-action-matrix.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RATING_OPTIONS, CASE_ORDER } from '../assets/js/preview/credit-framework/engine.js';
let JSDOM;
try { ({ JSDOM } = await import(process.env.CF_JSDOM_MODULE || 'jsdom')); } catch {}
const integration = JSDOM ? test : test.skip;

integration('rendered action matrix: ratings, tiers, deferrals, triggers, review states and resets', async (t) => {
  const html = await readFile(new URL('../preview/credit-framework.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.test/preview/credit-framework.html', pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = () => ({ matches: false });
  window.HTMLElement.prototype.scrollIntoView = function () {};
  for (const key of ['window', 'document', 'Node', 'location']) globalThis[key] = window[key];
  await import('../assets/js/preview/credit-framework/app.js');
  const $ = (s) => document.querySelector(s);
  const click = (s) => $(s).click();
  const choose = (s, value) => {
    const control = $(s); control.value = value;
    assert.equal(control.value, value, 'test selects a real option');
    control.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  const setTier = (tier) => click(`#tier-output [data-tier="${tier}"]`);
  let count = 0;
  for (const rating of RATING_OPTIONS) for (const tier of ['simple', 'comprehensive'])
    for (const deferral of [false, true]) for (const trigger of [false, true])
      for (const status of ['outstanding', 'reply_only', 'supports', 'weak']) {
        const context = JSON.stringify({ rating, tier, deferral, trigger, status });
        click('#case-picker [data-case="custom"]'); setTier('comprehensive');
        if (trigger) {
          click('#t-valuation_sensitive');
          choose('[data-rerate="valuation_sensitive"]', status);
        }
        if (deferral) click('#d-ato_position');
        choose('#f-rating', rating); setTier(tier);
        const card = $('.overview-action');
        const primary = card.querySelector('button');
        const next = $('#overview-next-step').textContent;
        const black = rating.startsWith('Black');
        // Independent expectations for the UI contract, not imported overview logic.
        const kind = black ? 'pause' : deferral ? 'deferral' : !trigger ? 'confirm'
          : tier === 'comprehensive' && status === 'supports' ? 'rerate' : 'question';
        const target = { pause: 'rating', deferral: 'deferral', confirm: null, rerate: 'rerate', question: 'questions' }[kind];
        assert.equal(card.dataset.overviewAction, kind, context);
        assert.equal(primary.dataset.openSection ?? null, target, context);
        assert.equal($('#f-rating').value, rating, context);
        assert.equal($('#t-valuation_sensitive').checked, trigger, context);
        assert.equal($('#t-ato_debt').checked, false, 'deferral never auto-selects linked triggers');
        assert.equal($('#d-ato_position').checked, deferral, context);
        assert.equal(document.body.dataset.lint, 'pass', context);
        assert.doesNotMatch($('#sec-cta').textContent, /Dong/, context);
        assert.match($('#sec-cta').textContent, /Not active in this prototype/, context);
        if (tier === 'comprehensive') {
          const request = $('#sec-cta button');
          assert.equal(request.textContent, 'Request Banker Review (inactive)', context);
          assert.equal(request.disabled, true, context);
          assert.equal(request.getAttribute('aria-disabled'), 'true', context);
        }
        if (kind === 'pause') {
          assert.match(next, /Do not proceed.*refer or pause/, context);
          assert.match(primary.textContent, /Review pause \/ referral context/, context);
          assert.equal(card.querySelector('#overview-exact-doc'), null, context);
          assert.equal(card.querySelector('#overview-deferral-status'), null, context);
          assert.equal(card.querySelector('.overview-evidence'), null, context);
          const secondary = $('#overview-secondary-deferral');
          assert.equal(Boolean(secondary), deferral, context);
          if (secondary) {
            assert.equal(secondary.open, false, context);
            assert.match(secondary.textContent, /does not change the pause \/ referral action/, context);
          }
        } else if (kind === 'deferral') {
          assert.match(next, /deferral recovery plan/, context);
          assert.equal(Boolean($('#overview-exact-doc')), tier === 'comprehensive', context);
        } else if (kind === 'confirm') assert.match(next, /^Confirm the triggers/, context);
        else if (kind === 'rerate') {
          assert.match(next, /banker review/, context);
          assert.match(primary.textContent, /context/, context);
          assert.doesNotMatch(primary.textContent, /^Book|^Request/, context);
        } else {
          assert.match(next, /Valuation-sensitive deal/, context);
          assert.ok($('#overview-question'), context);
        }
        if (kind !== 'question') assert.equal($('#overview-question'), null, context);
        if (tier === 'simple') {
          assert.equal($('#overview-exact-doc'), null, context);
          assert.equal($('#overview-deferral-status'), null, context);
          assert.equal($('.overview-rerate'), null, context);
          assert.equal(card.querySelector('.client-wording'), null, context);
        }
        // Click the actual primary control and verify its real focus/section effect.
        primary.click();
        assert.equal(document.activeElement.id, target ? `sec-${target}` : 'sugg-panel', context);
        if (target && !(target === 'deferral' && tier === 'simple')) assert.equal($(`#body-${target}`).hidden, false, context);
        if (target === 'deferral' && tier === 'simple') assert.match($('#sec-deferral').textContent, /Available in Comprehensive/, context);
        if (!target) assert.equal($('#sugg-panel').closest('details').open, true, context);
        if (black && deferral) {
          const secondary = $('#overview-secondary-deferral'); secondary.open = true;
          secondary.querySelector('button').click();
          assert.equal(document.activeElement.id, 'sec-deferral', context);
          assert.match($('#overview-next-step').textContent, /Do not proceed/, context);
          if (tier === 'simple') assert.match($('#sec-deferral').textContent, /Available in Comprehensive/, context);
        }
        count++;
      }
  assert.equal(count, 128);
  t.diagnostic(`${count} rendered combinations passed actual primary and secondary click destinations.`);

  // Banker-review text can coexist with remaining Important questions. It still
  // leads the action; the questions remain available in their own workflow.
  click('#case-picker [data-case="custom"]'); setTier('comprehensive');
  click('#t-valuation_sensitive'); click('#t-contract_growth');
  choose('[data-rerate="valuation_sensitive"]', 'supports');
  assert.match($('#overview-next-step').textContent, /Book banker review/);
  assert.equal($('.overview-action').querySelector('button').dataset.openSection, 'rerate');
  assert.equal($('#overview-question'), null);
  assert.ok(document.querySelector('[data-priority-issue="contract_growth"]'));

  // Repeated sample/custom and tier resets must clear stale pause/secondary state.
  for (const sample of CASE_ORDER) {
    click(`#case-picker [data-case="${sample}"]`); setTier('comprehensive');
    assert.equal(document.body.dataset.pristine, 'true');
    assert.equal($('#overview-secondary-deferral'), null);
    assert.equal($('.overview-action').dataset.overviewAction, 'question');
    click('#d-ato_position');
    choose('#f-rating', 'Black — Do Not Proceed');
    for (const tier of ['simple', 'comprehensive']) {
      setTier(tier);
      const button = $('.overview-action').querySelector('button');
      button.click(); assert.equal(document.activeElement.id, 'sec-rating');
      assert.equal($('#overview-secondary-deferral').open, false);
    }
    click('#case-picker [data-case="custom"]');
    assert.equal($('#overview-secondary-deferral'), null);
    assert.match($('#overview-next-step').textContent, /^Confirm the triggers/);
    assert.equal($('#d-ato_position').checked, false);
  }
  dom.window.close();
});

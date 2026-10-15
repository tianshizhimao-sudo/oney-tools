// Source/DOM print-contract tests, NOT a PDF layout or actual-browser print pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, buildAssessment, buildReport, EVIDENCE_STATUS } from '../assets/js/preview/credit-framework/engine.js';
let JSDOM;
try { ({ JSDOM } = await import(process.env.CF_JSDOM_MODULE || 'jsdom')); } catch {}
const integration = JSDOM ? test : test.skip;
const html = await readFile(new URL('../preview/credit-framework.html', import.meta.url), 'utf8');
const print = html.slice(html.indexOf('@media print'), html.indexOf('</style>'));

test('print CSS keeps bounded context units together and does not force page breaks or crop content', () => {
  assert.match(print, /\.manual-risk-visual\{display:block;break-inside:avoid;page-break-inside:avoid/);
  assert.match(print, /\.manual-risk-layout,\.risk-readouts\{display:block/);
  assert.match(print, /\.overview-intro,\.sec-intro,#print-head,\.legend,\.kv-row\{break-inside:avoid/);
  assert.match(print, /h3,h4,\.sec-intro,\.overview-issues>h4\{break-after:avoid/);
  assert.match(print, /\.notice,\.q \.gated\{color:#222!important/);
  assert.match(print, /\.sec-body\[hidden\]\{display:block!important/);
  assert.match(print, /#report>section\[data-locked="true"\],#sec-cta\{display:none!important/);
  assert.doesNotMatch(print, /break-before:(?:page|always)|break-after:(?:page|always)|overflow:hidden|max-height:/);
  assert.doesNotMatch(print, /\.manual-risk-view\{[^}]*break-inside:avoid/);
});

test('Comprehensive print keeps review notices intact, uses full-width tracker rows and avoids orphan footer', () => {
  assert.match(print, /#rerate-guardrail,#rerate-evidence-rule,#rerate-custom-guardrail,\.rr-row\{break-inside:avoid;page-break-inside:avoid/);
  assert.match(print, /\.rr-row\{display:block;padding:4px 0/);
  assert.match(print, /#sec-dimensions table\.grid th:nth-child\(2\),#sec-dimensions table\.grid td:nth-child\(2\)\{width:8em;overflow-wrap:normal;word-break:normal/);
  assert.match(print, /#boundary-bottom\{[^}]*break-after:avoid/);
  assert.match(print, /\.layout\{[^}]*break-after:avoid/);
  assert.match(print, /\.footer\{break-before:avoid;page-break-before:avoid;break-inside:avoid;page-break-inside:avoid;padding:4px 0 0/);
});

test('closing summary print spacing removes duplicated gaps without shrinking or hiding content', () => {
  assert.match(print, /\.rr-out\{gap:0\}/);
  assert.match(print, /\.rr-out>\.item\{margin:2px 0\}/);
  const summaryRules = [...print.matchAll(/(\.rr-out(?:>\.item)?)\{([^}]*)\}/g)];
  assert.equal(summaryRules.length, 2);
  for (const [, , declarations] of summaryRules) assert.doesNotMatch(declarations, /font|line-height|padding|height|overflow|display|visibility/);
  const screen = html.slice(0, html.indexOf('@media print'));
  assert.match(screen, /\.rr-out\{[^}]*gap:4px/);
  assert.match(screen, /\.item\{[^}]*margin:6px 0/);
  // Seven items: 6 grid gaps (4px) + 14 margins reduced by 4px = 80px.
  // This checks the intended spacing budget, not actual browser pagination.
  assert.equal(6 * 4 + 14 * (6 - 2), 80);
});

integration('query tier initializes correctly; print uses current selected tier and preserves active content', async () => {
  for (const tier of ['simple', 'comprehensive']) {
    const dom = new JSDOM(html, { url: `https://example.test/preview/credit-framework.html?tier=${tier}&release=cf-20261014-6`, pretendToBeVisual: true });
    const { window } = dom; window.matchMedia = () => ({ matches: false });
    window.HTMLElement.prototype.scrollIntoView = function () {};
    for (const key of ['window', 'document', 'Node', 'location']) globalThis[key] = window[key];
    let prints = 0; window.print = () => { prints++; }; document.execCommand = () => true;
    await import(`../assets/js/preview/credit-framework/app.js?print-contract=${tier}`);
    const $ = s => document.querySelector(s); const click = s => $(s).click();
    assert.equal(document.body.dataset.tier, tier);
    assert.equal($('#print-tier').dataset.tier, tier);
    assert.match($('#print-tier').textContent, new RegExp(`Output tier: ${tier === 'simple' ? 'Simple' : 'Comprehensive'}`));
    const printRules = [...document.styleSheets[0].cssRules].find(r => r.conditionText === 'print').cssRules;
    const hideSelectors = [...printRules].filter(r => r.selectorText && r.style.display === 'none').map(r => r.selectorText);
    const printHidden = node => hideSelectors.some(selector => node.closest(selector));
    for (const selected of ['comprehensive', 'simple']) {
      click(`#tier-output [data-tier="${selected}"]`);
      assert.equal($('#print-tier').dataset.tier, selected);
      assert.equal(new URL(location.href).searchParams.get('tier'), tier, 'URL is an initial tier hint, not current state');
      const report = buildReport(buildAssessment(initialState('CF-002', selected)), selected);
      const expected = report.sections.find(s => s.id === 'questions').items;
      assert.deepEqual([...document.querySelectorAll('[data-question]')].map(n => n.dataset.question), expected.map(q => q.id));
      for (const q of document.querySelectorAll('[data-question]')) assert.equal(printHidden(q), false);
      assert.equal(expected.filter(q => q.priority === 'Critical').length, 6, 'all sample Critical questions retained');
      for (const section of document.querySelectorAll('#report > section.out')) {
        assert.equal(printHidden(section), section.dataset.locked === 'true' || section.id === 'sec-cta');
      }
      const snapshot = report.sections.find(s => s.id === 'snapshot');
      const rows = [...document.querySelectorAll('#sec-snapshot .kv-row')];
      assert.equal(rows.length, snapshot.facts.length);
      rows.forEach((row, i) => { assert.equal(row.children.length, 2); assert.ok(row.firstElementChild.textContent.includes(snapshot.facts[i].label)); assert.equal(row.lastElementChild.textContent, snapshot.facts[i].value); });
      assert.ok($('#overview-title').closest('.overview-intro').querySelector('.overview-stats'));
      for (const section of document.querySelectorAll('section.out[data-locked="false"]')) if (section.id !== 'sec-cta') assert.ok(section.querySelector('.sec-intro h3'));
      assert.equal(printHidden($('.footer')), false); assert.match($('.footer').textContent, /Sample cases are synthetic; entered deals never leave your browser/);
      assert.equal(printHidden($('#boundary-bottom')), false);
      assert.equal(printHidden($('#print-head')), false); assert.match($('#print-head').textContent, /does not approve credit/);
      if (selected === 'simple') {
        assert.match($('#simple-expanded').textContent, /6 Critical/);
        assert.match($('#more-critical-evidence').textContent, /5 further Critical/);
        assert.match($('#hidden-questions').textContent, /1 further question/);
        for (const selector of ['#simple-expanded', '#more-critical-evidence', '#hidden-questions']) assert.equal(printHidden($(selector)), false);
        assert.equal(document.querySelector('[data-gated="ifStrong"]'), null);
        assert.equal(document.querySelector('[data-rerate]'), null);
      } else {
        assert.ok(document.querySelector('[data-gated="ifStrong"]')); assert.ok(document.querySelector('[data-rerate]'));
        const rerate = report.sections.find(s => s.id === 'rerate');
        assert.equal(document.querySelectorAll('#rerate-out > .item').length, 7, 'sample closing-spacing budget uses seven intact summary items');
        assert.equal($('#rerate-guardrail').textContent, rerate.rerate.guardrail);
        assert.equal($('#rerate-evidence-rule').textContent, `Reviewed evidence only: ${rerate.rerate.evidenceRule}`);
        assert.equal(printHidden($('#rerate-evidence-rule')), false);
        for (const row of document.querySelectorAll('.rr-row')) {
          assert.equal(printHidden(row), false);
          const label = row.querySelector('.print-only');
          assert.ok(label); assert.equal(printHidden(label), false);
          assert.equal(label.textContent, ` — ${EVIDENCE_STATUS.outstanding}`);
        }
        const questionId = document.querySelector('[data-rerate]').dataset.rerate;
        for (const status of ['reply_only', 'supports', 'weak', 'outstanding']) {
          const select = $(`[data-rerate="${questionId}"]`); select.value = status;
          select.dispatchEvent(new window.Event('change', { bubbles: true }));
          const label = $(`[data-rerate="${questionId}"]`).closest('.rr-row').querySelector('.print-only');
          assert.equal(label.textContent, ` — ${EVIDENCE_STATUS[status]}`);
          assert.equal(printHidden(label), false);
        }
        const dimensions = report.sections.find(s => s.id === 'dimensions');
        assert.deepEqual([...document.querySelectorAll('#sec-dimensions tbody tr')].map(row => row.cells[1].textContent), dimensions.items.map(d => d.dimension));
        assert.ok([...document.querySelectorAll('#sec-dimensions tbody tr')].some(row => row.cells[1].textContent === 'Management'));

      }
      const visual = $('.manual-risk-visual');
      for (const selector of ['#manual-risk-title', '.manual-risk-source', '#risk-svg-title', '#risk-svg-desc', '.manual-risk-donut']) assert.ok(visual.querySelector(selector));
      assert.match(visual.textContent, /not a complete assessment|not a.*risk score/);
      assert.match(visual.textContent, /Grey = not assessed, draft changes, or review required/);
      assert.equal(visual.querySelector('.risk-readouts'), null, 'arbitrary notes are outside bounded visual group');
      assert.equal(printHidden($('.risk-readouts')), false); assert.equal(printHidden($('.risk-editors')), true);
      const before = $('#report').textContent; click('#print-btn'); assert.equal($('#report').textContent, before, 'print does not change tier or disclosure');
    }
    assert.equal(prints, 2);
    // Print-visible text covers gray drafts, Red with a proposed next step,
    // and stale prior views; long notes must stay outside the unbreakable unit.
    const enter = (selector, value, type = 'input') => { const control = $(selector); control.value = value; control.dispatchEvent(new window.Event(type, { bubbles: true })); };
    click('[data-edit-risk="risk_transaction"]');
    enter('#risk-rating-risk_transaction', 'red', 'change');
    const longBasis = 'De-identified test basis. '.repeat(24).trim();
    const longNext = 'Request supporting documents. '.repeat(20).trim();
    enter('#risk-basis-risk_transaction', longBasis); enter('#risk-next-risk_transaction', longNext);
    let readout = $('[data-risk-readout="risk_transaction"]');
    assert.match(readout.textContent, /Draft changes — not confirmed/);
    assert.equal(printHidden(readout), false);
    click('[data-confirm-risk="risk_transaction"]');
    readout = $('[data-risk-readout="risk_transaction"]');
    assert.equal(readout.dataset.status, 'red');
    assert.ok(readout.textContent.includes(longBasis)); assert.ok(readout.textContent.includes(longNext));
    assert.match(readout.textContent, /not verified/);
    assert.equal(readout.closest('.manual-risk-visual'), null);
    enter('#f-loanAmount', '420001');
    readout = $('[data-risk-readout="risk_transaction"]');
    assert.equal(readout.dataset.status, 'not_assessed');
    assert.match(readout.textContent, /Review required — previous Red/);
    assert.match(readout.textContent, /Previous confirmed basis/);
    assert.equal(printHidden(readout), false);
    assert.equal($('#print-tier').dataset.tier, 'simple');
    dom.window.close();
  }
});

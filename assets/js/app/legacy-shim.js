/* =========================================================
   Oney & Co — Legacy slug compatibility (Phase 2)
   Non-destructive banner that links users to the redesigned
   schema-driven version. Phase 3 may turn this into a hard
   redirect; for now we keep the legacy page fully functional.

   Usage:
     <script src="/assets/js/app/legacy-shim.js"
             data-new-url="/tools/repayments.html"
             data-new-name="Repayments"
             defer></script>
   ========================================================= */

(function () {
  var script = document.currentScript;
  if (!script) return;
  var newUrl = script.getAttribute('data-new-url');
  var newName = script.getAttribute('data-new-name') || 'simplified version';
  if (!newUrl) return;

  function inject() {
    if (document.getElementById('oney-legacy-banner')) return;
    var bar = document.createElement('div');
    bar.id = 'oney-legacy-banner';
    bar.style.cssText = [
      'position:relative',
      'z-index:9999',
      'padding:10px 16px',
      'background:linear-gradient(90deg,rgba(46,204,133,0.18),rgba(107,76,154,0.18))',
      'border-bottom:1px solid rgba(255,255,255,0.10)',
      'color:#f3f7fb',
      'font:500 13px/1.4 Inter,system-ui,sans-serif',
      'display:flex',
      'gap:12px',
      'align-items:center',
      'justify-content:center',
      'flex-wrap:wrap',
    ].join(';');
    bar.innerHTML =
      '<span style="opacity:.85">A redesigned, faster ' +
      escapeHtml(newName) +
      ' is now available.</span>' +
      '<a href="' + escapeAttr(newUrl) + '" ' +
      'style="color:#9be7c1;font-weight:700;text-decoration:underline;text-underline-offset:2px;">' +
      'Try the new version →</a>' +
      '<button type="button" aria-label="Dismiss" ' +
      'style="background:transparent;border:0;color:rgba(243,247,251,0.6);cursor:pointer;font-size:18px;line-height:1;padding:0 4px;">' +
      '×</button>';
    document.body.insertBefore(bar, document.body.firstChild);
    bar.querySelector('button').addEventListener('click', function () {
      bar.remove();
      try { sessionStorage.setItem('oney-legacy-banner-dismissed', '1'); } catch (e) {}
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  try {
    if (sessionStorage.getItem('oney-legacy-banner-dismissed') === '1') return;
  } catch (e) {}

  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject, { once: true });
})();

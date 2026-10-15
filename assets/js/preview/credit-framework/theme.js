// Session-only presentation preference. Does not read or change case inputs.
const controls = document.querySelectorAll('[data-set-theme]');
function setTheme(theme) {
  if (!['light', 'dark'].includes(theme)) return;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#f3f5f8' : '#1A1A2E';
  for (const button of controls) button.setAttribute('aria-pressed', String(button.dataset.setTheme === theme));
}
for (const button of controls) button.addEventListener('click', () => setTheme(button.dataset.setTheme));
setTheme(document.documentElement.dataset.theme || 'light');
// Native detail content must also be included in printing, then restore the screen.
let printOpened = [];
window.addEventListener('beforeprint', () => {
  printOpened = [...new Set([...printOpened, ...[...document.querySelectorAll('details.reading-detail:not([open])')].filter(node => !node.classList.contains('no-print'))])];
  for (const node of printOpened) node.open = true;
});
window.addEventListener('afterprint', () => {
  for (const node of printOpened) node.open = false;
  printOpened = [];
});

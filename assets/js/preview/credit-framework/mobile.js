/* Presentation-only phone enhancement. No case storage, requests or service worker. */
const form = document.querySelector('#intake-form');
const intake = document.querySelector('#intake');
const output = document.querySelector('#output');
const phone = window.matchMedia('(max-width: 640px)');
let step = 0;
let view = 'inputs';
let deferredInstall;
const node = (tag, attrs = {}, text = '') => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => n.setAttribute(key, value));
  n.textContent = text;
  return n;
};
const nav = node('nav', { class: 'mobile-nav no-print', 'aria-label': 'Phone navigation' });
const stepper = node('div', { class: 'mobile-stepper no-print' });
const progress = node('p', { id: 'mobile-step-label', role: 'status', 'aria-live': 'polite' });
const previous = node('button', { type: 'button', class: 'btn btn-secondary' }, 'Previous');
const next = node('button', { type: 'button', class: 'btn btn-primary' }, 'Next');
const stepButtons = node('div', { class: 'mobile-step-actions' });
stepButtons.append(previous, next);
stepper.append(progress, stepButtons);
form.before(stepper);
const install = node('section', { id: 'mobile-install', class: 'mobile-install card no-print', tabindex: '-1', 'aria-labelledby': 'mobile-install-title' });
install.append(node('h2', { id: 'mobile-install-title' }, 'Add Oney to your home screen'),
  node('p', {}, 'iPhone / iPad: open this page in Safari, tap Share, then Add to Home Screen. If offered, leave Open as Web App on.'),
  node('p', {}, 'Android: open this page in Chrome, then use the browser menu → Install app or Add to Home screen. Available options depend on your browser and device.'),
  node('p', {}, 'Internet access is required to open or reload the app. Installation does not save a case. Keep inputs de-identified; reloading, closing, or the phone discarding this page can lose your work. Copy or export the report before leaving if you need a record.'));
const installButton = node('button', { type: 'button', class: 'btn btn-primary', hidden: '' }, 'Install app');
const installStatus = node('p', { role: 'status', 'aria-live': 'polite' });
install.append(installButton, installStatus);
output.parentElement.after(install);
const buttons = {};
for (const [id, label] of [['inputs', '1 · Inputs'], ['results', '2 · Results'], ['install', 'Install']]) {
  const button = node('button', { type: 'button', 'data-mobile-view': id }, label);
  button.addEventListener('click', () => show(id, true));
  buttons[id] = button;
  nav.append(button);
}
document.body.append(nav);
function sections() { return [...form.children].filter(n => n.matches('details.sec')); }
function syncSteps() {
  const all = sections();
  step = Math.min(step, Math.max(0, all.length - 1));
  all.forEach((section, i) => {
    section.classList.toggle('mobile-inactive-step', phone.matches && i !== step);
    if (phone.matches && i === step) section.open = true;
  });
  progress.textContent = `Step ${step + 1} of ${all.length}: ${all[step]?.querySelector('summary')?.textContent || 'Inputs'}`;
  previous.disabled = step === 0;
  next.textContent = step === all.length - 1 ? 'View results' : 'Next';
}
function show(target, focus = false) {
  view = target;
  document.body.dataset.mobileView = target;
  for (const [id, button] of Object.entries(buttons)) {
    if (id === target) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  if (focus && phone.matches) {
    const destination = target === 'inputs' ? stepper : target === 'results' ? output : install;
    destination.setAttribute('tabindex', '-1');
    destination.focus({ preventScroll: true });
    destination.scrollIntoView({ block: 'start' });
  }
}
previous.addEventListener('click', () => { step = Math.max(0, step - 1); syncSteps(); show('inputs', true); });
next.addEventListener('click', () => {
  if (step < sections().length - 1) { step++; syncSteps(); show('inputs', true); }
  else show('results', true);
});
document.querySelector('#jump-output').addEventListener('click', event => {
  if (phone.matches) { event.preventDefault(); show('results', true); }
});
document.addEventListener('credit:intake-rendered', syncSteps);
document.addEventListener('credit:review-triggers', () => {
  if (!phone.matches) return;
  step = sections().length - 1;
  syncSteps();
  show('inputs');
});
document.querySelector('#case-picker').addEventListener('click', event => {
  if (!event.target.closest('[data-case]')) return;
  step = 0;
  syncSteps();
});
phone.addEventListener?.('change', () => { syncSteps(); show(view); });
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstall = event;
  installButton.hidden = false;
});
installButton.addEventListener('click', async () => {
  if (!deferredInstall) return;
  const prompt = deferredInstall;
  deferredInstall = null;
  installButton.hidden = true;
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    installStatus.textContent = choice.outcome === 'accepted' ? 'Installation requested. Follow your browser’s instructions.' : 'Installation dismissed. You can keep using this page.';
  } catch {
    installStatus.textContent = 'Use your browser menu to add this app to your home screen.';
  }
});
window.addEventListener('appinstalled', () => {
  deferredInstall = null;
  installButton.hidden = true;
  installStatus.textContent = 'App installed. Case inputs are still held only in the open page.';
});
if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
  installStatus.textContent = 'Opened from your home screen. Case inputs are held only in this open page.';
}
syncSteps();
show(view);

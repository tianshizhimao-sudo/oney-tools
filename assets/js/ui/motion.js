/* =========================================================
   Oney & Co — Motion (Phase 1)
   Reveals .fade-up elements as they enter the viewport.
   Hamburger toggle for mobile nav.
   ========================================================= */

export function initFadeUp(root = document) {
  const targets = root.querySelectorAll('.fade-up');
  if (!targets.length) return;
  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
  targets.forEach((el) => io.observe(el));
}

export function initNav() {
  const nav = document.querySelector('.brand-nav');
  if (!nav) return;
  const toggle = nav.querySelector('.brand-nav-hamburger');
  if (!toggle) return;
  toggle.addEventListener('click', () => nav.classList.toggle('is-open'));
}

export function initAll() {
  initNav();
  initFadeUp();
}

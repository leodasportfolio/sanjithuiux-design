// Brandroom case study: chapter rail and phone menu copied from Drexel Works, plus scaling the design system card on phones.
// Section tracking must also run on the static Solution page without a carousel.
(() => {
  const links = Array.from(document.querySelectorAll('.section-nav a, .chapter-rail a'));
  if (!links.length) return;
  const sections = links.map(link => document.getElementById(link.hash.slice(1)));
  const rail = document.querySelector('.chapter-rail');
  let frame = 0;
  let pinned = -1;
  links.forEach((link, i) => link.addEventListener('click', () => { pinned = i; }));
  const unpin = () => { if (pinned >= 0) { pinned = -1; if (!frame) frame = requestAnimationFrame(updateSection); } };
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(type => window.addEventListener(type, (e) => {
    if (type === 'mousedown' && e.target.closest('.chapter-rail')) return;
    unpin();
  }, { passive: true }));
  const updateSection = () => {
    frame = 0;
    // A line near the top, so a short section like Problem lights up while its heading is in view.
    const readingLine = Math.min(window.innerHeight * .35, 160);
    const bounds = sections.map(section => section?.getBoundingClientRect() ?? null);
    let current = -1;
    bounds.forEach((rect, i) => {
      if (rect && rect.top <= readingLine) current = i;
    });
    // A clicked section stays lit even when the next short section also reaches the reading line.
    if (pinned >= 0) current = pinned;
    const atEnd = current >= 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    links.forEach((link, i) => {
      if (i === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
      // Derive completion from position every time, never from visit history.
      if (i < current || atEnd) link.setAttribute('data-complete', 'true');
      else link.removeAttribute('data-complete');
    });
    if (rail) {
      let progress = 0;
      if (current >= 0) {
        if (current === links.length - 1 || atEnd) progress = 1;
        else {
          const start = bounds[current].top;
          const end = bounds[current + 1]?.top ?? start + 1;
          const fraction = Math.max(0, Math.min(1, (readingLine - start) / Math.max(1, end - start)));
          progress = (current + fraction) / Math.max(1, links.length - 1);
        }
      }
      rail.style.setProperty('--chapter-progress', String(progress));
    }
  };
  window.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(updateSection);
  }, { passive: true });
  window.addEventListener('resize', updateSection, { passive: true });
  window.addEventListener('load', updateSection, { once: true });
  window.addEventListener('pageshow', updateSection);
  updateSection();
})();

// Phone section menu (same as Drexel Works).
(() => {
const rail = document.querySelector('.chapter-rail');
  const toggle = document.querySelector('.mobile-menu-toggle');
  if (!rail || !toggle) return;
  const phone = window.matchMedia('(max-width: 760px)');
  let open = false;
  const setOpen = (next, returnFocus = false) => {
    open = phone.matches && next;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close section menu' : 'Open section menu');
    rail.toggleAttribute('data-menu-open', open);
    if (returnFocus) toggle.focus({ preventScroll: true });
    rail.inert = phone.matches && !open;
    if (rail.inert) rail.setAttribute('aria-hidden', 'true');
    else rail.removeAttribute('aria-hidden');
  };
  const resetMenu = () => {
    rail.setAttribute('data-menu-reset', '');
    setOpen(false, phone.matches && rail.contains(document.activeElement));
  };
  toggle.addEventListener('click', () => {
    rail.removeAttribute('data-menu-reset');
    setOpen(!open);
  });
  // Section links scroll normally and deliberately leave the menu open.
  document.addEventListener('keydown', event => {
    if (open && event.key === 'Escape') {
      event.preventDefault();
      setOpen(false, true);
    }
  });
  document.addEventListener('pointerdown', event => {
    if (open && !rail.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
  });
  phone.addEventListener('change', resetMenu);
  window.addEventListener('pageshow', resetMenu);
  window.addEventListener('pagehide', resetMenu);
  document.addEventListener('visibilitychange', resetMenu);
  resetMenu();
  document.documentElement.classList.add('chapter-menu-ready');
  document.documentElement.classList.remove('chapter-menu-pending');
})();

// Design system card scaling.
(() => {
  // On phones the Figma design shows the desktop design system card scaled down to fit.
  const fit = document.querySelector('.ds-fit');
  const card = fit && fit.querySelector('.ds');
  const scale = () => {
    if (!card) return;
    if (window.matchMedia('(max-width: 760px)').matches) {
      card.style.zoom = String(fit.clientWidth / 896);
    } else {
      card.style.zoom = '';
    }
  };
  window.addEventListener('resize', scale);
  scale();
})();

// Match the approved GLOWM phone menu without replacing Drexel's scroll tracking.
(() => {
  if (new URLSearchParams(window.location.search).get('preview') === 'mobile' && window.parent !== window) {
    document.querySelectorAll('a[href^="https://"], a[href^="http://"]').forEach(link => {
      link.target = '_blank';
      link.relList.add('noopener', 'noreferrer');
    });
  }

  const rail = document.querySelector('.chapter-rail');
  const toggle = document.querySelector('.mobile-menu-toggle');
  if (!rail || !toggle) return;
  const phone = window.matchMedia('(max-width: 700px)');
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

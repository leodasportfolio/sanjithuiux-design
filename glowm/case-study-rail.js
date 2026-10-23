// Section tracking must also run on the static Solution page without a carousel.
(() => {
  // Keep the phone preview on the local draft, not an older published page.
  // Directly opened drafts and production pages retain normal same-tab links.
  if (new URLSearchParams(window.location.search).get('preview') === 'mobile' && window.parent !== window) {
    document.querySelectorAll('a[href^="https://"], a[href^="http://"]').forEach(link => {
      link.target = '_blank';
      link.relList.add('noopener', 'noreferrer');
    });
  }
  const links = Array.from(document.querySelectorAll('.section-nav a, .chapter-rail a'));
  if (!links.length) return;
  const sections = links.map(link => document.getElementById(link.hash.slice(1)));
  const rail = document.querySelector('.chapter-rail');
  const phoneLayout = window.matchMedia('(max-width: 700px)');
  const menuToggle = document.querySelector('.mobile-menu-toggle');
  if (rail && menuToggle) {
    let menuOpen = false;
    const setMenuOpen = (open, returnFocus = false) => {
      menuOpen = phoneLayout.matches && open;
      menuToggle.setAttribute('aria-expanded', String(menuOpen));
      menuToggle.setAttribute('aria-label', menuOpen ? 'Close section menu' : 'Open section menu');
      rail.toggleAttribute('data-menu-open', menuOpen);
      if (returnFocus) menuToggle.focus({ preventScroll: true });
      rail.inert = phoneLayout.matches && !menuOpen;
      if (rail.inert) rail.setAttribute('aria-hidden', 'true');
      else rail.removeAttribute('aria-hidden');
    };
    menuToggle.addEventListener('click', () => setMenuOpen(!menuOpen));
    // Native section links scroll normally without dismissing the open menu.
    document.addEventListener('keydown', event => {
      if (menuOpen && event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false, true);
      }
    });
    document.addEventListener('pointerdown', event => {
      if (menuOpen && !rail.contains(event.target) && !menuToggle.contains(event.target)) setMenuOpen(false);
    });
    phoneLayout.addEventListener('change', () => {
      // Do not leave focus inside navigation that becomes hidden on a resize.
      setMenuOpen(false, phoneLayout.matches && rail.contains(document.activeElement));
    });
    window.addEventListener('pageshow', () => setMenuOpen(false));
    window.addEventListener('pagehide', () => setMenuOpen(false));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) setMenuOpen(false);
    });
    setMenuOpen(false);
    document.documentElement.classList.add('chapter-menu-ready');
  }
  let frame = 0;
  const updateSection = () => {
    frame = 0;
    const readingLine = window.innerHeight * .35;
    const bounds = sections.map(section => section?.getBoundingClientRect() ?? null);
    let current = -1;
    bounds.forEach((rect, i) => {
      if (rect && rect.top <= readingLine) current = i;
    });
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

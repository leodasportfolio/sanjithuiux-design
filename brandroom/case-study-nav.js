(() => {
  const header = document.querySelector('.case-study-page .site-header');
  if (!header) return;

  const idleDelay = 2000;
  const topZone = 80;
  let lastScrollY = Math.max(0, window.scrollY);
  let idleTimer;
  let pointerInside = false;

  const isEngaged = () => pointerInside || header.contains(document.activeElement);
  const reveal = () => header.classList.remove('is-nav-hidden');

  function scheduleFade() {
    clearTimeout(idleTimer);
    if (window.scrollY <= topZone || isEngaged()) return;
    idleTimer = setTimeout(() => {
      if (window.scrollY > topZone && !isEngaged()) {
        header.classList.add('is-nav-hidden');
      }
    }, idleDelay);
  }

  window.addEventListener('scroll', () => {
    const scrollY = Math.max(0, window.scrollY);
    if (scrollY <= topZone || scrollY < lastScrollY) reveal();
    lastScrollY = scrollY;
    scheduleFade();
  }, { passive: true });

  header.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return;
    pointerInside = true;
    clearTimeout(idleTimer);
    reveal();
  });

  header.addEventListener('pointerleave', event => {
    if (event.pointerType === 'touch') return;
    pointerInside = false;
    scheduleFade();
  });

  header.addEventListener('focusin', () => {
    clearTimeout(idleTimer);
    reveal();
  });

  // Wait until focus has moved before deciding whether navigation is still in use.
  header.addEventListener('focusout', () => setTimeout(scheduleFade, 0));
  scheduleFade();
})();

const menuButton = document.querySelector('.menu-button');
const siteNav = document.querySelector('.site-nav');

// A fresh opening starts with the introduction, not a restored section position.
// In-page navigation still works normally after the page has opened.
window.addEventListener('pageshow', () => {
  const sectionHashes = ['', '#home', '#case-studies', '#about-me'];
  if (!sectionHashes.includes(window.location.hash)) return;
  if (window.location.hash) {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
});

function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  siteNav.classList.remove('is-open');
  document.body.classList.remove('menu-open');
}

menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  siteNav.classList.toggle('is-open', !isOpen);
  document.body.classList.toggle('menu-open', !isOpen);
});

siteNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

document.querySelectorAll('[aria-disabled="true"]').forEach((link) => {
  link.addEventListener('click', (event) => event.preventDefault());
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

// The header slides away on the way down the page and returns on the way up.
const siteHeader = document.querySelector('.site-header');
let lastScrollY = window.scrollY;

// One dark pill marks the section on screen and slides between links.
const sectionLinks = [...siteNav.querySelectorAll('a[href^="#"]')]
  .map((link) => ({ link, section: document.querySelector(link.getAttribute('href')) }))
  .filter((item) => item.section);
const navIndicator = document.createElement('span');
navIndicator.className = 'nav-indicator';
navIndicator.setAttribute('aria-hidden', 'true');
siteNav.prepend(navIndicator);
let currentItem = null;

function placeIndicator() {
  if (!currentItem) return;
  const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = currentItem.link;
  navIndicator.style.width = offsetWidth + 'px';
  navIndicator.style.height = offsetHeight + 'px';
  navIndicator.style.transform = 'translate(' + offsetLeft + 'px, ' + offsetTop + 'px)';
}

// In Fun mode on a wide screen the sections are staged: a folder opens out of the Dock, the
// Motion Graphics card covers the folders, About Me opens while that card shrinks aside.
// Where a section sits in the page no longer says what is on screen, so the pill is chosen
// from what can actually be seen: how much of the screen each section's own piece covers,
// measured as drawn (moved, shrunk or hidden as it is at that moment).
const wideScreen = window.matchMedia('(min-width: 1101px)');
const stagedPieces = {
  '#home': ['.hero'],
  '#case-studies': ['.project-grid', '#case-title'],
  '#motion-graphics': ['.reel-screen'],
  '#about-me': ['.about-inner'],
};
function shareOfScreen(selector) {
  const el = document.querySelector(selector);
  if (!el) return 0;
  const look = window.getComputedStyle(el);
  if (look.visibility === 'hidden' || look.display === 'none' || Number(look.opacity) < 0.3) return 0;
  const box = el.getBoundingClientRect();
  const wide = Math.min(box.right, window.innerWidth) - Math.max(box.left, 0);
  const tall = Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0);
  if (wide <= 0 || tall <= 0) return 0;
  return (wide * tall) / (window.innerWidth * window.innerHeight);
}
function sectionOnScreen() {
  // With the Motion Graphics panel open, that is what is on screen (the card under it is blanked).
  if (document.documentElement.classList.contains('reel-open')) {
    const reelItem = sectionLinks.find((item) => item.link.getAttribute('href') === '#motion-graphics');
    if (reelItem) return reelItem;
  }
  // The furthest-along section that has properly arrived wins: the pieces are stacked in
  // page order, so a later one that covers a good part of the screen is the one in front.
  let front = null;
  let most = null;
  let mostShare = 0;
  sectionLinks.forEach((item) => {
    const pieces = stagedPieces[item.link.getAttribute('href')];
    if (!pieces) return;
    let share = Math.max(...pieces.map(shareOfScreen));
    // (The Case Studies heading is small, but once it is up the section has begun.)
    if (item.link.getAttribute('href') === '#case-studies' && shareOfScreen('#case-title') > 0) {
      const title = document.querySelector('#case-title').getBoundingClientRect();
      if (title.top < window.innerHeight * 0.6) share = Math.max(share, 0.3);
    }
    if (share >= 0.3) front = item;
    if (share > mostShare) { most = item; mostShare = share; }
  });
  // Nothing has arrived (the last screen, "Let's Connect"): keep what was selected.
  return front || (mostShare > 0.12 ? most : null) || currentItem || sectionLinks[0];
}

// A click on a link sends the pill straight to that link, in one slide, and holds it there
// for as long as the page is travelling: it does not hop across the links in between.
// (The About Me glide is the longest, about a second and a half; the hold outlasts it. As
// soon as the visitor scrolls for themselves the hold is dropped.)
let pillHeldUntil = 0;
let pillHeldFor = null;
sectionLinks.forEach((item) => {
  item.link.addEventListener('click', () => {
    pillHeldFor = item;
    pillHeldUntil = performance.now() + 2000;
    updateSelected();
  });
});
['wheel', 'touchstart', 'keydown'].forEach((type) => window.addEventListener(type, () => { pillHeldUntil = 0; }, { passive: true }));

// The selected section is the one filling most of the screen.
function updateSelected() {
  const viewport = window.innerHeight;
  let best = sectionLinks[0];
  let bestVisible = -1;
  if (pillHeldFor && performance.now() < pillHeldUntil) {
    best = pillHeldFor;
  } else if (document.documentElement.dataset.mode === 'fun' && wideScreen.matches) {
    best = sectionOnScreen();
  } else sectionLinks.filter((item) => item.link.offsetParent !== null).forEach((item, index, shown) => {
    // (Only the links on show: in Normal mode the Motion Graphics link is folded into Case Studies.)
    const next = shown[index + 1];
    const top = item.section.getBoundingClientRect().top;
    const bottom = next ? next.section.getBoundingClientRect().top : document.documentElement.getBoundingClientRect().bottom;
    const visible = Math.min(bottom, viewport) - Math.max(top, 0);
    if (visible > bestVisible) { best = item; bestVisible = visible; }
  });
  if (best === currentItem) return;
  currentItem = best;
  sectionLinks.forEach((item) => {
    const active = item === best;
    item.link.classList.toggle('is-active', active);
    if (active) item.link.setAttribute('aria-current', 'true');
    else item.link.removeAttribute('aria-current');
  });
  placeIndicator();
}

function updateHeader() {
  const y = window.scrollY;
  const menuOpen = menuButton.getAttribute('aria-expanded') === 'true';
  if (Math.abs(y - lastScrollY) > 6) {
    const goingDown = y > lastScrollY && y > 120;
    siteHeader.classList.toggle('is-hidden', goingDown && !menuOpen && !siteHeader.contains(document.activeElement));
    lastScrollY = y;
  }
}

// The pill follows along while the page scrolls.
let headerQueued = false;
window.addEventListener('scroll', () => {
  if (headerQueued) return;
  headerQueued = true;
  window.requestAnimationFrame(() => { headerQueued = false; updateHeader(); updateSelected(); });
}, { passive: true });
siteHeader.addEventListener('focusin', () => siteHeader.classList.remove('is-hidden'));
window.addEventListener('resize', placeIndicator);
menuButton.addEventListener('click', placeIndicator);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeIndicator);
// In Normal mode the Motion Graphics videos sit inside the case-study grid, so the nav shows
// one link for both, "Case Studies & Motion Graphics". Fun mode keeps the two links as they are.
const caseLink = siteNav.querySelector('a[href="#case-studies"]');
const reelNavLink = siteNav.querySelector('a[href="#motion-graphics"]');
let navSwapTimer = 0;
function syncNavForMode(animate) {
  if (!caseLink || !reelNavLink) return;
  const plain = document.documentElement.dataset.mode !== 'fun';
  const apply = () => {
    caseLink.textContent = plain ? 'Case Studies & Motion Graphics' : 'Case Studies';
    reelNavLink.hidden = plain;
    currentItem = null;
    updateSelected();
    placeIndicator();
    siteNav.classList.remove('is-swapping');
  };
  window.clearTimeout(navSwapTimer);
  if (!animate) { apply(); return; }
  // The links fade out, swap while unseen, and fade back in: no snap.
  siteNav.classList.add('is-swapping');
  navSwapTimer = window.setTimeout(apply, 240);
}
syncNavForMode(false);
new MutationObserver(() => syncNavForMode(true)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
updateSelected();
// The staged pieces keep moving for a moment after the wheel stops, so the pill is also
// checked a few times a second; it costs four measurements.
window.setInterval(() => { if (!document.hidden) updateSelected(); }, 120);
window.requestAnimationFrame(() => navIndicator.classList.add('is-ready'));

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealItems = document.querySelectorAll('.reveal');

if (reduceMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px' });

  revealItems.forEach((item) => observer.observe(item));
}

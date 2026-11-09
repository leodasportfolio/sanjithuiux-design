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

// The selected section is the one filling most of the screen.
function updateSelected() {
  const viewport = window.innerHeight;
  let best = sectionLinks[0];
  let bestVisible = -1;
  sectionLinks.forEach((item, index) => {
    const next = sectionLinks[index + 1];
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
updateSelected();
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

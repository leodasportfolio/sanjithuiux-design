// Brandroom case study: chapter rail highlight, phone menu, and scaling the design system card on phones.
(() => {
  const sections = ['overview', 'the-problem', 'approach', 'the-idea'].map((id) => document.getElementById(id));
  const railLinks = [...document.querySelectorAll('.rail a')];
  const progress = document.querySelector('.rail .progress');

  const setActive = (index) => {
    railLinks.forEach((a, i) => a.setAttribute('aria-current', i === index ? 'true' : 'false'));
    if (progress) progress.style.height = `${18 + index * 62}px`;
  };

  const update = () => {
    let index = 0;
    sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < window.innerHeight * 0.35) index = i; });
    setActive(index);
  };
  window.addEventListener('scroll', update, { passive: true });
  update();

  const toggle = document.querySelector('.m-toggle');
  const menu = document.getElementById('m-menu');
  if (toggle && menu) {
    const close = () => { menu.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); };
    toggle.addEventListener('click', () => {
      const open = !menu.classList.contains('open');
      menu.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (open) menu.querySelector('a').focus();
    });
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('open')) { close(); toggle.focus(); } });
  }

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

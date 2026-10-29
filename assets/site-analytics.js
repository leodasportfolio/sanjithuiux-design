(() => {
  'use strict';

  const trackedHosts = ['sanjithuiux.design', 'www.sanjithuiux.design'];
  const isProduction = trackedHosts.includes(window.location.hostname);
  const isPreview = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  if (!isProduction && !isPreview) return;

  // Keep a quiet disclosure link; no banner, modal, or consent buttons.
  const footerLinks = document.createElement('div');
  footerLinks.className = 'site-privacy-links';
  footerLinks.innerHTML = '<a href="/privacy/">Privacy notice</a>';
  (document.querySelector('footer') || document.body).appendChild(footerLinks);

  // Honor an opt-out saved under the previous version of the site.
  let previouslyDeclined = false;
  try {
    const key = 'sanjith-analytics-consent-v1';
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && saved.choice === 'declined') {
      const age = Date.now() - saved.updatedAt;
      previouslyDeclined = Number.isFinite(age) && age >= 0 && age < 180 * 24 * 60 * 60 * 1000;
    } else if (saved && saved.choice === 'allowed') {
      localStorage.removeItem(key);
    }
  } catch (_) {
    // Cookieless analytics do not require browser storage.
  }

  // Remove first-party Clarity identifiers left by the previous opt-in setup.
  for (const name of ['_clck', '_clsk']) {
    for (const domain of ['', window.location.hostname, '.sanjithuiux.design', 'sanjithuiux.design']) {
      document.cookie = name + '=; Max-Age=0; Path=/; SameSite=Lax' + (domain ? '; Domain=' + domain : '');
    }
  }

  if (!isProduction || previouslyDeclined || navigator.globalPrivacyControl === true) return;
  if (document.querySelector('script[data-portfolio-clarity]')) return;

  window.clarity = window.clarity || function () {
    (window.clarity.q = window.clarity.q || []).push(arguments);
  };
  // Never claim consent on a visitor's behalf. Clarity runs without storage permission.
  window.clarity('consentv2', { analytics_Storage: 'denied', ad_Storage: 'denied' });
  const page = window.location.pathname.startsWith('/drexel-works/') ? 'Drexel Works'
    : window.location.pathname.startsWith('/glowm/') ? 'GLOWM'
      : window.location.pathname.startsWith('/resume/') ? 'Resume'
        : window.location.pathname.startsWith('/privacy/') ? 'Privacy' : 'Home';
  window.clarity('set', 'portfolio_page', page);

  const trackingScript = document.createElement('script');
  trackingScript.async = true;
  trackingScript.dataset.portfolioClarity = 'cookieless';
  trackingScript.src = 'https://www.clarity.ms/tag/z525rbrzhl';
  document.head.appendChild(trackingScript);

  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    const url = new URL(link.href, window.location.href);
    let name;
    if (url.pathname.endsWith('/sanjith-kumaar-resume.pdf')) name = 'resume_download';
    else if (trackedHosts.includes(url.hostname) && url.pathname.startsWith('/resume/')) name = 'resume_open';
    else if (url.protocol === 'mailto:') name = 'contact_email_click';
    else if (url.hostname === 'linkedin.com' || url.hostname.endsWith('.linkedin.com')) name = 'linkedin_open';
    else if (trackedHosts.includes(url.hostname) && url.pathname.startsWith('/drexel-works/')) name = 'drexel_works_open';
    else if (trackedHosts.includes(url.hostname) && url.pathname.startsWith('/glowm/')) name = 'glowm_open';
    if (name) window.clarity('event', name);
  });
})();

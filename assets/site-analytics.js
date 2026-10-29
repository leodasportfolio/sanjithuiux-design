(() => {
  'use strict';

  const projectId = 'z525rbrzhl';
  const trackedHosts = ['sanjithuiux.design', 'www.sanjithuiux.design'];
  const isProduction = trackedHosts.includes(window.location.hostname);
  const isPreview = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  if (!isProduction && !isPreview) return;

  const preferenceKey = 'sanjith-analytics-consent-v1';
  const preferenceLifetime = 180 * 24 * 60 * 60 * 1000;
  const browserDeclines = navigator.globalPrivacyControl === true;
  let started = false;
  let returnFocus = null;

  function readPreference() {
    if (browserDeclines) return 'declined';
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceKey));
      if (!saved || !['allowed', 'declined'].includes(saved.choice)) return null;
      const age = Date.now() - saved.updatedAt;
      if (!Number.isFinite(age) || age < 0 || age >= preferenceLifetime) return null;
      return saved.choice;
    } catch (_) {
      return null;
    }
  }

  let preference = readPreference();

  function clearAnalyticsCookies() {
    const domains = ['', window.location.hostname, '.sanjithuiux.design', 'sanjithuiux.design'];
    for (const name of ['_clck', '_clsk']) {
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`;
      }
    }
  }

  function startAnalytics() {
    if (started || preference !== 'allowed' || browserDeclines || !isProduction) return;
    if (!/^[a-z0-9]{4,40}$/i.test(projectId)) return;
    started = true;
    window.clarity = window.clarity || function () {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
    // Queue the visitor's choice before downloading the tracking script.
    window.clarity('consentv2', { analytics_Storage: 'granted', ad_Storage: 'denied' });
    const page = window.location.pathname.startsWith('/drexel-works/') ? 'Drexel Works'
      : window.location.pathname.startsWith('/glowm/') ? 'GLOWM'
        : window.location.pathname.startsWith('/privacy/') ? 'Privacy' : 'Home';
    window.clarity('set', 'portfolio_page', page);
    const trackingScript = document.createElement('script');
    trackingScript.async = true;
    trackingScript.src = `https://www.clarity.ms/tag/${projectId}`;
    document.head.appendChild(trackingScript);
  }

  const banner = document.createElement('aside');
  banner.className = 'site-privacy-banner';
  banner.setAttribute('aria-labelledby', 'site-privacy-title');
  banner.hidden = true;
  banner.innerHTML = `
    <div class="site-privacy-copy">
      <h2 id="site-privacy-title" tabindex="-1">Help improve this portfolio</h2>
      <p>With your permission, Microsoft Clarity helps me understand visits, clicks and scrolling through heatmaps and session replays. You can change your choice anytime. <a href="/privacy/">Privacy notice</a></p>
      <p class="site-privacy-status" role="status"></p>
    </div>
    <div class="site-privacy-actions">
      <button type="button" data-privacy-choice="declined">Decline</button>
      <button type="button" data-privacy-choice="allowed">Allow analytics</button>
    </div>`;
  document.body.appendChild(banner);

  const footerLinks = document.createElement('div');
  footerLinks.className = 'site-privacy-links';
  footerLinks.innerHTML = '<a href="/privacy/">Privacy notice</a><button type="button">Cookie settings</button>';
  (document.querySelector('footer') || document.body).appendChild(footerLinks);
  const settingsButton = footerLinks.querySelector('button');

  function showBanner(fromSettings = false) {
    banner.querySelector('.site-privacy-status').textContent = browserDeclines
      ? 'Your browser privacy preference keeps optional analytics off.'
      : fromSettings ? `Optional analytics are currently ${preference === 'allowed' ? 'on' : 'off'}.` : '';
    banner.querySelector('[data-privacy-choice="allowed"]').disabled = browserDeclines;
    banner.hidden = false;
    if (fromSettings) {
      returnFocus = document.activeElement;
      banner.querySelector('h2').focus({ preventScroll: true });
    }
  }

  function hideBanner() {
    banner.hidden = true;
    if (returnFocus) {
      returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    } else if (banner.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  }

  function setPreference(choice) {
    preference = browserDeclines ? 'declined' : choice;
    try {
      localStorage.setItem(preferenceKey, JSON.stringify({ choice: preference, updatedAt: Date.now() }));
    } catch (_) {
      // The choice still applies to this page when browser storage is unavailable.
    }
    hideBanner();
    if (preference === 'allowed') {
      startAnalytics();
    } else {
      if (started && typeof window.clarity === 'function') {
        window.clarity('consentv2', { analytics_Storage: 'denied', ad_Storage: 'denied' });
      }
      clearAnalyticsCookies();
      // Reloading removes the already-running SDK; no tracking script loads again.
      if (started) window.location.reload();
    }
  }

  banner.querySelectorAll('[data-privacy-choice]').forEach(button => {
    button.addEventListener('click', () => setPreference(button.dataset.privacyChoice));
  });
  settingsButton.addEventListener('click', () => showBanner(true));
  banner.addEventListener('keydown', event => {
    if (event.key === 'Escape' && preference) hideBanner();
  });

  window.addEventListener('storage', event => {
    if (event.key !== preferenceKey) return;
    preference = readPreference();
    if (preference !== 'allowed' && started) {
      window.clarity('consentv2', { analytics_Storage: 'denied', ad_Storage: 'denied' });
      clearAnalyticsCookies();
      window.location.reload();
    } else if (preference === 'allowed') {
      hideBanner();
      startAnalytics();
    } else if (!preference) {
      showBanner();
    } else {
      hideBanner();
    }
  });

  document.addEventListener('click', event => {
    if (!started || preference !== 'allowed') return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    const url = new URL(link.href, window.location.href);
    let name;
    if (url.pathname.endsWith('/sanjith-kumaar-resume.pdf')) name = 'resume_open';
    else if (url.protocol === 'mailto:') name = 'contact_email_click';
    else if (url.hostname === 'linkedin.com' || url.hostname.endsWith('.linkedin.com')) name = 'linkedin_open';
    else if (trackedHosts.includes(url.hostname) && url.pathname.startsWith('/drexel-works/')) name = 'drexel_works_open';
    else if (trackedHosts.includes(url.hostname) && url.pathname.startsWith('/glowm/')) name = 'glowm_open';
    if (name) window.clarity('event', name);
  });

  if (preference === 'allowed') startAnalytics();
  else if (preference === 'declined') clearAnalyticsCookies();
  else showBanner();
})();

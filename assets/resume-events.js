(() => {
  'use strict';
  if (typeof window.clarity !== 'function') return;
  window.clarity('event', 'resume_view');
  const reached = new Set();
  let queued = false;
  const checkDepth = () => {
    queued = false;
    if (document.visibilityState === 'hidden') return;
    const height = document.documentElement.scrollHeight;
    const depth = Math.min(1, (window.scrollY + window.innerHeight) / height);
    for (const milestone of [25, 50, 75, 100]) {
      if (depth >= milestone / 100 - 0.002 && !reached.has(milestone)) {
        reached.add(milestone);
        window.clarity('event', 'resume_scroll_' + milestone);
      }
    }
  };
  const queueDepth = () => {
    if (!queued) { queued = true; window.requestAnimationFrame(checkDepth); }
  };
  window.addEventListener('scroll', queueDepth, { passive: true });
  window.addEventListener('resize', queueDepth, { passive: true });
  window.addEventListener('load', queueDepth, { once: true });
  document.addEventListener('visibilitychange', queueDepth);
})();

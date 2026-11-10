(() => {
  const carousel = document.querySelector('.screen-carousel');
  if (!carousel) return;
  const slides = Array.from(carousel.querySelectorAll('.screen-slide'));
  const dots = Array.from(carousel.querySelectorAll('.screen-dot'));
  const previous = carousel.querySelector('.screen-arrow--prev');
  const next = carousel.querySelector('.screen-arrow--next');
  const status = carousel.querySelector('.screen-status');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gsap = window.gsap;
  let active = 0;
  let transition = null;
  let drag = null;

  const visualNodes = slide => [slide.querySelector('.screen-image-stage img'), slide.querySelector('.screen-caption')];

  function settleTransition() {
    if (transition) {
      transition.kill();
      transition = null;
    }
    slides.forEach((slide, index) => {
      if (gsap) {
        gsap.killTweensOf(visualNodes(slide));
        gsap.set(visualNodes(slide), { clearProps: 'transform,opacity,visibility' });
      }
      slide.classList.remove('is-entering');
      slide.hidden = index !== active;
      slide.inert = index !== active;
      if (index === active) slide.removeAttribute('aria-hidden');
      else slide.setAttribute('aria-hidden', 'true');
    });
  }

  function showScreen(index, dragOffset = 0) {
    const target = Math.max(0, Math.min(slides.length - 1, index));
    if (target === active) return;
    settleTransition();
    const outgoing = slides[active];
    const direction = target > active ? 1 : -1;
    active = target;
    const slide = slides[active];
    slide.hidden = false;
    slide.inert = false;
    slide.removeAttribute('aria-hidden');
    outgoing.inert = true;
    outgoing.setAttribute('aria-hidden', 'true');

    if (gsap && !reducedMotion.matches) {
      const [oldImage, oldCaption] = visualNodes(outgoing);
      const [newImage, newCaption] = visualNodes(slide);
      const viewport = slide.querySelector('.screen-image-stage');
      const distance = Math.max(viewport.clientWidth || 0, 240);
      gsap.set(oldImage, { x: dragOffset });
      transition = gsap.timeline({
        defaults: { duration: .5, ease: 'power2.inOut' },
        onComplete: () => {
          transition = null;
          settleTransition();
        },
      });
      transition
        .to(oldImage, { x: -direction * distance }, 0)
        .fromTo(newImage, { x: direction * distance + dragOffset, autoAlpha: 1 }, { x: 0, autoAlpha: 1 }, 0)
        .to(oldCaption, { autoAlpha: 0, duration: .12 }, 0)
        .fromTo(newCaption, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: .3, ease: 'power2.out' }, .16);
    } else {
      settleTransition();
    }

    previous.disabled = active === 0;
    next.disabled = active === slides.length - 1;
    dots.forEach((dot, i) => {
      if (i === active) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    status.textContent = `Screen ${active + 1} of ${slides.length}: ${slide.querySelector('.screen-caption h3').textContent}`;
    // Keep focus usable when the currently focused arrow becomes disabled.
    if (document.activeElement === previous && previous.disabled || document.activeElement === next && next.disabled) carousel.focus({ preventScroll: true });
  }

  previous.addEventListener('click', () => showScreen(active - 1));
  next.addEventListener('click', () => showScreen(active + 1));
  dots.forEach(dot => dot.addEventListener('click', () => showScreen(Number(dot.dataset.screen))));
  carousel.addEventListener('keydown', event => {
    const targets = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: slides.length - 1 };
    if (!(event.key in targets) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    showScreen(targets[event.key]);
  });

  slides.forEach(slide => {
    slide.querySelector('.screen-image-stage img').draggable = false;
  });

  function resetDrag(immediate = false) {
    if (!drag) return;
    const current = drag;
    drag = null;
    if (current.viewport.hasPointerCapture?.(current.pointerId)) {
      current.viewport.releasePointerCapture(current.pointerId);
    }
    if (gsap && current.horizontal) {
      if (immediate || reducedMotion.matches) gsap.set(current.image, { clearProps: 'transform' });
      else gsap.to(current.image, { x: 0, duration: .25, ease: 'power2.out', overwrite: true, clearProps: 'transform' });
    }
  }

  carousel.addEventListener('pointerdown', event => {
    if (event.isPrimary === false || event.button !== 0 || drag) return;
    const viewport = event.target.closest('.screen-image-stage');
    if (!viewport || !carousel.contains(viewport)) return;
    settleTransition();
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      viewport,
      image: slides[active].querySelector('.screen-image-stage img'),
      width: Math.max(viewport.clientWidth || 0, 240),
      horizontal: false,
      offset: 0,
    };
  });

  carousel.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.horizontal) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        resetDrag(true);
        return;
      }
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      drag.horizontal = true;
      drag.viewport.setPointerCapture?.(event.pointerId);
    }
    const atEdge = active === 0 && dx > 0 || active === slides.length - 1 && dx < 0;
    drag.offset = Math.max(-drag.width * .65, Math.min(drag.width * .65, dx * (atEdge ? .18 : 1)));
    if (gsap && !reducedMotion.matches) gsap.set(drag.image, { x: drag.offset });
    if (event.cancelable) event.preventDefault();
  }, { passive: false });

  carousel.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const target = active + (dx < 0 ? 1 : -1);
    const threshold = Math.max(44, Math.min(72, drag.width * .18));
    if (drag.horizontal && Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.2 && target >= 0 && target < slides.length) {
      const current = drag;
      drag = null;
      if (current.viewport.hasPointerCapture?.(current.pointerId)) current.viewport.releasePointerCapture(current.pointerId);
      showScreen(target, current.offset);
    } else {
      resetDrag();
    }
  });

  const cancelPointer = event => {
    if (drag && event.pointerId === drag.pointerId) resetDrag();
  };
  carousel.addEventListener('pointercancel', cancelPointer);
  carousel.addEventListener('lostpointercapture', cancelPointer);

  let wheelDelta = 0;
  let lastWheelAt = 0;
  let wheelUsed = false;
  carousel.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey || !event.target.closest('.screen-image-stage') || Math.abs(event.deltaX) < 1 || Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.2) return;
    if (event.cancelable) event.preventDefault();
    const now = Date.now();
    if (now - lastWheelAt > 180) {
      wheelDelta = 0;
      wheelUsed = false;
    }
    lastWheelAt = now;
    if (wheelUsed || drag) return;
    wheelDelta += event.deltaX * (event.deltaMode === 1 ? 16 : 1);
    if (Math.abs(wheelDelta) >= 48) {
      wheelUsed = true;
      showScreen(active + (wheelDelta > 0 ? 1 : -1));
    }
  }, { passive: false });

  reducedMotion.addEventListener?.('change', () => {
    resetDrag(true);
    settleTransition();
  });
  window.addEventListener('resize', () => {
    resetDrag(true);
    settleTransition();
  }, { passive: true });
  settleTransition();

})();

// Section tracking must also run on the static Solution page without a carousel.
(() => {
  const links = Array.from(document.querySelectorAll('.section-nav a, .chapter-rail a'));
  if (!links.length) return;
  const sections = links.map(link => document.getElementById(link.hash.slice(1)));
  const rail = document.querySelector('.chapter-rail');
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

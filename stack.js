// Fun mode, wide screens: the case-study stack (stack.css has the picture). Everything here
// is read straight off the scroll, the way the original folder entrance was: scroll down
// and the Dock rises, the pointer walks to the folder icon and clicks, the three folders
// genie out into a Wallet stack, then Mission Control, then Motion Graphics takes the
// screen. Stop and it stops; scroll back and it all runs backwards. A click lifts a folder
// in place; only its button goes inside. Nothing here acts in Normal mode or under 1101px.
(() => {
  const root = document.documentElement;
  const section = document.querySelector('.case-studies');
  const grid = section && section.querySelector('.project-grid');
  const cards = grid ? [...grid.querySelectorAll('.project-card')] : [];
  if (!grid || !cards.length) return;
  const wide = window.matchMedia('(min-width: 1101px)');
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  const active = () => wide.matches && root.dataset.mode === 'fun';
  const RUN = () => window.innerHeight * 3.2 + 1850; // the runway past the stage (.case-studies::after in stack.css)

  // The Dock and the pointer are copies of Fun mode's own (hero-play.js builds them).
  const copies = {};
  ['.dock:wdock', '.pointer:wpointer'].forEach((pair) => {
    const [from, name] = pair.split(':');
    const el = document.querySelector(from);
    if (!el) return;
    const copy = el.cloneNode(true);
    copy.className = name;
    copy.removeAttribute('style');
    document.body.append(copy); // (fixed: the stage below is sometimes moved with a transform)
    copies[name] = copy;
  });
  const dock = copies.wdock, pointer = copies.wpointer;

  const unit = (t) => Math.max(0, Math.min(1, t));
  const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const ease = (t) => t * t * (3 - 2 * t);
  const easeOut = (t) => 1 - (1 - t) ** 3;
  const tabTall = () => parseFloat(getComputedStyle(grid).getPropertyValue('--tab-h')) || 0;

  // The genie is the site's own (hero-play.js's strip warp, the same maths): each folder is
  // drawn as strips of a copy, bent into a funnel that narrows to the Dock's folder icon.
  const STRIPS = 44;
  const buildStrips = (card) => {
    const box = document.createElement('div');
    box.className = 'sgenie';
    const look = getComputedStyle(card);
    box.style.zIndex = look.zIndex;
    const wide = card.offsetWidth, tall = card.offsetHeight + tabTall(), slice = tall / STRIPS;
    for (let i = 0; i < STRIPS; i += 1) {
      const strip = document.createElement('div');
      strip.className = 'genie-strip';
      strip.style.cssText = 'width:' + wide + 'px;height:' + slice + 'px';
      const copy = card.cloneNode(true);
      copy.removeAttribute('id');
      copy.removeAttribute('href');
      const own = ['--f', '--ink', '--s'].map((v) => v + ':' + look.getPropertyValue(v)).join(';');
      copy.style.cssText = 'left:0;top:' + (tabTall() - i * slice) + 'px;height:' + card.offsetHeight + 'px;opacity:1;transform:none;transition:none;' + own;
      strip.append(copy);
      box.append(strip);
    }
    grid.append(box);
    return box;
  };
  const warp = (card, box, k) => {
    const g = grid.getBoundingClientRect();
    const wide = card.offsetWidth, tall = card.offsetHeight + tabTall(), slice = tall / STRIPS;
    const left = card.offsetLeft, at = card.offsetTop - tabTall() - g.top; // (the folder keeps its place on screen while the stage rides off with the page, like the Dock does)
    const fromX = g.width / 2 + 162;              // the Dock's folder icon
    const mouth = window.innerHeight - 92 - g.top; // the Dock, in the stage's own frame (the stage may be moving off with the page)
    const gone = (1 - k) ** 1.25;
    const bend = ease(unit(gone / 0.62));
    const slide = ease(unit((gone - 0.3) / 0.7));
    const scale = 1 + ((mouth - at) / tall - 1) * bend;
    const bottom = at + tall * scale;
    const fall = slide * (mouth - at);
    const yOf = (i) => Math.min(bottom, at + i * slice * scale + fall);
    const edges = (y) => {
      const f = smooth(unit((y - at) / (bottom - at))) * bend;
      return [left + (fromX - 26 - left) * f, left + wide + (fromX + 26 - left - wide) * f];
    };
    let y0 = yOf(0), e0 = edges(y0);
    const strips = box.children;
    for (let i = 0; i < STRIPS; i += 1) {
      const y1 = yOf(i + 1), e1 = edges(y1), yb = y1 + 0.7;
      const x0 = e0[0], x1 = e0[1], x2 = e1[1], x3 = e1[0];
      const tilt = (x0 - x1 + x2 - x3) / (x3 - x2);
      strips[i].style.transform = 'matrix3d(' + [
        (x1 - x0) / wide, 0, 0, 0,
        (x3 - x0 + tilt * x3) / slice, (yb - y0 + tilt * yb) / slice, 0, tilt / slice,
        0, 0, 1, 0,
        x0, y0, 0, 1
      ].map((n) => n.toFixed(7)).join(',') + ')';
      y0 = y1; e0 = e1;
    }
  };

  // The script. q is px of scrolling since the Dock started to rise: like the original site,
  // that is once the "Case Studies" title is in, S px before the stage sticks (p = 0).
  const CLICK_PAST = 300;                 // the click comes this far after the stage sticks
  const CLOSE_PAST = 200;                 // scrolling back up, the folders are clicked shut here
  const PRESS = 40;                       // how long the press shows, in px
  const POUR_MS = 1240, MINIMISE_MS = 800; // the folders pouring out, and going back in (the original's timing)
  const TURN_BACK = 24;                   // scrolled back up this far and fast enough, they go in early, so they are in before they leave the screen (the original)
  const STAG_MS = 300;                    // each folder starts this long after the one under it
  const DOCK_CATCH_MS = 700;              // the Dock's own rise or fall: unhurried, both ways
  const TRIP_RATE = 1.0, AWAY = 400;                 // px of the pointer's trip per ms: one steady pace both ways, whatever the scroll does
  const DROP = CLICK_PAST + 110 + 130;    // p: the Dock is down (past the click, the rest is scroll-driven)
  const MC = () => DROP + 130 + window.innerHeight * 0.8;  // (a near-full screen of rest to click around in) // Mission Control, after a rest
  const MC_LEN = 900;                     // (a slow hand-off: it reads too fast at 450)
  const MC_CATCH_MS = 900;                // and the row eases there, never snaps
  const TOP = () => MC() + MC_LEN + 100;  // Motion Graphics takes the screen
  const TOP_LEN = 700;
  const SPAN = POUR_MS + 2 * STAG_MS;     // the whole pour, first folder to last

  // Lowering eases the folders back (is-settling carries the transition, since the stack's
  // own transforms must not ease).
  let settle = 0, settling = false;
  const lower = () => {
    if (!cards.some((card) => card.classList.contains('is-up') || card.classList.contains('is-down'))) return;
    cards.forEach((card) => { card.classList.remove('is-up', 'is-down'); card.classList.add('is-settling'); });
    settling = true;
    window.clearTimeout(settle);
    settle = window.setTimeout(() => { cards.forEach((card) => card.classList.remove('is-settling')); settling = false; paint(); }, 600);
  };
  let boxes = null;
  const title = section.querySelector('.section-title');
  let titleOff = 90; // the title's top below the section's, before it sticks
  // The pour runs on a clock, not the scroll (the original's pace): tk is how far along the
  // whole pour is, open says which way it is going, dockUp chases what the scroll asks for.
  const clock = { tk: 0, open: false, seen: false, back: false, wantBack: false, pressAt: -1e9, lastY: 0, upRun: 0, downRun: 0, speed: 0, movedAt: 0, dockUp: 0, dockWant: 0, home: false, flat: false, trip: 0, q: 0, click: 0, mc: 0, mcWant: 0, last: 0, frame: 0 };
  // One flick, one stage: the hero, the stack out and settled, the Mission Control row with the
  // Motion Graphics title, Motion Graphics full; from there the page scrolls freely. A flick
  // sends the page there on hero-play.js's own glide (the nav links' ride), and the wheel
  // waits until it lands. p is read off the last paint.
  const step = { p: -1e9, shut: false, to: null, until: 0, busy: false, toHero: false, lastAt: 0, lastDelta: 0 };
  const stops = () => [DROP + 60, MC() + MC_LEN, TOP() + TOP_LEN];
  const go = (top, now, ms, out) => {
    ms = ms || Math.max(700, Math.min(1000, 400 + Math.abs(top - window.scrollY) * 0.4)); // a steady, unhurried step: never a dash, never a crawl
    step.to = Math.round(top);
    step.until = now + ms + 160;
    window.dispatchEvent(new CustomEvent('stackglide', { detail: { top, ms, out } }));
  };
  window.addEventListener('wheel', (event) => {
    if (!active() || event.ctrlKey || event.metaKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const now = performance.now();
    // A new flick, not the tail of the last one: a pause, a stronger push, or anything at all
    // once the last step has been over for a while (a trackpad never pauses).
    const fresh = now - step.lastAt > 150 || Math.abs(event.deltaY) > step.lastDelta * 1.5 || now > step.until + 1500; // (1.5s: longer than a trackpad's momentum tail)
    step.lastAt = now; step.lastDelta = Math.abs(event.deltaY);
    if (step.busy && now > step.until + 4000) step.busy = step.toHero = step.shut = false; // (never stuck: whatever happened, the wheel is theirs again)
    if (step.p < -1e8) paint(); // (a wheel before the first paint: measure first)
    const p = step.p, list = stops(), last = list[list.length - 1];
    if (p > last + 40) return; // past Motion Graphics: the page is free
    event.preventDefault(); // (hero-play.js leaves a prevented wheel alone)
    // Turning round mid-way: scrolled back while the folders pour out, they stop where they are
    // and go back in from there (the pointer turns back to click); scrolled down again while
    // they go in, they pour back out from there. Either way, nothing restarts.
    if (event.deltaY < 0 && clock.open && clock.tk < 1 && !step.shut) { step.shut = true; go(0, now, 2200, 'inout'); queue(); return; } // (a shorter ride than from the settled stack: fewer folders to put back)
    if (event.deltaY > 0 && clock.home) { clock.home = false; clock.back = false; step.shut = step.toHero = false; if (clock.tk > 0) { clock.open = true; if (clock.trip <= clock.click) clock.pressAt = now; } go(window.scrollY + list[0] - p, now); queue(); return; }
    if (step.busy || now < step.until || !fresh) return;
    if (event.deltaY > 0) {
      const next = list.find((at) => at > p + 40);
      if (next !== undefined) go(window.scrollY + next - p, now);
    } else if (p > list[0] - 40 && p < list[1] - 40) {
      // Back from the stack: the page rides to the hero while the folders are clicked shut.
      step.shut = true; go(0, now, 3400, 'inout');
      queue();
    } else {
      const prev = list.filter((at) => at < p - 40).pop();
      go(prev === undefined ? 0 : window.scrollY + prev - p, now);
    }
  }, { passive: false, capture: true });

  const tick = (now) => {
    clock.frame = 0;
    const dt = Math.min(100, now - clock.last);
    clock.last = now;
    // The pointer's trip runs on the clock: in and along the icons to the folder (the click waits
    // for it), off once the folders are out; riding home, the same trip backwards.
    if (clock.home) { if (!clock.open) { clock.trip = Math.max(clock.tk > 0 ? clock.click : 80, clock.trip - dt * TRIP_RATE); if (clock.trip <= clock.click && clock.dockUp >= 1 && clock.pressAt < 0) clock.pressAt = now; } } // (the click once the Dock is up; it waits on the folder while the files go in)
    else if (clock.q > 0) clock.trip = Math.min(clock.open ? clock.click + AWAY : clock.click, clock.trip + dt * TRIP_RATE);
    if (clock.open) clock.tk = Math.min(1, clock.tk + dt / (clock.flat ? MINIMISE_MS : SPAN));
    else if (clock.dockUp >= 1 && now >= clock.pressAt + PRESS && (!clock.home || clock.trip <= clock.click)) clock.tk = Math.max(0, clock.tk - dt / (clock.flat ? MINIMISE_MS : SPAN)); // (in: the Dock up first, the click, then the whole stack as one folder)
    if (calm.matches) clock.tk = clock.open ? 1 : 0;
    const d = dt / DOCK_CATCH_MS, was = clock.dockUp;
    clock.dockUp = clock.dockUp < clock.dockWant ? Math.min(clock.dockWant, clock.dockUp + d) : Math.max(clock.dockWant, clock.dockUp - d);
    if (!clock.open && !clock.home && clock.tk > 0 && was < 1 && clock.dockUp >= 1) clock.pressAt = now; // the click, once the Dock is up
    const e = dt / MC_CATCH_MS;
    clock.mc = clock.mc < clock.mcWant ? Math.min(clock.mcWant, clock.mc + e) : Math.max(clock.mcWant, clock.mc - e);
    paint();
  };
  const run = () => { if (!clock.frame) { clock.last = performance.now(); clock.frame = window.requestAnimationFrame(tick); } };

  // Going in, the page is held still (the original's folder minimises in place, then the
  // page moves on); the hold lets go the moment they are in, or after a second at most.
  let held = false, heldAt = 0;
  const hold = (on) => {
    if (on && !held) heldAt = performance.now();
    on = on && performance.now() < heldAt + 2600; // (never stuck: longer than the pour)
    if (on === held) return;
    held = on;
    document.documentElement.classList.toggle('is-held', on); // (hero-play.js drops the wheel while this is on)
  };
  const paint = () => {
    if (!active()) { if (boxes) { boxes.forEach((b) => b.remove()); boxes = null; } hold(false); return; }
    const vh = window.innerHeight;
    // How far the page has scrolled on since the stage stuck (negative: not yet). The stage
    // is sticky, so it is measured from the section's end: the runway and the stage come last.
    const s = section.getBoundingClientRect();
    const p = vh + RUN() - s.top - s.height;
    step.p = p;
    // The title's own place on the page is remembered from before it sticks.
    const tr = title.getBoundingClientRect().top - (parseFloat(section.style.getPropertyValue('--ty')) || 0);
    if (tr > 86) titleOff = tr - s.top;
    // The Dock starts up once the title is in (its top at 0.72vh), as on the original site.
    const S = Math.max(260, Math.min(560, s.height - RUN() - vh * 0.28 - titleOff + 40));
    const q = p + S;
    const CLICK = S + CLICK_PAST;
    clock.q = q; clock.click = CLICK;

    // The click, and the folders clicked shut on the way back up.
    const now = performance.now();
    const moved = window.scrollY - clock.lastY;
    clock.lastY = window.scrollY;
    clock.upRun = moved < 0 ? clock.upRun - moved : moved > 0 ? 0 : clock.upRun;
    clock.downRun = moved > 0 ? clock.downRun + moved : moved < 0 ? 0 : clock.downRun;
    if (moved !== 0) { const lapse = Math.max(8, Math.min(120, now - clock.movedAt)); clock.speed += (Math.abs(moved) / lapse * 1000 - clock.speed) * 0.35; clock.movedAt = now; }
    else if (now - clock.movedAt > 140) clock.speed = 0;
    if (step.to !== null && Math.abs(window.scrollY - step.to) < 1) step.to = null; // (landed)
    const gliding = step.busy || now < step.until + 300 || step.to !== null; // (a step is carrying the page: its speed means nothing)
    if (gliding) clock.speed = clock.upRun = 0;
    const early = !gliding && clock.tk >= 1 && clock.upRun >= TURN_BACK && (p + vh - 230) / Math.max(1, clock.speed) < (PRESS + MINIMISE_MS) / 1000 + 0.06;
    if (!clock.seen) { clock.seen = true; if (q >= CLICK) { clock.open = true; clock.tk = 1; clock.trip = CLICK + AWAY; } }
    if (!clock.open && q >= CLICK && clock.trip >= CLICK && (!clock.back || clock.downRun >= 40)) { clock.open = true; clock.back = false; clock.pressAt = now; if (clock.tk <= 0) clock.flat = false; } // (once shut, the next click needs a scroll back down, as the original)
    else if (clock.open && ((q < S + CLOSE_PAST && !gliding) || early || step.shut) && !settling) {
      clock.open = false; clock.back = true; clock.wantBack = true; step.shut = false; clock.downRun = 0; clock.home = gliding; clock.flat = clock.tk >= 1; if (gliding) { clock.trip = Math.max(clock.trip, CLICK); clock.pressAt = -1e9; } else if (clock.dockUp >= 1) clock.pressAt = now; // (downRun: the next click needs a fresh scroll down, not the one that brought them here)
      // The rest of the runway is dead scroll now (the stage is pinned, so this shows nothing):
      // skip it, and the hero is next once they are in. hero-play.js moves the page.
      if (p > 0 && !gliding) { window.dispatchEvent(new CustomEvent('stackjump', { detail: -p })); clock.lastY = window.scrollY; }
    }  // (settled first, then clicked shut)
    // Once they are in, the Dock is gone until the page is scrolled down towards the click again (as the original).
    if (clock.back && clock.tk <= 0) { if (moved < 0) clock.wantBack = false; else if (moved > 0 && q >= CLICK - 260) clock.wantBack = true; } // (the Dock stays up while a step carries the page to the hero)
    if (q <= 0 && clock.tk <= 0) { clock.back = clock.wantBack = false; if (!clock.home) clock.trip = 0; } // back above it all: the next visit starts fresh
    const closing = !clock.open && clock.tk > 0;
    if (clock.home && (!gliding || moved > 0)) clock.home = false; // (riding home: the Dock is on its own clock, down once the folders are in)
    if (step.toHero && !clock.open && clock.tk <= 0 && now >= step.until) { step.busy = step.toHero = false; go(0, now, 1400, true); }
    // Each folder's k, from its own slice of the clock; scrolled up so far the stage has left
    // the screen, a folder finishes going in over the last stretch rather than vanishing.
    let allOut = true, mid = false;
    cards.forEach((card, i) => {
      let k = clock.flat ? unit(clock.tk) : unit((clock.tk * SPAN - i * STAG_MS) / POUR_MS); // (out one after the other; in together, as the original's one folder)
      card.dataset.k = k;
      if (k < 1) allOut = false;
      if (k > 0 && k < 1) mid = true;
    });

    // The Dock: up over 300px of scroll from the title, down once the folders are out.
    const press = now < clock.pressAt + PRESS ? Math.sin(Math.PI * (now - clock.pressAt) / PRESS) : 0; // (the click, by the clock: the original's PRESS)
    const settled = clock.open && allOut;
    // The page waits for the stack: while they go in, while they pour out, and whenever a fast
    // scroll runs ahead of Mission Control (scrolled at any speed, nothing overtakes the show).
    const ahead = (clock.open && !allOut && p > 360) || (settled && clock.mc < clock.mcWant - 0.15);
    hold(closing || ahead);
    clock.dockWant = clock.home ? (closing ? 1 : 0) : settled ? 1 - unit((q - CLICK - 110) / 130) ** 3 : clock.back && !closing ? (clock.wantBack ? 1 : 0) : 1;
    const up = clock.home ? clock.dockUp : Math.min(easeOut(unit(q / 300)), clock.dockUp);
    if (dock) {
      dock.style.bottom = (-140 + 180 * up).toFixed(1) + 'px';
      dock.style.visibility = up > 0 ? '' : 'hidden';
    }
    // The pointer: in from the lower left, along the icons to the folder, the click, then
    // off to the lower right while the folders come out.
    if (pointer) {
      const qq = clock.trip;
      // One straight line at one speed, in from the lower left to the folder, then straight
      // off to the lower right once the folders are out.
      // (the last fifth of the way in slows to a stop on the folder, and the way out starts
      // from rest: no jolt at the click, either direction)
      const u = unit((qq - 80) / (CLICK - 80)), v = unit((u - 0.8) / 0.2);
      const arrive = u < 0.8 ? u : 0.8 + 0.2 * (v + v * v - v * v * v);
      const w = unit((qq - CLICK - 40) / (AWAY - 40));
      const away = 2 * w * w - w * w * w;
      const x = -469 + 625 * arrive + 280 * away;
      const lift = clock.home && clock.tk <= 0 ? 0 : (1 - up) * 180; // (riding home with the folders in, the pointer leaves on its own straight line: the Dock dropping under it must not pull it about)
      const y = vh + 40 - 135 * arrive - vh / 2 + 220 * away - lift;
      pointer.style.opacity = arrive > 0 && away < 1 && (up > 0 || lift === 0) ? '1' : '0'; // (riding home, it finishes leaving while the Dock drops)
      pointer.style.transform = 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px) scale(' + (1 - 0.14 * press).toFixed(3) + ')';
      pointer.classList.toggle('is-hand', arrive > 0.93 && away < 0.2);
      // Each icon swells as the pointer passes over it and pushes its neighbours aside, as on
      // the original site's Dock (hero-play.js's maths; the folder also takes the press).
      if (dock) {
        const icons = dock.children, ICON = 76, GAP = 32, power = up * arrive * (1 - away), sizes = [];
        let row = (icons.length - 1) * GAP;
        for (let i = 0; i < icons.length; i += 1) {
          const far = (x + 7 - (i - 1.5) * (ICON + GAP)) / (ICON + GAP);
          sizes[i] = (1 + 0.42 * power * Math.exp(-far * far)) * (i === icons.length - 1 ? 1 - 0.14 * press : 1);
          row += ICON * sizes[i];
        }
        let edge = -row / 2;
        for (let i = 0; i < icons.length; i += 1) {
          const centre = edge + ICON * sizes[i] / 2;
          icons[i].style.transform = 'translate3d(' + (centre - (i - 1.5) * (ICON + GAP)).toFixed(2) + 'px, 0, 0) scale(' + sizes[i].toFixed(4) + ')';
          edge += ICON * sizes[i] + GAP;
        }
        const plain = icons.length * ICON + (icons.length - 1) * GAP;
        dock.style.setProperty('--bar', ((row + 56) / (plain + 56)).toFixed(4));
      }
    }
    // The folders pour out of the Dock, one after the other.
    // Mission Control waits for the pour to finish (a fast scroll must not overtake it), then
    // chases the scroll on the clock so it never snaps.
    clock.mcWant = settled ? smooth(unit((p - MC()) / MC_LEN)) : 0;
    const m = clock.mc;
    const t = m >= 1 ? smooth(unit((p - TOP()) / TOP_LEN)) : 0;
    cards.forEach((card) => { card.style.opacity = +card.dataset.k >= 1 ? (1 - unit(t * 3)).toFixed(3) : '0'; });  // the row is gone before Motion Graphics reaches it
    if (mid && !boxes) boxes = cards.map(buildStrips);
    if (!mid && boxes) { boxes.forEach((b) => b.remove()); boxes = null; }
    if (boxes) cards.forEach((card, i) => {
      const k = +card.dataset.k;
      const show = k > (closing ? 0.08 : 0) && k < 1; // (going in, the last stub is already inside the icon: skip the frame it would flash on)
      boxes[i].style.visibility = show ? '' : 'hidden';
      if (show) warp(card, boxes[i], k);
    });
    // Mission Control and Motion Graphics (stack.css reads these).
    grid.style.setProperty('--m', m.toFixed(4));
    grid.style.setProperty('--t', t.toFixed(4));
    grid.style.setProperty('--tr', smooth(unit((t - 0.34) / 0.66)).toFixed(4));  // Motion Graphics moves up only after the row is gone
    // The "Case Studies" title fades and rises in as the section comes up the screen (from
    // 0.96vh to 0.72vh, as on the original site), and goes with Mission Control.
    const tin = smooth(unit((vh * 0.96 - s.top - titleOff) / (vh * 0.24)));
    section.style.setProperty('--ti', (tin * (1 - m)).toFixed(3));
    section.style.setProperty('--ty', ((1 - tin) * 70).toFixed(1) + 'px');
    const rest = settled && p >= DROP && m <= 0;  // the stack at rest: a folder may be lifted
    grid.classList.toggle('is-rest', rest);
    grid.classList.toggle('is-on', m > 0);
    grid.classList.toggle('is-shutting', closing); // (the stage may be riding off with the page: the folders must not be cut at its edge)
    if (!rest) lower();
    // Keep the clock going while anything is still moving.
    const want = clock.open ? 1 : 0;
    if (clock.tk !== want || clock.dockUp !== clock.dockWant || clock.mc !== clock.mcWant || now < clock.pressAt + PRESS || (clock.home ? clock.trip > 80 : q > 0 && clock.trip < (clock.open ? CLICK + AWAY : CLICK))) run();
  };

  cards.forEach((card) => card.addEventListener('click', (event) => {
    if (!active() || event.target.closest('.project-link')) return; // (the button goes inside)
    event.preventDefault(); // (the folder itself never goes inside, the front one included: only its button does)
    if (card === cards[2]) return; // (the front folder is open already: nothing to lift)
    if (!grid.classList.contains('is-rest')) return;
    const wasUp = card.classList.contains('is-up');
    lower();
    if (wasUp) return;
    // The demo: a lower folder rises one step over the one above it; the top folder stays and
    // the others slide down out of its way.
    card.classList.add('is-up');
    if (card === cards[0]) cards.slice(1).forEach((c) => c.classList.add('is-down'));
    if (card === cards[1]) cards[2].classList.add('is-down');  // room to read the middle one
  }));

  let frame = 0;
  const queue = () => { if (!frame) frame = window.requestAnimationFrame(() => { frame = 0; paint(); }); };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('stackride', paint); // (the ride home moves the page inside a frame: draw after it, not a frame late)
  window.addEventListener('resize', queue);
  new MutationObserver(queue).observe(root, { attributes: true, attributeFilter: ['data-mode'] });
  paint();
})();

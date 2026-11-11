// Motion Graphics: a click on the dark card grows it into a panel of the videos from the
// two Vimeo showcases; a click on a video pops it up out of its tile, with its notes beside
// it. Every Vimeo embed carries dnt=1, so the site stays cookieless. Transform only, so the
// hero's own scroll staging (hero-play.js) is left exactly as it is.
(() => {
  const reel = document.querySelector('.reel');
  const card = reel && reel.querySelector('.reel-card');
  const plain = reel && reel.querySelector('.reel-plain');
  // Whichever of the two cards is on show (the dark screen in Fun mode, the plain card
  // otherwise) is the one the panel grows out of, and the one the clip plays in.
  const shown = () => (plain && plain.offsetParent ? plain : card);
  const panel = document.querySelector('.reel-panel');
  const veil = document.querySelector('.reel-veil');
  if (!card || !panel || !veil) return;
  const root = document.documentElement;
  const player = panel.querySelector('.reel-player');
  const frame = panel.querySelector('.reel-frame');
  const holder = panel.querySelector('.reel-holder');
  const info = panel.querySelector('.reel-info');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');

  // The videos, as they are on Vimeo (ids, lengths, thumbnails). Names and notes written
  // from the videos themselves.
  const videos = [
    { id: 1221290901, title: 'FruVital – New Taste', blurb: 'Product spot for a juice brand: the bottle spins through each new flavour, Apple to Pineapple, and lands on the logo.', tools: ['After Effects', 'Illustrator'], secs: 17, tall: true, group: 'motion', thumb: 'https://i.vimeocdn.com/video/2193955138-76f2f750134d85f07315a053b17c0359fd5fe8c7b366b8982a56c35d44eb7745-d_640' },
    { id: 1221290902, title: 'Taco Tuesday Arcade', blurb: 'A retro arcade cabinet where a taco battles a burger, pixel high-score board and all.', tools: ['After Effects', 'Illustrator'], secs: 54, tall: true, group: 'motion', thumb: 'https://i.vimeocdn.com/video/2193955114-67a8f7d307dc2031b5dafa40f629b841f31f4f248cbdbd9ce3e2107c1f4e453b-d_640' },
    { id: 1215592515, title: 'Singapore Travel Guide', blurb: 'Four-minute explainer for Pickyourtrail: presenter cutouts, food, Gardens by the Bay, with animated tips and lower-thirds.', tools: ['After Effects', 'Illustrator'], secs: 241, tall: false, group: 'motion', thumb: 'https://i.vimeocdn.com/video/2186805773-adc8f17b43e3a8bc89f0df4b9e93ef26f8a771744b4f565c43fea1ade6c0eed5-d_640' },
    { id: 1245620221, title: 'Anxiety', blurb: 'Short character piece: a boy covers his ears as the noise builds, then faces an empty bed at night.', tools: ['After Effects', 'Photoshop'], secs: 15, tall: true, group: 'motion', thumb: 'https://i.vimeocdn.com/video/2224799091-c398a28dbba18c3ca8d72467b9946792a7292c99e2a6581dffe22fd68a962954-d_640' },
    { id: 1215591729, title: 'A Day in New York City', blurb: 'Fast travel edit of a day in NYC: subway, skyline and the Manhattan Bridge, cut to the beat.', tools: ['Premiere Pro', 'After Effects'], secs: 15, tall: false, group: 'video', thumb: 'https://i.vimeocdn.com/video/2186803220-b853f7ac5d5b5d8dc4d159f2929e6fb807dad529c29c6eb0b705d5453c37719c-d_640' },
    { id: 1215591728, title: 'A Day in Philadelphia', blurb: 'Travel edit through Philadelphia: City Hall, the Masonic Temple gates and the Franklin Institute.', tools: ['Premiere Pro', 'After Effects'], secs: 15, tall: false, group: 'video', thumb: 'https://i.vimeocdn.com/video/2186803062-678c879edc3fa0e3e5d52f8189ed561d9b02e6f0b5078c092d9b83a985f6fc67-d_640' },
    { id: 1215592514, title: 'Labour Day – Pickyourtrail', blurb: 'Vertical campaign film meeting the teams behind your trip: Sales, Product, Tech & Analytics and Finance.', tools: ['Premiere Pro', 'After Effects'], secs: 37, tall: true, group: 'video', thumb: 'https://i.vimeocdn.com/video/2186803720-b92a2b7a47d910a69c4f4970443f50189f76804339ae9fa67a9c54349f72c1c0-d_640' },
  ];
  const clock = (secs) => Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
  const text = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  videos.forEach((v, i) => {
    const tile = document.createElement('div');
    tile.className = 'reel-tile';
    tile.setAttribute('role', 'button');
    tile.tabIndex = 0;
    tile.setAttribute('aria-label', 'Watch ' + v.title + ', ' + clock(v.secs));
    tile.style.setProperty('--i', i);
    tile.style.setProperty('--thumb', 'url(' + v.thumb + ')');
    tile.innerHTML = '<div class="reel-thumb"></div><div class="reel-tile-play" aria-hidden="true"><i></i></div><div class="reel-tile-label">' + text(v.title) + '<small>' + text(v.blurb) + ' &middot; ' + clock(v.secs) + '</small></div>';
    tile.addEventListener('click', () => openVideo(v, tile));
    tile.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openVideo(v, tile); } });
    panel.querySelector('.reel-grid[data-group="' + v.group + '"]').append(tile);
  });

  // The video pops up out of its tile: the big frame starts exactly over the tile (moved and
  // scaled to match, showing the same thumbnail) and eases out to its place; the notes slide
  // in beside it a beat later. Closing runs it back into the tile.
  const POP = still.matches ? 0 : 520;
  let openTile = null;
  let popTimer = 0;
  const mapFrameToTile = (tile) => {
    const t = tile.getBoundingClientRect();
    const f = frame.getBoundingClientRect(); // (its resting place)
    if (!f.width || !f.height) { frame.style.transform = 'none'; return; }
    frame.style.transform = 'translate(' + (t.left - f.left) + 'px, ' + (t.top - f.top) + 'px) scale(' + (t.width / f.width) + ', ' + (t.height / f.height) + ')';
  };
  const openVideo = (v, tile) => {
    if (player.classList.contains('is-on')) return;
    window.clearTimeout(popTimer);
    openTile = tile;
    frame.style.setProperty('--ratio', v.tall ? '9 / 16' : '16 / 9');
    frame.style.setProperty('--poster', 'url(' + v.thumb + ')');
    frame.classList.toggle('is-tall', v.tall);
    holder.classList.toggle('is-tall', v.tall);
    info.querySelector('h4').textContent = v.title;
    info.querySelector('p').textContent = v.blurb;
    info.querySelector('.reel-tools').innerHTML = v.tools.map((t) => '<li>' + text(t) + '</li>').join('');
    info.querySelector('.reel-meta').textContent = clock(v.secs) + ' · ' + (v.tall ? 'Vertical' : 'Widescreen');
    frame.innerHTML = '';
    player.classList.add('is-on');
    frame.style.transition = 'none';
    frame.style.transform = 'none';
    mapFrameToTile(tile);
    void frame.offsetWidth;
    frame.style.transition = 'transform ' + POP + 'ms cubic-bezier(.16, 1, .3, 1)';
    frame.style.transform = 'none';
    player.classList.add('is-lit');
    tile.style.visibility = 'hidden';
    popTimer = window.setTimeout(() => {
      frame.innerHTML = '<iframe src="https://player.vimeo.com/video/' + v.id + '?dnt=1&autoplay=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="' + text(v.title) + '"></iframe>';
      panel.querySelector('.reel-back').focus({ preventScroll: true });
    }, Math.max(0, POP - 120));
  };
  const stopPlayer = () => {
    if (!player.classList.contains('is-on')) return;
    window.clearTimeout(popTimer);
    frame.innerHTML = '';
    player.classList.remove('is-lit');
    frame.style.transition = 'transform ' + Math.round(POP * 0.75) + 'ms cubic-bezier(.7, 0, .84, 0)';
    const tile = openTile;
    if (tile) mapFrameToTile(tile);
    popTimer = window.setTimeout(() => {
      player.classList.remove('is-on');
      if (tile) { tile.style.visibility = ''; tile.focus({ preventScroll: true }); }
      openTile = null;
      frame.style.transform = 'none';
    }, Math.round(POP * 0.75));
  };
  panel.querySelector('.reel-back').addEventListener('click', stopPlayer);

  // The card grows into the panel: the panel starts exactly where the card is (moved and
  // scaled to match), then eases out to the middle of the window. One element, transform only.
  const DUR = still.matches ? 0 : 560;
  let openTimer = 0;
  const isOpen = () => !panel.hidden;
  const fitToCard = () => {
    const r = shown().getBoundingClientRect(); // (as drawn: moved or shrunk by the hero staging too)
    const sx = r.width / panel.offsetWidth;
    const sy = r.height / panel.offsetHeight;
    panel.style.transform = 'translate(' + r.left + 'px, ' + r.top + 'px) scale(' + sx + ', ' + sy + ')';
  };
  const fitToHome = () => {
    const left = (window.innerWidth - panel.offsetWidth) / 2;
    const top = (window.innerHeight - panel.offsetHeight) / 2;
    panel.style.transform = 'translate(' + left + 'px, ' + top + 'px) scale(1, 1)';
  };
  const open = () => {
    if (isOpen()) return;
    window.clearTimeout(openTimer);
    veil.hidden = false;
    panel.hidden = false;
    panel.style.transition = 'none';
    fitToCard();
    reel.classList.add('is-showing');
    root.classList.add('reel-open');
    void panel.offsetWidth;
    panel.style.transition = 'transform ' + DUR + 'ms cubic-bezier(.16, 1, .3, 1)';
    fitToHome();
    veil.classList.add('is-on');
    openTimer = window.setTimeout(() => { panel.classList.add('is-in'); panel.querySelector('.reel-close').focus({ preventScroll: true }); }, Math.max(0, DUR - 260));
  };
  const close = () => {
    if (!isOpen()) return;
    window.clearTimeout(openTimer);
    panel.classList.remove('is-in');
    stopPlayer();
    panel.style.transition = 'transform ' + Math.round(DUR * 0.8) + 'ms cubic-bezier(.7, 0, .84, 0)';
    fitToCard();
    veil.classList.remove('is-on');
    openTimer = window.setTimeout(() => {
      panel.hidden = true;
      veil.hidden = true;
      reel.classList.remove('is-showing');
      root.classList.remove('reel-open');
      shown().focus({ preventScroll: true });
    }, Math.round(DUR * 0.8));
  };
  // One Vimeo clip, moved into whichever card is on show, so it is never loaded twice.
  const video = reel.querySelector('.reel-video');
  const placeVideo = () => {
    if (!video) return;
    const into = plain && plain.offsetParent ? plain.querySelector('.reel-image') : card.querySelector('.reel-stage');
    if (into && video.parentElement !== into) into.prepend(video);
  };
  placeVideo();
  window.addEventListener('resize', placeVideo);
  // The clip's first picture is on the card from the start; the video itself only loads
  // once the card is on show (in Fun mode, once it has built over the folders), so no video
  // runs while the folders stack, and it is unloaded again once the card is out of sight.
  const clip = video && video.querySelector('iframe');
  let clipSeen = false;
  const syncClip = () => {
    if (!clip) return;
    const built = !(card && card.offsetParent) || reel.classList.contains('is-open');
    const want = clipSeen && built;
    if (want && !clip.src) {
      clip.src = clip.dataset.src;
      // (Shown a beat after it has loaded, by which time the clip is running.)
      clip.addEventListener('load', () => { clipTimer = window.setTimeout(() => clip.classList.add('is-playing'), 900); }, { once: true });
    } else if (!want && clip.src) {
      window.clearTimeout(clipTimer);
      clip.classList.remove('is-playing');
      clip.removeAttribute('src');
    }
  };
  let clipTimer = 0;
  if (clip && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { clipSeen = entries.some((e) => e.isIntersecting); syncClip(); }, { rootMargin: '400px 0px' }).observe(video);
    new MutationObserver(syncClip).observe(reel, { attributes: true, attributeFilter: ['class'] });
  } else if (clip) {
    clip.src = clip.dataset.src;
    clip.classList.add('is-playing');
  }
  [card, plain].forEach((el) => {
    if (!el) return;
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
  panel.querySelector('.reel-close').addEventListener('click', close);
  veil.addEventListener('click', close);
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    if (player.classList.contains('is-on')) stopPlayer(); else close();
  });
  window.addEventListener('resize', () => { if (isOpen()) { panel.style.transition = 'none'; fitToHome(); } });
  // While the panel is open the page behind it stays put: the wheel scrolls the grid, not the
  // page (hero-play.js listens on the window, so the event is stopped before it gets there).
  const keep = (e) => { e.stopPropagation(); };
  panel.addEventListener('wheel', keep, { passive: true });
  veil.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
  panel.addEventListener('touchmove', keep, { passive: true });
  // Switching modes rebuilds the page around the card, so the panel closes first.
  const modeSwitch = document.querySelector('.mode-switch');
  if (modeSwitch) {
    modeSwitch.addEventListener('click', close, true);
    modeSwitch.addEventListener('click', () => window.setTimeout(placeVideo, 0));
    // (The switch may first glide the page to the top and change mode a moment later.)
    new MutationObserver(placeVideo).observe(root, { attributes: true, attributeFilter: ['data-mode'] });
  }
})();

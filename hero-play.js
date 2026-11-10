(() => {
  'use strict';
  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const modeSwitch = document.querySelector('.mode-switch');
  if (!hero || !modeSwitch) return;

  const copy = hero.querySelector('.hero-copy');
  const nameSelect = hero.querySelector('.name-select');
  const sizeTag = hero.querySelector('.size-tag');
  const playLayer = hero.querySelector('.play-layer');
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');

  const wide = window.matchMedia('(min-width: 1101px)');
  const playing = () => root.dataset.mode === 'fun' && wide.matches;

  // ---------- Orange selection box ----------
  // The box around the name can be moved by the word and resized by its eight handles.
  // Letting go springs it back like a rubber band. x/y/w/h are relative to its resting spot.
  const nameWord = nameSelect.querySelector('.name-word');
  const nameBox = nameSelect.querySelector('.name-box');
  const box = { x: 0, y: 0, w: 0, h: 0, restW: 0, restH: 0, vel: { x: 0, y: 0, w: 0, h: 0 }, held: false, frame: 0 };
  const PAD_X = 10;
  const PAD_Y = 2;
  const MIN_W = 70;
  const MIN_H = 34;

  const renderBox = () => {
    if (!box.restW) return;
    nameWord.style.transform = 'translate(' + box.x + 'px, ' + box.y + 'px) scale(' + box.w / box.restW + ', ' + box.h / box.restH + ')';
    nameBox.style.inset = 'auto';
    nameBox.style.left = box.x - PAD_X + 'px';
    nameBox.style.top = box.y - PAD_Y + 'px';
    nameBox.style.width = box.w + PAD_X * 2 + 'px';
    nameBox.style.height = box.h + PAD_Y * 2 + 'px';
    sizeTag.textContent = Math.round(box.w) + ' × ' + Math.round(box.h);
    wakeTile();
  };

  const measureBox = () => {
    if (box.held || box.frame) return;
    nameWord.style.transform = '';
    const rect = nameSelect.getBoundingClientRect();
    box.restW = rect.width;
    box.restH = rect.height;
    box.x = 0; box.y = 0; box.w = rect.width; box.h = rect.height;
    renderBox();
  };

  const springBox = () => {
    window.cancelAnimationFrame(box.frame);
    const target = { x: 0, y: 0, w: box.restW, h: box.restH };
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      let moving = false;
      for (const key of ['x', 'y', 'w', 'h']) {
        const pull = -230 * (box[key] - target[key]) - 13 * box.vel[key];
        box.vel[key] += pull * dt;
        box[key] += box.vel[key] * dt;
        if (Math.abs(box.vel[key]) > 2 || Math.abs(box[key] - target[key]) > 0.3) moving = true;
      }
      if (moving && !box.held) {
        renderBox();
        box.frame = window.requestAnimationFrame(step);
      } else if (!box.held) {
        box.frame = 0;
        Object.assign(box, target);
        box.vel = { x: 0, y: 0, w: 0, h: 0 };
        renderBox();
      }
    };
    box.frame = window.requestAnimationFrame(step);
  };

  nameSelect.addEventListener('pointerdown', (event) => {
    if (!playing() || event.button !== 0) return;
    // "Sanjith!" stays where it is: only its handles do anything, and they only stretch it.
    if (!event.target.closest('.name-box i')) return;
    event.preventDefault();
    window.cancelAnimationFrame(box.frame);
    box.frame = 0;
    box.held = true;
    box.vel = { x: 0, y: 0, w: 0, h: 0 };
    nameSelect.classList.add('is-held');
    try { nameSelect.setPointerCapture(event.pointerId); } catch (error) { /* capture is a nicety */ }
    // Handles are named by edge: t/m/b for top, middle, bottom and l/c/r for left, centre, right.
    const handle = event.target.closest('.name-box i');
    const edges = handle ? handle.className : 'move';
    const start = { px: event.clientX, py: event.clientY, x: box.x, y: box.y, w: box.w, h: box.h };

    const drag = (move) => {
      const dx = move.clientX - start.px;
      const dy = move.clientY - start.py;
      if (edges === 'move') {
        box.x = start.x + dx;
        box.y = start.y + dy;
      } else {
        if (edges[1] === 'l') {
          box.w = Math.max(MIN_W, start.w - dx);
          box.x = start.x + start.w - box.w;
        } else if (edges[1] === 'r') {
          box.w = Math.max(MIN_W, start.w + dx);
        }
        if (edges[0] === 't') {
          box.h = Math.max(MIN_H, start.h - dy);
          box.y = start.y + start.h - box.h;
        } else if (edges[0] === 'b') {
          box.h = Math.max(MIN_H, start.h + dy);
        }
      }
      renderBox();
    };
    const release = () => {
      nameSelect.removeEventListener('pointermove', drag);
      nameSelect.removeEventListener('pointerup', release);
      nameSelect.removeEventListener('pointercancel', release);
      box.held = false;
      nameSelect.classList.remove('is-held');
      springBox();
    };
    nameSelect.addEventListener('pointermove', drag);
    nameSelect.addEventListener('pointerup', release);
    nameSelect.addEventListener('pointercancel', release);
  });

  // ---------- His tile ----------
  // Grabbing the portrait lifts it out of the headline as a free tile that can be thrown.
  // It falls in gentle moon gravity, bounces off the hero's edges, the nav bar and the
  // orange box (which acts as a trampoline), and comes to rest on the floor.
  const portrait = hero.querySelector('.hero-portrait');
  const portraitImg = portrait.querySelector('img');
  const header = document.querySelector('.site-header');
  const HELD_SCALE = 1.35; // a little bigger in the hand, not huge
  const FREE_SCALE = 1.3;
  const SLING_SPEED = 1150;
  const GRAVITY = 40;   // barely any: he flies straight and fast, like something in space
  const AIR_DRAG = 0.85;
  const WALL_BOUNCE = 0.72;
  const FLOOR_BOUNCE = 0.4;
  const BOX_BOUNCE = 1.15;
  const MAX_SPEED = 2000;
  const tile = {
    el: null, x: 0, y: 0, vx: 0, vy: 0, angle: 4, spin: 0, size: 96, heldSize: 192, freeSize: 154,
    held: false, frame: 0, last: 0, hits: 0, grabX: 0, grabY: 0, trail: [], lean: 0, sling: '', release: null, carryX: 0, carryY: 0, touch: null, pushedAt: 0, aimX: 0, aimY: 0, shownX: 0, shownY: 0,
  };

  const heroPoint = (event) => {
    const rect = hero.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  // Half the width of the tile's upright bounding box at its current tilt.
  const tileReach = () => {
    const turn = tile.angle * Math.PI / 180;
    return tile.size / 2 * (Math.abs(Math.cos(turn)) + Math.abs(Math.sin(turn)));
  };

  // ---------- The slingshot on the right wire ----------
  // The orange pen-tool handle on the right wire is a slingshot. Carry him onto it and he
  // is hooked: pulling back stretches the handle like a rubber band, up to a limit, and
  // letting go launches him the opposite way, harder the further he was pulled. Only
  // he can be launched; stickers pass it by.
  const bandGroup = null; // (the handle on the wire is no longer a slingshot: he is slung from wherever he is grabbed)
  const bandLine = bandGroup && bandGroup.querySelector('.handle');
  const BAND = { ax: 1302, ay: 477, k1: [1316, 426], k2: [1288, 528] }; // in the drawing's own units
  const BAND_REACH = 44; // how close his centre must come to be hooked
  const BAND_NEAR = 170; // how close before the handle shows it is ready
  const BAND_PULL = 110; // the furthest it stretches
  const BAND_MIN = 12; // a shorter pull than this is just letting go
  const band = { hooked: false, pull: 0, offX: 0, offY: 0, velX: 0, velY: 0, frame: 0 };
  // The drawing is scaled to cover the hero, so its units are converted to hero pixels.
  const bandFit = () => {
    const scale = Math.max(hero.clientWidth / 1472, hero.clientHeight / 603);
    return { scale, x: (hero.clientWidth - 1472 * scale) / 2 + BAND.ax * scale, y: (hero.clientHeight - 603 * scale) / 2 + BAND.ay * scale };
  };
  const drawBand = () => {
    if (!bandLine) return;
    const scale = bandFit().scale;
    bandLine.setAttribute('d', 'M' + BAND.k1[0] + ' ' + BAND.k1[1] + ' L' + (BAND.ax + band.offX / scale).toFixed(1) + ' ' + (BAND.ay + band.offY / scale).toFixed(1) + ' L' + BAND.k2[0] + ' ' + BAND.k2[1]);
  };
  // Let go, it whips back and wobbles for a moment like a plucked string.
  const whipBand = () => {
    if (band.frame) return;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000));
      last = now;
      band.velX += (-520 * band.offX - 9 * band.velX) * dt;
      band.velY += (-520 * band.offY - 9 * band.velY) * dt;
      band.offX += band.velX * dt;
      band.offY += band.velY * dt;
      if (Math.hypot(band.offX, band.offY) < 0.3 && Math.hypot(band.velX, band.velY) < 6) {
        band.offX = band.offY = band.velX = band.velY = 0;
        band.frame = 0;
        drawBand();
        return;
      }
      drawBand();
      band.frame = window.requestAnimationFrame(step);
    };
    band.frame = window.requestAnimationFrame(step);
  };
  const dropBand = () => {
    const was = band.hooked || band.offX || band.offY;
    band.hooked = false;
    band.pull = 0;
    if (bandGroup) bandGroup.classList.remove('is-ready', 'is-loaded');
    if (was) whipBand();
  };

  const renderTile = () => {
    const style = tile.el.style;
    style.width = style.height = tile.size + 'px';
    style.margin = -tile.size / 2 + 'px 0 0 ' + -tile.size / 2 + 'px';
    style.borderRadius = tile.size * 0.146 + 'px';
    style.transform = 'translate(' + tile.x + 'px, ' + tile.y + 'px) rotate(' + tile.angle + 'deg)';
    placeBubble();
  };

  const makeTile = () => {
    tile.prevX = undefined;
    const heroRect = hero.getBoundingClientRect();
    const rect = portraitImg.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'tile';
    const img = new Image();
    img.src = portraitImg.currentSrc || portraitImg.src;
    img.alt = '';
    img.draggable = false;
    el.append(img);
    playLayer.append(el);
    tile.el = el;
    tile.size = portraitImg.offsetWidth;
    tile.heldSize = tile.size * HELD_SCALE;
    tile.freeSize = tile.size * FREE_SCALE;
    tile.x = rect.left + rect.width / 2 - heroRect.left;
    tile.y = rect.top + rect.height / 2 - heroRect.top;
    tile.vx = tile.vy = tile.spin = 0;
    tile.angle = 4;
    renderTile();
    root.classList.add('is-out');
    // (Out of the headline he cannot be grabbed: only once he is back in his place.)
  };

  // Push the tile out of a rectangle it overlaps. Returns true when it was touching.
  // ---------- Reset button ----------
  // A small orange button just outside the nav bar, beside the fun/normal switch. It
  // slides out as soon as anything is out of place (he has been pulled out, or a sticker
  // has been moved), travels with the nav bar, shows only while the hero is on screen,
  // and one click glides everything home, exactly as the page looked when it opened.
  const resetButton = document.querySelector('.hero-reset');
  const resetRect = () => {
    if (!resetButton || !resetButton.classList.contains('is-on')) return null;
    const heroRect = hero.getBoundingClientRect();
    const rect = resetButton.getBoundingClientRect();
    return { left: rect.left - heroRect.left, top: rect.top - heroRect.top, right: rect.right - heroRect.left, bottom: rect.bottom - heroRect.top };
  };
  const wobbleReset = () => {
    resetButton.classList.remove('is-wobbling');
    void resetButton.offsetWidth;
    resetButton.classList.add('is-wobbling');
  };
  if (resetButton) resetButton.addEventListener('animationend', () => resetButton.classList.remove('is-wobbling'));

  const bounceOffRect = (rect, bounce, dt, onHit) => {
    const reach = tileReach();
    const fromLeft = tile.x + reach - rect.left;
    const fromRight = rect.right - (tile.x - reach);
    const fromTop = tile.y + reach - rect.top;
    const fromBottom = rect.bottom - (tile.y - reach);
    if (fromLeft <= 0 || fromRight <= 0 || fromTop <= 0 || fromBottom <= 0) return false;
    const depth = Math.min(fromLeft, fromRight, fromTop, fromBottom);
    let nx = 0;
    let ny = 0;
    if (depth === fromLeft) nx = -1; else if (depth === fromRight) nx = 1; else if (depth === fromTop) ny = -1; else ny = 1;
    tile.x += nx * depth;
    tile.y += ny * depth;
    const closing = -(tile.vx * nx + tile.vy * ny);
    if (closing > 0) {
      // A trampoline (bounce above 1) always kicks him clear, so he never rests on it.
      const kick = bounce > 1 ? Math.max(closing * (1 + bounce), closing + 260) : closing * (1 + bounce);
      tile.vx += nx * kick;
      tile.vy += ny * kick;
      tile.spin += (nx * tile.vy - ny * tile.vx) * 0.06;
      if (closing > 60) { tile.hits += 1; if (onHit) onHit(nx, ny, closing); }
    } else {
      // The rectangle moved into him: shove him along with it.
      const shove = Math.min(900, depth / dt * 0.6);
      tile.vx += nx * shove;
      tile.vy += ny * shove;
      tile.shoved = depth / dt;
      return 'shove';
    }
    return 'bounce';
  };

  const boxRect = () => {
    const heroRect = hero.getBoundingClientRect();
    const rest = nameSelect.getBoundingClientRect();
    const left = rest.left - heroRect.left + box.x - PAD_X;
    const top = rest.top - heroRect.top + box.y - PAD_Y;
    return { left, top, right: left + box.w + PAD_X * 2, bottom: top + box.h + PAD_Y * 2 };
  };

  const navRect = () => {
    if (header.classList.contains('is-hidden')) return null;
    const heroRect = hero.getBoundingClientRect();
    const rect = header.getBoundingClientRect();
    return { left: rect.left - heroRect.left, top: rect.top - heroRect.top, right: rect.right - heroRect.left, bottom: rect.bottom - heroRect.top };
  };

  // Carrying him into the orange box stretches the edge he pushes on, like the string of
  // a slingshot. Past its limit the string snaps back and fires him out of your hand.
  const slingTile = () => {
    if (box.held) return;
    const heroRect = hero.getBoundingClientRect();
    const rest = nameSelect.getBoundingClientRect();
    const left = rest.left - heroRect.left - PAD_X;
    const top = rest.top - heroRect.top - PAD_Y;
    const right = left + box.restW + PAD_X * 2;
    const bottom = top + box.restH + PAD_Y * 2;
    const reach = tileReach();
    const depth = {
      top: tile.y + reach - top,
      bottom: bottom - (tile.y - reach),
      left: tile.x + reach - left,
      right: right - (tile.x - reach),
    };
    const touching = depth.top > 0 && depth.bottom > 0 && depth.left > 0 && depth.right > 0;
    if (!touching) {
      if (tile.sling) { tile.sling = ''; springBox(); }
      return;
    }
    // He stretches the edge he is pressing on. If he is only grazing a corner and another
    // edge becomes the shallow one, the stretch moves to that edge instead of building up.
    const shallow = Object.keys(depth).reduce((best, edge) => (depth[edge] < depth[best] ? edge : best));
    if (!tile.sling || depth[shallow] < depth[tile.sling] * 0.5) tile.sling = shallow;
    const edge = tile.sling;
    const pull = Math.max(0, depth[edge]);
    const upright = edge === 'top' || edge === 'bottom';
    const limit = upright ? box.restH * 0.62 : Math.min(box.restW * 0.45, 150);
    window.cancelAnimationFrame(box.frame);
    box.frame = 0;
    box.vel = { x: 0, y: 0, w: 0, h: 0 };
    box.x = edge === 'left' ? pull : 0;
    box.y = edge === 'top' ? pull : 0;
    box.w = box.restW - (upright ? 0 : pull);
    box.h = box.restH - (upright ? pull : 0);
    renderBox();
    if (pull < limit) return;
    // The string is at full stretch: let go of him and fire.
    const nx = edge === 'left' ? -1 : edge === 'right' ? 1 : 0;
    const ny = edge === 'top' ? -1 : edge === 'bottom' ? 1 : 0;
    tile.vx = nx * SLING_SPEED + (ny ? (Math.random() - 0.5) * 260 : 0);
    tile.vy = ny * SLING_SPEED + (nx ? -180 : 0);
    tile.spin = (Math.random() < 0.5 ? -1 : 1) * 150;
    tile.sling = '';
    if (tile.release) tile.release(true);
    springBox();
  };

  const stepTile = (now) => {
    const dt = Math.min(0.032, Math.max(0.001, (now - tile.last) / 1000));
    tile.last = now;
    const width = hero.clientWidth;
    const height = hero.clientHeight;
    // Biggest while he is held; a little smaller once he is flying free.
    // Biggest in the hand, a little smaller flying free, and back to his small headline
    // size while he sits in the slingshot, so the stretched band shows around him.
    const wanted = band.hooked ? tile.freeSize / FREE_SCALE : tile.held ? tile.heldSize : tile.freeSize;
    tile.size += (wanted - tile.size) * Math.min(1, dt * 9);
    let onFloor = false;

    tile.yielded = false;
    if (tile.held) {
      const gapX = tile.aimX - tile.shownX;
      const gapY = tile.aimY - tile.shownY;
      const gap = Math.hypot(gapX, gapY);
      if ((tile.blocked || tile.catching) && gap > 60) {
        // Held off by something that cannot give way, or just freed: he heads for the
        // cursor from where he is rather than jumping onto it.
        tile.x = tile.shownX + gapX / gap * 60;
        tile.y = tile.shownY + gapY / gap * 60;
      } else {
        if (!tile.blocked) tile.catching = false;
        tile.x = tile.aimX;
        tile.y = tile.aimY;
      }
      // Pressed against something solid, or loaded in the slingshot, he sits steady: no leaning.
      if (tile.blocked || band.hooked) tile.lean = 0;
      tile.angle += (tile.lean - tile.angle) * Math.min(1, dt * 10);
      tile.lean *= 1 - Math.min(1, dt * 5);
      tile.carryX *= 1 - Math.min(1, dt * 6);
      tile.carryY *= 1 - Math.min(1, dt * 6);
    } else {
      tile.vy += GRAVITY * dt;
      tile.vx *= 1 - AIR_DRAG * dt;
      tile.vy *= 1 - AIR_DRAG * dt;
      const speed = Math.hypot(tile.vx, tile.vy);
      if (speed > MAX_SPEED) { tile.vx *= MAX_SPEED / speed; tile.vy *= MAX_SPEED / speed; }
      tile.x += tile.vx * dt;
      tile.y += tile.vy * dt;
      tile.angle += tile.spin * dt;
      tile.spin *= 1 - 0.9 * dt;
      if (now - tile.pushedAt < 1400) {
        // Just pushed by a sticker: he may lean a few degrees but never spins.
        const upright = Math.round(tile.angle / 90) * 90;
        if (Math.abs(tile.angle - upright) > 7) { tile.angle = upright + Math.sign(tile.angle - upright) * 7; tile.spin = 0; }
      }

      // The nav bar is the one solid thing he can meet up there; the orange box is not
      // his to bump (it only stretches for the visitor), so he passes straight through it.
      const nav = navRect();
      if (nav) bounceOffRect(nav, WALL_BOUNCE, dt);

      const reach = tileReach();
      if (tile.x - reach < 0) { tile.x = reach; if (tile.vx < 0) { if (tile.vx < -60) tile.hits += 1; tile.spin += tile.vy * 0.06; tile.vx *= -WALL_BOUNCE; } }
      if (tile.x + reach > width) { tile.x = width - reach; if (tile.vx > 0) { if (tile.vx > 60) tile.hits += 1; tile.spin -= tile.vy * 0.06; tile.vx *= -WALL_BOUNCE; } }
      if (tile.y - reach < 0) { tile.y = reach; if (tile.vy < 0) { if (tile.vy < -60) tile.hits += 1; tile.vy *= -WALL_BOUNCE; } }
      if (tile.y + reach >= height) {
        tile.y = height - reach;
        onFloor = true;
        if (tile.vy > 70) tile.vy *= -FLOOR_BOUNCE; else if (tile.vy > 0) tile.vy = 0;
        tile.vx *= 1 - 3 * dt;
        // One clean bounce lands him upright; a ricochet lands him on whichever side is nearest.
        const settle = tile.hits <= 1 ? Math.round(tile.angle / 360) * 360 : Math.round(tile.angle / 90) * 90;
        tile.spin += (settle - tile.angle) * 16 * dt;
        tile.spin *= 1 - 7 * dt;
        if (Math.abs(tile.vx) < 5 && Math.abs(tile.vy) < 5 && Math.abs(tile.spin) < 3 && Math.abs(settle - tile.angle) < 0.5 && Math.abs(tile.freeSize - tile.size) < 0.5) {
          tile.vx = tile.vy = tile.spin = 0;
          tile.angle = settle;
          tile.size = tile.freeSize;
          tile.y = height - tileReach();
          renderTile();
          tile.frame = 0;
          runWorld();
          return;
        }
      }
    }
    worldTick(dt);
    tile.blocked = tile.held && tile.yielded;
    if (tile.blocked) tile.catching = true;
    tile.shownX = tile.x;
    tile.shownY = tile.y;
    updateFace(now);
    renderTile();
    tile.frame = window.requestAnimationFrame(stepTile);
  };

  const runTile = () => {
    if (tile.frame || !tile.el) return;
    tile.last = performance.now();
    tile.frame = window.requestAnimationFrame(stepTile);
  };

  // A resting tile wakes up when the orange box moves into it.
  function wakeTile() {
    if (!tile.el || tile.frame || tile.held) return;
    const rect = boxRect();
    const reach = tileReach();
    if (tile.x + reach > rect.left && tile.x - reach < rect.right && tile.y + reach > rect.top && tile.y - reach < rect.bottom) runTile();
  }

  const PULL_MAX = 120; // the furthest he can be pulled back
  const PULL_MIN = 14;  // a shorter pull than this is just letting go of him
  // A hit sprays the same tiny keyframe pieces as the Fun mode switch, in every direction
  // from the spot where they touched: many small bits, quick out, then they drop and fade.
  const SPARK_FILLS = ['#ffcb05', '#ffcb05', '#ff5a1f', '#ffffff'];
  let sparkAt = 0;
  const sparkBurst = (x, y, force) => {
    const now = performance.now();
    if (calm.matches || !playLayer.animate || now - sparkAt < 140) return;
    sparkAt = now;
    const count = Math.round(26 + Math.min(1, force / 1400) * 16);
    for (let i = 0; i < count; i += 1) {
      const piece = document.createElement('span');
      piece.className = 'burst hit-burst';
      piece.style.left = x.toFixed(1) + 'px';
      piece.style.top = y.toFixed(1) + 'px';
      piece.style.background = SPARK_FILLS[Math.floor(Math.random() * SPARK_FILLS.length)];
      const size = 5 + Math.random() * 5;
      piece.style.width = piece.style.height = size.toFixed(1) + 'px';
      playLayer.append(piece);
      const angle = Math.random() * Math.PI * 2;
      const reach = 60 + Math.random() * 220 + Math.min(80, force * 0.05);
      const dx = Math.cos(angle) * reach;
      const dy = Math.sin(angle) * reach;
      piece.animate([
        { transform: 'translate(-50%, -50%) rotate(45deg) scale(.4)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + dx.toFixed(1) + 'px), calc(-50% + ' + dy.toFixed(1) + 'px)) rotate(' + (180 + Math.random() * 360).toFixed(0) + 'deg) scale(1)', opacity: 1, offset: 0.6 },
        { transform: 'translate(calc(-50% + ' + (dx * 1.08).toFixed(1) + 'px), calc(-50% + ' + (dy + 30).toFixed(1) + 'px)) rotate(' + (360 + Math.random() * 360).toFixed(0) + 'deg) scale(.2)', opacity: 0 },
      ], { duration: 800 + Math.random() * 500, easing: 'cubic-bezier(.2, .8, .3, 1)' }).onfinish = () => piece.remove();
    }
  };
  // A sticker he hits wakes up into its colours, and goes grey again a little after.
  const colourHit = (body) => {
    body.el.classList.add('is-hit');
    clearTimeout(body.hitTimer);
    body.hitTimer = setTimeout(() => body.el.classList.remove('is-hit'), 2600);
  };

  let slingLine = null;
  // The aimer: from where he was grabbed, a dotted line points the way he will fly, longer
  // the harder the pull, with a small white square marking the spot he was grabbed from.
  const drawSling = (fromX, fromY, toX, toY) => {
    if (!slingLine) {
      slingLine = document.createElement('div');
      slingLine.className = 'sling-band';
      playLayer.append(slingLine);
    }
    const pull = Math.hypot(toX - fromX, toY - fromY);
    slingLine.style.transform = 'translate(' + fromX.toFixed(1) + 'px, ' + fromY.toFixed(1) + 'px) rotate(' + Math.atan2(fromY - toY, fromX - toX).toFixed(4) + 'rad)';
    slingLine.style.width = (pull * 2.4).toFixed(1) + 'px';
    slingLine.style.opacity = pull > 6 ? '1' : '0';
  };
  const hideSling = () => { if (slingLine) slingLine.style.opacity = '0'; };

  // Grab him anywhere, pull back, let go: he flies the opposite way, harder the further
  // he was pulled. Where he was grabbed is the slingshot's post, and a band stretches
  // from it to him while he is held. A pull too short to count just lets him go home.
  function grabTile(event) {
    if (!playing() || event.button !== 0 || tile.held) return;
    event.preventDefault();
    if (!tile.el) makeTile();
    window.clearTimeout(mood.homeTimer);
    mood.homeTimer = 0;
    const point = heroPoint(event);
    tile.held = true;
    tile.hits = 0;
    tile.vx = tile.vy = tile.spin = 0;
    tile.carryX = tile.carryY = 0;
    tile.lean = 0;
    tile.angle = ((tile.angle + 180) % 360 + 360) % 360 - 180;
    tile.anchorX = tile.x;
    tile.anchorY = tile.y;
    tile.grabX = point.x - tile.x;
    tile.grabY = point.y - tile.y;
    tile.aimX = tile.shownX = tile.x;
    tile.aimY = tile.shownY = tile.y;
    tile.blocked = tile.catching = false;
    tile.pull = 0;
    tile.el.classList.add('is-held');
    document.documentElement.classList.add('is-dragging');
    loadFaces();
    onGrab();

    const drag = (move) => {
      const at = heroPoint(move);
      let dx = at.x - tile.grabX - tile.anchorX;
      let dy = at.y - tile.grabY - tile.anchorY;
      const len = Math.hypot(dx, dy);
      // The band gives easily at first and stiffens towards its limit.
      const give = len > 0 ? PULL_MAX * Math.tanh(len / PULL_MAX) : 0;
      if (len > 0) { dx *= give / len; dy *= give / len; }
      const reach = tileReach();
      tile.aimX = Math.min(hero.clientWidth - reach, Math.max(reach, tile.anchorX + dx));
      tile.aimY = Math.min(hero.clientHeight - reach, Math.max(reach, tile.anchorY + dy));
      tile.x = tile.aimX;
      tile.y = tile.aimY;
      tile.pull = Math.hypot(tile.x - tile.anchorX, tile.y - tile.anchorY);
      tile.lean = Math.max(-14, Math.min(14, -(tile.x - tile.anchorX) * 0.06)); // he leans back against the pull
      drawSling(tile.anchorX, tile.anchorY, tile.x, tile.y);
    };
    const release = () => {
      window.removeEventListener('pointermove', drag);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      tile.held = false;
      tile.release = null;
      tile.blocked = tile.catching = false;
      document.documentElement.classList.remove('is-dragging');
      hideSling();
      if (!tile.el) return; // (sent home while in the hand: a mode switch)
      tile.el.classList.remove('is-held');
      // The pull is how far the pointer drew him back, not where he happens to be: a
      // sticker drifting into him while he is held still must not count as a pull.
      const dx = tile.aimX - tile.anchorX;
      const dy = tile.aimY - tile.anchorY;
      const len = Math.hypot(dx, dy);
      tile.pull = 0;
      if (len < PULL_MIN) {
        // Not really pulled: he just goes back to where he belongs.
        onRelease(false);
        sendTileHome('lower'); // (put straight back down: he lowers his hands and calms)
        return;
      }
      const speed = 650 + (len / PULL_MAX) * 1550;
      tile.vx = -dx / len * speed;
      tile.vy = -dy / len * speed;
      tile.spin = Math.max(-170, Math.min(170, tile.vx * 0.12));
      onRelease(true);
      runTile();
    };
    tile.release = release;
    window.addEventListener('pointermove', drag);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    runTile();
  }

  // Put him back in the headline (used when leaving Fun mode).
  const sendTileHome = (face) => {
    dropBand();
    if (!tile.el) return;
    window.cancelAnimationFrame(tile.frame);
    tile.frame = 0;
    tile.held = false;
    window.clearTimeout(mood.homeTimer);
    mood.homeTimer = 0;
    hideSling();
    const el = tile.el;
    mood.face = '';
    mood.was = 'home';
    mood.crashes = 0;
    mood.wary = true;
    mood.rough = false;
    mood.gentleRuns = 0;
    mood.sick = mood.flight = mood.knocked = mood.shook = false;
    mood.hurtAt = mood.holdUntil = mood.shake = 0;
    mood.gentleFace = '';
    el.querySelector('img').src = face && face !== 'lower' ? 'assets/faces/' + face + '.jpg?v=2' : portraitImg.currentSrc || portraitImg.src;
    if (face === 'lower') lowerHands(el);
    el.classList.remove('is-giggling');
    tile.el = null;
    const heroRect = hero.getBoundingClientRect();
    const rect = portraitImg.getBoundingClientRect();
    const size = portraitImg.offsetWidth;
    el.style.transition = 'transform 1.1s cubic-bezier(.3, 1, .3, 1), width 1.1s cubic-bezier(.3, 1, .3, 1), height 1.1s cubic-bezier(.3, 1, .3, 1), margin 1.1s cubic-bezier(.3, 1, .3, 1), border-radius 1.1s ease';
    el.style.width = el.style.height = size + 'px';
    el.style.margin = -size / 2 + 'px 0 0 ' + -size / 2 + 'px';
    el.style.borderRadius = size * 0.146 + 'px';
    el.style.transform = 'translate(' + (rect.left + rect.width / 2 - heroRect.left) + 'px, ' + (rect.top + rect.height / 2 - heroRect.top) + 'px) rotate(4deg)';
    // The moment he is back in his place he says so: the bubble pops straight up.
    const finish = () => {
      el.remove();
      root.classList.add('is-back');
      const arrived = root.classList.contains('is-out');
      root.classList.remove('is-out');
      if (arrived && face === 'dizzy') shakeItOff(); // (back in his place, he shakes the dizziness out)
    };
    runWorld();
    el.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(finish, 1250);
  };

  // ---------- His face ----------
  // Four faces, and only these: calm at home (his own portrait), startled while he is
  // held and pulled back, cheeks-out panic while he flies, dizzy when he lands. A few
  // seconds after landing he floats back to his place in the headline by himself.
  const FACES = ['calm', 'startled', 'panic', 'dizzy'];
  const REST_HOME_MS = 3000;
  const SCREAM_ON_MS = 500; // how long he keeps screaming after the first knock // how long he lies where he landed before floating home
  const mood = { face: '', changedAt: 0, was: 'home', flight: false, landedAt: 0, slowSince: 0, activeAt: 0, contacts: {}, homeTimer: 0, tick: 0 };
  const placeBubble = () => {};
  const hush = () => {};

  const loadFaces = () => {
    if (mood.loaded) return;
    mood.loaded = true;
    FACES.forEach((name) => { new Image().src = 'assets/faces/' + name + '.jpg?v=2'; });
  };

  const wear = (face) => {
    if (!tile.el || mood.face === face) return false;
    mood.face = face;
    mood.changedAt = performance.now();
    tile.el.querySelector('img').src = 'assets/faces/' + face + '.jpg?v=2';
    showScare(face);
    return true;
  };

  // Startled and panic are acted clips, not drawings. Startled opens on his portrait: his
  // hands fly up and hit the screen, and he stays there blinking while he is held. Panic
  // opens on the end of startled: the wind hits and he screams while he flies. Each clip
  // keeps going round its hold part, and each is cut in and out: no fade.
  // (from: where it starts; hold: where its loop starts. Panic starts part-way into the
  // wind hitting him, because a flight is often over in a fraction of a second.)
  // Startled is joined just as he flinches and its first moment is played a little faster,
  // so his hands are on the screen about as quickly as his hand comes up for the wave.
  const CLIPS = { startled: { from: 0.45, hold: 0.9, hurry: 1.3, hurryMs: 260 }, panic: { from: 0.2, hold: 0.5 },
    // Dizzy starts and ends on the same drawing, so it simply goes round.
    dizzy: { from: 0, hold: 0 } };
  Object.keys(CLIPS).forEach((name) => {
    const clip = document.createElement('video');
    clip.className = 'tile-clip';
    clip.muted = true;
    clip.playsInline = true;
    clip.preload = 'auto';
    clip.setAttribute('aria-hidden', 'true');
    fetch('assets/clips/' + name + '.mp4?v=1').then((reply) => reply.blob()).then((file) => { clip.src = URL.createObjectURL(file); }).catch(() => {});
    clip.addEventListener('ended', () => {
      if (!clip.isConnected) return;
      clip.currentTime = CLIPS[name].hold;
      const going = clip.play();
      if (going && going.catch) going.catch(() => {});
    });
    CLIPS[name].el = clip;
  });
  // Picked up and put straight back: the startled clip run backwards, so his hands come
  // down off the screen and his face settles into his portrait, instead of a cut.
  const downClip = document.createElement('video');
  downClip.className = 'tile-clip';
  downClip.muted = true;
  downClip.playsInline = true;
  downClip.preload = 'auto';
  downClip.setAttribute('aria-hidden', 'true');
  fetch('assets/clips/startled-down.mp4?v=1').then((reply) => reply.blob()).then((file) => { downClip.src = URL.createObjectURL(file); }).catch(() => {});
  function lowerHands(el) {
    const wasScared = CLIPS.startled.el.isConnected;
    showScare('');
    if (!wasScared || !downClip.src || calm.matches) return;
    el.append(downClip);
    downClip.currentTime = 0;
    downClip.playbackRate = 1.15; // (done just before his tile has finished settling back)
    const going = downClip.play();
    if (going && going.catch) going.catch(() => {});
  }
  function showScare(face) {
    Object.keys(CLIPS).forEach((name) => {
      const clip = CLIPS[name].el;
      if (name !== face || !tile.el || !clip.src || calm.matches) { clip.pause(); clip.remove(); return; }
      tile.el.append(clip);
      clip.currentTime = CLIPS[name].from;
      clip.playbackRate = CLIPS[name].hurry || 1;
      window.clearTimeout(CLIPS[name].settle);
      if (CLIPS[name].hurry) CLIPS[name].settle = window.setTimeout(() => { clip.playbackRate = 1; }, CLIPS[name].hurryMs);
      const going = clip.play();
      if (going && going.catch) going.catch(() => {});
    });
  }

  // Stickers have no powers any more: touching one does nothing to him.
  const feelTouch = () => {};
  const feelBox = () => {};

  const onGrab = () => {
    mood.flight = false;
    mood.struck = false;
    mood.knockAt = 0;
    mood.activeAt = performance.now();
    wear('startled');
  };

  const onRelease = (fired) => {
    mood.flight = Boolean(fired);
    if (fired) wear('panic');
  };

  const goHomeSoon = () => {
    if (mood.homeTimer || tile.held || !tile.el) return;
    mood.homeTimer = window.setTimeout(() => {
      mood.homeTimer = 0;
      if (tile.el && !tile.held) sendTileHome('dizzy');
    }, REST_HOME_MS);
  };

  const updateFace = (now) => {
    if (!tile.el) return;
    mood.tick = now;
    const speed = tile.held ? 0 : Math.hypot(tile.vx, tile.vy);
    const slow = speed < 60;
    if (!slow) mood.slowSince = 0; else if (!mood.slowSince) mood.slowSince = now;
    const onFloor = tile.y + tileReach() >= hero.clientHeight - 8;
    const settled = !tile.frame || (slow && (onFloor || now - mood.slowSince > 700));
    const state = tile.held ? 'held' : settled ? 'rest' : 'air';
    if (state !== 'rest') { mood.activeAt = now; window.clearTimeout(mood.homeTimer); mood.homeTimer = 0; }
    if (state === 'held') { wear('startled'); mood.was = state; return; }
    if (state === 'air') {
      // Cheeks out while he flies. The first knock (a wall, the nav bar, a sticker) makes him
      // dizzy, but not on the instant: he goes on screaming for half a second first, so the
      // scream is seen even when the knock comes straight after he is let go.
      if (mood.flight) {
        const knocked = tile.hits > 0 || mood.struck;
        if (knocked && !mood.knockAt) mood.knockAt = now;
        wear(knocked && now - mood.knockAt >= SCREAM_ON_MS ? 'dizzy' : 'panic');
      }
      mood.was = state;
      return;
    }
    // At rest.
    if (mood.was !== 'rest') {
      mood.landedAt = now;
      if (mood.flight) { mood.flight = false; wear('dizzy'); }
    }
    mood.was = state;
    goHomeSoon();
  };

  // While he is lying still nothing else runs, so check on him a few times a second.
  window.setInterval(() => {
    if (!tile.el || !heroVisible) return;
    if (!tile.frame) updateFace(performance.now());
  }, 160);

  hero.addEventListener('pointerdown', () => { mood.activeAt = performance.now(); }, true);

  // Coming close with the cursor wakes him with a start.
  hero.addEventListener('pointermove', (event) => {
    if (mood.face !== 'asleep' || !tile.el) return;
    const at = heroPoint(event);
    if (Math.hypot(at.x - tile.x, at.y - tile.y) > tile.size / 2 + 90) return;
    mood.landedAt = performance.now() - 11000;
    mood.activeAt = performance.now();
    mood.rough = false;
    wear('startled', true);
  });

  window.__probe = { tile, mood, band, get bodies() { return bodies; } };
  portrait.addEventListener('pointerdown', (event) => { if (!tile.el) grabTile(event); });

  // ---------- The wave ----------
  // Hovering him in his place plays one acted clip inside his box: he smiles, raises his
  // hand, waves, lowers it and is his portrait again. The clip starts and ends on the
  // portrait itself, so it is cut in and out with no fade. If the pointer leaves while his
  // hand is up, he skips to lowering it rather than vanishing.
  const WAVE_FROM = 0.3;  // where the clip is joined: just as his smile starts, so his hand is up sooner
  const WAVE_UP = 0.55;   // his hand is in view from here
  const WAVE_DOWN = 2.95; // he starts lowering it here
  const WAVE_END = 4.05;  // he is his portrait again from here; the rest of the clip is him standing still
  const WAVE_HURRY = 1.5; // the raise is played a little faster, so he answers the pointer quickly
  const waveClip = document.createElement('video');
  waveClip.className = 'wave-clip';
  // Loaded whole, so he can skip to any moment of it whatever the server supports.
  fetch('assets/clips/wave.mp4?v=1').then((reply) => reply.blob()).then((clip) => { waveClip.src = URL.createObjectURL(clip); }).catch(() => {});
  waveClip.muted = true;
  waveClip.playsInline = true;
  waveClip.preload = 'auto';
  waveClip.setAttribute('aria-hidden', 'true');
  portrait.insertBefore(waveClip, portraitImg.nextSibling);
  // (Stopping also ends "recovering": the bubble is held back while he shakes his head and
  // smiles, and pops up the moment he is his normal self again.)
  const stopWave = () => { waveClip.classList.remove('is-on'); waveClip.pause(); stopShake(); root.classList.remove('is-recovering'); };

  // Home again after a throw, he shakes the dizziness out of his head and breaks into a
  // smile: one acted clip in his box. It ends on a frame of the wave clip (smiling, hand
  // already down), so the wave clip takes over from there and settles him into his portrait.
  const WAVE_SMILE = 3.42; // the frame of the wave clip the head shake ends on
  const shakeClip = document.createElement('video');
  shakeClip.className = 'wave-clip';
  fetch('assets/clips/head-shake.mp4?v=1').then((reply) => reply.blob()).then((clip) => { shakeClip.src = URL.createObjectURL(clip); }).catch(() => {});
  shakeClip.muted = true;
  shakeClip.playsInline = true;
  shakeClip.preload = 'auto';
  shakeClip.setAttribute('aria-hidden', 'true');
  portrait.insertBefore(shakeClip, portraitImg.nextSibling);
  let shaking = false;
  let shakeGuard = 0;
  function stopShake() { shaking = false; shakeClip.classList.remove('is-on'); shakeClip.pause(); }
  function shakeItOff() {
    if (!playing() || calm.matches || tile.el || !shakeClip.src) return;
    waveClip.classList.remove('is-on');
    waveClip.pause();
    shaking = true;
    root.classList.add('is-recovering');
    shakeClip.currentTime = 0;
    shakeClip.classList.add('is-on'); // (its first frame is the dizzy drawing he arrived wearing)
    window.clearTimeout(shakeGuard);
    shakeGuard = window.setTimeout(() => { if (shaking) stopWave(); }, 6000); // (never leave him stuck if the clip stalls)
    const going = shakeClip.play();
    if (going && going.catch) going.catch(() => {});
  }
  shakeClip.addEventListener('ended', () => {
    if (!shaking) return;
    shaking = false;
    // Hand over to the end of the wave clip, shown first so there is never a bare frame.
    waveClip.currentTime = WAVE_SMILE;
    waveClip.playbackRate = 1;
    waveClip.classList.add('is-on');
    const going = waveClip.play();
    if (going && going.catch) going.catch(() => {});
    window.setTimeout(() => shakeClip.classList.remove('is-on'), 80);
  });
  const startWave = () => {
    if (!playing() || calm.matches || tile.el || tile.held || !waveClip.src || shaking) return;
    const running = waveClip.classList.contains('is-on') && !waveClip.paused && !waveClip.ended;
    if (running && waveClip.currentTime < WAVE_DOWN) return; // already waving, hand up
    // Not waving, or caught lowering his hand: either way he answers at once. Caught
    // lowering it, he brings it straight back up instead of finishing first.
    waveClip.currentTime = running ? WAVE_UP : WAVE_FROM;
    waveClip.playbackRate = WAVE_HURRY;
    window.clearTimeout(waveSettle);
    waveSettle = window.setTimeout(() => { waveClip.playbackRate = 1; }, 330);
    const going = waveClip.play();
    if (going && going.catch) going.catch(() => {});
  };
  let waveSettle = 0;
  // He waves every time the pointer comes onto him: once per visit, however long it stays.
  let waveOver = false;
  let waveAgain = 0;
  waveClip.addEventListener('playing', () => { if (!tile.el && playing()) waveClip.classList.add('is-on'); else stopWave(); });
  const waveDone = () => {
    if (!waveClip.classList.contains('is-on')) return;
    stopWave(); // one wave per visit: he waves again only when the pointer leaves and comes back
    window.clearTimeout(waveAgain);
  };
  waveClip.addEventListener('ended', waveDone);
  waveClip.addEventListener('timeupdate', () => { if (waveClip.currentTime >= WAVE_END) waveDone(); });
  const waveIn = (event) => {
    if (event.pointerType === 'touch') return;
    waveOver = true;
    window.clearTimeout(waveAgain);
    startWave();
  };
  const waveOut = () => {
    waveOver = false;
    window.clearTimeout(waveAgain);
    if (!waveClip.classList.contains('is-on')) return;
    if (waveClip.currentTime <= WAVE_UP) { stopWave(); return; } // his hand is not up yet: he is still his portrait
    if (waveClip.currentTime < WAVE_DOWN) waveClip.currentTime = WAVE_DOWN;
  };
  // Whether the pointer is on him is read from where it is, not from which element it
  // hits: a sticker drifting across his face would otherwise swallow the hover.
  const onHim = (event) => {
    const box = portraitImg.getBoundingClientRect();
    return event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
  };
  hero.addEventListener('pointermove', (event) => {
    const inside = onHim(event);
    if (inside && !waveOver) waveIn(event);
    else if (!inside && waveOver) waveOut();
  });
  hero.addEventListener('pointerleave', () => { if (waveOver) waveOut(); });
  portrait.addEventListener('pointerdown', stopWave, true);

  // ---------- Loose things: stickers and words ----------
  // Stickers can be grabbed and thrown; they drift in moon gravity, bump each other and
  // his tile, and never quite settle. Words move only when his tile passes through them:
  // they give way and then spring back into the sentence.
  const FLOAT_GRAVITY = 70;
  const bodies = [];
  let worldFrame = 0;
  let worldLast = 0;
  let clock = 0;
  let heroVisible = true;

  const addBody = (el, kind) => bodies.push({
    el, kind, state: 'home', x: 0, y: 0, homeX: 0, homeY: 0, hw: 0, hh: 0, vx: 0, vy: 0, angle: 0, spin: 0,
    held: false, measured: false, thrownAt: 0, baseAngle: 0, pressed: 0, side: -1, armed: false, phase: Math.random() * 6.28, lift: 4 + Math.random() * 10,
    grabX: 0, grabY: 0, trail: [], orbit: null, kickAt: -99,
  });
  // The stickers drift round the headline on one big loop, each turning gently as it goes.
  const ORBIT_LAP = 32;        // seconds for one full lap
  const ORBIT_TURN = 360 / 60; // degrees a second a sticker turns on its own
  const ORBIT_PULL = 14;       // how firmly a sticker is drawn back to its place on the loop
  const ORBIT_DRAG = 5;
  const ORBIT_RX = 0.37; // the loop, as a share of the hero's width and height
  const ORBIT_RY = 0.34;
  const orbitOf = (body) => {
    // The stickers share one loop round the headline, evenly spaced, so there is never a
    // wide gap for him to fly through without hitting one.
    const ring = bodies.filter((item) => item.kind === 'sticker');
    const slot = ring.indexOf(body);
    return { rho: 1, theta: slot * (2 * Math.PI / ring.length) - Math.PI / 2 - clock * (2 * Math.PI / ORBIT_LAP) };
  };
  const orbitSpot = (body) => {
    const width = hero.clientWidth;
    const height = hero.clientHeight;
    const t = body.orbit.theta + clock * (2 * Math.PI / ORBIT_LAP);
    return {
      x: Math.min(width - body.hw, Math.max(body.hw, width / 2 + body.orbit.rho * width * ORBIT_RX * Math.cos(t))),
      y: Math.min(height - body.hh - body.lift, Math.max(body.hh, height / 2 + 8 + body.orbit.rho * height * ORBIT_RY * Math.sin(t))),
    };
  };

  // Split the copy into words so each can give way on its own. "Sanjith!" stays whole and safe.
  const hiWord = copy.querySelector('h1 > span:first-child');
  hiWord.classList.add('w');
  const imSpan = nameSelect.parentElement;
  const imText = imSpan.firstChild;
  if (imText && imText.nodeType === 3) {
    const imWord = document.createElement('span');
    imWord.className = 'w';
    imWord.textContent = imText.textContent.trim();
    imSpan.replaceChild(imWord, imText);
    imWord.after(' ');
  }
  const paragraph = copy.querySelector(':scope > p');
  paragraph.innerHTML = paragraph.textContent.trim().split(/\s+/).map((word) => '<span class="w">' + word + '</span>').join(' ');
  // Only the paragraph's words give way to him. "Hi," and "I'm" stay as still as "Sanjith!".
  paragraph.querySelectorAll('.w').forEach((el) => addBody(el, 'word'));
  playLayer.querySelectorAll('.sticker').forEach((el) => addBody(el, 'sticker'));

  // Where a piece rests, measured once and remembered until the layout changes.
  const measure = (body) => {
    if (body.measured) return;
    const heroRect = hero.getBoundingClientRect();
    const rect = body.el.getBoundingClientRect();
    body.homeX = rect.left + rect.width / 2 - heroRect.left;
    body.homeY = rect.top + rect.height / 2 - heroRect.top;
    body.hw = (body.kind === 'sticker' ? body.el.offsetWidth : rect.width) / 2;
    body.hh = (body.kind === 'sticker' ? body.el.offsetHeight : rect.height) / 2;
    body.baseAngle = body.kind === 'sticker' ? parseFloat(body.el.style.getPropertyValue('--r')) || 0 : 0;
    body.measured = true;
    if (body.state === 'home') { body.x = body.homeX; body.y = body.homeY; }
  };

  // Hand a resting piece over to the physics.
  const wake = (body) => {
    if (body.state !== 'home') return;
    measure(body);
    body.x = body.homeX;
    body.y = body.homeY;
    body.vx = body.vy = body.spin = body.angle = 0;
    body.el.classList.add('is-live');
  };

  const renderBody = (body) => {
    const dx = body.x - body.homeX;
    const dy = body.y - body.homeY;
    if (body.kind === 'sticker') {
      body.el.style.setProperty('--dx', dx + 'px');
      body.el.style.setProperty('--dy', dy + 'px');
      body.el.style.setProperty('--da', body.angle + 'deg');
    } else {
      body.el.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) rotate(' + body.angle + 'deg)';
    }
  };

  // How far a sticker overlaps his tile, and which way is out. Both are tested as the
  // tilted rectangles they really are, so no corner of either can cross the other.
  const tileOverlap = (body) => {
    const tileTurn = tile.angle * Math.PI / 180;
    const bodyTurn = (body.baseAngle + body.angle) * Math.PI / 180;
    const half = tile.size / 2;
    const hw = body.hw * 0.92;
    const hh = body.hh * 0.92;
    const frames = [
      [Math.cos(tileTurn), Math.sin(tileTurn)], [-Math.sin(tileTurn), Math.cos(tileTurn)],
      [Math.cos(bodyTurn), Math.sin(bodyTurn)], [-Math.sin(bodyTurn), Math.cos(bodyTurn)],
    ];
    const gapX = body.x - tile.x;
    const gapY = body.y - tile.y;
    const overs = [];
    const signs = [];
    let apartBy = 0;
    for (const [ax, ay] of frames) {
      const tileSpan = half * (Math.abs(ax * frames[0][0] + ay * frames[0][1]) + Math.abs(ax * frames[1][0] + ay * frames[1][1]));
      const bodySpan = hw * Math.abs(ax * frames[2][0] + ay * frames[2][1]) + hh * Math.abs(ax * frames[3][0] + ay * frames[3][1]);
      const apart = gapX * ax + gapY * ay;
      const over = tileSpan + bodySpan - Math.abs(apart);
      if (over <= 0) apartBy = Math.max(apartBy, -over);
      overs.push(over);
      signs.push(apart < 0 ? -1 : 1);
    }
    // Not touching: report how far apart they are as a negative depth.
    if (overs.some((over) => over <= 0)) { body.side = -1; return { depth: -apartBy, nx: 0, ny: 0 }; }
    let pick = overs.indexOf(Math.min(...overs));
    // Stay with the side it was already leaving by unless another is clearly shorter,
    // so the way out never flickers between two sides from frame to frame.
    if (body.side >= 0 && overs[body.side] <= overs[pick] * 1.4 + 2) pick = body.side;
    body.side = pick;
    return { depth: overs[pick], nx: frames[pick][0] * signs[pick], ny: frames[pick][1] * signs[pick] };
  };

  // Thrown into a sticker that cannot give way: he bounces off it as he would off a wall.
  const bounceOffJam = (nx, ny) => {
    const into = tile.vx * nx + tile.vy * ny;
    if (into <= 0) return;
    if (into > 60) tile.hits += 1;
    tile.vx -= nx * into * (1 + WALL_BOUNCE);
    tile.vy -= ny * into * (1 + WALL_BOUNCE);
  };

  // One step of everything loose. Returns true while something is still moving.
  const worldTick = (dt) => {
    clock += dt;
    const width = hero.clientWidth;
    const height = hero.clientHeight;
    const tileOut = Boolean(tile.el);
    const tvx = tile.held ? tile.carryX : tile.vx;
    const tvy = tile.held ? tile.carryY : tile.vy;
    const tileSpeed = Math.hypot(tvx, tvy);
    const reach = tileOut ? tileReach() : 0;
    let busy = false;

    for (const body of bodies) {
      measure(body);
      body.yielded = false;
      // A sticker is never at rest in Fun mode: it is always on its loop.
      if (body.kind === 'sticker' && body.state === 'home') { wake(body); body.state = 'free'; body.orbit = null; }
      if (body.kind === 'sticker' && !body.orbit) { body.orbit = orbitOf(body); body.spin = ORBIT_TURN; }

      // His tile against this word or sticker.
      if (tileOut) {
        if (body.kind === 'word') {
          // Words give way as he passes and spring back afterwards. They never break loose.
          if (Math.abs(body.x - tile.x) < reach + body.hw && Math.abs(body.y - tile.y) < reach + body.hh) {
            if (body.state === 'home') { wake(body); body.state = 'nudged'; }
            const awayX = body.x - tile.x;
            const awayY = body.y - tile.y;
            const away = Math.hypot(awayX, awayY) || 1;
            const shove = (520 + tileSpeed * 1.1) * dt;
            body.vx += awayX / away * shove + tvx * 0.9 * dt;
            body.vy += awayY / away * shove + tvy * 0.9 * dt;
            body.spin += (awayX > 0 ? 1 : -1) * (40 + tileSpeed * 0.15) * dt;
          }
        } else {
          // His tile is tested as its real shape (a tilted square), so a sticker can never
          // slip under one of its corners.
          const contact = tileOverlap(body);
          const overlap = contact.depth;
          // Loaded in the slingshot he passes over the stickers, so they cannot spoil the
          // pull. Any he is over stay out of it until he has flown clear of them.
          if (band.hooked && overlap > 0) body.under = true;
          else if (body.under && overlap <= 0) body.under = false;
          if (body.under) {
            // nothing: they do not touch
          } else if (overlap > 0) {
            body.pressed = Math.max(body.pressed, 3);
            const nx = contact.nx;
            const ny = contact.ny;
            const closing = Math.min(1000, (tvx - body.vx) * nx + (tvy - body.vy) * ny);
            if (body.state === 'home') { wake(body); body.state = 'free'; }
            // The one firm rule: a sticker and his tile never overlap, at any speed.
            if (body.held) {
              // A sticker in the hand stops at his edge. Pressing gently makes him slip
              // forward; shoving it fast knocks him along with the force of the shove.
              if (!tile.held) {
                // Which way he is being pushed, with any direction blocked by a wall or the
                // floor taken out. Cornered with nowhere to go, he simply stays still.
                const reachNow = tileReach();
                // He goes the way the sticker is being dragged, not the way the shapes happen to meet.
                const dragSpeed = Math.hypot(body.vx, body.vy);
                let pushX = dragSpeed > 20 ? body.vx / dragSpeed : -nx;
                let pushY = dragSpeed > 20 ? body.vy / dragSpeed : -ny;
                // A sticker being pulled away from him does not push him at all.
                if (pushX * -nx + pushY * -ny < 0.2) { pushX = 0; pushY = 0; }
                const nearWall = 24;
                let blocked = 0;
                if ((pushX < 0 && tile.x <= reachNow + nearWall) || (pushX > 0 && tile.x >= width - reachNow - nearWall)) { blocked += Math.abs(pushX); pushX = 0; }
                if ((pushY < 0 && tile.y <= reachNow + nearWall) || (pushY > 0 && tile.y >= height - reachNow - nearWall)) { blocked += Math.abs(pushY); pushY = 0; }
                // Mostly pushed into a wall or the floor: he stays put rather than squirting sideways.
                if (Math.hypot(pushX, pushY) > 0.3 && blocked < Math.hypot(pushX, pushY)) {
                  const slip = Math.min(overlap, 40) * 0.6;
                  tile.x += pushX * slip;
                  tile.y += pushY * slip;
                  const force = closing > 140 ? Math.min(1150, closing) * 0.85 : 30;
                  const already = tile.vx * pushX + tile.vy * pushY;
                  if (already < force) { tile.vx += pushX * (force - already); tile.vy += pushY * (force - already); }
                  // He leans a few degrees the way he is pushed, never spins.
                  const upright = Math.round(tile.angle / 90) * 90;
                  tile.spin = (upright + pushX * 5 - tile.angle) * 5;
                  tile.pushedAt = performance.now();
                  tile.x = Math.min(width - reachNow, Math.max(reachNow, tile.x));
                  tile.y = Math.min(height - reachNow, Math.max(reachNow, tile.y));
                  runTile();
                }
              }
              const rest = tileOverlap(body);
              if (rest.depth > 0) { body.x += rest.nx * rest.depth; body.y += rest.ny * rest.depth; }
            }
            // A loose sticker is not moved here: everything is settled together further down.
            // "Thrown" only while it is still travelling: one that has come to rest after
            // being let go is just a sticker lying there.
            const thrown = !body.held && body.armed && performance.now() - body.thrownAt < 6000 && Math.hypot(body.vx, body.vy) > 60;
            if (!body.held) body.armed = false; // only the first hit of a throw counts
            if (closing > 0 && !body.held) {
              // A sticker he bumps into is nudged aside, not launched across the hero.
              const shove = thrown ? closing * 1.4 : Math.min(closing, 300) * 0.8;
              // Given once the frame is settled, and only if the sticker turned out free to move.
              body.kick = [nx * shove, ny * shove, (Math.random() - 0.5) * Math.min(closing, 420) * 0.5];
              if (thrown && !tile.held) {
                // A sticker someone threw at him: how hard decides what he does.
                // Slow: it just touches and goes. Medium: he wobbles. Hard: he is knocked along.
                if (closing > 620) {
                  const knock = Math.min(360, closing * 0.34);
                  tile.vx -= nx * knock;
                  tile.vy -= ny * knock + 40;
                  tile.spin += (nx > 0 ? -1 : 1) * Math.min(140, closing * 0.14);
                  tile.hits += 1;
                  runTile();
                } else if (closing > 230) {
                  tile.spin += (nx > 0 ? -1 : 1) * (50 + closing * 0.22);
                  tile.vy -= 30;
                  runTile();
                }
              }
            }
            tile.touch = { sticker: body.el.dataset.sticker, at: performance.now(), thrown, pushed: body.held, force: Math.max(0, closing) };
            if (closing > 150 && !tile.held) mood.struck = true; // he has hit a sticker: he feels it
            // Only his own hit sparks: a sticker drifting into him while he lies there does not.
            if (closing > 150 && !tile.held && Math.hypot(tile.vx, tile.vy) > 260) { sparkBurst((tile.x + body.x) / 2, (tile.y + body.y) / 2, closing); colourHit(body); }
            feelTouch(tile.touch);
          } else if ((body.held || tile.held) && overlap > -48 && performance.now() - (mood.contacts[body.el.dataset.sticker] || 0) < 700) {
            // Held right beside each other after touching (the sticker in the hand, or him):
            // one slips back a little, but they are still together.
            feelTouch({ sticker: body.el.dataset.sticker, at: performance.now(), thrown: false, pushed: body.held, force: 0 });
          }
        }
      }

      if (body.state === 'home') continue;
      if (body.held) {
        body.vx *= 1 - Math.min(1, dt * 9);
        body.vy *= 1 - Math.min(1, dt * 9);
        busy = true;
        renderBody(body);
        continue;
      }

      if (body.state === 'nudged') {
        // A soft spring pulls the word back to its place in the sentence.
        const offX = body.x - body.homeX;
        const offY = body.y - body.homeY;
        body.vx += (-70 * offX - 9 * body.vx) * dt;
        body.vy += (-70 * offY - 9 * body.vy) * dt;
        body.spin += (-90 * body.angle - 10 * body.spin) * dt;
        body.x += body.vx * dt;
        body.y += body.vy * dt;
        body.angle += body.spin * dt;
        const off = Math.hypot(body.x - body.homeX, body.y - body.homeY);
        if (off > 64) { body.x = body.homeX + (body.x - body.homeX) * 64 / off; body.y = body.homeY + (body.y - body.homeY) * 64 / off; }
        if (off < 0.4 && Math.hypot(body.vx, body.vy) < 4 && Math.abs(body.angle) < 0.4) {
          body.state = 'home';
          body.x = body.homeX;
          body.y = body.homeY;
          body.angle = 0;
          body.el.style.transform = '';
          body.el.classList.remove('is-live');
          continue;
        }
        busy = true;
        renderBody(body);
        continue;
      }

      // A sticker on its loop: drawn to its moving place on it, so when he knocks it off
      // course it tumbles away and then drifts back on its own. It turns gently all the
      // while, and ambles back to that gentle turn after a tumble.
      if (body.pressed > 0) body.pressed -= 1;
      const spot = orbitSpot(body);
      body.vx += ((spot.x - body.x) * ORBIT_PULL - body.vx * ORBIT_DRAG) * dt;
      body.vy += ((spot.y - body.y) * ORBIT_PULL - body.vy * ORBIT_DRAG) * dt;
      body.spin += (ORBIT_TURN - body.spin) * 1.6 * dt;
      const pace = Math.hypot(body.vx, body.vy);
      const limit = clock - body.kickAt < 2.5 ? 1100 : 420;
      if (pace > limit) { body.vx *= limit / pace; body.vy *= limit / pace; }
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.angle += body.spin * dt;
      if (body.x - body.hw < 0) { body.x = body.hw; body.vx = Math.abs(body.vx) * 0.5; }
      if (body.x + body.hw > width) { body.x = width - body.hw; body.vx = -Math.abs(body.vx) * 0.5; }
      if (body.y - body.hh < 0) { body.y = body.hh; body.vy = Math.abs(body.vy) * 0.5; }
      if (body.y + body.hh + body.lift > height) { body.y = height - body.hh - body.lift; body.vy = -Math.abs(body.vy) * 0.5; }
      busy = true;
      renderBody(body);
    }

    // Stickers knock into each other like ordinary objects.
    const loose = bodies.filter((body) => body.kind === 'sticker');
    const touching = (a, b) => {
      const gapX = b.x - a.x;
      const gapY = b.y - a.y;
      const gap = Math.hypot(gapX, gapY) || 1;
      return { over: (Math.max(a.hw, a.hh) + Math.max(b.hw, b.hh)) * 0.8 - gap, nx: gapX / gap, ny: gapY / gap };
    };
    for (let i = 0; i < loose.length; i += 1) {
      for (let j = i + 1; j < loose.length; j += 1) {
        const a = loose[i];
        const b = loose[j];
        if (a.state === 'home' && b.state === 'home') continue;
        const { over, nx, ny } = touching(a, b);
        if (over <= 0.05) continue;
        for (const body of [a, b]) { if (body.state === 'home') { wake(body); body.state = 'free'; } body.pressed = Math.max(body.pressed, 3); }
        const closing = Math.min(480, (a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
        if (closing > 0) {
          const push = closing * 0.8;
          if (!a.held) { a.vx -= nx * push * (b.held ? 1.3 : 1); a.vy -= ny * push * (b.held ? 1.3 : 1); a.spin -= closing * 0.3; }
          if (!b.held) { b.vx += nx * push * (a.held ? 1.3 : 1); b.vy += ny * push * (a.held ? 1.3 : 1); b.spin += closing * 0.3; }
        }
        busy = true;
      }
    }

    // Settling. Nothing may end the frame overlapping, and nothing may shake.
    // Whatever is moving under the hand or flying (his tile, or a sticker being dragged)
    // tries its move; the stickers in its way are pushed aside. If they cannot all get
    // clear, because a wall, the floor or other stickers leave them nowhere to go, the
    // whole attempt is undone exactly and a shorter move is tried. So a trapped sticker
    // is never shoved out and back: it lies perfectly still and the mover stops against it.
    const clampBody = (body) => {
      body.x = Math.min(width - body.hw, Math.max(body.hw, body.x));
      body.y = Math.min(height - body.hh - body.lift, Math.max(body.hh, body.y));
    };
    const solve = () => {
      for (let pass = 0; pass < 17; pass += 1) {
        let shifted = false;
        for (let i = 0; i < loose.length; i += 1) {
          for (let j = i + 1; j < loose.length; j += 1) {
            const a = loose[i];
            const b = loose[j];
            if (a.state === 'home' && b.state === 'home') continue;
            const { over, nx, ny } = touching(a, b);
            if (over <= 0.05) continue;
            for (const body of [a, b]) { if (body.state === 'home') { wake(body); body.state = 'free'; } }
            const shareA = a.held ? 0 : b.held ? 1 : 0.5;
            a.x -= nx * over * shareA;
            a.y -= ny * over * shareA;
            b.x += nx * over * (1 - shareA);
            b.y += ny * over * (1 - shareA);
            if (!a.held) clampBody(a);
            if (!b.held) clampBody(b);
            shifted = true;
          }
        }
        // The last pass leaves his tile out of it, so a sticker with nowhere to go is
        // left pressed back into him and the jam shows.
        if (tileOut && pass < 16) {
          for (const body of loose) {
            if (body.state === 'home' || body.held || body.under) continue;
            const contact = tileOverlap(body);
            if (contact.depth <= 0.05) continue;
            body.x += contact.nx * contact.depth;
            body.y += contact.ny * contact.depth;
            clampBody(body);
            shifted = true;
          }
        }
        if (!shifted) break;
      }
    };
    const snapshot = () => loose.map((body) => [body, body.x, body.y]);
    const restore = (snap) => { for (const [body, x, y] of snap) { body.x = x; body.y = y; } };
    const lieStill = (body) => { body.vx = body.vy = body.spin = 0; body.pressed = 8; body.jamAt = clock; };
    // Stickers pushed aside may only go roughly the way the mover is going, and not much
    // further than it went. Anything else is a trapped sticker squirming out sideways.
    const squirmed = (snap, moveX, moveY) => {
      const len = Math.hypot(moveX, moveY);
      if (!len) return false;
      for (const [body, x, y] of snap) {
        if (body.held) continue;
        const dx = body.x - x;
        const dy = body.y - y;
        const far = Math.hypot(dx, dy);
        if (far > 1.5 && ((dx * moveX + dy * moveY) / len < far * 0.35 || far > len * 2.5 + 3)) return true;
      }
      return false;
    };
    // Try a move, then shorter ones, then sliding along one axis. `place` puts the mover
    // somewhere; `blocker` says what is in the way afterwards (or null).
    const advance = (fromX, fromY, toX, toY, place, blocker) => {
      const dx = toX - fromX;
      const dy = toY - fromY;
      const start = snapshot();
      const tries = [[dx, dy]];
      for (const step of [40, 12, 4, 1]) {
        if (Math.abs(dx) > 0.01) tries.push([Math.sign(dx) * Math.min(Math.abs(dx), step), 0]);
        if (Math.abs(dy) > 0.01) tries.push([0, Math.sign(dy) * Math.min(Math.abs(dy), step)]);
      }
      let block = null;
      for (let index = 0; index < tries.length; index += 1) {
        const [mx, my] = tries[index];
        place(fromX + mx, fromY + my);
        solve();
        const len = Math.hypot(mx, my) || 1;
        const hit = blocker() || (squirmed(start, mx, my) ? { nx: mx / len, ny: my / len } : null);
        if (!hit) return { full: index === 0, block };
        if (!block) {
          block = hit;
          // Everything that attempt disturbed is trapped: it lies still.
          for (const [body, x, y] of start) { if (!body.held && Math.hypot(body.x - x, body.y - y) > 0.05) lieStill(body); }
        }
        restore(start);
      }
      place(fromX, fromY);
      return { full: false, block };
    };

    const tileYields = tileOut && (tile.held || tileSpeed > 40);
    if (!tileOut) tile.prevX = undefined;
    const tileToX = tile.x;
    const tileToY = tile.y;
    const transact = tileYields && tile.prevX !== undefined && Math.hypot(tileToX - tile.prevX, tileToY - tile.prevY) > 0.01;
    if (transact) { tile.x = tile.prevX; tile.y = tile.prevY; }
    // First settle whatever the stickers did on their own this frame.
    solve();
    if (tileOut) {
      // What already overlaps him and cannot get out (he has just grown or turned).
      const before = new Map();
      for (const body of loose) { if (body.state !== 'home' && !body.held) before.set(body, Math.max(0, tileOverlap(body).depth)); }
      const tileBlocker = () => {
        let worst = null;
        let most = 0.75;
        for (const body of loose) {
          if (body.state === 'home' || body.held || body.under) continue;
          const contact = tileOverlap(body);
          const extra = contact.depth - (before.get(body) || 0);
          if (contact.depth > 0 && extra > most) { most = extra; worst = { nx: contact.nx, ny: contact.ny }; }
        }
        return worst;
      };
      if (transact) {
        const went = advance(tile.prevX, tile.prevY, tileToX, tileToY, (x, y) => { tile.x = x; tile.y = y; }, tileBlocker);
        if (!went.full) {
          tile.yielded = true;
          if (!tile.held && went.block) bounceOffJam(went.block.nx, went.block.ny);
        }
      }
      for (const body of loose) {
        if (body.state === 'home' || body.held || body.under) continue;
        const still = tileOverlap(body);
        if (still.depth <= 0.5) continue;
        if (tileYields) {
          // Still wedged into him (he grew or turned into it): he is the one who gives way.
          tile.x = Math.min(width - reach, Math.max(reach, tile.x - still.nx * still.depth));
          tile.y = Math.min(height - reach, Math.max(reach, tile.y - still.ny * still.depth));
          tile.yielded = true;
          if (!tile.held) bounceOffJam(still.nx, still.ny);
          lieStill(body);
        } else {
          // He is sitting still and a loose sticker is squeezed against him: the sticker
          // works its way out round his nearest free side. He is not moved.
          const exits = [
            [tile.x - reach - body.hw - body.x, 0], [tile.x + reach + body.hw - body.x, 0],
            [0, tile.y - reach - body.hh - body.y], [0, tile.y + reach + body.hh - body.y],
          ].filter(([dx, dy]) => body.x + dx >= body.hw && body.x + dx <= width - body.hw && body.y + dy >= body.hh && body.y + dy <= height - body.hh);
          exits.sort((one, two) => Math.hypot(one[0], one[1]) - Math.hypot(two[0], two[1]));
          if (exits.length) {
            const [dx, dy] = exits[0];
            const far = Math.hypot(dx, dy) || 1;
            const stepOut = Math.min(far, 16);
            body.x += dx / far * stepOut;
            body.y += dy / far * stepOut;
            body.vx = dx / far * 120;
            body.vy = dy / far * 120;
            body.pressed = 0;
          }
        }
      }
      tile.prevX = tile.x;
      tile.prevY = tile.y;
    }

    // A sticker in the hand moves the same way: as far as the others let it.
    for (const body of loose) {
      if (!body.held) continue;
      const toX = body.blocked ? body.aimX : body.x;
      const toY = body.blocked ? body.aimY : body.y;
      if (body.prevX === undefined || Math.hypot(toX - body.prevX, toY - body.prevY) <= 0.01) continue;
      const before = new Map();
      body.x = body.prevX;
      body.y = body.prevY;
      if (tileOut) { for (const other of loose) { if (other.state !== 'home' && !other.held && !other.under) before.set(other, Math.max(0, tileOverlap(other).depth)); } }
      const handBlocker = () => {
        // The sticker in the hand never ends up on top of him or of another sticker.
        if (tileOut) { const own = tileOverlap(body); if (own.depth > 0.75) return { nx: -own.nx, ny: -own.ny }; }
        for (const other of loose) {
          if (other === body || other.state === 'home') continue;
          const { over, nx, ny } = touching(body, other);
          if (over > 0.75) return { nx, ny };
          if (tileOut && !other.under) { const contact = tileOverlap(other); if (contact.depth - (before.get(other) || 0) > 0.75) return { nx: contact.nx, ny: contact.ny }; }
        }
        return null;
      };
      const went = advance(body.prevX, body.prevY, toX, toY, (x, y) => { body.x = x; body.y = y; }, handBlocker);
      body.yielded = !went.full;
    }
    for (const body of loose) {
      if (body.held) body.blocked = body.yielded;
      if (body.kick) {
        // The nudge from bumping into him: a trapped sticker takes none.
        if (body.jamAt !== clock && !body.held) { body.vx += body.kick[0]; body.vy += body.kick[1]; body.spin += body.kick[2]; body.kickAt = clock; }
        body.kick = null;
      }
      body.prevX = body.x;
      body.prevY = body.y;
      if (body.state !== 'home') renderBody(body);
    }
    syncReset();
    return busy;
  };

  const worldLoop = (now) => {
    worldFrame = 0;
    if (tile.frame || !heroVisible || !playing()) return;
    const dt = Math.min(0.032, Math.max(0.001, (now - worldLast) / 1000));
    worldLast = now;
    worldTick(dt);
    worldFrame = window.requestAnimationFrame(worldLoop);
  };

  // His tile drives the world while it is moving; otherwise the world runs itself.
  function runWorld() {
    if (worldFrame || tile.frame || !heroVisible) return;
    worldLast = performance.now();
    worldFrame = window.requestAnimationFrame(worldLoop);
  }

  const grabSticker = (event) => {
    if (!playing() || event.button !== 0) return;
    const body = bodies.find((item) => item.el === event.currentTarget);
    event.preventDefault();
    wake(body);
    const point = heroPoint(event);
    body.state = 'free';
    body.held = true;
    body.armed = false;
    body.vx = body.vy = 0;
    body.grabX = point.x - body.x;
    body.grabY = point.y - body.y;
    body.aimX = body.prevX = body.x;
    body.aimY = body.prevY = body.y;
    body.blocked = body.yielded = false;
    body.trail = [{ t: performance.now(), x: body.x, y: body.y }];
    body.el.classList.add('is-held');
    document.documentElement.classList.add('is-dragging');
    syncReset();
    const drag = (move) => {
      const at = heroPoint(move);
      const now = performance.now();
      const beforeX = body.aimX;
      const beforeY = body.aimY;
      body.aimX = Math.min(hero.clientWidth - body.hw, Math.max(body.hw, at.x - body.grabX));
      body.aimY = Math.min(hero.clientHeight - body.hh, Math.max(body.hh, at.y - body.grabY));
      // Held off by a trapped sticker, it stays where it is and only presses toward the cursor.
      if (!body.blocked) { body.x = body.aimX; body.y = body.aimY; }
      const last = body.trail[body.trail.length - 1];
      const span = Math.max(0.008, (now - last.t) / 1000);
      body.vx = Math.max(-1200, Math.min(1200, (body.aimX - beforeX) / span));
      body.vy = Math.max(-1200, Math.min(1200, (body.aimY - beforeY) / span));
      if (body.blocked) { body.vx *= 0.25; body.vy *= 0.25; }
      body.trail.push({ t: now, x: body.aimX, y: body.aimY });
      if (body.trail.length > 8) body.trail.shift();
    };
    const release = () => {
      window.removeEventListener('pointermove', drag);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      body.held = false;
      const wasBlocked = body.blocked;
      body.blocked = false;
      body.el.classList.remove('is-held');
      document.documentElement.classList.remove('is-dragging');
      const now = performance.now();
      const from = body.trail.find((point) => now - point.t < 110) || body.trail[body.trail.length - 1];
      const span = Math.max(0.016, (now - from.t) / 1000);
      // Its speed is the speed of the hand. Let go while it is pressed against something
      // that cannot move, it simply stays there: that is not a throw.
      body.vx = wasBlocked ? 0 : Math.max(-1400, Math.min(1400, (body.aimX - from.x) / span));
      body.vy = wasBlocked ? 0 : Math.max(-1400, Math.min(1400, (body.aimY - from.y) / span));
      body.spin = Math.max(-200, Math.min(200, body.vx * 0.2));
      body.thrownAt = now;
      // Let go while moving: it is a throw, and its first hit on him will hurt.
      body.armed = Math.hypot(body.vx, body.vy) > 80;
      runWorld();
    };
    window.addEventListener('pointermove', drag);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    runWorld();
  };
  // (The stickers are not for grabbing any more: only he moves them, by hitting them.)
  void grabSticker;

  const syncReset = () => {}; // (there is no Reset button any more: everything finds its own way back)

  // Everything loose glides back to where it belongs.
  const sendAllHome = () => {
    window.cancelAnimationFrame(worldFrame);
    worldFrame = 0;
    for (const body of bodies) {
      if (body.kind === 'sticker' && body.state !== 'home') {
        const wrapped = ((body.angle + 180) % 360 + 360) % 360 - 180;
        body.el.style.setProperty('--da', wrapped + 'deg');
      }
    }
    void hero.offsetWidth;
    for (const body of bodies) {
      body.state = 'home';
      body.held = false;
      body.vx = body.vy = body.spin = body.angle = 0;
      body.el.classList.remove('is-live', 'is-held', 'is-hopping');
      body.hopUntil = 0;
      if (body.kind === 'sticker') ['--dx', '--dy', '--da'].forEach((name) => body.el.style.removeProperty(name));
      else body.el.style.transform = '';
    }
  };

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; syncReset(); if (heroVisible) runWorld(); }).observe(hero);
  }

  // Tiny keyframes spray out from where the sticker row sat when Fun mode switches on.
  const burst = () => {
    if (calm.matches || !playLayer.animate) return;
    const box = hero.getBoundingClientRect();
    const originX = box.width / 2;
    const originY = box.height - 62;
    for (let i = 0; i < 18; i += 1) {
      const piece = document.createElement('span');
      piece.className = 'burst';
      piece.style.left = originX + 'px';
      piece.style.top = originY + 'px';
      playLayer.append(piece);
      const angle = -Math.PI * (0.08 + Math.random() * 0.84);
      const reach = 140 + Math.random() * 300;
      const x = Math.cos(angle) * reach;
      const y = Math.sin(angle) * reach;
      piece.animate([
        { transform: 'translate(-50%, -50%) rotate(45deg) scale(.4)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + x + 'px), calc(-50% + ' + y + 'px)) rotate(' + (180 + Math.random() * 360) + 'deg) scale(1)', opacity: 1, offset: 0.6 },
        { transform: 'translate(calc(-50% + ' + x * 1.08 + 'px), calc(-50% + ' + (y + 46) + 'px)) rotate(' + (360 + Math.random() * 360) + 'deg) scale(.2)', opacity: 0 },
      ], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2, .8, .3, 1)' }).onfinish = () => piece.remove();
    }
  };

  const setMode = (mode, announce) => {
    // Release everything loose while the page is still in its current layout, so each
    // piece starts its glide from exactly where it is.
    if (mode !== 'fun') { sendTileHome(); sendAllHome(); }
    root.dataset.mode = mode;
    syncReset();
    if (mode === 'fun') runWorld(); // (the stickers set off on their loop)
    modeSwitch.setAttribute('aria-checked', String(mode === 'fun'));
    if (!announce) return;
    try { window.localStorage.setItem('hero-mode', mode); } catch (error) { /* storage is optional */ }
    root.classList.remove('is-fresh');
    copy.classList.remove('is-switching');
    void copy.offsetWidth;
    copy.classList.add('is-switching');
    if (mode === 'fun') burst();
  };

  // Reset: he glides home looking relieved and is his calm self again, the stickers
  // return to their places, and the opening bubble comes back.
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      if (!playing()) return;
      sendTileHome('relieved');
      sendAllHome();
      if (!box.held) springBox();
      syncReset();
    });
  }

  modeSwitch.addEventListener('click', () => setMode(root.dataset.mode === 'fun' ? 'normal' : 'fun', true));
  copy.addEventListener('animationend', (event) => {
    if (event.animationName === 'copy-sharpen' && event.target.tagName === 'P') copy.classList.remove('is-switching');
  });

  setMode(root.dataset.mode === 'fun' ? 'fun' : 'normal', false);
  if (root.dataset.mode === 'fun' && !calm.matches) {
    root.classList.add('is-fresh');
    window.setTimeout(() => root.classList.remove('is-fresh'), 3200);
  }

  measureBox();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureBox);
  window.addEventListener('resize', () => { measureBox(); if (!playing()) { sendTileHome(); sendAllHome(); } bodies.forEach((body) => { if (body.state === 'home') body.measured = false; }); });

  // ---------- Fun mode below the hero ----------
  // The dotted canvas runs down the whole page (hero-play.css). Two small things follow
  // the visitor here: the dots brighten softly around the cursor. (The case-study files
  // stack by themselves: each one is sticky, so the next slides up over it.)
  const glow = document.querySelector('.dot-glow');
  // The Motion Graphics card is built out of square blocks by scrolling: once the folders
  // are stacked, blocks of the card pop in over them a few at a time until the whole card
  // is there. The blocks are rectangles in an SVG clip, so what shows through them is the
  // real card. When it is complete its title decodes from scrambled characters.
  const reel = document.querySelector('.reel');
  const reelCard = reel && reel.querySelector('.reel-card');
  const reelTitle = reel && reel.querySelector('.reel-title');
  const REEL_COLS = 32; // about 40px pixels on a full-width card
  const REEL_ROWS = 14;
  const REEL_POP = 0.12; // how long (as a share of the build) one block takes to pop in
  const reelCells = [];
  if (reel) {
    const space = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(space, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    const clip = document.createElementNS(space, 'clipPath');
    clip.id = 'reel-clip';
    clip.setAttribute('clipPathUnits', 'objectBoundingBox');
    // A fixed scatter (the same every visit), leaning a little from the middle outwards.
    let seed = 7;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let row = 0; row < REEL_ROWS; row += 1) {
      for (let col = 0; col < REEL_COLS; col += 1) {
        const rect = document.createElementNS(space, 'rect');
        clip.append(rect);
        const fromMiddle = Math.hypot((col + 0.5) / REEL_COLS - 0.5, ((row + 0.5) / REEL_ROWS - 0.5) * 0.6) / 0.58;
        reelCells.push({ rect, cx: (col + 0.5) / REEL_COLS, cy: (row + 0.5) / REEL_ROWS, at: 0.72 * random() + 0.28 * Math.min(1, fromMiddle), shown: -1 });
      }
    }
    svg.append(clip);
    reel.append(svg);
  }

  // The title: scrambled until the card is complete, then it decodes left to right.
  const reelWords = reelTitle ? reelTitle.textContent.trim() : '';
  const GLYPHS = '#%&$@+=<>/[]{}01XKZ';
  let reelDecoded = reelWords.length;
  let reelTimer = 0;
  let reelScrambledAt = 0;
  const writeReelTitle = () => {
    const rest = reelWords.slice(reelDecoded).replace(/\S/g, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);
    reelTitle.innerHTML = '<span aria-hidden="true">' + reelWords.slice(0, reelDecoded) + '</span><span class="reel-scr" aria-hidden="true">' + rest + '</span>';
  };
  if (reelTitle) { reelTitle.setAttribute('aria-label', reelWords); writeReelTitle(); }
  const decodeReelTitle = () => {
    if (reelTimer || reelDecoded >= reelWords.length) return;
    reelTimer = window.setInterval(() => {
      reelDecoded += 1;
      writeReelTitle();
      if (reelDecoded >= reelWords.length) { window.clearInterval(reelTimer); reelTimer = 0; }
    }, 48);
  };
  const scrambleReelTitle = () => {
    window.clearInterval(reelTimer);
    reelTimer = 0;
    reelDecoded = 0;
    // While the card is still building, the scramble changes as the page scrolls.
    const now = performance.now();
    if (now - reelScrambledAt > 70) { reelScrambledAt = now; writeReelTitle(); }
  };

  let reelBuild = 0;
  const paintReel = () => {
    if (!reel) return;
    if (!playing()) {
      reel.classList.remove('is-out', 'is-open');
      if (reelDecoded < reelWords.length) { window.clearInterval(reelTimer); reelTimer = 0; reelDecoded = reelWords.length; writeReelTitle(); }
      return;
    }
    const tall = reelCard.offsetHeight;
    const runway = Math.max(1, reel.offsetHeight - tall);
    const stick = parseFloat(window.getComputedStyle(reelCard).top) || 0;
    // This card takes its turn after the last folder (see paintArrivals). If the scroll has
    // already run past where it would have started, it starts from there (up to 120px
    // late; any more than that and it simply picks up part-built).
    const passed = stick - reel.getBoundingClientRect().top;
    if (dock) {
      if (!dockPop.allStacked) dockPop.reelShift = null;
      else if (passed <= 0) dockPop.reelShift = 0;
      else if (dockPop.reelShift === null) { dockPop.reelShift = Math.min(120, passed + 120); /* a short pause after the last folder */ dockPop.reelAt = performance.now(); runDock(); }
    }
    const waiting = dock && dockPop.reelShift === null;
    const progress = waiting ? 0 : Math.max(0, Math.min(1, (passed - (dock ? dockPop.reelShift : 0)) / runway));
    // The build takes the first 64vh of the scroll. For the rest the finished card simply
    // rests there (its heading rises into the title spot, then the About Me notification
    // and pointer arrive over it) before it and the folders scroll away together.
    let build = Math.min(1, progress * runway / (0.64 * window.innerHeight));
    // (Picking up part-built, it builds to there at a steady pace rather than all at once.)
    const turn = dock ? Math.max(0, Math.min(1, (performance.now() - dockPop.reelAt) / REEL_CATCH)) : 1;
    build = Math.min(build, turn);
    const wide = 1 / REEL_COLS;
    const high = 1 / REEL_ROWS;
    for (const cell of reelCells) {
      const pop = Math.max(0, Math.min(1, (build * (1 + REEL_POP) - cell.at) / REEL_POP));
      if (pop === cell.shown) continue;
      cell.shown = pop;
      // Each block grows from its own middle; fully in, it overlaps its neighbours a hair
      // so no seams show between blocks.
      const size = pop >= 1 ? 1.03 : 1 - (1 - pop) ** 3;
      cell.rect.setAttribute('x', (cell.cx - wide * size / 2).toFixed(5));
      cell.rect.setAttribute('y', (cell.cy - high * size / 2).toFixed(5));
      cell.rect.setAttribute('width', (wide * size).toFixed(5));
      cell.rect.setAttribute('height', (high * size).toFixed(5));
    }
    const open = build >= 1;
    // "Case Studies" bows out while this card builds, and returns on the way back up.
    if (caseTitle) caseTitle.style.setProperty('--out', Math.min(1, build * 1.6).toFixed(3));
    reelBuild = build; // (the card starts moving to the middle the moment that fade has finished: paintReelHeading)
    reel.classList.toggle('is-out', progress > 0.001 && turn > 0);
    reel.classList.toggle('is-open', open);
    if (open) decodeReelTitle(); else if (build < 0.94) scrambleReelTitle();
  };

  // Case Studies arrives with the scroll: the heading fades and rises in first, then each
  // folder as it comes up from the bottom of the screen. Each piece is fully in by the
  // time it is well into view, and the same happens in reverse on the way back up.
  const caseTitle = document.querySelector('.case-studies .section-title');
  const caseFolders = [...document.querySelectorAll('.project-grid .project-card')];
  const aboutWindow = document.querySelector('.about-inner');
  const ARRIVE_RISE = 70; // matches the 70px in hero-play.css
  const laterHome = [];
  const laterShift = [];   // how much later, in scrolling, each later folder is running
  const laterStacked = []; // whether each has reached the stack
  const paintArrivals = () => {
    const pieces = [];
    if (caseTitle) pieces.push([caseTitle, 0.96, 0.72, 0]);
    // A folder is measured from the top of its tab, and starts once the heading is in.
    for (const folder of caseFolders) pieces.push([folder, 0.85, 0.48, 56]);
    if (!playing()) {
      for (const [piece] of pieces) { piece.style.removeProperty('--in'); piece.style.removeProperty('--late'); }
      if (caseTitle) { caseTitle.style.removeProperty('--sc'); caseTitle.style.removeProperty('--out'); }
      return;
    }
    const tall = window.innerHeight;
    let gate = 0; // how far the page must have scrolled before this piece may begin
    for (const [piece, from, to, lead, anchor] of pieces) {
      const was = parseFloat(piece.style.getPropertyValue('--in'));
      const risen = (!anchor && Number.isFinite(was) ? (1 - was) * ARRIVE_RISE : 0) + (parseFloat(piece.style.getPropertyValue('--late')) || 0);
      // Where it would be without the rise it is currently given.
      const top = (anchor || piece).getBoundingClientRect().top - risen - lead;
      // On a tall window a piece can already be on screen before any scrolling. It still
      // waits: the heading begins only once the page has started to move, and the first
      // folder only once the heading is fully in. (Later folders are a whole folder further
      // down, so they are never on screen that early.)
      const span = (from - to) * tall;
      const place = top + window.scrollY;
      const begin = Math.min(from * tall, place - gate - 24);
      let arrived = Math.max(0, Math.min(1, (begin - top) / span));
      // Stacking starts only once the first folder is fully out of the Dock and has settled,
      // and it always follows the scroll: a later folder rises only as the page is scrolled.
      // They also take turns. Each one may start only when the one before it has reached
      // the stack. If the scroll has already run past where it would have started, it
      // starts from the bottom of the screen all the same and rises from there as the page
      // is scrolled on, so two folders never come in stuck together.
      const turn = caseFolders.indexOf(piece);
      if (turn > 0 && dock) {
        const stick = (parseFloat(window.getComputedStyle(piece).top) || 0) - lead; // where its tab rests in the stack
        if (top > stick + 2) laterHome[turn] = place;                              // its own place on the page
        const home = (laterHome[turn] === undefined ? place : laterHome[turn]) - window.scrollY;
        const free = dockPop.skip || (turn === 1 ? performance.now() >= dockPop.doneAt + SETTLE : laterStacked[turn - 1] === true);
        const start = from * tall; // a folder starts its rise here, near the bottom of the screen
        if (dockPop.skip) laterShift[turn] = 0; // (carried here by the nav bar: simply in place)
        else if (!free) laterShift[turn] = null;
        else if (home >= start) laterShift[turn] = 0;                               // not due yet: nothing to make up
        else if (laterShift[turn] === null || laterShift[turn] === undefined) laterShift[turn] = start - home; // late: it starts from the bottom
        else if (home + laterShift[turn] <= stick) laterShift[turn] = 0;            // it has arrived in the stack: nothing left to make up
        if (!free || top < stick - 1) {
          // (Waiting its turn, or the whole section is scrolling away.)
          if (!free) arrived = 0;
          laterStacked[turn] = free;
          piece.style.setProperty('--late', '0px');
        } else {
          const shown = Math.max(stick, home + laterShift[turn]); // where it is shown: as if the scroll were that much less
          arrived = Math.max(0, Math.min(1, (start - shown) / span));
          laterStacked[turn] = shown <= stick + 1;
          piece.style.setProperty('--late', (shown - top).toFixed(1) + 'px');
        }
        if (turn === 1) dockPop.nextDue = arrived; // (is the first folder on its own?)
        if (turn === caseFolders.length - 1) dockPop.allStacked = laterStacked[turn] === true;
      }
      gate = piece === caseTitle ? place - begin + span : 0;
      if (piece === caseTitle) {
        // The title shrinks a little as it settles into the place where it stays.
        const rest = parseFloat(window.getComputedStyle(piece).top) || 0;
        const settled = Math.max(0, Math.min(1, 1 - (top - rest) / 180));
        dockPop.titleTop = top;
        piece.style.setProperty('--sc', (1 - 0.28 * settled).toFixed(3));
      }
      piece.style.setProperty('--in', arrived.toFixed(3));
    }
    // The first folder does not fade or rise in: it pours out of the Dock (paintDock).
    if (caseFolders[0]) caseFolders[0].style.setProperty('--in', '1');
    // Stacked behind the Motion Graphics card, the folders move up to the middle with it.
    // (The later folders' own value was set afresh just above; the first has none of its own.)
    caseFolders.forEach((folder, i) => {
      if (i === 0) { if (reelCentre) folder.style.setProperty('--late', reelCentre.toFixed(1) + 'px'); else folder.style.removeProperty('--late'); }
      else if (reelCentre) folder.style.setProperty('--late', ((parseFloat(folder.style.getPropertyValue('--late')) || 0) + reelCentre).toFixed(1) + 'px');
    });
  };

  // About Me arrives the way something opens on a Mac. A notification slides in at the top
  // right (the illustration, "About Me", the opening words of the text). Scrolling on
  // brings a pointer over to it. When the pointer gets there it clicks by itself: the
  // notification slides away and the window pops open from that spot, floats in view,
  // and settles into the page as the scroll catches up with it. Scrolling back up closes
  // it again. Nothing fades: every piece slides, scales or pops as a solid object.
  const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const unit = (t) => Math.max(0, Math.min(1, t));
  const backOut = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2; // lands with a small overshoot
  let notice = null;
  let pointer = null;
  if (aboutWindow) {
    const words = (aboutWindow.querySelector('p') || {}).textContent || '';
    // The line under the title is the opening of the visitor-facing text itself.
    const opening = words.trim().split(/\s+/).slice(0, 7).join(' ').replace(/[,.;:]$/, '') + '…';
    const picture = aboutWindow.querySelector('.about-photo img');
    notice = document.createElement('div');
    notice.className = 'notice';
    notice.setAttribute('aria-hidden', 'true');
    notice.innerHTML = '<img alt=""><span><b>About Me</b><i></i></span>';
    notice.querySelector('img').src = picture ? picture.getAttribute('src') : '';
    notice.querySelector('i').textContent = opening;
    pointer = document.createElement('div');
    pointer.className = 'pointer';
    pointer.setAttribute('aria-hidden', 'true');
    pointer.innerHTML = '<svg class="arrow" viewBox="0 0 24 24"><path d="M5 2.5v17.2l4.5-4 3 6.8 2.7-1.2-3-6.7h6z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>'
      + '<svg class="hand" viewBox="0 0 24 24" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V4.2a1.7 1.7 0 0 1 3.4 0V10l5.2 1.1a2.4 2.4 0 0 1 1.9 2.6l-.7 4.9A3.9 3.9 0 0 1 14.9 22H12a4.4 4.4 0 0 1-3.5-1.7l-3.6-4.6a1.6 1.6 0 0 1 2.4-2.1L9 15.200z"/></svg>';
    document.body.append(notice, pointer);
  }
  const pop = { on: false, k: 0, pressAt: 0, frame: 0, last: 0 };
  if (window.__probe) window.__probe.pop = pop; // temporary, for testing: remove with the other debug hooks
  const PRESS = 150; // the click itself
  const runPop = () => {
    if (pop.frame) return;
    pop.last = performance.now();
    const step = (now) => {
      pop.frame = 0;
      const dt = Math.min(48, now - pop.last);
      pop.last = now;
      const pressing = pop.on && now < pop.pressAt + PRESS;
      if (!pressing) pop.k = pop.on ? Math.min(1, pop.k + dt / 560) : Math.max(0, pop.k - dt / 300);
      paintAbout();
      if (pressing || (pop.on ? pop.k < 1 : pop.k > 0)) pop.frame = window.requestAnimationFrame(step);
    };
    pop.frame = window.requestAnimationFrame(step);
  };
  const ABOUT_FLOAT = 76; // how far from the top of the screen the open About Me window floats
  let aboutEdge = null;
  if (window.__probe) window.__probe.aboutEdge = () => aboutEdge; // temporary, for testing: remove with the other debug hooks
  function paintAbout() {
    if (!aboutWindow) return;
    const style = aboutWindow.style;
    if (!playing()) {
      style.transform = style.clipPath = style.visibility = '';
      style.removeProperty('--photo-r');
      style.removeProperty('--photo-tilt');
      aboutWindow.classList.remove('is-moving');
      notice.style.visibility = pointer.style.visibility = 'hidden';
      pop.on = false;
      pop.k = 0;
      return;
    }
    const now = performance.now();
    const viewWide = window.innerWidth;
    const viewTall = window.innerHeight;
    const section = aboutWindow.parentElement.getBoundingClientRect();
    const wide = aboutWindow.offsetWidth;
    const tall = aboutWindow.offsetHeight;
    // Where the window really belongs right now.
    const homeX = section.left + aboutWindow.offsetLeft;
    const homeY = section.top + aboutWindow.offsetTop;

    // The click happens once the scroll has brought the pointer all the way over; scrolling
    // back above that point closes the window again.
    if (!pop.on && homeY <= viewTall + 40) {
      pop.on = true;
      pop.pressAt = now;
      if (homeY < viewTall * 0.6) { pop.k = 1; pop.pressAt = 0; } // arrived by a jump: already open
      runPop();
    } else if (pop.on && homeY > viewTall + 70) {
      pop.on = false;
      runPop();
    }
    const pressing = pop.on && now < pop.pressAt + PRESS;
    const press = pressing ? Math.sin(Math.PI * (now - pop.pressAt) / PRESS) : 0;
    const away = smooth(unit(pop.k / 0.5)); // the notification and pointer leaving after the click

    // The notification: slides in from the right, dips when clicked, slides back out.
    const noticeWide = notice.offsetWidth;
    const noticeTall = notice.offsetHeight;
    const noticeStyle = window.getComputedStyle(notice);
    const noticeTop = parseFloat(noticeStyle.top) || 0;
    const noticeRight = parseFloat(noticeStyle.right) || 0;
    // (It arrives 400px of scrolling before the pointer sets off, so it sits there a while on its own first.)
    const slide = smooth(unit((viewTall + 1040 - homeY) / 130));
    const noticeGone = (1 - slide) + away;
    notice.style.visibility = slide > 0 && noticeGone < 1 ? 'visible' : 'hidden';
    notice.style.transform = 'translate3d(' + (Math.min(1, noticeGone) * (noticeWide + noticeRight + 30)).toFixed(2) + 'px, 0, 0) scale(' + (1 - 0.04 * press).toFixed(4) + ')';
    // Once the window starts to open, the picture has left the notification: it is the
    // window's own photo from here on, so the notification's copy is put away.
    const icon = notice.querySelector('img');
    icon.style.visibility = pop.k > 0 ? 'hidden' : '';
    const spotX = viewWide - noticeRight - noticeWide / 2; // the middle of the notification
    const spotY = noticeTop + noticeTall / 2;

    // The pointer: comes up from below along a gentle curve, becomes a hand over the
    // notification, clicks, then leaves with it.
    // (Unhurried: it takes a good 440px of scrolling to cross the screen.)
    const along = unit((viewTall + 480 - homeY) / 440);
    const reach = along * along * (3 - 2 * along); // a gentle ease, so it never rushes mid-way
    const fromX = viewWide * 0.56;
    const fromY = viewTall + 40;
    const bendX = viewWide * 0.82;
    const bendY = viewTall * 0.6;
    const toX = spotX - 26;
    const toY = spotY + 4;
    const pointX = (1 - reach) ** 2 * fromX + 2 * (1 - reach) * reach * bendX + reach ** 2 * toX + away * (noticeWide + noticeRight + 120);
    const pointY = (1 - reach) ** 2 * fromY + 2 * (1 - reach) * reach * bendY + reach ** 2 * toY;
    pointer.style.visibility = reach > 0 && away < 1 ? 'visible' : 'hidden';
    pointer.classList.toggle('is-hand', reach > 0.86);
    // (The hot spot of each cursor, its tip, sits a few pixels inside its box.)
    pointer.style.transform = 'translate3d(' + (pointX - 7).toFixed(2) + 'px, ' + (pointY - 3).toFixed(2) + 'px, 0) scale(' + (1 - 0.14 * press).toFixed(4) + ')';

    // The window. Closed, it is not there at all. Open, it floats near the top of the
    // screen, a little smaller if it would not fit, until the page has scrolled far
    // enough for its real place to arrive; from then on it is an ordinary part of the page.
    if (pop.k <= 0) {
      style.visibility = 'hidden';
      aboutWindow.classList.remove('is-moving');
      aboutEdge = null;
      return;
    }
    style.visibility = '';
    const floatY = ABOUT_FLOAT;
    const fit = Math.min(1, (viewTall - floatY - 44) / tall);
    const docked = smooth(unit((viewTall * 0.92 - homeY) / (viewTall * 0.92 - floatY)));
    const restScale = fit + (1 - fit) * docked;
    const restX = homeX + wide * (1 - restScale) / 2;
    const restY = Math.min(homeY, floatY); // floating until its real place has come up to meet it
    aboutEdge = { now: restX, rest: restX }; // (its visible left edge on screen, for the Stage Manager tile beside it)
    const photo = aboutWindow.querySelector('.about-photo');
    if (pop.k >= 1) {
      style.clipPath = '';
      style.removeProperty('--photo-r');
      style.removeProperty('--photo-tilt');
    }
    if (pop.k >= 1 && homeY <= floatY) {
      aboutEdge.now = aboutEdge.rest = homeX;
      style.transform = '';
      aboutWindow.classList.remove('is-moving');
      return;
    }
    aboutWindow.classList.add('is-moving');
    // Opening beside the Motion Graphics card (see paintStage): one continuous growth.
    const growing = pop.on && stage.on && stage.k < 1 && photo && stage.right !== null;
    if (!growing && (pop.k >= 1 || !photo)) {
      // Open and floating.
      style.transform = 'translate3d(' + (restX - homeX).toFixed(2) + 'px, ' + (restY - homeY).toFixed(2) + 'px, 0) scale(' + restScale.toFixed(5) + ')';
      return;
    }
    // Unfolding. It starts as nothing but its photo, sitting exactly on the notification's
    // picture at the same size, then the rest of the window opens out around the photo
    // while the whole thing grows and travels to where it rests.
    const photoX = photo.offsetLeft;
    const photoY = photo.offsetTop;
    const photoSize = photo.offsetWidth;
    const iconSize = icon.offsetWidth;
    const iconX = viewWide - noticeRight - noticeWide + icon.offsetLeft;
    const iconY = noticeTop + icon.offsetTop;
    const startScale = iconSize / photoSize;
    const startX = iconX - photoX * startScale;
    const startY = iconY - photoY * startScale;
    if (growing) {
      // The whole window grows as one piece, at the same pace as the card shrinks, from
      // the size at which its picture sits exactly on the notification's picture up to
      // full size. Its right side follows that steady growth; its left side is always the
      // small gap to the right of the card, so the two change size together, side by side,
      // with no stage where one part opens before another.
      const grown = 1 - (1 - stage.k) ** 3; // (the card's own pace)
      const size = startScale + (restScale - startScale) * grown;
      const far = startX + (restX - startX) * grown + wide * size;           // its right edge
      const near = Math.max(startX + (restX - startX) * grown, stage.right + STAGE_GAP); // its left edge
      const scaleNow = Math.max(startScale, (far - near) / wide);
      const xNow = far - wide * scaleNow;
      const yNow = startY + (restY - startY) * grown;
      style.transform = 'translate3d(' + (xNow - homeX).toFixed(2) + 'px, ' + (yNow - homeY).toFixed(2) + 'px, 0) scale(' + scaleNow.toFixed(5) + ')';
      // It comes out of the picture: in the first moment, while still that small, the
      // window opens around its photo. After that there is no cover at all.
      const out = smooth(unit(grown / 0.16));
      const hid = 1 - out;
      style.clipPath = hid > 0.001 ? 'inset(' + (photoY * hid).toFixed(2) + 'px ' + ((wide - photoX - photoSize) * hid).toFixed(2) + 'px ' + ((tall - photoY - photoSize) * hid).toFixed(2) + 'px ' + (photoX * hid).toFixed(2) + 'px round ' + ((12 + 4 * out) / scaleNow).toFixed(2) + 'px)' : '';
      style.setProperty('--photo-r', ((12 + (18 * scaleNow - 12) * grown) / Math.max(scaleNow, 0.05)).toFixed(2) + 'px');
      style.setProperty('--photo-tilt', (-3 * smooth(grown)).toFixed(3) + 'deg');
      aboutEdge.now = xNow + photoX * hid * scaleNow;
      return;
    }
    const opened = backOut(pop.k);
    const scale = startScale + (restScale - startScale) * opened;
    const x = startX + (restX - startX) * opened;
    const y = startY + (restY - startY) * opened;
    style.transform = 'translate3d(' + (x - homeX).toFixed(2) + 'px, ' + (y - homeY).toFixed(2) + 'px, 0) scale(' + scale.toFixed(5) + ')';
    // The window opening out around the photo: from the photo's own outline to the full window.
    const reveal = smooth(unit(pop.k / 0.72));
    const keep = 1 - reveal;
    aboutEdge.now = x + photoX * keep * scale;
    const settle = unit(pop.k);
    const corner = (12 + 4 * reveal) / scale; // on screen: the picture's 12px corners easing to the window's 16px
    style.clipPath = 'inset(' + (photoY * keep).toFixed(2) + 'px ' + ((wide - photoX - photoSize) * keep).toFixed(2) + 'px ' + ((tall - photoY - photoSize) * keep).toFixed(2) + 'px ' + (photoX * keep).toFixed(2) + 'px round ' + corner.toFixed(2) + 'px)';
    // The photo's corners, measured on screen: the picture's 12px at first, easing to the
    // photo's usual 18px (in the window's own units) by the time it is open.
    const cornerOnScreen = 12 + (18 * scale - 12) * settle;
    style.setProperty('--photo-r', (cornerOnScreen / Math.max(scale, 0.05)).toFixed(2) + 'px');
    style.setProperty('--photo-tilt', (-3 * smooth(settle)).toFixed(3) + 'deg');
  }

  // The "Motion Graphics" heading becomes the section title. After "Case Studies" has faded
  // and the card is built and decoded, scrolling on lifts the heading out of the card to
  // the spot above it where "Case Studies" sat, centred and at that same size. It follows
  // the scroll both ways. Because the heading inside the card is clipped to the card, a
  // copy does the travelling: the two are swapped where they coincide exactly.
  let reelHeading = null;
  if (reelTitle) {
    reelHeading = document.createElement('p');
    reelHeading.className = 'reel-heading';
    reelHeading.setAttribute('aria-hidden', 'true');
    reelHeading.textContent = reelWords;
    document.body.append(reelHeading);
  }
  let reelHeadingAt = null;
  let reelTitleSpot = { x: 44, y: 30 }; // where the heading sits inside the card
  // The card's name stays inside the card. What happens instead: as soon as "Case Studies"
  // has faded out, while the card is still building, the card (and the folders stacked
  // behind it) moves up from under the now empty title spot to the middle of the screen.
  // Everything after it keeps its timing.
  let reelCentre = 0; // how far up the card has been moved, in px (0 or negative)
  const paintReelHeading = () => {
    if (!reelCard) return;
    if (reelHeading) { reelHeading.style.visibility = 'hidden'; reelHeadingAt = null; }
    if (reelTitle) reelTitle.style.visibility = '';
    // "Case Studies" has fully faded when the build is five eighths done (see paintReel).
    // The card starts moving at that moment and is in the middle as the build completes.
    const lift = playing() && aboutWindow ? smooth(Math.max(0, Math.min(1, (reelBuild - 0.625) / 0.375))) : 0;
    const stick = parseFloat(window.getComputedStyle(reelCard).top) || 134;
    const middle = Math.max(24, (window.innerHeight - reelCard.offsetHeight) / 2);
    reelCentre = Math.min(0, middle - stick) * lift;
    if (!stage.on) reelCard.style.translate = reelCentre ? '0 ' + reelCentre.toFixed(2) + 'px' : '';
  };

  // The first folder's entrance. As the page scrolls, a Mac Dock pops up from the bottom,
  // a pointer runs across After Effects, Photoshop and Figma (each icon swells as it
  // passes), reaches the folder and clicks it. The click and what follows play by
  // themselves: the folder pours out of the Dock icon as a narrow funnel that widens into
  // the full folder (the Mac "genie"), and the Dock drops away. Scrolling back above the
  // click pours it back in.
  const firstFolder = caseFolders[0] || null;
  const DOCK_ICONS = [
    '<svg viewBox="0 0 56 56"><rect width="56" height="56" rx="13" fill="#00005b"/><text x="28" y="37" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="24" fill="#9999ff">Ae</text></svg>',
    '<svg viewBox="0 0 56 56"><rect width="56" height="56" rx="13" fill="#001e36"/><text x="28" y="37" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="24" fill="#31a8ff">Ps</text></svg>',
    '<svg viewBox="0 0 56 56"><rect width="56" height="56" rx="13" fill="#1e1e1e"/><path d="M28 7h-7a7 7 0 0 0 0 14h7z" fill="#f24e1e"/><path d="M28 7h7a7 7 0 0 1 0 14h-7z" fill="#ff7262"/><path d="M28 21h-7a7 7 0 0 0 0 14h7z" fill="#a259ff"/><circle cx="35" cy="28" r="7" fill="#1abcfe"/><path d="M28 35h-7a7 7 0 1 0 7 7z" fill="#0acf83"/></svg>',
    '<svg viewBox="0 0 56 56"><path d="M4 16a6 6 0 0 1 6-6h12a5 5 0 0 1 4 2l2 3h18a6 6 0 0 1 6 6v4H4z" fill="#123f96"/><rect x="4" y="19" width="48" height="29" rx="6" fill="#2a72e0"/><rect x="4" y="34" width="48" height="14" rx="6" fill="#164fb8" opacity=".55"/></svg>'
  ];
  let dock = null;
  let dockPointer = null;
  let genieBox = null;
  let genieStrips = [];
  let genieShade = null;
  let genieKey = '';
  if (firstFolder && pointer) {
    dock = document.createElement('div');
    dock.className = 'dock';
    dock.setAttribute('aria-hidden', 'true');
    dock.innerHTML = DOCK_ICONS.map((icon) => '<span>' + icon + '</span>').join('');
    dockPointer = pointer.cloneNode(true);
    dockPointer.style.zIndex = '22';
    document.body.append(dock, dockPointer);
    genieBox = document.createElement('div');
    genieBox.className = 'genie';
    genieBox.setAttribute('aria-hidden', 'true');
    genieBox.inert = true;
    firstFolder.parentElement.append(genieBox);
  }
  const GENIE_STRIPS = 44;
  const buildGenie = (wide, tall, tabTall) => {
    const key = Math.round(wide) + 'x' + Math.round(tall);
    if (key === genieKey) return;
    genieKey = key;
    genieBox.textContent = '';
    genieShade = document.createElement('div');
    genieShade.className = 'genie-shade';
    genieBox.append(genieShade);
    genieStrips = [];
    const slice = (tall + tabTall) / GENIE_STRIPS;
    for (let i = 0; i < GENIE_STRIPS; i += 1) {
      const strip = document.createElement('div');
      strip.className = 'genie-strip';
      strip.style.width = wide + 'px';
      strip.style.height = slice + 'px';
      const copy = firstFolder.cloneNode(true);
      copy.removeAttribute('id');
      copy.removeAttribute('href');
      copy.style.cssText = 'width:' + wide + 'px;height:' + tall + 'px;top:' + (tabTall - i * slice) + 'px;--in:1';
      for (const image of copy.querySelectorAll('img')) image.loading = 'eager';
      strip.append(copy);
      genieBox.append(strip);
      genieStrips.push(strip);
    }
  };
  // The Dock and the pointer follow the scroll. The click, the pour and the minimise each
  // play by themselves as one quick motion, like a real Mac, so nobody ever stops on an
  // in-between shape. Scrolling down, the click comes when the folder reaches its place.
  // Scrolling back up, the folder stays open until it starts to leave that place (the hero
  // is coming back); then the Dock pops up and the folder minimises into it.
  const dockPop = { skip: false, open: false, seen: false, back: false, wantBack: false, pressed: false, liftAt: -1e9, reelShift: null, reelAt: -1e9, allStacked: false, away: 1, awayWant: 1, returning: false, speed: 0, movedAt: 0, far: 0, doneAt: Infinity, nextDue: 0, lastY: 0, upRun: 0, downRun: 0, titleTop: 0, titleRest: 80, k: 0, up: 0, want: 0, pressAt: -1e9, frame: 0, last: 0 };
  if (window.__probe) window.__probe.dock = dockPop; // temporary, for testing: remove with the other debug hooks
  // Motion rules for this piece. The Dock and the pointer are positions on the scroll: move
  // the page and they move with it at once, both ways, and stop when it stops. Only the
  // folder's warp runs on a clock, and it starts on the very frame the click point is
  // crossed. Entering eases out, leaving eases in, nothing bounces. The warp is a
  // full-screen move, so it gets longer than the usual 300ms (the one stated exception).
  const POUR_MS = 880;      // the folder pouring out (a Mac takes 0.4s; slowed so it can be watched)
  const MINIMISE_MS = 820;  // the folder going back in
  const CLOSE_PAST = 200;   // scrolling back up, the folder is clicked shut when the page is back to here
  const SETTLE = 650;       // the first folder rests this long, fully out, before anything stacks on it
  const REEL_CATCH = 700;   // a Motion Graphics card that was kept waiting takes this long to build
  const FOLLOW = 1000;       // a later folder that was kept waiting takes this long to slide up into the stack
  const DOCK_CATCH_MS = 280; // the Dock's own rise or fall, and the most it may lag behind a very fast scroll
  const CLICK_PAST = 300;   // the click comes this far after the folder's place is reached (matches hero-play.css)
  const REOPEN_GAP = 20;    // scrolling back up, the second click comes this much earlier
  const DOCK_HIDE = 260;    // how far below its place the Dock waits, out of sight
  const TURN_BACK = 24;     // scrolling back up this far, with the folder on its own, minimises it
  const SWAP_MS = 140;      // the cross-fade between the warp and the real folder
  const TURN_DOWN = 40;     // after that, scrolling down this far brings the Dock back to reopen it
  const REACH_MS = 560;     // scrolling back up: the pointer gliding in to the folder icon
  const runDock = () => {
    if (dockPop.frame) return;
    dockPop.last = performance.now();
    const step = (now) => {
      dockPop.frame = 0;
      const dt = Math.min(100, now - dockPop.last);
      dockPop.last = now;
      if (dockPop.up < dockPop.want) dockPop.up = Math.min(dockPop.want, dockPop.up + dt / DOCK_CATCH_MS);
      else if (dockPop.up > dockPop.want) dockPop.up = Math.max(dockPop.want, dockPop.up - dt / DOCK_CATCH_MS);
      // The warp keeps its own steady pace, however fast or slowly the page is scrolled.
      // It starts once the Dock is fully up, with the click.
      if (dockPop.open) {
        if (dockPop.k < 1 && dockPop.up >= 1) {
          if (!dockPop.pressed) { dockPop.pressed = true; dockPop.pressAt = now; }
          dockPop.k = Math.min(1, dockPop.k + dt / POUR_MS);
          if (dockPop.k >= 1) dockPop.doneAt = now;
        }
      } else {
        dockPop.doneAt = Infinity;
        if (dockPop.k > 0 && now >= dockPop.liftAt + PRESS) {
          dockPop.k = Math.max(0, dockPop.k - dt / MINIMISE_MS);
          if (dockPop.k <= 0) dockPop.wantBack = false; // in: the Dock may go
        }
      }
      // The pointer drifts away after the click at its own pace, and comes back with the scroll.
      if (dockPop.away < dockPop.awayWant) dockPop.away = Math.min(dockPop.awayWant, dockPop.away + dt / 800);
      else if (dockPop.away > dockPop.awayWant) dockPop.away = Math.max(dockPop.awayWant, dockPop.away - dt / 320);
      paintPage(); // (everything that waits on this folder is repainted with it)
      const busy = dockPop.up !== dockPop.want || now < dockPop.pressAt + PRESS 
        || (dockPop.open ? (dockPop.k < 1 || now < dockPop.doneAt + SETTLE + 60) : dockPop.k > 0) || now < dockPop.reelAt + REEL_CATCH + 60
        || dockPop.away !== dockPop.awayWant;
      // (paintDock may already have asked for the next frame.)
      if (busy && !dockPop.frame) dockPop.frame = window.requestAnimationFrame(step);
    };
    dockPop.frame = window.requestAnimationFrame(step);
  };
  let dockGap = 110;
  let folderHome = null;    // where the first folder sits in its grid when it is not stuck
  function paintDock() {
    if (!dock) return;
    if (!playing()) {
      dock.style.visibility = dockPointer.style.visibility = 'hidden';
      genieBox.classList.remove('is-on');
      firstFolder.style.visibility = '';
      dockPop.open = dockPop.seen = dockPop.back = false;
      dockPop.k = dockPop.up = dockPop.want = dockPop.far = 0;
      dockPop.wantBack = dockPop.pressed = dockPop.returning = false;
      dockPop.reelShift = null;
      dockPop.allStacked = false;
      dockPop.doneAt = Infinity;
      return;
    }
    const now = performance.now();
    const viewWide = window.innerWidth;
    const viewTall = window.innerHeight;
    const grid = firstFolder.parentElement;
    const gridStyle = window.getComputedStyle(grid);
    const tabTall = parseFloat(gridStyle.getPropertyValue('--tab-h')) || 56;
    const stackTop = parseFloat(gridStyle.getPropertyValue('--stack-top')) || 134;
    const card = firstFolder.getBoundingClientRect();
    const top = card.top - tabTall - (parseFloat(firstFolder.style.getPropertyValue('--late')) || 0); // the top of the folder's tab, where the page has it
    const left = card.left;
    const wide = card.width;
    const tall = card.height + tabTall;
    // Where the folder would be if it did not stick: this keeps counting after it has
    // stuck, which is what the click and the pour are measured against.
    const gridTop = grid.getBoundingClientRect().top;
    if (top > stackTop + 2) folderHome = top - gridTop;
    else if (folderHome === null) folderHome = (parseFloat(gridStyle.paddingTop) || 0) + tabTall;
    const toGo = gridTop + folderHome - stackTop; // above zero: still rising; below: stuck, and scrolling on
    const past = -toGo; // how far the page has scrolled on since the folder reached its place
    if (!dockPop.seen) {
      // The page opened already past this point: the folder is simply there.
      dockPop.seen = true;
      dockPop.lastY = window.scrollY;
      if (past >= CLICK_PAST) { dockPop.open = true; dockPop.k = 1; dockPop.doneAt = -1e9; }
    }
    // Which way the page is being scrolled, and how far in that direction.
    const moved = window.scrollY - dockPop.lastY;
    dockPop.lastY = window.scrollY;
    if (moved > 0) { dockPop.downRun += moved; dockPop.upRun = 0; }
    else if (moved < 0) { dockPop.upRun -= moved; dockPop.downRun = 0; }
    // How fast it is being scrolled (px a second, smoothed), to judge how much time is left.
    if (moved !== 0) {
      const lapse = Math.max(8, Math.min(120, now - dockPop.movedAt));
      dockPop.speed += (Math.abs(moved) / lapse * 1000 - dockPop.speed) * 0.35;
      dockPop.movedAt = now;
    } else if (now - dockPop.movedAt > 140) dockPop.speed = 0;

    if (dockPop.skip) {
      // Carried here by the nav bar: the folder is simply out, with no Dock and no pointer,
      // until the page has come to rest past the click point.
      dockPop.open = true;
      dockPop.back = dockPop.returning = false;
      dockPop.k = dockPop.away = dockPop.awayWant = 1;
      dockPop.doneAt = -1e9;
      dockPop.downRun = dockPop.upRun = 0;
    } else if (!dockPop.open) {
      // The click. On the first way down it comes at a fixed point. After the folder has
      // been minimised, it comes when the page is scrolled down to that point again.
      if (past >= CLICK_PAST && (!dockPop.back || dockPop.downRun >= TURN_DOWN)) { dockPop.open = true; dockPop.pressed = false; dockPop.away = 0; dockPop.returning = false; }
    } else if (past < CLOSE_PAST || (dockPop.k >= 1 && dockPop.nextDue <= 0 && dockPop.upRun >= TURN_BACK
        && (past + viewTall - 230 - stackTop) / Math.max(1, dockPop.speed) < (PRESS + MINIMISE_MS) / 1000 + 0.06)) {
      // (Scrolled up so fast that waiting for that point would leave too little time for the
      // folder to go in before the page carries it down to the Dock? Then it starts now.)
      // Scrolling back up, in stages that follow the scroll: first the Dock rises, then the
      // pointer comes back to the folder icon, and here it clicks and the folder minimises.
      dockPop.open = false;
      dockPop.back = true;
      dockPop.pressed = false;
      dockPop.liftAt = dockPop.pressAt = now;
    }
    if (dockPop.back && !dockPop.open && dockPop.k <= 0) {
      // Minimised. The Dock is gone until the page is scrolled down towards the click again.
      if (dockPop.upRun >= TURN_DOWN) dockPop.wantBack = false;
      else if (dockPop.downRun >= TURN_DOWN && past >= CLICK_PAST - 260) dockPop.wantBack = true;
    }
    // The warp always plays at its own steady pace. Nothing is pinned and nothing waits: the
    // folder is warped wherever the page has it, so on a fast scroll back up it simply
    // travels down with the page while it pours into the Dock, and the title and the hero
    // scroll as they always do. (The folder is below the hero on the page, so it can never
    // be on top of it.) Once its place has all but reached the Dock there is nothing left
    // to pour: it is in.
    // (Flung faster than even that allows, it finishes over the last stretch rather than vanishing.)
    if (!dockPop.open && dockPop.k > 0) dockPop.k = Math.min(dockPop.k, unit((viewTall - 230 - top) / 300));
    // The pointer after the click: gone, until the page is scrolled back up towards the click.
    if (dockPop.open && dockPop.k >= 1) {
      if (dockPop.upRun >= 8 && past < CLICK_PAST + 140) dockPop.returning = true;
      else if (dockPop.downRun >= 8) dockPop.returning = false;
    }
    dockPop.awayWant = dockPop.open ? (dockPop.returning ? smooth(unit((past - CLOSE_PAST - 10) / 110)) : 1) : 0;
    const k = dockPop.k;
    const press = now < dockPop.pressAt + PRESS ? Math.sin(Math.PI * (now - dockPop.pressAt) / PRESS) : 0;

    // Everything waits for the "Case Studies" title: the Dock starts only once the title is
    // fully in. (The folder sits a fixed distance below the title until the title sticks.)
    if (caseTitle && dockPop.titleTop > 100) dockGap = gridTop + folderHome - dockPop.titleTop;
    const start = Math.max(260, Math.min(560, 0.72 * viewTall + dockGap - stackTop - 70));
    const along = start - toGo;           // scrolling done since the Dock began
    const whole = start + CLICK_PAST;     // scrolling from the Dock beginning to the click
    if (along <= 0 && dockPop.k <= 0) { dockPop.back = dockPop.wantBack = false; dockPop.far = 0; } // back above it all: the next visit starts fresh
    // The pointer only ever tours the icons going down. Scroll back up part-way and it
    // waits where it had got to; it never walks back across them.
    dockPop.far = Math.max(dockPop.far, along);
    const toured = dockPop.far;

    // The Dock. Its place is read straight off the scroll: it rises over the first 170px,
    // stays while the pointer works and the folder comes out, and sinks over 130px once
    // the page has moved on. Scroll back and the same happens in reverse.
    const easeOut = (t) => 1 - (1 - t) ** 3;
    const easeIn = (t) => t ** 3;
    const closing = !dockPop.open && k > 0;
    const rise = easeOut(unit(along / 150));
    const drop = easeIn(unit((past - CLICK_PAST - 110) / 130));
    // Up whenever the folder is coming out or going in. Otherwise: on the first way down it
    // follows the scroll; once the folder has been minimised it stays away until wanted.
    dockPop.want = dockPop.skip ? 0 : (dockPop.open && k < 1) || closing ? 1 : dockPop.open ? 1 - drop : dockPop.back ? (dockPop.wantBack ? 1 : 0) : rise;
    if (dockPop.skip) dockPop.up = 0;

    const busy = dockPop.want !== dockPop.up || now < dockPop.pressAt + PRESS || (dockPop.open ? k < 1 : k > 0) || dockPop.away !== dockPop.awayWant;
    if (busy) runDock();
    const up = dockPop.up;
    dock.style.visibility = up > 0 ? 'visible' : 'hidden';
    dock.style.transform = 'translate3d(-50%, ' + ((1 - up) * DOCK_HIDE).toFixed(2) + 'px, 0)';
    const icons = dock.children;
    const ICON = 76, GAP = 32;
    const iconY = viewTall - 88 - 14 - ICON / 2; // (the Dock floats 88px above the bottom edge)
    const iconX = (i) => viewWide / 2 + (i - 1.5) * (ICON + GAP);

    // The pointer. Going down it is read straight off the scroll: in from the lower left,
    // along the row of icons to the folder, then the click. After the click it takes its
    // time leaving, drifting off to the lower right while the folder comes out. Coming
    // back up it glides in from the lower right straight to the folder icon (no tour of
    // the others), clicks, and afterwards leaves with the Dock.
    const arrive = dockPop.open || dockPop.back ? 1 : smooth(unit((toured - 110) / 150));
    const across = dockPop.open || dockPop.back ? 1 : smooth(unit((toured - 260) / Math.max(120, whole - 310)));
    const riding = dockPop.back || toured > along + 1; // with the Dock as it rises or leaves, not arriving on its own
    const away = closing ? 0 : dockPop.open ? smooth(dockPop.away) : 0;
    const pointX = (arrive < 1 ? iconX(0) - 300 + 300 * arrive : iconX(0) + (iconX(3) - iconX(0)) * across) + away * 280;
    const pointY = (arrive < 1 ? viewTall + 40 + (iconY - 8 - viewTall - 40) * arrive : iconY - 8) + away * 220 + (1 - up) * DOCK_HIDE * (riding ? 1 : 0);
    dockPointer.style.visibility = arrive > 0 && away < 1 && up > 0 ? 'visible' : 'hidden';
    dockPointer.classList.toggle('is-hand', across > 0.9 && away < 0.2);
    dockPointer.style.transform = 'translate3d(' + (pointX - 7).toFixed(2) + 'px, ' + (pointY - 3).toFixed(2) + 'px, 0) scale(' + (1 - 0.14 * press).toFixed(4) + ')';
    // Each icon swells as the pointer passes over it and, like the real Dock, pushes its
    // neighbours aside so they never overlap. (Moved and scaled with transforms only.)
    const power = up * arrive * (1 - away);
    const sizes = [];
    let row = (icons.length - 1) * GAP;
    for (let i = 0; i < icons.length; i += 1) {
      const far = (pointX - iconX(i)) / (ICON + GAP);
      sizes[i] = 1 + 0.42 * power * Math.exp(-far * far);
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

    // Get the strips ready while the Dock is still coming up, so the click never stutters.
    if (up > 0) buildGenie(wide, card.height, tabTall);

    // The folder. Not there before the click; the real one once it is fully out. The warp
    // is a copy drawn on top, and the two are cross-faded where they are identical (fully
    // out), so there is no cut when one takes over from the other: the real folder fades in
    // under the copy as it lands, and the copy fades in over it as the minimise begins.
    const real = k >= 1;
    const copy = k > 0 && k < 1;
    firstFolder.style.visibility = real ? '' : 'hidden';
    genieBox.classList.toggle('is-on', copy);
    if (!copy) return;
    const at = top; // the warp is drawn wherever the page has the folder
    // The folder's soft shadow, which the copy cannot carry: it grows in under the folder
    // as it settles and is exactly the real folder's shadow at the moment of the swap.
    if (genieShade) {
      genieShade.style.transform = 'translate3d(' + left.toFixed(1) + 'px, ' + (at + tabTall).toFixed(1) + 'px, 0)';
      genieShade.style.width = wide + 'px';
      genieShade.style.height = card.height + 'px';
      genieShade.style.opacity = real ? '0' : unit((k - 0.72) / 0.28).toFixed(3);
    }
    // The Mac genie, as the Mac does it. Going in: the folder's sides bend into a funnel
    // that narrows to the Dock icon, then the whole folder slides down the funnel and
    // into the icon. Coming out is the same thing backwards: it slides up out of the icon
    // through the funnel, top first, and then the funnel straightens into the folder.
    // Matched frame by frame to a real Mac (the user's reference recording). Opening has
    // two halves. First the folder slides up out of the icon through a funnel: its top
    // edge rises and widens while its bottom stays pinched in the icon. Then, with the top
    // already in place, the funnel straightens: the two bottom corners travel out from
    // the icon to where they belong. Minimising is the same film backwards: the bottom
    // corners pinch into the icon, then the folder slides down the funnel into it.
    const fromX = iconX(3);
    const mouth = iconY;                            // the icon the folder comes out of
    const gone = (1 - k) ** 1.25;                    // 0 = fully out, 1 = fully in the Dock; eased so
                                                    // it leaves the icon fast and settles gently
    // The two halves overlap and each eases in and out, so one flows into the other with
    // no change of gear in between.
    const ease = (t) => t * t * (3 - 2 * t);
    const bend = ease(unit(gone / 0.62));           // how pinched the bottom is
    const slide = ease(unit((gone - 0.3) / 0.7));   // how far down the funnel it has slid
    const slice = tall / GENIE_STRIPS;
    // Pinched, the folder's bottom edge is in the icon, so its height is the gap from its
    // top to the icon (a Mac stretches or squeezes a window the same way); straightened,
    // it is its own height again.
    const scale = 1 + ((mouth - at) / tall - 1) * bend;
    const bottom = at + tall * scale;              // where the folder's bottom edge is now
    const fall = slide * (mouth - at);
    const yOf = (i) => Math.min(bottom, at + i * slice * scale + fall);
    const edges = (y) => {
      const f = smooth(unit((y - at) / (bottom - at))) * bend;
      return [left + (fromX - 26 - left) * f, left + wide + (fromX + 26 - left - wide) * f];
    };
    // Each strip is bent into a trapezoid whose top and bottom follow the funnel exactly
    // (a perspective transform), so the picture and words flow across the strips in one
    // continuous, smooth warp with no steps between them.
    let y0 = yOf(0);
    let e0 = edges(y0);
    for (let i = 0; i < GENIE_STRIPS; i += 1) {
      const y1 = yOf(i + 1);
      const e1 = edges(y1);
      const yb = y1 + 0.7; // a hair of overlap, so no seam shows between strips
      const x0 = e0[0], x1 = e0[1], x2 = e1[1], x3 = e1[0];
      // Square-to-quad mapping; the top and bottom edges are level, which leaves one
      // perspective term (how much narrower or wider the bottom is than the top).
      const tilt = (x0 - x1 + x2 - x3) / (x3 - x2);
      genieStrips[i].style.transform = 'matrix3d(' + [
        (x1 - x0) / wide, 0, 0, 0,
        (x3 - x0 + tilt * x3) / slice, (yb - y0 + tilt * yb) / slice, 0, tilt / slice,
        0, 0, 1, 0,
        x0, y0, 0, 1
      ].map((n) => n.toFixed(7)).join(',') + ')';
      y0 = y1;
      e0 = e1;
    }
  }

  // Stage Manager. When the pointer clicks the About Me notification, the Motion Graphics
  // card is set aside the way a Mac's Stage Manager does it: it shrinks to a small
  // thumbnail at the left edge, turned a little in perspective, while About Me opens. Only
  // the card is shown there (the folders behind it are simply not shown while it is aside).
  // Scrolling on down through About Me, the thumbnail slides out to the left, off the
  // screen. Scrolling back above the click sets everything back in place.
  // It runs on its own clock (triggered by the same click as the About Me window), eased in
  // and out, and only moves, scales and turns the card; nothing here feeds into any of the
  // scroll-driven motion.
  const STAGE_IN_MS = 780;
  const STAGE_OUT_MS = 660;
  const STAGE_WIDE = 360;  // the most the tile's width may be before it is turned
  const STAGE_GAP = 24;    // the gap kept between the tile and the About Me window
  const STAGE_TURN = 26;   // degrees
  const STAGE_LEAVE = 380; // scrolling through About Me over which the thumbnail slides away
  const stage = { k: 0, frame: 0, last: 0, done: new Map(), on: false, right: null };
  const stageClear = () => {
    if (!stage.on) return;
    stage.on = false;
    reelCard.style.scale = reelCard.style.transform = reelCard.style.transformOrigin = reelCard.style.pointerEvents = '';
    reelCard.style.translate = reelCentre ? '0 ' + reelCentre.toFixed(2) + 'px' : '';
    for (const folder of caseFolders) folder.style.opacity = '';
    if (reelHeading) reelHeading.style.translate = reelHeading.style.scale = reelHeading.style.opacity = '';
    stage.done.clear();
    stage.from = stage.headFrom = null;
    stage.right = null;
    stage.seen = 0;
  };
  const runStage = () => {
    if (stage.frame) return;
    stage.last = performance.now();
    const step = (now) => {
      stage.frame = 0;
      const dt = Math.min(100, now - stage.last);
      stage.last = now;
      stage.k = pop.on ? Math.min(1, stage.k + dt / STAGE_IN_MS) : Math.max(0, stage.k - dt / STAGE_OUT_MS);
      paintAbout(); // (About Me opens out beside the card as the card clears)
      paintStage();
      paintAbout();
      if (stage.k !== (pop.on ? 1 : 0) && !stage.frame) stage.frame = window.requestAnimationFrame(step);
    };
    stage.frame = window.requestAnimationFrame(step);
  };
  function paintStage() {
    if (!reelCard || !aboutWindow) return;
    if (!playing()) { stage.k = 0; stageClear(); return; }
    if (stage.k !== (pop.on ? 1 : 0)) runStage();
    // Setting it aside, it starts briskly and settles gently: that clears the way at once,
    // so About Me can start growing beside it straight away. Coming back, a gentle start and stop.
    const eased = pop.on ? 1 - (1 - stage.k) ** 3 : (stage.k < 0.5 ? 2 * stage.k * stage.k : 1 - (2 - 2 * stage.k) ** 2 / 2);
    if (eased <= 0) { stageClear(); return; }
    stage.on = true;
    const viewTall = window.innerHeight;
    // Where the page has the card right now (what was last applied to it undone).
    const now = performance.now();
    const lapse = Math.min(100, now - (stage.seen || now));
    stage.seen = now;
    const box = reelCard.getBoundingClientRect();
    const was = stage.done.get(reelCard) || { x: 0, y: reelCentre };
    const card = { left: box.left - was.x, top: box.top - was.y, width: reelCard.offsetWidth, height: reelCard.offsetHeight };
    // It shrinks from the spot on the screen where it was when it was set aside. (Not from
    // wherever the page then carries it: that made it drift up off the top and come back.)
    // On the way back it homes in on wherever the page has it by then.
    const home = (from, x, y) => {
      if (!from) return { x, y };
      if (!pop.on) { const pull = 1 - Math.exp(-lapse / 110); from.x += (x - from.x) * pull; from.y += (y - from.y) * pull; }
      return from;
    };
    stage.from = home(stage.from, card.left, card.top + reelCentre); // (where it is shown: moved up to the middle)
    // Turned about its left edge, the card looks narrower: this is how wide it shows on
    // screen at a given size and turn.
    const FAR = 2600;
    const turn = STAGE_TURN * smooth(unit((eased - 0.4) / 0.6)); // (it turns once its title is back inside it)
    const shown = (size, degrees) => {
      const a = degrees * Math.PI / 180;
      return card.width * size * Math.cos(a) * FAR / (FAR + card.width * Math.sin(a));
    };
    // The tile is sized to sit in the space left of the About Me window, a small gap away.
    const room = aboutEdge ? aboutEdge.rest - STAGE_GAP - 34 : STAGE_WIDE;
    const small = Math.min(STAGE_WIDE / card.width, Math.max(120, room) / shown(1, STAGE_TURN));
    // Scrolling on through About Me, the tile slides away to the left.
    const aboutTop = aboutWindow.parentElement.getBoundingClientRect().top + aboutWindow.offsetTop;
    const leaving = smooth(unit((ABOUT_FLOAT - aboutTop) / STAGE_LEAVE));
    const endX = 34 - leaving * (STAGE_WIDE + 120);
    const endY = viewTall / 2 - card.height * small / 2;
    const at = stage.from.x + (endX - stage.from.x) * eased; // its left edge on screen
    const size = 1 + (small - 1) * eased;
    // Side by side: the card shrinks at its own steady pace, and About Me opens out to
    // its right only as far as the card has cleared (paintAbout reads this edge).
    stage.right = at + shown(size, turn);
    const x = at - card.left;
    const y = stage.from.y + (endY - stage.from.y) * eased - card.top;
    reelCard.style.transformOrigin = '0 0';
    reelCard.style.translate = x.toFixed(2) + 'px ' + y.toFixed(2) + 'px';
    reelCard.style.scale = size.toFixed(5);
    // Turned about its left edge, like a Stage Manager thumbnail (far edge further away).
    const half = (card.height / 2).toFixed(1);
    reelCard.style.transform = 'translate3d(0, ' + half + 'px, 0) perspective(' + FAR + 'px) rotateY(' + turn.toFixed(2) + 'deg) translate3d(0, -' + half + 'px, 0)';
    reelCard.style.pointerEvents = 'none';
    stage.done.set(reelCard, { x, y, s: size });
    // The folders are directly behind the card, hidden by it; they stay out of sight while it is aside.
    for (const folder of caseFolders) folder.style.opacity = '0';
    // The heading goes back where it came from: it travels down into the card, to the
    // title's own place, and is the card's title again by the time the card turns.
    if (reelHeading && reelHeadingAt) {
      stage.headFrom = home(stage.headFrom, reelHeadingAt.x, reelHeadingAt.y);
      const back = smooth(unit(eased / 0.4));
      const grow = 1 + (size / reelHeadingAt.s - 1) * back;
      const px = stage.headFrom.x + (card.left + x + reelTitleSpot.x * size - stage.headFrom.x) * back;
      const py = stage.headFrom.y + (card.top + y + reelTitleSpot.y * size - stage.headFrom.y) * back;
      reelHeading.style.translate = (px - grow * reelHeadingAt.x).toFixed(2) + 'px ' + (py - grow * reelHeadingAt.y).toFixed(2) + 'px';
      reelHeading.style.scale = grow.toFixed(5);
      // Dark above the card's top edge, white once inside it.
      reelHeading.style.setProperty('--edge', ((card.top + y - py) / (grow * reelHeadingAt.s)).toFixed(2) + 'px');
      reelHeading.style.opacity = back >= 1 ? '0' : '';
      if (back >= 1) reelTitle.style.visibility = 'visible';
    }
  }

  // "Motion Graphics" in the nav bar goes straight to the finished card. The page is
  // carried there in one go, so the things on the way (the Dock, the folders) are simply
  // in place when it arrives instead of each playing its entrance.
  const reelLink = document.querySelector('.site-nav a[href="#motion-graphics"]');
  if (reelLink && reel && reelCard) {
    reelLink.addEventListener('click', (event) => {
      if (!playing()) return;
      event.preventDefault();
      dockPop.skip = true;
      // Back to normal as soon as the page has arrived (or the visitor scrolls for themselves).
      const arrived = () => { if (!dockPop.skip) return; dockPop.skip = false; queuePage(); };
      window.addEventListener('scrollend', arrived, { once: true });
      window.addEventListener('wheel', arrived, { once: true, passive: true });
      window.setTimeout(arrived, 3200);
      const stick = parseFloat(window.getComputedStyle(reelCard).top) || 134;
      window.scrollTo({ top: reel.getBoundingClientRect().top + window.scrollY - stick + 0.64 * window.innerHeight + 170, behavior: 'smooth' });
      queuePage();
    });
  }

  let pageFrame = 0;
  let pointerX = -999;
  let pointerY = -999;
  const paintPage = () => {
    pageFrame = 0;
    paintArrivals();
    paintDock();
    paintReel();
    paintReelHeading();
    paintAbout();
    paintStage();
    if (glow) {
      glow.style.setProperty('--mx', pointerX + 'px');
      glow.style.setProperty('--my', pointerY + 'px');
      glow.style.setProperty('--sy', (window.scrollY % 24) + 'px');
    }
  };
  const queuePage = () => { if (!pageFrame) pageFrame = window.requestAnimationFrame(paintPage); };
  window.addEventListener('scroll', queuePage, { passive: true });

  // A top speed for scrolling. However hard the wheel or trackpad is flicked, the page
  // moves at most this fast, so the scroll-driven pieces above always get the time they
  // need and the site never has to race to keep up. Below the limit it follows the hand
  // as usual. (Keyboard, the scrollbar and the nav links are left alone.)
  const MAX_SCROLL = 1200; // px a second
  const wheel = { target: null, at: 0, frame: 0, last: 0 };
  const wheelStep = (now) => {
    wheel.frame = 0;
    if (wheel.target === null) return;
    const dt = Math.min(50, now - wheel.last) / 1000;
    wheel.last = now;
    const left = wheel.target - wheel.at;
    // Arrived: rest exactly on the spot (a whole pixel), so the page never sits between two
    // positions and trembles.
    if (Math.abs(left) < 0.75) { window.scrollTo({ top: wheel.target, behavior: 'instant' }); wheel.target = null; return; }
    // Ease towards where the hand has asked for, never faster than the limit.
    // (A short catch-up, so it follows the hand closely and never feels heavy.)
    const want = left * (1 - Math.exp(-dt / 0.032));
    const most = MAX_SCROLL * dt;
    wheel.at += Math.max(-most, Math.min(most, want));
    window.scrollTo({ top: wheel.at, behavior: 'instant' });
    wheel.frame = window.requestAnimationFrame(wheelStep);
  };
  window.addEventListener('wheel', (event) => {
    if (!playing() || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    const line = event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? window.innerHeight : 1;
    const end = document.documentElement.scrollHeight - window.innerHeight;
    // Already at the very top and still scrolling up (or at the very bottom, scrolling
    // down): there is nowhere to go, so nothing at all happens.
    if (wheel.target === null && ((event.deltaY < 0 && window.scrollY <= 0.5) || (event.deltaY > 0 && window.scrollY >= end - 0.5))) {
      if (window.scrollY > 0 && window.scrollY <= 0.5) window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    if (wheel.target === null) wheel.at = wheel.target = window.scrollY;
    // No backlog: at most half a second of travel is ever queued, so it stops when the hand stops.
    const reach = MAX_SCROLL * 0.5;
    wheel.target = Math.round(Math.max(0, Math.min(end, Math.max(wheel.at - reach, Math.min(wheel.at + reach, wheel.target + event.deltaY * line)))));
    if (!wheel.frame) { wheel.last = performance.now(); wheel.frame = window.requestAnimationFrame(wheelStep); }
  }, { passive: false });
  window.addEventListener('resize', queuePage);
  // The first measure can happen before fonts and images have set the final positions,
  // so measure again whenever the page finishes loading or its layout changes size.
  window.addEventListener('load', queuePage);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(queuePage);
  if ('ResizeObserver' in window) new ResizeObserver(queuePage).observe(document.body);
  modeSwitch.addEventListener('click', queuePage);
  if (glow) {
    window.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      glow.classList.add('is-on');
      queuePage();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => glow.classList.remove('is-on'));
  }
  queuePage();
})();

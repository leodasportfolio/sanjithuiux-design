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
  const HELD_SCALE = 2;
  const FREE_SCALE = 1.6;
  const SLING_SPEED = 1150;
  const GRAVITY = 330;
  const AIR_DRAG = 1.5;
  const WALL_BOUNCE = 0.55;
  const FLOOR_BOUNCE = 0.4;
  const BOX_BOUNCE = 1.15;
  const MAX_SPEED = 1500;
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
  const bandGroup = hero.querySelector('.pen-path .sling');
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
    el.addEventListener('pointerdown', grabTile);
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

      // The orange box is a trampoline: it throws him back harder and flexes.
      const boxed = bounceOffRect(boxRect(), BOX_BOUNCE, dt, (nx, ny, closing) => {
        feelBox('bounce');
        if (box.held) return;
        box.vel.x -= nx * closing * 0.35;
        box.vel.y -= ny * closing * 0.35;
        springBox();
      });
      if (boxed === 'shove' && box.held) feelBox(tile.shoved > 650 ? 'slam' : 'push');
      const nav = navRect();
      if (nav && bounceOffRect(nav, WALL_BOUNCE, dt)) {
        // Wedged between the nav bar and the box: squeeze out sideways.
        const rect = boxRect();
        const reachNow = tileReach();
        if (tile.x + reachNow > rect.left && tile.x - reachNow < rect.right && tile.y + reachNow > rect.top && tile.y - reachNow < rect.bottom) {
          const way = tile.x < (rect.left + rect.right) / 2 ? -1 : 1;
          tile.x += way * 520 * dt;
          tile.vx = way * 260;
          tile.vy = 0;
        }
      }

      // The reset button is solid too, and wobbles when he hits it.
      const resetBox = resetRect();
      if (resetBox) bounceOffRect(resetBox, WALL_BOUNCE, dt, wobbleReset);

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
    if (!tile.held) {
      const rect = boxRect();
      const reachNow = tileReach();
      if (tile.x + reachNow > rect.left + 1 && tile.x - reachNow < rect.right - 1 && tile.y + reachNow > rect.top + 1 && tile.y - reachNow < rect.bottom - 1) {
        // Pinned between the box and the floor or a wall: squeeze out sideways.
        const way = tile.x < (rect.left + rect.right) / 2 ? -1 : 1;
        const room = way < 0 ? rect.left - reachNow > reachNow : rect.right + reachNow < width - reachNow;
        const go = room ? way : -way;
        tile.x += go * 620 * dt;
        tile.vx = go * 220;
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

  function grabTile(event) {
    if (!playing() || event.button !== 0) return;
    event.preventDefault();
    if (!tile.el) makeTile();
    const point = heroPoint(event);
    tile.held = true;
    tile.hits = 0;
    tile.vx = tile.vy = 0;
    tile.carryX = tile.carryY = 0;
    tile.lean = 0;
    tile.angle = ((tile.angle + 180) % 360 + 360) % 360 - 180;
    tile.grabX = point.x - tile.x;
    tile.grabY = point.y - tile.y;
    tile.aimX = tile.shownX = tile.x;
    tile.aimY = tile.shownY = tile.y;
    tile.blocked = tile.catching = false;
    tile.trail = [{ t: performance.now(), x: tile.x, y: tile.y }];
    tile.el.classList.add('is-held');
    document.documentElement.classList.add('is-dragging');
    syncReset();
    loadFaces();
    onGrab();

    const drag = (move) => {
      const at = heroPoint(move);
      const reach = tileReach();
      const before = tile.aimX;
      let wantX = at.x - tile.grabX;
      let wantY = at.y - tile.grabY;
      if (bandGroup) {
        const anchor = bandFit();
        const away = Math.hypot(wantX - anchor.x, wantY - anchor.y);
        if (!band.hooked && away < BAND_REACH) {
          // Carried onto the handle: he is hooked.
          band.hooked = true;
          window.cancelAnimationFrame(band.frame);
          band.frame = 0;
          band.velX = band.velY = 0;
          bandGroup.classList.add('is-loaded');
        }
        if (band.hooked) {
          // He goes only as far as the band stretches, however far the cursor goes.
          const pull = Math.min(away, BAND_PULL);
          wantX = anchor.x + (away ? (wantX - anchor.x) / away * pull : 0);
          wantY = anchor.y + (away ? (wantY - anchor.y) / away * pull : 0);
        } else bandGroup.classList.toggle('is-ready', away < BAND_NEAR);
        tile.aimX = Math.min(hero.clientWidth - reach, Math.max(reach, wantX));
        tile.aimY = Math.min(hero.clientHeight - reach, Math.max(reach, wantY));
        if (band.hooked) {
          band.offX = tile.aimX - anchor.x;
          band.offY = tile.aimY - anchor.y;
          band.pull = Math.min(1, Math.hypot(band.offX, band.offY) / BAND_PULL);
          drawBand();
        }
      } else {
        tile.aimX = Math.min(hero.clientWidth - reach, Math.max(reach, wantX));
        tile.aimY = Math.min(hero.clientHeight - reach, Math.max(reach, wantY));
      }
      tile.x = tile.aimX;
      tile.y = tile.aimY;
      // He tips a little toward the way he is being carried.
      if (!tile.blocked && !band.hooked) tile.lean = Math.max(-16, Math.min(16, tile.lean + (tile.x - before) * 0.5));
      const prior = tile.trail[tile.trail.length - 1];
      const since = Math.max(0.008, (performance.now() - prior.t) / 1000);
      tile.carryX = (tile.x - prior.x) / since;
      tile.carryY = (tile.y - prior.y) / since;
      // Held off, he is not really travelling however fast the cursor moves.
      if (tile.blocked) { tile.carryX *= 0.25; tile.carryY *= 0.25; }
      const pace = Math.hypot(tile.carryX, tile.carryY);
      if (pace > 300) {
        // A sharp reversal of direction is one beat of a shake, whichever way it goes.
        const dirX = tile.carryX / pace;
        const dirY = tile.carryY / pace;
        if (mood.dirX * dirX + mood.dirY * dirY < -0.3) mood.flips.push(performance.now());
        mood.dirX = dirX;
        mood.dirY = dirY;
      }
      tile.trail.push({ t: performance.now(), x: tile.x, y: tile.y });
      if (tile.trail.length > 8) tile.trail.shift();
      if (!band.hooked) slingTile();
    };
    const release = (fired) => {
      window.removeEventListener('pointermove', drag);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      tile.held = false;
      tile.release = null;
      tile.blocked = tile.catching = false;
      document.documentElement.classList.remove('is-dragging');
      // He was sent home while still in the hand (reset or a mode switch): nothing to let go of.
      if (!tile.el) { dropBand(); return; }
      tile.el.classList.remove('is-held');
      const stretch = Math.hypot(band.offX, band.offY);
      const slung = band.hooked && fired !== true && stretch >= BAND_MIN;
      if (slung) {
        // The slingshot lets go: he flies the opposite way to the pull, harder the further it was.
        const speed = 380 + (stretch - BAND_MIN) / (BAND_PULL - BAND_MIN) * 1070;
        tile.vx = -band.offX / stretch * speed;
        tile.vy = -band.offY / stretch * speed;
        tile.spin = Math.max(-170, Math.min(170, tile.vx * 0.12));
      } else if (fired !== true) {
        const now = performance.now();
        const from = tile.trail.find((point) => now - point.t < 110) || tile.trail[tile.trail.length - 1];
        const span = Math.max(0.016, (now - from.t) / 1000);
        tile.vx = (tile.x - from.x) / span;
        tile.vy = (tile.y - from.y) / span;
        tile.spin = Math.max(-170, Math.min(170, tile.vx * 0.12));
        if (tile.sling) { tile.sling = ''; springBox(); }
      }
      dropBand();
      onRelease(fired === true || slung);
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
    el.querySelector('img').src = face ? 'assets/faces/' + face + '.jpg?v=2' : portraitImg.currentSrc || portraitImg.src;
    el.classList.remove('is-giggling');
    tile.el = null;
    const heroRect = hero.getBoundingClientRect();
    const rect = portraitImg.getBoundingClientRect();
    const size = portraitImg.offsetWidth;
    el.style.transition = 'transform .65s cubic-bezier(.3, 1, .3, 1), width .65s cubic-bezier(.3, 1, .3, 1), height .65s cubic-bezier(.3, 1, .3, 1), margin .65s cubic-bezier(.3, 1, .3, 1), border-radius .65s ease';
    el.style.width = el.style.height = size + 'px';
    el.style.margin = -size / 2 + 'px 0 0 ' + -size / 2 + 'px';
    el.style.borderRadius = size * 0.146 + 'px';
    el.style.transform = 'translate(' + (rect.left + rect.width / 2 - heroRect.left) + 'px, ' + (rect.top + rect.height / 2 - heroRect.top) + 'px) rotate(4deg)';
    const finish = () => { el.remove(); root.classList.remove('is-out'); };
    runWorld();
    el.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(finish, 800);
  };

  // ---------- His face ----------
  // He wears one drawing at a time, chosen from what is actually happening to him, and
  // each one stays on for at least a second so it can be read. He remembers how he has
  // been treated: after rough handling the next grab frightens him; after gentle
  // handling he trusts the hand and smiles.
  const FACES = ['calm', 'smile', 'startled', 'scared', 'panic', 'dizzy', 'tired', 'queasy', 'ouch', 'coffee', 'nervous', 'relieved', 'asleep', 'annoyed', 'wave', 'refreshed'];
  const MIN_SHOW = 1000;
  const ROUGH_CARRY = 700;
  const THROW_SPEED = 350;
  const mood = {
    face: '', changedAt: 0, was: 'home', wary: true, grabAt: 0, grabX: 0, grabY: 0,
    roughHold: false, flight: false, landedAt: 0, rough: false, crashes: 0, gentleRuns: 0,
    lastTouch: 0, clicks: [], loaded: false, slowSince: 0, activeAt: 0,
    contacts: {}, reacted: {}, felt: {}, stung: {}, gentleFace: '', gentleAt: 0, gentleUntil: 0, hurtAt: 0, flightHit: false, knocked: false, boxAt: 0,
    holdUntil: 0, flips: [], dirX: 0, dirY: 0, shake: 0, shakeAt: 0, shook: false, sick: false, flightLock: false, tick: 0,
  };
  const placeBubble = () => {};
  const hush = () => {};

  const loadFaces = () => {
    if (mood.loaded) return;
    mood.loaded = true;
    FACES.forEach((name) => { new Image().src = 'assets/faces/' + name + '.jpg?v=2'; });
  };

  // Wear a face. Unless `now` is forced, the current face is left on until it has been
  // showing for at least a second.
  const wear = (face, force) => {
    if (!tile.el || mood.face === face) return false;
    const now = performance.now();
    if (!force && now - mood.changedAt < MIN_SHOW) return false;
    mood.face = face;
    mood.changedAt = now;
    tile.el.querySelector('img').src = 'assets/faces/' + face + '.jpg?v=2';
    // Temporary recorder for tracking down a stuck face. It changes nothing on screen.
    (window.__faceLog = window.__faceLog || []).push({ t: Math.round(now), face, forced: Boolean(force), held: tile.held, moving: Boolean(tile.frame), speed: Math.round(Math.hypot(tile.vx, tile.vy)), carry: Math.round(Math.hypot(tile.carryX, tile.carryY)), flight: mood.flight, rough: mood.rough, was: mood.was, x: Math.round(tile.x), y: Math.round(tile.y) });
    if (window.__faceLog.length > 400) window.__faceLog.shift();
    tile.el.classList.remove('is-giggling');
    return true;
  };

  const mugNear = () => {
    const mug = bodies.find((body) => body.el.dataset.sticker === 'mug');
    if (!mug) return false;
    measure(mug);
    // The coffee counts only when someone brings the two together, not when it happens to be nearby.
    const brought = tile.held || mug.held;
    return brought && Math.hypot(mug.x - tile.x, mug.y - tile.y) < tile.size / 2 + 120;
  };

  // A hit: it hurts, he is wary afterwards, and at rest he works through
  // startled -> nervous -> relieved -> calm.
  const hurt = (now) => {
    const moving = !tile.held && Math.hypot(tile.vx, tile.vy) > 140;
    mood.hurtAt = now;
    mood.wary = true;
    mood.activeAt = now;
    mood.holdUntil = now + (moving ? 1000 : 1500);
    wear('ouch', true);
  };

  // What a sticker does to him, the instant it touches him. One rule everywhere:
  // fast hurts, slow is gentle. It applies to a sticker in the hand, one that was just
  // thrown (first contact only), and to him being thrown or carried into one.
  // A sticker that is merely drifting does nothing.
  const HURT_SPEED = 500;
  const feelTouch = (touch) => {
    if (!tile.el) return;
    const now = touch.at;
    const name = touch.sticker;
    mood.contacts[name] = now;
    const flying = !tile.held && mood.flight;
    if (!(touch.thrown || touch.pushed || tile.held || flying)) return;

    if (touch.force > HURT_SPEED) {
      const himMoving = flying && !touch.thrown && !touch.pushed;
      if (himMoving) {
        // Thrown into stickers: only the first one he meets on that throw hurts.
        if (mood.flightHit) return;
        mood.flightHit = true;
      } else if (now - (mood.reacted[name] || 0) < 1200) return;
      mood.reacted[name] = now;
      (window.__hurtLog = window.__hurtLog || []).push({ name, thrown: touch.thrown, pushed: touch.pushed, himMoving, force: Math.round(touch.force), t: Math.round(now) });
      mood.gentleFace = '';
      mood.stung[name] = now;
      hurt(now);
      if (name === 'clapper' && !himMoving) {
        // The clapperboard also leaves him seeing stars once the pain has passed.
        mood.hurtAt = 0;
        mood.rough = true;
        mood.flight = false;
        mood.landedAt = mood.holdUntil;
      }
      return;
    }

    // Gentle. Not while he is mid-Ouch, and not while he is being whipped around.
    if (now < mood.holdUntil) return;
    // A sticker that has just hurt him gets no second, gentle reaction while it is still
    // against him.
    if (now - (mood.stung[name] || 0) < 2500) return;
    if (tile.held && Math.hypot(tile.carryX, tile.carryY) > HURT_SPEED) return;
    // Nor while he is being shaken: the shaking wins, he gets dizzy whatever is beside him.
    if (tile.held && (mood.flips.filter((time) => now - time < 900).length >= 3 || now - (mood.shakeAt || 0) < 500)) return;
    const unwell = ['dizzy', 'tired', 'queasy', 'annoyed'].includes(mood.face);
    const stillRefreshing = mood.gentleFace === 'refreshed' && now - mood.gentleAt < 600;
    let face = '';
    if (name === 'mug') face = unwell || stillRefreshing ? 'refreshed' : 'coffee';
    else if (name === 'razor' || name === 'wacom') face = 'scared'; // sharp things scare him even when unwell
    else if (!unwell) face = 'nervous';
    if (!face) return;
    // Two stickers on him at once: the scarier one decides his face. Sharp beats coffee,
    // coffee beats the rest.
    const rank = face === 'scared' ? 3 : name === 'mug' ? 2 : 1;
    const ruled = mood.gentleFace && mood.gentleFrom !== name && mood.gentleRank > rank && now - mood.gentleAt < 350;
    if (ruled) { mood.felt[name] = now; mood.activeAt = now; return; }
    if (now - (mood.felt[name] || 0) > 600) {
      // A new meeting: show the reaction for at least a moment.
      mood.gentleUntil = now + 1200;
      mood.reacted[name] = now;
      // Coffee brings him round completely, shaking included.
      if (face === 'refreshed') { mood.rough = false; mood.crashes = 0; mood.sick = false; mood.hurtAt = 0; mood.landedAt = now - 2000; mood.shake = 0; mood.shook = false; mood.roughHold = false; }
    }
    (window.__gentleLog = window.__gentleLog || []).push({ name, face, thrown: touch.thrown, pushed: touch.pushed, held: tile.held, flying, force: Math.round(touch.force), t: Math.round(now) });
    // The reaction stays for as long as the sticker is against him.
    mood.felt[name] = now;
    mood.gentleRank = rank;
    mood.gentleFrom = name;
    mood.gentleFace = face;
    mood.gentleAt = now;
    mood.activeAt = now;
  };

  // The orange box meeting him: pushed in slowly, slammed in, or launching him.
  const feelBox = (how) => {
    if (!tile.el || tile.held) return;
    const now = performance.now();
    if (now - (mood.boxAt || 0) < 700) return;
    mood.boxAt = now;
    mood.activeAt = now;
    mood.wary = true;
    if (how === 'bounce') {
      // The trampoline (or slingshot) sends him off hard.
      mood.flight = true;
      mood.rough = true;
      mood.flightLock = false;
      mood.flightFace = 'panic';
      mood.panicAt = now;
      // If he is mid-Ouch, let that finish; the flight face takes over straight after.
      if (now >= mood.holdUntil) wear('panic', true);
    } else if (how === 'slam') {
      hurt(now);
    } else if (now >= mood.holdUntil) {
      wear('startled', true);
      mood.holdUntil = now + 1200;
    }
  };

  const onGrab = () => {
    const now = performance.now();
    mood.grabAt = now;
    mood.grabX = tile.x;
    mood.grabY = tile.y;
    mood.roughHold = false;
    mood.flight = false;
    mood.flightLock = false;
    mood.holdUntil = 0;
    mood.gentleFace = '';
    mood.flips = [];
    mood.shake = 0;
    mood.shook = false;
    // Being grabbed always registers at once: frightened if he has reason to be.
    wear(mood.wary ? 'startled' : 'smile', true);
  };

  const onRelease = (fired) => {
    const now = performance.now();
    const speed = Math.hypot(tile.vx, tile.vy);
    const moved = Math.hypot(tile.x - mood.grabX, tile.y - mood.grabY);
    if (!fired && now - mood.grabAt < 320 && moved < 4) {
      // A click with no carrying at all. Three in a row tickle him, but only when he is well.
      mood.clicks = mood.clicks.filter((time) => now - time < 1300);
      mood.clicks.push(now);
      const well = !mood.rough || now - mood.landedAt > 10600;
      if (mood.clicks.length >= 3 && well) {
        mood.clicks = [];
        mood.wary = false;
        wear('smile', true);
        tile.el.classList.add('is-giggling');
        window.setTimeout(() => tile.el && tile.el.classList.remove('is-giggling'), 1400);
      }
      return;
    }
    if (fired || speed > THROW_SPEED || mood.roughHold || mood.shake > 1.5) {
      // Thrown, or carried roughly: he has been handled badly. How hard he was thrown
      // decides his face for the whole flight, so it shows the instant he leaves the hand.
      mood.flight = true;
      mood.flightHit = false;
      mood.rough = true;
      mood.wary = true;
      mood.gentleRuns = 0;
      if (mood.shake > 1.5) {
        // Let go after a good shaking: he falls already dizzy or queasy.
        mood.sick = mood.shake > 3.5;
        mood.flightLock = true;
        mood.flightFace = mood.sick ? 'queasy' : 'dizzy';
      } else {
        mood.flightFace = fired || speed > 650 ? 'panic' : 'scared';
        mood.panicAt = now;
      }
      wear(mood.flightFace, true);
    } else {
      // Set down gently.
      mood.flight = true;
      mood.rough = false;
      mood.gentleRuns += 1;
      if (mood.gentleRuns >= 2) mood.wary = false;
    }
  };

  const updateFace = (now) => {
    if (!tile.el) return;
    const dt = Math.min(0.25, Math.max(0, (now - (mood.tick || now)) / 1000));
    mood.tick = now;
    const speed = tile.held ? Math.hypot(tile.carryX, tile.carryY) : Math.hypot(tile.vx, tile.vy);
    // He is flying only while he is really moving. Slow and on the floor, or slow for a
    // while, means he is at rest whatever is still settling.
    const slow = speed < 60;
    if (!slow) mood.slowSince = 0; else if (!mood.slowSince) mood.slowSince = now;
    const onFloor = tile.y + tileReach() >= hero.clientHeight - 8;
    const settled = !tile.frame || (slow && (onFloor || now - mood.slowSince > 700));
    const state = tile.held ? 'held' : settled ? 'rest' : 'air';

    if (state === 'rest' && mood.was !== 'rest' && mood.flight) {
      // He has just come to rest after being thrown or set down.
      mood.flight = false;
      mood.landedAt = now;
      if (mood.rough && tile.hits > 0) mood.crashes += 1;
      // The landing shows at once, not a second later (unless he is mid-reaction).
      if (mood.rough && mood.face === 'tired') mood.landedAt = now - 2600; // already past the dizziness: carry on from tired
      else if (now >= mood.holdUntil) wear(mood.rough ? (mood.crashes >= 4 || mood.sick ? 'queasy' : 'dizzy') : (mood.wary ? 'calm' : 'smile'), true);
    }
    mood.was = state;

    if (state !== 'rest') mood.activeAt = now;
    // A reaction to being hit stays on screen long enough to be seen.
    if (now < mood.holdUntil) return;
    // Loaded in the slingshot: scared as it stretches, cheeks out at full stretch.
    if (tile.held && band.hooked) { mood.activeAt = now; wear(band.pull > 0.9 ? 'panic' : 'scared', true); return; }
    // A sticker being held against him: his reaction lasts as long as it is there.
    if (mood.gentleFace) {
      if (now < mood.gentleUntil || now - mood.gentleAt < 350) { wear(mood.gentleFace, true); return; }
      mood.gentleFace = '';
    }
    if (state === 'held') {
      // Shaking him, in any direction, makes him dizzy and then queasy. It wears off
      // slowly once the shaking stops.
      mood.flips = mood.flips.filter((time) => now - time < 900);
      const shaking = mood.flips.length >= 3;
      if (shaking) { mood.shake += dt; mood.shakeAt = now; mood.roughHold = true; mood.wary = true; }
      else if (now - mood.shakeAt > 500) mood.shake = Math.max(0, mood.shake - dt * 0.9);
      if (mood.shake > 1.5) mood.shook = true;
      if (mood.shake <= 0) mood.shook = false;
      if (mood.shake > 3.5) { wear('queasy', true); return; }
      if (mood.shake > 1.5) { wear('dizzy', mood.face !== 'queasy'); return; }
      if (mood.shook) { wear('tired'); return; }
      if (shaking) { wear('scared', true); return; }
      if (speed > ROUGH_CARRY) { mood.roughHold = true; mood.wary = true; }
      // Whipped around very fast in the hand, his cheeks go too.
      if (speed > 1300) { mood.panicAt = now; wear('panic', true); }
      else if (speed > ROUGH_CARRY) { if (mood.face !== 'panic' || now - (mood.panicAt || 0) > 450) wear('scared', true); }
      else if (mood.roughHold) { if (mood.face !== 'panic' || now - (mood.panicAt || 0) > 450) wear(mood.face === 'panic' ? 'scared' : 'nervous', mood.face === 'panic'); }
      else if (!mood.wary) wear(mugNear() ? 'coffee' : 'calm'); // eyes open while he is carried
      else if (now - mood.grabAt > 2200) wear('nervous');
      return;
    }

    if (state === 'air') {
      // Only a real throw counts. Sliding or rocking after he has landed does not.
      if (!mood.flight) {
        // Knocked along by a sticker or the box: his hands go up while he slides.
        const recovering = mood.rough && now - mood.landedAt < 5600;
        if (!recovering && speed > 140) { wear('scared', true); mood.knocked = true; }
        return;
      }
      if (!mood.rough) return;
      // The cheeks-out panic face follows his real speed: on while he is truly fast,
      // off as soon as he has slowed to a drift. After a shaking he just stays sick.
      if (mood.flightLock) { /* keep the dizzy or queasy face */ }
      else if (speed > 650) { mood.flightFace = 'panic'; mood.panicAt = now; }
      else if (speed < 430 && now - (mood.panicAt || 0) > 350) mood.flightFace = 'scared';
      wear(mood.flightFace || 'scared', true);
      return;
    }

    // At rest. He is never scared or panicking while lying still.
    const since = now - mood.landedAt;
    // He dozes off only once nothing at all has happened in the hero for a while.
    const sleepy = now - mood.activeAt > 18000;
    const unwell = mood.rough && since < 5600;
    if (mood.knocked) {
      // He has stopped sliding: carry on as someone who has just had a fright.
      mood.knocked = false;
      if (!mood.hurtAt) mood.hurtAt = now - 1500;
    }
    if (mood.hurtAt) {
      const sinceHurt = now - mood.hurtAt;
      const recovering = mood.rough && since >= 0 && since < 5600;
      if (recovering || sinceHurt > 7500) mood.hurtAt = 0; // back to feeling unwell, or over it
      else {
        wear(sinceHurt < 3500 ? 'startled' : sinceHurt < 5500 ? 'nervous' : 'relieved', mood.face === 'ouch' || mood.face === 'scared');
        return;
      }
    }
    if (mugNear() && since > 500) {
      if (unwell || mood.face === 'queasy') {
        // Coffee brings him round.
        if (wear('refreshed')) { mood.rough = false; mood.crashes = 0; mood.landedAt = now - 2000; }
        return;
      }
      if (since < 16000 && wear('coffee')) return;
      if (mood.face === 'coffee' && since < 16000) return;
    }
    if (mood.rough) {
      const sideways = Math.abs((((tile.angle % 360) + 540) % 360) - 180) > 30;
      if (since < 2600) wear(mood.crashes >= 4 || mood.sick ? 'queasy' : 'dizzy');
      else if (since < 5600) wear(sideways ? 'annoyed' : 'tired');
      else if (since < 8600) wear('nervous');
      else if (since < 10600) wear('relieved');
      else if (!sleepy) { if (wear('calm') || mood.face === 'calm') { mood.wary = false; mood.crashes = 0; mood.sick = false; } }
      else wear('asleep');
    } else if (since < 3200) wear(mood.wary ? 'calm' : 'smile');
    else if (!sleepy) wear('calm');
    else wear('asleep');
  };

  // While he is lying still nothing else runs, so check on him a few times a second.
  // A safety net as well: if he has not actually moved for half a second, he cannot be
  // wearing a flying face, whatever the rest of the logic believes.
  const watch = { x: 0, y: 0, stillFor: 0 };
  window.setInterval(() => {
    if (!tile.el || !heroVisible) return;
    const now = performance.now();
    const moved = Math.hypot(tile.x - watch.x, tile.y - watch.y);
    watch.x = tile.x;
    watch.y = tile.y;
    watch.stillFor = moved < 3 && !tile.held ? watch.stillFor + 160 : 0;
    if (watch.stillFor >= 480 && (mood.face === 'panic' || mood.face === 'scared')) {
      mood.flight = false;
      mood.landedAt = now;
      wear(mood.rough ? (mood.crashes >= 4 || mood.sick ? 'queasy' : 'dizzy') : 'calm', true);
    }
    if (!tile.frame) updateFace(now);
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
    grabX: 0, grabY: 0, trail: [],
  });

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
  copy.querySelectorAll('.w').forEach((el) => addBody(el, 'word'));
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

      const quiet = body.pressed > 0;
      if (quiet) body.pressed -= 1;
      if (!quiet) body.vy += FLOAT_GRAVITY * dt;
      // Jammed with nowhere to go: it does not move or turn at all.
      if (body.pressed >= 5) body.vx = body.vy = body.spin = 0;
      if (quiet) {
        // Pressed against him or another sticker: it holds still rather than jiggling.
        body.vx *= 1 - Math.min(1, dt * 14);
        body.vy *= 1 - Math.min(1, dt * 14);
        body.spin *= 1 - Math.min(1, dt * 14);
      } else {
        body.vx += Math.sin(clock * 0.7 + body.phase) * 7 * dt;
        body.vx *= 1 - 1.1 * dt;
        body.vy *= 1 - 1.1 * dt;
        body.spin *= 1 - 0.6 * dt;
      }
      const pace = Math.hypot(body.vx, body.vy);
      // Only a sticker someone has just thrown may travel fast; one he merely bumps drifts.
      const limit = performance.now() - body.thrownAt < 3500 ? 950 : 340;
      if (pace > limit) { body.vx *= limit / pace; body.vy *= limit / pace; }
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.angle += body.spin * dt;

      const spring = quiet ? 0 : 0.5;
      if (body.x - body.hw < 0) { body.x = body.hw; body.vx = Math.abs(body.vx) * spring; }
      if (body.x + body.hw > width) { body.x = width - body.hw; body.vx = -Math.abs(body.vx) * spring; }
      if (body.y - body.hh < 0) { body.y = body.hh; body.vy = Math.abs(body.vy) * spring; }
      const floor = height - body.hh - body.lift;
      if (body.y > floor) {
        body.y = floor;
        // Moon gravity: it touches down softly and keeps bobbing instead of lying still.
        body.vy = quiet ? 0 : body.vy > 45 ? -body.vy * 0.45 : -(14 + Math.random() * 24);
        body.spin *= 0.7;
      }
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
        if (body.jamAt !== clock && !body.held) { body.vx += body.kick[0]; body.vy += body.kick[1]; body.spin += body.kick[2]; }
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
    if (worldTick(dt)) worldFrame = window.requestAnimationFrame(worldLoop);
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
  bodies.forEach((body) => { if (body.kind === 'sticker') body.el.addEventListener('pointerdown', grabSticker); });

  const syncReset = () => {
    if (!resetButton) return;
    const on = playing() && heroVisible && (Boolean(tile.el) || bodies.some((body) => body.kind === 'sticker' && body.state !== 'home'));
    if (on === resetButton.classList.contains('is-on')) return;
    resetButton.classList.toggle('is-on', on);
    resetButton.disabled = !on;
  };

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

  // Scrolling the page sloshes whatever is loose, like shaking a container.
  let sloshY = window.scrollY;
  window.addEventListener('scroll', () => {
    const moved = window.scrollY - sloshY;
    sloshY = window.scrollY;
    if (!playing() || !moved) return;
    const kick = Math.max(-520, Math.min(520, moved * 7));
    let any = false;
    for (const body of bodies) { if (body.state === 'free' && !body.held) { body.vy -= kick * (0.6 + Math.random() * 0.6); body.vx += (Math.random() - 0.5) * Math.abs(kick) * 0.3; any = true; } }
    if (tile.el && !tile.held) { tile.vy -= kick; runTile(); }
    if (any) runWorld();
  }, { passive: true });

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
    const progress = Math.max(0, Math.min(1, (stick - reel.getBoundingClientRect().top) / runway));
    // The build takes the first three quarters of the scroll; the rest is the finished
    // card simply resting there before it and the folders scroll away together.
    const build = Math.min(1, progress / 0.74);
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
    reel.classList.toggle('is-out', progress > 0.001);
    reel.classList.toggle('is-open', open);
    if (open) decodeReelTitle(); else if (build < 0.94) scrambleReelTitle();
  };

  // Case Studies arrives with the scroll: the heading fades and rises in first, then each
  // folder as it comes up from the bottom of the screen. Each piece is fully in by the
  // time it is well into view, and the same happens in reverse on the way back up.
  const caseTitle = document.querySelector('.case-studies .section-title');
  const caseFolders = [...document.querySelectorAll('.project-grid .project-card')];
  const ARRIVE_RISE = 70; // matches the 70px in hero-play.css
  const paintArrivals = () => {
    const pieces = [];
    if (caseTitle) pieces.push([caseTitle, 0.96, 0.72, 0]);
    // A folder is measured from the top of its tab, and starts once the heading is in.
    for (const folder of caseFolders) pieces.push([folder, 0.85, 0.48, 56]);
    if (!playing()) {
      for (const [piece] of pieces) piece.style.removeProperty('--in');
      if (caseTitle) { caseTitle.style.removeProperty('--sc'); caseTitle.style.removeProperty('--out'); }
      return;
    }
    const tall = window.innerHeight;
    let gate = 0; // how far the page must have scrolled before this piece may begin
    for (const [piece, from, to, lead] of pieces) {
      const was = parseFloat(piece.style.getPropertyValue('--in'));
      const risen = Number.isFinite(was) ? (1 - was) * ARRIVE_RISE : 0;
      // Where it would be without the rise it is currently given.
      const top = piece.getBoundingClientRect().top - risen - lead;
      // On a tall window a piece can already be on screen before any scrolling. It still
      // waits: the heading begins only once the page has started to move, and the first
      // folder only once the heading is fully in. (Later folders are a whole folder further
      // down, so they are never on screen that early.)
      const span = (from - to) * tall;
      const place = top + window.scrollY;
      const begin = Math.min(from * tall, place - gate - 24);
      const arrived = Math.max(0, Math.min(1, (begin - top) / span));
      gate = piece === caseTitle ? place - begin + span : 0;
      if (piece === caseTitle) {
        // The title shrinks a little as it settles into the place where it stays.
        const rest = parseFloat(window.getComputedStyle(piece).top) || 0;
        const settled = Math.max(0, Math.min(1, 1 - (top - rest) / 180));
        piece.style.setProperty('--sc', (1 - 0.28 * settled).toFixed(3));
      }
      piece.style.setProperty('--in', arrived.toFixed(3));
    }
  };

  let pageFrame = 0;
  let pointerX = -999;
  let pointerY = -999;
  const paintPage = () => {
    pageFrame = 0;
    paintArrivals();
    paintReel();
    if (glow) {
      glow.style.setProperty('--mx', pointerX + 'px');
      glow.style.setProperty('--my', pointerY + 'px');
      glow.style.setProperty('--sy', (window.scrollY % 24) + 'px');
    }
  };
  const queuePage = () => { if (!pageFrame) pageFrame = window.requestAnimationFrame(paintPage); };
  window.addEventListener('scroll', queuePage, { passive: true });
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

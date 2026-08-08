import { play } from './audio.js';

const TICK = './assets/audio/sfx/menu-hover.mp3';
const SLOT_FALLBACK = 0.42;
const SPRING_K = 180;
const SPRING_ZETA = 0.8;
const FLICK_PROJECT = 0.14;
const FLICK_CAP = 1.25;
const FLICK_VEL = 1.1;
const INTENT = 0.14;
const EDGE_GIVE = 0.3;
const WHEEL_GAIN = 1.5;
const WHEEL_IDLE = 110;
const DRAG_SLOP = 6;
const REST_POS = 0.0015;
const REST_VEL = 0.02;
const VISIBLE = 2.2;
const OFFSCREEN = 3;
const SHELL_LAG = 0.1;
const OBJECT_LEAD = 0.08;
const HEADLINE_LAG = 0.14;
const CAPTION_LAG = 0.06;
const SCALE_NEAR = 0.26;
const SCALE_FAR = 0.1;
const FADE_NEAR = 0.48;
const FADE_FAR = 0.52;
const DIP = 14;

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

function buildArt(object) {
  if (object.src) {
    const img = document.createElement('img');
    img.className = 'reveal__art reveal__art--img';
    img.src = object.src;
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    return img;
  }
  const glyph = document.createElement('span');
  glyph.className = 'reveal__art reveal__art--glyph';
  glyph.textContent = object.glyph;
  return glyph;
}

function buildCell(item) {
  const el = document.createElement('section');
  el.className = 'reveal__item';
  if (item.tone) el.classList.add('reveal__item--' + item.tone);

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'reveal__card';
  card.setAttribute('aria-label', item.ariaLabel);

  const headline = document.createElement('span');
  headline.className = 'reveal__headline';
  headline.setAttribute('aria-hidden', 'true');
  headline.textContent = item.headline;

  const object = document.createElement('span');
  object.className = 'reveal__object';
  object.setAttribute('aria-hidden', 'true');
  object.appendChild(buildArt(item.object));

  const caption = document.createElement('span');
  caption.className = 'reveal__caption';
  caption.setAttribute('aria-hidden', 'true');
  const captionText = document.createElement('span');
  captionText.className = 'pill reveal__captionText';
  captionText.textContent = item.caption;
  caption.appendChild(captionText);

  card.append(headline, object, caption);
  el.appendChild(card);
  return { el, card, headline, object, caption, onSelect: item.onSelect };
}

export function mountRevealList(host, { items, ariaLabel, initialIndex = 0, onCommit }) {
  const rail = document.createElement('div');
  rail.className = 'reveal';
  rail.setAttribute('role', 'group');
  rail.setAttribute('aria-label', ariaLabel);

  const track = document.createElement('div');
  track.className = 'reveal__track';
  const cells = items.map(buildCell);
  cells.forEach((cell) => track.appendChild(cell.el));
  rail.appendChild(track);
  host.appendChild(rail);

  const last = cells.length - 1;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');

  let slot = rail.clientWidth * SLOT_FALLBACK || 1;
  let pos = clamp(initialIndex, 0, last);
  let index = Math.round(pos);
  let target = pos;
  let vel = 0;
  let frame = 0;
  let frameAt = 0;

  function paint() {
    for (let i = 0; i <= last; i++) {
      const cell = cells[i];
      const d = i - pos;
      const span = Math.abs(d);
      if (span >= OFFSCREEN) {
        cell.el.classList.add('is-off');
        continue;
      }
      cell.el.classList.remove('is-off');
      const near = Math.min(span, 1);
      const far = Math.max(span - 1, 0);
      const scale = 1 - SCALE_NEAR * near - SCALE_FAR * far;
      const shift = d * slot * (1 - SHELL_LAG * span);
      cell.el.style.transform =
        'translate3d(' + shift + 'px,' + DIP * near + 'px,0) scale(' + scale + ')';
      cell.el.style.opacity = Math.max(0, 1 - FADE_NEAR * near - FADE_FAR * far);
      cell.el.style.zIndex = String(120 - Math.round(span * 20));
      cell.el.classList.toggle('is-mute', span > VISIBLE);
      cell.object.style.transform = 'translate3d(' + d * slot * OBJECT_LEAD + 'px,0,0)';
      cell.headline.style.transform = 'translate3d(' + -d * slot * HEADLINE_LAG + 'px,0,0)';
      cell.caption.style.transform = 'translate3d(' + -d * slot * CAPTION_LAG + 'px,0,0)';
    }
  }

  function measure() {
    const width = cells[0].el.offsetWidth;
    slot = width || rail.clientWidth * SLOT_FALLBACK || 1;
    paint();
  }

  function land() {
    const next = Math.round(pos);
    if (next === index) return;
    index = next;
    cells.forEach((cell) => cell.el.classList.remove('is-landed'));
    const el = cells[index].el;
    void el.offsetWidth;
    el.classList.add('is-landed');
    play(TICK);
    if (onCommit) onCommit(index);
  }

  function tick(now) {
    frame = 0;
    const dt = Math.min((now - frameAt) / 1000, 1 / 30) || 1 / 60;
    frameAt = now;
    const damping = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
    vel += (target - pos) * SPRING_K * dt - vel * damping * dt;
    pos += vel * dt;
    if (Math.abs(target - pos) < REST_POS && Math.abs(vel) < REST_VEL) {
      pos = target;
      vel = 0;
      paint();
      land();
      return;
    }
    paint();
    frame = requestAnimationFrame(tick);
  }

  function halt() {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function settleTo(to) {
    target = clamp(Math.round(to), 0, last);
    if (calm.matches) {
      halt();
      pos = target;
      vel = 0;
      paint();
      land();
      return;
    }
    if (pos === target && vel === 0) return;
    if (frame) return;
    frameAt = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function give(over) {
    return EDGE_GIVE * (1 - 1 / (over / EDGE_GIVE + 1));
  }

  function withEdges(raw) {
    if (raw < 0) return -give(-raw);
    if (raw > last) return last + give(raw - last);
    return raw;
  }

  let pointer = null;
  let grabX = 0;
  let grabPos = 0;
  let grabAt = 0;
  let dragged = false;
  let swallow = false;

  function onMove(event) {
    if (event.pointerId !== pointer) return;
    const dx = event.clientX - grabX;
    if (!dragged && Math.abs(dx) < DRAG_SLOP) return;
    dragged = true;
    const dt = Math.max((event.timeStamp - grabAt) / 1000, 1 / 240);
    grabAt = event.timeStamp;
    const next = withEdges(grabPos - dx / slot);
    vel = ((next - pos) / dt) * 0.6 + vel * 0.4;
    pos = next;
    paint();
  }

  function onUp(event) {
    if (event.pointerId !== pointer) return;
    pointer = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    if (!dragged) return;
    swallow = true;
    const from = Math.round(grabPos);
    let to = Math.round(pos + clamp(vel * FLICK_PROJECT, -FLICK_CAP, FLICK_CAP));
    const drift = pos - from;
    if (to === from && (Math.abs(drift) > INTENT || Math.abs(vel) > FLICK_VEL)) {
      to = from + Math.sign(drift || vel);
    }
    settleTo(to);
  }

  function onDown(event) {
    if (pointer !== null || event.button > 0) return;
    pointer = event.pointerId;
    grabX = event.clientX;
    grabPos = pos;
    grabAt = event.timeStamp;
    dragged = false;
    swallow = false;
    vel = 0;
    halt();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  let wheelTimer = 0;
  let wheelFrom = 0;
  let wheelSum = 0;

  function onWheel(event) {
    const raw = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!raw) return;
    event.preventDefault();
    const px = event.deltaMode === 1 ? raw * 16 : event.deltaMode === 2 ? raw * slot : raw;
    if (wheelTimer) {
      clearTimeout(wheelTimer);
    } else {
      halt();
      vel = 0;
      wheelFrom = Math.round(pos);
      wheelSum = 0;
    }
    const move = (px * WHEEL_GAIN) / slot;
    wheelSum += move;
    pos = withEdges(pos + move);
    paint();
    wheelTimer = setTimeout(() => {
      wheelTimer = 0;
      let to = Math.round(pos);
      if (to === wheelFrom && Math.abs(wheelSum) > INTENT) to = wheelFrom + Math.sign(wheelSum);
      settleTo(to);
    }, WHEEL_IDLE);
  }

  function onKey(event) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'ArrowRight') settleTo(target + 1);
    else if (event.key === 'ArrowLeft') settleTo(target - 1);
    else return;
    event.preventDefault();
  }

  function onFocusIn(event) {
    const i = cells.findIndex((cell) => cell.card === event.target);
    if (i >= 0 && i !== index) settleTo(i);
  }

  function onClick(event) {
    if (swallow) {
      swallow = false;
      return;
    }
    const i = cells.findIndex((cell) => cell.card === event.currentTarget);
    if (i !== index) {
      settleTo(i);
      return;
    }
    cells[i].onSelect();
  }

  cells.forEach((cell) => cell.card.addEventListener('click', onClick));
  rail.addEventListener('pointerdown', onDown);
  rail.addEventListener('wheel', onWheel, { passive: false });
  rail.addEventListener('focusin', onFocusIn);
  window.addEventListener('keydown', onKey);

  const observer = new ResizeObserver(measure);
  observer.observe(rail);

  measure();
  cells[index].el.classList.add('is-landed');

  return () => {
    halt();
    if (wheelTimer) clearTimeout(wheelTimer);
    observer.disconnect();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };
}

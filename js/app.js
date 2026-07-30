import { UNIT1 } from './data.js';
import * as audio from './audio.js';
import stepHello from './steps/hello.js';
import stepWhatsthis from './steps/whatsthis.js';
import stepChant from './steps/chant.js';
import stepPeekaboo from './steps/peekaboo.js';

const STEP_MODULES = [stepHello, stepWhatsthis, stepChant, stepPeekaboo];
const STEP_ORDER = ['hello', 'whatsthis', 'chant', 'peekaboo'];
const STEP_META = {
  hello: { icon: '🍎' },
  whatsthis: { icon: '❓' },
  chant: { icon: '🎵' },
  peekaboo: { icon: '👀' },
};

const steps = new Map();

export function registerStep(id, module) {
  steps.set(id, module);
}

STEP_MODULES.forEach((mod) => registerStep(mod.id, mod));

const UNITS_MAP = [
  { n: 1, kind: 'unit', label: 'Aa Bb Cc', face: '🍎', state: 'current' },
  { n: 2, kind: 'unit', label: 'Dd Ee Ff', face: '🦕', state: 'locked' },
  { n: 3, kind: 'unit', label: 'Gg Hh Ii', face: '🐘', state: 'locked' },
  { n: 'R1', kind: 'review', label: 'Review 1', face: '🏅', state: 'locked' },
  { n: 4, kind: 'unit', label: 'Jj Kk Ll', face: '🦘', state: 'locked' },
  { n: 5, kind: 'unit', label: 'Mm Nn Oo', face: '🌙', state: 'locked' },
  { n: 6, kind: 'unit', label: 'Pp Qq Rr', face: '👑', state: 'locked' },
  { n: 'R2', kind: 'review', label: 'Review 2', face: '🏅', state: 'locked' },
  { n: 7, kind: 'unit', label: 'Ss Tt Uu', face: '☀️', state: 'locked' },
  { n: 8, kind: 'unit', label: 'Vv Ww Xx', face: '🚂', state: 'locked' },
  { n: 9, kind: 'unit', label: 'Yy Zz', face: '🦓', state: 'locked' },
  { n: 'R3', kind: 'review', label: 'Review 3', face: '🏆', state: 'locked' },
];

const ROAD_POINTS = [
  { x: 150, y: 150 },
  { x: 430, y: 95 },
  { x: 700, y: 150 },
  { x: 1010, y: 110 },
  { x: 1010, y: 330 },
  { x: 730, y: 290 },
  { x: 450, y: 350 },
  { x: 170, y: 310 },
  { x: 170, y: 530 },
  { x: 450, y: 575 },
  { x: 730, y: 525 },
  { x: 1010, y: 565 },
];
const ROAD_VIEWBOX = { w: 1180, h: 660 };

const root = document.getElementById('app');
const completed = new Set();

let cleanupCurrent = null;
let stepPaused = false;
let pauseListeners = [];

function catmullRomPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x} ${p2.y}`;
  }
  return d;
}

export function goto(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function parseRoute(hash) {
  const clean = hash || '#/units';
  if (clean === '#/units') return { name: 'units' };
  if (clean === '#/unit/1') return { name: 'hub' };
  const m = clean.match(/^#\/unit\/1\/(hello|whatsthis|chant|peekaboo)$/);
  if (m) return { name: 'step', id: m[1] };
  return { name: 'redirect' };
}

function render() {
  if (cleanupCurrent) {
    cleanupCurrent();
    cleanupCurrent = null;
  }
  audio.stopAll();

  const route = parseRoute(location.hash);
  if (route.name === 'units') renderUnits();
  else if (route.name === 'hub') renderHub();
  else if (route.name === 'step') renderStep(route.id);
  else goto('#/units');
}

window.addEventListener('hashchange', render);

function buildTopBar() {
  const bar = document.createElement('header');
  bar.className = 'top-bar units-topbar';

  const logo = document.createElement('div');
  logo.className = 'units-topbar__logo';
  logo.innerHTML =
    '<span class="prompt-banner__letter units-topbar__mark" aria-hidden="true">🦆</span>' +
    '<h1 class="top-bar__title"><b class="t-accent">Hafsa</b> Phonics</h1>';

  const stars = document.createElement('div');
  stars.className = 'star-counter units-topbar__stars';
  stars.setAttribute('role', 'status');
  stars.setAttribute('aria-label', '0 stars earned');
  stars.innerHTML = '<span aria-hidden="true">⭐</span><span>0</span>';

  bar.append(logo, stars);
  return bar;
}

function buildUnitNode(entry, point) {
  const left = ((point.x / ROAD_VIEWBOX.w) * 100).toFixed(2) + '%';
  const top = ((point.y / ROAD_VIEWBOX.h) * 100).toFixed(2) + '%';
  const isCurrent = entry.state === 'current';
  const isLocked = entry.state === 'locked';

  const classes = ['candy-node', 'units-node'];
  if (isCurrent) classes.push('is-current');
  if (isLocked) classes.push('is-locked');

  const node = document.createElement('div');
  node.className = classes.join(' ');
  node.style.left = left;
  node.style.top = top;

  const pad = document.createElement('span');
  pad.className = 'candy-node__pad';
  pad.setAttribute('aria-hidden', 'true');

  const bubble = document.createElement('button');
  bubble.type = 'button';
  bubble.className = 'candy-node__bubble';

  if (entry.kind === 'unit') {
    const num = document.createElement('span');
    num.className = 'candy-node__num';
    num.setAttribute('aria-hidden', 'true');
    num.textContent = String(entry.n);
    bubble.appendChild(num);
  }

  const face = document.createElement('span');
  face.className = 'candy-node__face';
  face.setAttribute('aria-hidden', 'true');
  face.textContent = entry.face;
  bubble.appendChild(face);

  const spoken = entry.kind === 'review' ? entry.label : `Unit ${entry.n} — ${entry.label}`;

  if (isLocked) {
    bubble.setAttribute('aria-disabled', 'true');
    bubble.setAttribute('aria-label', `${spoken}. Locked.`);
    const lock = document.createElement('span');
    lock.className = 'candy-node__lock';
    lock.setAttribute('aria-hidden', 'true');
    lock.textContent = '🔒';
    bubble.appendChild(lock);
    bubble.addEventListener('click', () => {
      node.classList.remove('is-shaking');
      void node.offsetWidth;
      node.classList.add('is-shaking');
      setTimeout(() => node.classList.remove('is-shaking'), 650);
    });
  } else {
    bubble.setAttribute('aria-label', `${spoken}. Tap to start!`);
    bubble.addEventListener('click', () => goto('#/unit/1'));
  }

  node.append(pad, bubble);

  if (isCurrent) {
    const start = document.createElement('span');
    start.className = 'pill units-node__start';
    start.setAttribute('aria-hidden', 'true');
    start.textContent = 'Start ›';
    node.appendChild(start);
  }

  const label = document.createElement('span');
  label.className = 'pill node-pill' + (isLocked ? ' pill--muted' : '');
  label.setAttribute('aria-hidden', 'true');
  label.textContent = entry.label;
  node.appendChild(label);

  return node;
}

function buildRoad() {
  const wrap = document.createElement('div');
  wrap.className = 'units-road';

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'units-road__svg');
  svg.setAttribute('viewBox', `0 0 ${ROAD_VIEWBOX.w} ${ROAD_VIEWBOX.h}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const d = catmullRomPath(ROAD_POINTS);
  ['units-road__casing', 'units-road__fill', 'units-road__dots'].forEach((cls) => {
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('class', cls);
    path.setAttribute('d', d);
    svg.appendChild(path);
  });

  wrap.appendChild(svg);

  const nodes = document.createElement('div');
  nodes.className = 'units-road__nodes';
  nodes.setAttribute('role', 'group');
  nodes.setAttribute('aria-label', 'Learning path — 9 units and 3 reviews');
  UNITS_MAP.forEach((entry, i) => nodes.appendChild(buildUnitNode(entry, ROAD_POINTS[i])));
  wrap.appendChild(nodes);

  return wrap;
}

function renderUnits() {
  root.innerHTML = '';
  root.className = 'shell shell--units';

  const page = document.createElement('div');
  page.className = 'units-page';
  page.append(buildTopBar(), buildRoad());

  root.appendChild(page);
}

function buildStepCard(id) {
  const meta = STEP_META[id];
  const mod = steps.get(id);
  const isDone = completed.has(id);

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card card--tappable hub-card' + (isDone ? ' is-done' : '');
  card.setAttribute('aria-label', mod.title + (isDone ? ' — completed' : ''));

  const icon = document.createElement('span');
  icon.className = 'hub-card__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = meta.icon;

  const label = document.createElement('span');
  label.className = 'hub-card__label t-title';
  label.textContent = mod.title;

  card.append(icon, label);

  if (isDone) {
    const badge = document.createElement('span');
    badge.className = 'hub-card__badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = '✓';
    card.appendChild(badge);
  }

  card.addEventListener('click', () => goto(`#/unit/1/${id}`));
  return card;
}

function renderHub() {
  root.innerHTML = '';
  root.className = 'shell shell--hub';

  const page = document.createElement('div');
  page.className = 'hub-page';

  const header = document.createElement('header');
  header.className = 'hub-header';

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'btn btn--ghost btn--s hub-header__back';
  back.textContent = '‹ Units';
  back.addEventListener('click', () => goto('#/units'));

  const title = document.createElement('h1');
  title.className = 'hub-header__title t-hero';
  title.textContent = 'Unit 1';

  const chips = document.createElement('div');
  chips.className = 'hub-header__chips';
  chips.setAttribute('aria-hidden', 'true');
  ['Aa', 'Bb', 'Cc'].forEach((letters) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = letters;
    chips.appendChild(chip);
  });

  header.append(back, title, chips);

  const path = document.createElement('div');
  path.className = 'hub-path';
  path.setAttribute('role', 'group');
  path.setAttribute('aria-label', 'Unit 1 steps');
  STEP_ORDER.forEach((id) => path.appendChild(buildStepCard(id)));

  page.append(header, path);
  root.appendChild(page);
}

function renderStep(id) {
  const mod = steps.get(id);
  if (!mod) {
    goto('#/units');
    return;
  }

  root.innerHTML = '';
  root.className = 'shell shell--step';

  const shell = document.createElement('div');
  shell.className = 'step-shell';

  const header = document.createElement('div');
  header.className = 'step-shell__header';

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'btn btn--ghost step-shell__back';
  back.textContent = '‹ Steps';
  back.addEventListener('click', () => goto('#/unit/1'));

  const title = document.createElement('h1');
  title.className = 'step-shell__title t-title';
  title.textContent = mod.title;

  const pips = document.createElement('div');
  pips.className = 'progress-pips step-shell__pips';
  pips.setAttribute('role', 'status');
  pips.setAttribute('aria-label', 'Step progress');

  header.append(back, title, pips);

  const stage = document.createElement('div');
  stage.className = 'step';

  const pauseBtn = document.createElement('button');
  pauseBtn.type = 'button';
  pauseBtn.className = 'btn btn--primary btn--xl step-shell__pause';
  pauseBtn.textContent = 'Pause';
  pauseBtn.setAttribute('aria-pressed', 'false');

  const overlay = document.createElement('div');
  overlay.className = 'overlay overlay--celebrate is-hidden step-shell__overlay';
  overlay.innerHTML =
    '<div class="overlay__card">' +
    '<h2 class="overlay__title">Well done!</h2>' +
    '<div class="overlay__actions">' +
    '<button type="button" class="btn btn--primary btn--l step-shell__overlay-back">‹ Back to steps</button>' +
    '</div></div>';
  overlay.querySelector('.step-shell__overlay-back').addEventListener('click', () => goto('#/unit/1'));

  shell.append(header, stage, pauseBtn, overlay);
  root.appendChild(shell);

  stepPaused = false;
  pauseListeners = [];

  pauseBtn.addEventListener('click', () => {
    stepPaused = !stepPaused;
    pauseBtn.textContent = stepPaused ? 'Continue' : 'Pause';
    pauseBtn.setAttribute('aria-pressed', String(stepPaused));
    pauseListeners.forEach((fn) => fn(stepPaused));
  });

  const ctx = {
    onDone() {
      completed.add(id);
      overlay.classList.remove('is-hidden');
    },
    setProgress(done, total) {
      pips.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const pip = document.createElement('span');
        pip.className = 'progress-pips__pip' + (i < done ? ' is-done' : i === done ? ' is-current' : '');
        pips.appendChild(pip);
      }
    },
    isPaused() {
      return stepPaused;
    },
    onPauseChange(fn) {
      pauseListeners.push(fn);
    },
  };

  const cleanup = mod.mount(stage, ctx);
  cleanupCurrent = typeof cleanup === 'function' ? cleanup : null;
}

function armAudioUnlock() {
  const handler = () => audio.unlock();
  document.addEventListener('pointerdown', handler, { once: true });
  document.addEventListener('keydown', handler, { once: true });
}

function preloadAssets() {
  audio.preload([
    ...UNIT1.map((word) => word.utter),
    './assets/audio/chant.mp3',
    './assets/audio/sfx/correct.mp3',
    './assets/audio/sfx/stage-clear.mp3',
    './assets/audio/sfx/transition-sting.mp3',
  ]);
}

armAudioUnlock();
preloadAssets();
render();

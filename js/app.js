import { UNITS } from './units.js';
import * as audio from './audio.js';
import { mountRevealList } from './revealList.js';
import stepHello from './steps/hello.js';
import stepWhatsthis from './steps/whatsthis.js';
import stepChant from './steps/chant.js';
import stepPeekaboo from './steps/peekaboo.js';
import stepStory from './steps/story.js';
import stepBubbles from './steps/bubbles.js';
import stepPopup from './steps/popup.js';
import stepNumbers from './steps/numbers.js';
import stepCount from './steps/count.js';
import stepHowmany from './steps/howmany.js';
import stepAddup from './steps/addup.js';
import stepMatchup from './steps/matchup.js';

const STEP_MODULES = [
  stepHello, stepWhatsthis, stepChant, stepPeekaboo, stepStory, stepBubbles, stepPopup,
  stepNumbers, stepCount, stepHowmany, stepAddup, stepMatchup,
];

const STEP_ART = new Set(['hello', 'whatsthis', 'chant', 'peekaboo', 'story', 'bubbles', 'popup']);

const steps = new Map();

export function registerStep(id, module) {
  steps.set(id, module);
}

STEP_MODULES.forEach((mod) => registerStep(mod.id, mod));

const root = document.getElementById('app');
const completed = new Set();

let cleanupCurrent = null;
let stepPaused = false;
let pauseListeners = [];
let preloadedUnit = null;
let unitsIndex = 0;
const hubIndex = new Map();

function preloadUnit(unit) {
  if (preloadedUnit === unit.n) return;
  preloadedUnit = unit.n;
  audio.preload(unit.preload);
}

export function goto(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function parseRoute(hash) {
  const clean = hash || '#/units';
  if (clean === '#/units') return { name: 'units' };
  const m = clean.match(/^#\/unit\/(\d+)(?:\/([a-z]+))?$/);
  if (!m) return { name: 'redirect' };
  const unit = UNITS.find((u) => u.n === Number(m[1]));
  if (!unit) return { name: 'redirect' };
  if (!m[2]) return { name: 'hub', unit };
  if (!unit.steps.some((step) => step.id === m[2])) return { name: 'redirect' };
  return { name: 'step', unit, id: m[2] };
}

function render() {
  if (cleanupCurrent) {
    cleanupCurrent();
    cleanupCurrent = null;
  }
  audio.stopAll();

  const route = parseRoute(location.hash);
  if (route.name === 'units') {
    renderUnits();
    return;
  }
  if (route.name === 'redirect') {
    goto('#/units');
    return;
  }
  preloadUnit(route.unit);
  if (route.name === 'hub') renderHub(route.unit);
  else renderStep(route.unit, route.id);
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

function unitRevealItem(unit) {
  return {
    headline: unit.label,
    object: { src: unit.hero },
    caption: 'Unit ' + unit.n,
    ariaLabel: `Unit ${unit.n} — ${unit.label}. Tap to start!`,
    onSelect: () => goto('#/unit/' + unit.n),
  };
}

function renderUnits() {
  root.innerHTML = '';
  root.className = 'shell shell--units';

  const page = document.createElement('div');
  page.className = 'units-page';
  page.appendChild(buildTopBar());
  root.appendChild(page);

  cleanupCurrent = mountRevealList(page, {
    items: UNITS.map(unitRevealItem),
    ariaLabel: `Learning path — ${UNITS.length} units`,
    initialIndex: unitsIndex,
    onCommit: (index) => {
      unitsIndex = index;
    },
  });
}

function stepArt(step) {
  if (!STEP_ART.has(step.id)) return { glyph: step.icon };
  return { src: './assets/steps/' + step.id + '.webp' };
}

function stepRevealItem(unit, entry, i) {
  const mod = steps.get(entry.id);
  const isDone = completed.has(`${unit.n}:${entry.id}`);
  return {
    headline: mod.title,
    object: stepArt(entry),
    caption: 'Step ' + (i + 1) + (isDone ? ' ✓' : ''),
    ariaLabel: `Step ${i + 1} — ${mod.title}${isDone ? ' — completed' : ''} — tap to start!`,
    onSelect: () => {
      hubIndex.set(unit.n, i);
      goto(`#/unit/${unit.n}/${entry.id}`);
    },
  };
}

function renderHub(unit) {
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
  title.textContent = unit.title || 'Unit ' + unit.n;

  const chips = document.createElement('div');
  chips.className = 'hub-header__chips';
  chips.setAttribute('aria-hidden', 'true');
  unit.chips.forEach((text) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = text;
    chips.appendChild(chip);
  });

  header.append(back, title, chips);
  page.appendChild(header);
  root.appendChild(page);

  cleanupCurrent = mountRevealList(page, {
    items: unit.steps.map((entry, i) => stepRevealItem(unit, entry, i)),
    ariaLabel: `Unit ${unit.n} steps — ${unit.steps.length} steps`,
    initialIndex: hubIndex.get(unit.n) || 0,
    onCommit: (index) => {
      hubIndex.set(unit.n, index);
    },
  });
}

function renderStep(unit, id) {
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
  if (mod.noTitle) {
    header.classList.add('step-shell__header--no-title');
  }

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'btn btn--ghost step-shell__back';
  back.textContent = '‹ Steps';
  back.addEventListener('click', () => goto(`#/unit/${unit.n}`));

  const pips = document.createElement('div');
  pips.className = 'progress-pips step-shell__pips';
  pips.setAttribute('role', 'status');
  pips.setAttribute('aria-label', 'Step progress');

  if (mod.noTitle) {
    header.append(back, pips);
  } else {
    const title = document.createElement('h1');
    title.className = 'step-shell__title t-title';
    title.textContent = mod.title;
    header.append(back, title, pips);
  }

  const stage = document.createElement('div');
  stage.className = 'step';

  const overlay = document.createElement('div');
  overlay.className = 'overlay overlay--celebrate is-hidden step-shell__overlay';
  overlay.innerHTML =
    '<div class="overlay__card">' +
    '<h2 class="overlay__title">Well done!</h2>' +
    '<div class="overlay__actions">' +
    '<button type="button" class="btn btn--primary btn--l step-shell__overlay-back">‹ Back to steps</button>' +
    '</div></div>';
  overlay.querySelector('.step-shell__overlay-back').addEventListener('click', () => goto(`#/unit/${unit.n}`));

  shell.append(header, stage);

  stepPaused = false;
  pauseListeners = [];

  if (mod.noPause) {
    shell.classList.add('step-shell--no-pause');
  } else {
    const pauseBtn = document.createElement('button');
    pauseBtn.type = 'button';
    pauseBtn.className = 'btn btn--primary btn--xl step-shell__pause';
    pauseBtn.textContent = 'Pause';
    pauseBtn.setAttribute('aria-pressed', 'false');
    pauseBtn.addEventListener('click', () => {
      stepPaused = !stepPaused;
      pauseBtn.textContent = stepPaused ? 'Continue' : 'Pause';
      pauseBtn.setAttribute('aria-pressed', String(stepPaused));
      pauseListeners.forEach((fn) => fn(stepPaused));
    });
    shell.appendChild(pauseBtn);
  }

  shell.appendChild(overlay);
  root.appendChild(shell);

  let seekFn = null;

  const ctx = {
    unit,
    onDone() {
      completed.add(`${unit.n}:${id}`);
      overlay.classList.remove('is-hidden');
    },
    setProgress(done, total) {
      pips.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const state = i < done ? ' is-done' : i === done ? ' is-current' : '';
        if (seekFn) {
          const hit = document.createElement('button');
          hit.type = 'button';
          hit.className = 'progress-pips__hit';
          hit.setAttribute('aria-label', `Go to word ${i + 1} of ${total}`);
          const dot = document.createElement('span');
          dot.className = 'progress-pips__pip' + state;
          hit.appendChild(dot);
          hit.addEventListener('click', () => {
            if (stepPaused) return;
            seekFn(i);
          });
          pips.appendChild(hit);
        } else {
          const pip = document.createElement('span');
          pip.className = 'progress-pips__pip' + state;
          pips.appendChild(pip);
        }
      }
    },
    isPaused() {
      return stepPaused;
    },
    onPauseChange(fn) {
      pauseListeners.push(fn);
    },
    onSeek(fn) {
      seekFn = fn;
      pips.classList.add('is-seekable');
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

armAudioUnlock();
render();

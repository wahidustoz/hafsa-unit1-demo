const SFX = {
  next: './assets/audio/sfx/correct.mp3',
  complete: './assets/audio/sfx/stage-clear.mp3',
};

const SILENCE_SRC = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

const cache = new Map();
const playing = new Set();
let unlocked = false;

function getAudio(src) {
  let a = cache.get(src);
  if (!a) {
    a = new Audio(src);
    cache.set(src, a);
  }
  return a;
}

function track(a) {
  playing.add(a);
}

function untrack(a) {
  playing.delete(a);
}

export function play(src) {
  return new Promise((resolve) => {
    const a = getAudio(src);
    try {
      a.pause();
    } catch (err) {}
    a.currentTime = 0;
    track(a);

    const finish = () => {
      a.removeEventListener('ended', finish);
      a.removeEventListener('error', finish);
      untrack(a);
      resolve();
    };

    a.addEventListener('ended', finish, { once: true });
    a.addEventListener('error', finish, { once: true });

    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => finish());
    }
  });
}

export function chime(kind) {
  const src = SFX[kind];
  if (!src) return;
  const a = getAudio(src);
  try {
    a.pause();
  } catch (err) {}
  a.currentTime = 0;
  track(a);
  const done = () => untrack(a);
  a.addEventListener('ended', done, { once: true });
  const p = a.play();
  if (p && typeof p.catch === 'function') {
    p.catch(() => untrack(a));
  }
}

export function stopAll() {
  playing.forEach((a) => {
    try {
      a.pause();
      a.currentTime = 0;
    } catch (err) {}
  });
  playing.clear();
}

export function pauseAll() {
  playing.forEach((a) => {
    try {
      a.pause();
    } catch (err) {}
  });
}

export function resumeAll() {
  playing.forEach((a) => {
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {});
    }
  });
}

export function preload(srcs) {
  srcs.forEach((src) => {
    const a = getAudio(src);
    a.preload = 'auto';
    try {
      a.load();
    } catch (err) {}
  });
}

export function unlock() {
  if (unlocked) return;
  unlocked = true;
  const silence = new Audio(SILENCE_SRC);
  const p = silence.play();
  if (p && typeof p.catch === 'function') {
    p.catch(() => {});
  }
}

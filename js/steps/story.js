import * as audio from '../audio.js'
import { confetti } from '../fx.js'

const CROP = { x: 0, y: 700, w: 941, h: 770 }
const PAD = 6
const LEAD = 0.8
const HL = 2.5
const DUR = 0.85
const STEP = 0.5
const ATTRACT_TAIL = 1.5
const ATTRACT_END = 8.71
const ATTRACT_STOP = Math.max(0.5, ATTRACT_END - ATTRACT_TAIL)

const OBJECTS = [
  { key: 'cow', cut: './assets/story/objects/cow.with.png', halo: './assets/story/objects/cow.with.halo.png', box: [152, 919, 197, 268] },
  { key: 'alligator', cut: './assets/story/objects/alligator.png', halo: './assets/story/objects/alligator.halo.png', box: [550, 1020, 285, 203] },
  { key: 'bear', cut: './assets/story/objects/bear.with.png', halo: './assets/story/objects/bear.with.halo.png', box: [384, 888, 188, 252] },
  { key: 'ant', cut: './assets/story/objects/ant.png', halo: './assets/story/objects/ant.halo.png', box: [256, 1159, 84, 103] },
  { key: 'apple', cut: './assets/story/objects/apple.png', halo: './assets/story/objects/apple.halo.png', box: [389, 958, 52, 50] },
  { key: 'ball', cut: './assets/story/objects/ball.png', halo: './assets/story/objects/ball.halo.png', box: [590, 1243, 108, 112] },
  { key: 'cup', cut: './assets/story/objects/cup.png', halo: './assets/story/objects/cup.halo.png', box: [282, 1025, 49, 59] },
  { key: 'car', cut: './assets/story/objects/car.png', halo: './assets/story/objects/car.halo.png', box: [150, 771, 146, 113] },
  { key: 'bag', cut: './assets/story/objects/bag.png', halo: './assets/story/objects/bag.halo.png', box: [717, 962, 120, 127] },
]

const BEATS = [
  { t: 9.39, key: 'cow' },
  { t: 11.53, key: 'alligator' },
  { t: 13.59, key: 'bear' },
  { t: 15.77, key: 'ant' },
  { t: 21.85, key: 'cow' },
  { t: 24.0, key: 'alligator' },
  { t: 26.02, key: 'bear' },
  { t: 28.14, key: 'ant' },
]

const LYRICS = [
  { t: 8.49, text: 'I see a cow.', hl: 'cow' },
  { t: 10.63, text: 'I see an alligator.', hl: 'alligator' },
  { t: 12.69, text: 'I see a bear.', hl: 'bear' },
  { t: 14.87, text: 'I see an ant.', hl: 'ant' },
  { t: 20.95, text: 'I see a cow.', hl: 'cow' },
  { t: 23.1, text: 'I see an alligator.', hl: 'alligator' },
  { t: 25.12, text: 'I see a bear.', hl: 'bear' },
  { t: 27.24, text: 'I see an ant.', hl: 'ant' },
]

function pct(box) {
  return {
    l: ((box[0] - CROP.x) / CROP.w) * 100,
    t: ((box[1] - CROP.y) / CROP.h) * 100,
    w: (box[2] / CROP.w) * 100,
    h: (box[3] / CROP.h) * 100,
  }
}

function shuffle(list) {
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

function buildSchedule() {
  const keys = OBJECTS.map((o) => o.key)
  let pool = shuffle(keys)
  let pi = 0
  let t = 0.4
  const sched = []
  while (t < ATTRACT_STOP - 0.15) {
    const n = Math.random() < 0.35 ? 2 : 1
    const group = []
    for (let j = 0; j < n; j++) {
      if (pi >= pool.length) {
        pool = shuffle(keys)
        pi = 0
      }
      group.push(pool[pi++])
    }
    sched.push({ s: t, e: t + DUR, keys: group })
    t += STEP
  }
  return sched
}

function attractActive(t, sched) {
  const active = new Set()
  for (const slot of sched) {
    if (t >= slot.s && t < slot.e) slot.keys.forEach((k) => active.add(k))
  }
  return active
}

function lastBeatKey(t) {
  let b = null
  for (const beat of BEATS) {
    if (t >= beat.t - LEAD) b = beat
  }
  if (!b) return null
  return t - (b.t - LEAD) < HL ? b.key : null
}

function curLyric(t) {
  let L = null
  for (const ly of LYRICS) {
    if (t >= ly.t) L = ly
  }
  return L
}

function escRe(s) {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

export default {
  id: 'story',
  title: 'Story',
  mount(root, ctx) {
    root.classList.add('step-story')

    const frame = document.createElement('div')
    frame.className = 'story-frame'

    const badgeEl = document.createElement('div')
    badgeEl.className = 'story-badge'
    badgeEl.textContent = 'Get ready! 🎵'
    badgeEl.setAttribute('aria-hidden', 'true')
    frame.appendChild(badgeEl)

    const wrappers = {}
    OBJECTS.forEach((o) => {
      const wrap = document.createElement('div')
      wrap.className = 'story-obj'
      wrap.setAttribute('aria-hidden', 'true')
      const b = pct(o.box)
      wrap.style.left = b.l + '%'
      wrap.style.top = b.t + '%'
      wrap.style.width = b.w + '%'
      wrap.style.height = b.h + '%'

      const halo = document.createElement('img')
      halo.className = 'story-obj__halo'
      halo.src = o.halo
      halo.alt = ''

      const cut = document.createElement('img')
      cut.className = 'story-obj__cut'
      cut.src = o.cut
      cut.alt = ''
      cut.style.left = (PAD / o.box[2]) * 100 + '%'
      cut.style.top = (PAD / o.box[3]) * 100 + '%'
      cut.style.width = ((o.box[2] - 2 * PAD) / o.box[2]) * 100 + '%'
      cut.style.height = 'auto'

      wrap.append(halo, cut)
      frame.appendChild(wrap)
      wrappers[o.key] = wrap
    })

    const captionEl = document.createElement('div')
    captionEl.className = 'story-caption'
    captionEl.setAttribute('role', 'status')
    captionEl.setAttribute('aria-live', 'polite')
    const captionTextEl = document.createElement('span')
    captionEl.appendChild(captionTextEl)
    frame.appendChild(captionEl)

    root.appendChild(frame)

    const audioEl = new Audio('./assets/story/narration.mp3')
    audioEl.preload = 'auto'

    let alive = true
    let rafId = null
    let sched = buildSchedule()
    let curSig = ''
    let lastProgress = -1

    function setLit(activeKeys) {
      for (const o of OBJECTS) {
        wrappers[o.key].classList.toggle('is-lit', activeKeys.has(o.key))
      }
    }

    function renderCaption(ly) {
      if (!ly) {
        captionEl.classList.remove('is-on')
        return
      }
      let html = ly.text
      if (ly.hl) {
        const re = new RegExp('\\b(' + escRe(ly.hl) + 's?)\\b', 'i')
        html = html.replace(re, '<span class="story-caption__accent">$1</span>')
      }
      captionTextEl.innerHTML = html
      captionEl.classList.add('is-on')
    }

    function applyAt(t) {
      if (t < ATTRACT_STOP) {
        badgeEl.classList.add('is-on')
        const active = attractActive(t, sched)
        const sig = 'A' + [...active].sort().join(',')
        if (sig !== curSig) {
          curSig = sig
          setLit(active)
          renderCaption(null)
        }
      } else {
        badgeEl.classList.remove('is-on')
        const activeKey = lastBeatKey(t)
        const ly = curLyric(t)
        const sig = 'C' + (activeKey || '') + '|' + (ly ? ly.t : '')
        if (sig !== curSig) {
          curSig = sig
          setLit(activeKey ? new Set([activeKey]) : new Set())
          renderCaption(ly)
        }
      }

      let done = 0
      for (const b of BEATS) if (t >= b.t) done++
      if (done !== lastProgress) {
        lastProgress = done
        ctx.setProgress(done, BEATS.length)
      }
    }

    function tick() {
      if (!alive) return
      applyAt(audioEl.currentTime || 0)
      rafId = requestAnimationFrame(tick)
    }

    function onEnded() {
      if (!alive) return
      cancelAnimationFrame(rafId)
      curSig = ''
      setLit(new Set())
      renderCaption(null)
      badgeEl.classList.remove('is-on')
      ctx.setProgress(BEATS.length, BEATS.length)
      audio.chime('complete')
      confetti(root)
      ctx.onDone()
    }

    audioEl.addEventListener('ended', onEnded)

    function setPaused(paused) {
      root.classList.toggle('is-paused', paused)
      if (!alive) return
      if (paused) {
        audioEl.pause()
      } else {
        const p = audioEl.play()
        if (p && p.catch) p.catch(() => {})
      }
    }

    ctx.onPauseChange(setPaused)

    const startPaused = ctx.isPaused()
    if (startPaused) root.classList.add('is-paused')
    else {
      const p = audioEl.play()
      if (p && p.catch) p.catch(() => {})
    }

    ctx.setProgress(0, BEATS.length)
    applyAt(audioEl.currentTime || 0)
    rafId = requestAnimationFrame(tick)

    return function cleanup() {
      alive = false
      if (rafId) cancelAnimationFrame(rafId)
      audioEl.pause()
      audioEl.removeEventListener('ended', onEnded)
      audio.stopAll()
    }
  },
}

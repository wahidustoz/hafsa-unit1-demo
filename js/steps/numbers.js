import { DIGITS } from '../data.js'
import * as audio from '../audio.js'
import { confetti } from '../fx.js'

const HOLD_MS = 1300
const FINISH_HOLD_MS = 1500
const AUDIO_START_LATENCY_MS = 160
const TOTAL = DIGITS.length

function retrigger(el, cls) {
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
}

export default {
  id: 'numbers',
  title: 'Meet the Numbers',
  mount(root, ctx) {
    root.classList.add('step-numbers')

    root.innerHTML =
      '<div class="nm-stage">' +
        '<div class="nm-glyph" data-glyph aria-hidden="true"></div>' +
        '<div class="nm-plate" data-plate role="img"></div>' +
        '<div class="nm-word" data-word aria-hidden="true"></div>' +
      '</div>' +
      '<div class="nm-banner" data-banner hidden>' +
        '<p class="nm-banner__title">All ten numbers!</p>' +
      '</div>'

    const glyphEl = root.querySelector('[data-glyph]')
    const plateEl = root.querySelector('[data-plate]')
    const wordEl = root.querySelector('[data-word]')
    const bannerEl = root.querySelector('[data-banner]')

    let destroyed = false
    let paused = ctx.isPaused()
    let runGen = 0
    const timers = new Set()

    root.classList.toggle('is-paused', paused)

    function makeTimer(ms, onFire) {
      const t = { remaining: ms, startedAt: 0, handle: null, done: false }
      function arm() {
        t.startedAt = performance.now()
        t.handle = setTimeout(() => {
          t.handle = null
          t.done = true
          timers.delete(t)
          onFire()
        }, Math.max(0, t.remaining))
      }
      t.pauseIt = () => {
        if (t.done || t.handle === null) return
        clearTimeout(t.handle)
        t.handle = null
        t.remaining = Math.max(0, t.remaining - (performance.now() - t.startedAt))
      }
      t.resumeIt = () => {
        if (t.done || t.handle !== null) return
        arm()
      }
      t.cancelIt = () => {
        if (t.handle !== null) clearTimeout(t.handle)
        t.handle = null
        t.done = true
        timers.delete(t)
      }
      timers.add(t)
      if (!paused) arm()
      return t
    }

    function delay(ms) {
      return new Promise((resolve) => { makeTimer(ms, resolve) })
    }

    function clearTimers() {
      timers.forEach((t) => t.cancelIt())
      timers.clear()
    }

    function setPaused(next) {
      if (destroyed || paused === next) return
      paused = next
      root.classList.toggle('is-paused', paused)
      if (paused) {
        audio.pauseAll()
        timers.forEach((t) => t.pauseIt())
      } else {
        audio.resumeAll()
        timers.forEach((t) => t.resumeIt())
      }
    }

    function buildPlate(d) {
      plateEl.innerHTML = ''
      plateEl.style.setProperty('--n', String(Math.max(1, d.count)))
      plateEl.classList.toggle('is-empty', d.count === 0)
      plateEl.setAttribute('aria-label', d.count + ' ' + d.obj)
      for (let k = 0; k < d.count; k++) {
        const img = document.createElement('img')
        img.className = 'nm-plate__obj'
        img.style.setProperty('--i', String(k))
        img.src = d.img
        img.alt = ''
        plateEl.appendChild(img)
      }
    }

    function preloadNext(i) {
      const next = DIGITS[i + 1]
      if (!next) return
      audio.preload([next.clip])
      const warm = new Image()
      warm.src = next.img
    }

    function enterDigit(d) {
      glyphEl.textContent = d.digit
      wordEl.textContent = d.name
      buildPlate(d)
      plateEl.classList.remove('is-shown')
      wordEl.classList.remove('is-shown')
      retrigger(glyphEl, 'is-entering')
      glyphEl.classList.add('is-saying')
    }

    function revealCount() {
      glyphEl.classList.remove('is-saying')
      retrigger(glyphEl, 'is-popping')
      retrigger(plateEl, 'is-shown')
      retrigger(wordEl, 'is-shown')
    }

    async function playDigit(i, gen) {
      const d = DIGITS[i]
      ctx.setProgress(i, TOTAL)
      enterDigit(d)
      preloadNext(i)

      let revealed = false
      const revealTimer = makeTimer(d.wordAtMs + AUDIO_START_LATENCY_MS, () => {
        revealed = true
        revealCount()
      })

      await audio.play(d.clip)
      if (destroyed || gen !== runGen) {
        revealTimer.cancelIt()
        return
      }
      revealTimer.cancelIt()
      if (!revealed) revealCount()
      audio.chime('next')
      await delay(HOLD_MS)
    }

    async function finishAll(gen) {
      ctx.setProgress(TOTAL, TOTAL)
      audio.chime('complete')
      confetti(root)
      bannerEl.hidden = false
      retrigger(bannerEl, 'is-shown')
      await delay(FINISH_HOLD_MS)
      if (destroyed || gen !== runGen) return
      ctx.onDone()
    }

    async function run(startIndex) {
      const gen = runGen
      for (let i = startIndex; i < TOTAL; i++) {
        if (destroyed || gen !== runGen) return
        await playDigit(i, gen)
      }
      if (destroyed || gen !== runGen) return
      await finishAll(gen)
    }

    function seekTo(i) {
      if (destroyed) return
      runGen += 1
      clearTimers()
      audio.stopAll()
      bannerEl.hidden = true
      bannerEl.classList.remove('is-shown')
      run(Math.max(0, Math.min(i, TOTAL - 1)))
    }

    ctx.onPauseChange(setPaused)
    ctx.onSeek(seekTo)

    ctx.setProgress(0, TOTAL)
    run(0)

    return function cleanup() {
      destroyed = true
      clearTimers()
      audio.stopAll()
    }
  },
}

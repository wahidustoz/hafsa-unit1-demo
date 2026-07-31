import { UNIT1 } from '../data.js'
import * as audio from '../audio.js'
import { confetti } from '../fx.js'

const HOLD_MS = 1600
const FINISH_HOLD_MS = 1200
const TOTAL = UNIT1.length

function retrigger(el, cls) {
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
}

export default {
  id: 'hello',
  title: 'Hello',
  mount(root, ctx) {
    root.classList.add('step-hello')

    const stage = document.createElement('div')
    stage.className = 'hello-stage'

    const lettersRow = document.createElement('div')
    lettersRow.className = 'hello-letters'

    const letterFirst = document.createElement('span')
    letterFirst.className = 'hello-letter'
    letterFirst.style.setProperty('--i', '0')

    const letterSecond = document.createElement('span')
    letterSecond.className = 'hello-letter'
    letterSecond.style.setProperty('--i', '1')

    lettersRow.append(letterFirst, letterSecond)

    const objectWrap = document.createElement('div')
    objectWrap.className = 'hello-object'

    const shadowEl = document.createElement('div')
    shadowEl.className = 'hello-object__shadow'

    const img = document.createElement('img')
    img.className = 'hello-object__img'
    img.alt = ''

    const glow = document.createElement('div')
    glow.className = 'hello-object__glow'

    objectWrap.append(shadowEl, img, glow)

    const wordRow = document.createElement('div')
    wordRow.className = 'hello-word'

    stage.append(lettersRow, objectWrap, wordRow)

    const banner = document.createElement('div')
    banner.className = 'hello-banner'
    banner.hidden = true

    const bannerCard = document.createElement('p')
    bannerCard.className = 'hello-banner__title'
    bannerCard.textContent = 'Unit 1 words — all done!'
    banner.append(bannerCard)

    root.append(stage, banner)

    let destroyed = false
    let paused = typeof ctx.isPaused === 'function' ? !!ctx.isPaused() : false
    const timers = new Set()

    function setPausedVisual(next) {
      root.classList.toggle('is-paused', next)
    }
    setPausedVisual(paused)

    function makeTimer(ms, onFire) {
      const t = { remaining: ms, startedAt: 0, handle: null, done: false }
      function arm() {
        t.startedAt = performance.now()
        t.handle = setTimeout(() => {
          t.handle = null
          t.done = true
          timers.delete(t)
          onFire()
        }, t.remaining)
      }
      t.pauseIt = () => {
        if (t.done || t.handle === null) return
        clearTimeout(t.handle)
        t.handle = null
        t.remaining -= performance.now() - t.startedAt
        if (t.remaining < 0) t.remaining = 0
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

    function setPaused(next) {
      if (destroyed || paused === next) return
      paused = next
      setPausedVisual(paused)
      if (paused) {
        audio.pauseAll()
        timers.forEach((t) => t.pauseIt())
      } else {
        audio.resumeAll()
        timers.forEach((t) => t.resumeIt())
      }
    }

    if (typeof ctx.onPauseChange === 'function') ctx.onPauseChange(setPaused)

    function preloadNext(i) {
      const next = UNIT1[i + 1]
      if (!next) return
      audio.preload([next.utter])
      const warm = new Image()
      warm.src = next.img
    }

    function buildWordLetters(word) {
      wordRow.innerHTML = ''
      Array.from(word).forEach((ch, idx) => {
        const span = document.createElement('span')
        span.className = 'hello-word__letter'
        span.style.setProperty('--i', String(idx))
        span.textContent = ch
        wordRow.append(span)
      })
    }

    function enterWord(w) {
      const glyphs = w.letters.split(' ')
      letterFirst.textContent = glyphs[0] || ''
      letterSecond.textContent = glyphs[1] || ''
      img.src = w.img
      img.alt = w.word
      buildWordLetters(w.word)

      objectWrap.classList.remove('is-popping')
      wordRow.classList.remove('is-revealed')

      retrigger(lettersRow, 'is-entering')
      retrigger(objectWrap, 'is-entering')
      lettersRow.classList.add('is-saying')
    }

    function popWord(w) {
      lettersRow.classList.remove('is-saying')
      retrigger(objectWrap, 'is-popping')
      retrigger(wordRow, 'is-revealed')
    }

    async function playWord(i, gen) {
      const w = UNIT1[i]
      ctx.setProgress(i, TOTAL)
      enterWord(w)
      preloadNext(i)

      let popped = false
      const popTimer = makeTimer(w.wordAtMs, () => {
        popped = true
        popWord(w)
      })

      await audio.play(w.utter)
      if (destroyed || gen !== runGen) { popTimer.cancelIt(); return }

      popTimer.cancelIt()
      if (!popped) popWord(w)

      audio.chime('next')
      await delay(HOLD_MS)
    }

    async function finishAll(gen) {
      ctx.setProgress(TOTAL, TOTAL)
      audio.chime('complete')
      confetti(root)
      banner.hidden = false
      retrigger(banner, 'is-shown')
      await delay(FINISH_HOLD_MS)
      if (destroyed || gen !== runGen) return
      ctx.onDone()
    }

    let runGen = 0

    async function run(startIndex) {
      const gen = runGen
      for (let i = startIndex; i < TOTAL; i++) {
        if (destroyed || gen !== runGen) return
        await playWord(i, gen)
      }
      if (destroyed || gen !== runGen) return
      await finishAll(gen)
    }

    function seekTo(i) {
      if (destroyed) return
      runGen += 1
      timers.forEach((t) => t.cancelIt())
      timers.clear()
      audio.stopAll()
      banner.hidden = true
      banner.classList.remove('is-shown')
      run(Math.max(0, Math.min(i, TOTAL - 1)))
    }

    if (typeof ctx.onSeek === 'function') ctx.onSeek(seekTo)

    run(0)

    return function cleanup() {
      destroyed = true
      timers.forEach((t) => t.cancelIt())
      timers.clear()
      audio.stopAll()
    }
  }
}

import { UNIT1 } from '../data.js'
import * as audio from '../audio.js'
import { confetti } from '../fx.js'

const TOTAL = UNIT1.length
const FLASH_MS = 380
const HOLD_NEXT_MS = 1600
const COUNTDOWN_STEPS = [3, 2, 1]
const COUNTDOWN_BEAT_MS = 800
const SFX_WHOOSH = './assets/audio/sfx/transition-sting.mp3'
const SFX_TICK = './assets/audio/sfx/menu-hover.mp3'

function retrigger(el, cls) {
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
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

export default {
  id: 'peekaboo',
  title: 'Peek-a-boo',
  mount(root, ctx) {
    root.classList.add('step-peekaboo')
    root.innerHTML =
      '<div class="pk-stage">' +
        '<p class="pk-hint" data-hint>Ready…</p>' +
        '<div class="pk-arena">' +
          '<div class="pk-glow" data-glow></div>' +
          '<img class="pk-object" data-object alt="" />' +
          '<div class="pk-curtain" data-curtain>' +
            '<div class="pk-curtain__panel pk-curtain__panel--l"></div>' +
            '<div class="pk-curtain__panel pk-curtain__panel--r"></div>' +
            '<div class="pk-curtain__mark">?</div>' +
          '</div>' +
          '<div class="pk-countdown">' +
            '<span class="pk-countdown__num" data-countdown-num></span>' +
          '</div>' +
        '</div>' +
        '<div class="pk-answer" data-answer>' +
          '<div class="pk-letters" data-letters></div>' +
          '<div class="pk-word" data-word></div>' +
        '</div>' +
        '<div class="pk-actions" data-actions>' +
          '<button type="button" class="pk-peek btn btn--ghost btn--s" data-peek>Peek again</button>' +
          '<button type="button" class="pk-reveal btn btn--celebration btn--xl" data-reveal>Reveal!</button>' +
        '</div>' +
      '</div>'

    const hintEl = root.querySelector('[data-hint]')
    const glowEl = root.querySelector('[data-glow]')
    const objectEl = root.querySelector('[data-object]')
    const curtainEl = root.querySelector('[data-curtain]')
    const countdownNumEl = root.querySelector('[data-countdown-num]')
    const answerEl = root.querySelector('[data-answer]')
    const lettersEl = root.querySelector('[data-letters]')
    const wordEl = root.querySelector('[data-word]')
    const actionsEl = root.querySelector('[data-actions]')
    const peekBtn = root.querySelector('[data-peek]')
    const revealBtn = root.querySelector('[data-reveal]')

    const order = shuffle(UNIT1)
    let alive = true
    let paused = ctx.isPaused()
    let isFlashing = false
    let isCountingDown = false
    let pendingReveal = null

    const timers = new Set()

    function armTimer(t) {
      t.startedAt = performance.now()
      t.id = setTimeout(() => {
        timers.delete(t)
        t.cb()
      }, Math.max(0, t.remaining))
    }

    function disarmTimer(t) {
      if (t.id == null) return
      clearTimeout(t.id)
      t.remaining -= performance.now() - t.startedAt
      if (t.remaining < 0) t.remaining = 0
      t.id = null
    }

    function schedule(cb, delay) {
      const t = { cb, remaining: delay, id: null, startedAt: 0 }
      timers.add(t)
      if (!paused) armTimer(t)
      return t
    }

    function wait(ms) {
      return new Promise((resolve) => schedule(resolve, ms))
    }

    function clearAllTimers() {
      timers.forEach((t) => {
        if (t.id != null) clearTimeout(t.id)
      })
      timers.clear()
    }

    function setPaused(next) {
      if (paused === next) return
      paused = next
      if (paused) {
        timers.forEach(disarmTimer)
        audio.pauseAll()
      } else {
        timers.forEach((t) => {
          if (t.id == null) armTimer(t)
        })
        audio.resumeAll()
      }
      root.classList.toggle('is-paused', paused)
    }

    ctx.onPauseChange(setPaused)
    if (paused) root.classList.add('is-paused')

    function buildLetters(w) {
      lettersEl.innerHTML = ''
      wordEl.innerHTML = ''
      let i = 0
      w.letters.split(' ').forEach((ch) => {
        const span = document.createElement('span')
        span.className = 'pk-letter'
        span.style.setProperty('--i', i++)
        span.textContent = ch
        lettersEl.appendChild(span)
      })
      w.word.split('').forEach((ch) => {
        const span = document.createElement('span')
        span.className = 'pk-word-letter'
        span.style.setProperty('--i', i++)
        span.textContent = ch
        wordEl.appendChild(span)
      })
    }

    function prepareStage(w) {
      curtainEl.classList.remove('is-peeking', 'is-open')
      objectEl.classList.remove('is-flash', 'is-reveal')
      glowEl.classList.remove('is-active')
      answerEl.classList.remove('is-revealed')
      actionsEl.classList.remove('is-visible')
      countdownNumEl.classList.remove('is-pop')
      countdownNumEl.textContent = ''
      hintEl.textContent = 'Ready…'
      hintEl.classList.remove('is-question')
      objectEl.src = w.img
      objectEl.alt = w.word
      buildLetters(w)
    }

    async function runCountdown() {
      if (isCountingDown) return
      isCountingDown = true
      for (let i = 0; i < COUNTDOWN_STEPS.length; i++) {
        if (!alive) break
        countdownNumEl.textContent = String(COUNTDOWN_STEPS[i])
        retrigger(countdownNumEl, 'is-pop')
        audio.play(SFX_TICK)
        await wait(COUNTDOWN_BEAT_MS)
      }
      isCountingDown = false
    }

    async function countdownThenFlash() {
      await runCountdown()
      if (!alive) return
      await flash()
    }

    function flash() {
      if (isFlashing) return Promise.resolve()
      isFlashing = true
      curtainEl.classList.add('is-peeking')
      objectEl.classList.add('is-flash')
      audio.play(SFX_WHOOSH)
      return wait(FLASH_MS).then(() => {
        curtainEl.classList.remove('is-peeking')
        objectEl.classList.remove('is-flash')
        isFlashing = false
      })
    }

    function showRevealUI() {
      hintEl.textContent = 'What was it?'
      hintEl.classList.add('is-question')
      actionsEl.classList.add('is-visible')
    }

    function waitForReveal() {
      return new Promise((resolve) => {
        pendingReveal = resolve
      })
    }

    function onRevealClick() {
      if (!pendingReveal) return
      const resolve = pendingReveal
      pendingReveal = null
      actionsEl.classList.remove('is-visible')
      resolve()
    }

    function onPeekClick() {
      if (!pendingReveal || isCountingDown) return
      countdownThenFlash()
    }

    revealBtn.addEventListener('click', onRevealClick)
    peekBtn.addEventListener('click', onPeekClick)

    async function revealSequence(w) {
      curtainEl.classList.add('is-open')
      objectEl.classList.add('is-reveal')
      glowEl.classList.add('is-active')
      answerEl.classList.add('is-revealed')
      await audio.play(w.utter)
      if (!alive) return
      audio.chime('next')
    }

    async function run() {
      for (let i = 0; i < order.length; i++) {
        if (!alive) return
        ctx.setProgress(i, TOTAL)
        const w = order[i]
        prepareStage(w)
        await countdownThenFlash()
        if (!alive) return
        showRevealUI()
        await waitForReveal()
        if (!alive) return
        await revealSequence(w)
        if (!alive) return
        await wait(HOLD_NEXT_MS)
      }
      if (!alive) return
      ctx.setProgress(TOTAL, TOTAL)
      audio.chime('complete')
      confetti(root)
      ctx.onDone()
    }

    run()

    return function cleanup() {
      alive = false
      clearAllTimers()
      audio.stopAll()
      revealBtn.removeEventListener('click', onRevealClick)
      peekBtn.removeEventListener('click', onPeekClick)
    }
  },
}

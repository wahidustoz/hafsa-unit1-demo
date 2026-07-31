import { MATH_PROBLEMS } from '../data.js'
import * as audio from '../audio.js'
import { confetti } from '../fx.js'

const U2 = './assets/audio/unit2/'
const VOICE_INTRO = U2 + 'lets-add.mp3'
const AUDIO_START_LATENCY_MS = 160
const HOLD_MS = 1500
const FINISH_HOLD_MS = 1600
const TOTAL = MATH_PROBLEMS.length

function retrigger(el, cls) {
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
}

export default {
  id: 'addup',
  title: 'Add it up!',
  mount(root, ctx) {
    root.classList.add('step-addup')

    root.innerHTML =
      '<div class="ad-stage">' +
        '<div class="ad-eq" data-eq>' +
          '<div class="ad-group" data-group-a role="img"></div>' +
          '<span class="ad-op" data-op-plus aria-hidden="true">+</span>' +
          '<div class="ad-group" data-group-b role="img"></div>' +
          '<span class="ad-op ad-op--eq" aria-hidden="true">=</span>' +
          '<div class="ad-answer" data-answer role="status"><span class="ad-answer__value" data-value>?</span></div>' +
        '</div>' +
      '</div>'

    const eqEl = root.querySelector('[data-eq]')
    const groupAEl = root.querySelector('[data-group-a]')
    const groupBEl = root.querySelector('[data-group-b]')
    const plusEl = root.querySelector('[data-op-plus]')
    const answerEl = root.querySelector('[data-answer]')
    const valueEl = root.querySelector('[data-value]')

    let destroyed = false
    let paused = ctx.isPaused()
    let runGen = 0
    let objects = []
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

    function fillGroup(el, count, src, label) {
      el.innerHTML = ''
      el.style.setProperty('--n', String(count))
      el.setAttribute('aria-label', label)
      const made = []
      for (let k = 0; k < count; k++) {
        const slot = document.createElement('span')
        slot.className = 'ad-obj'
        slot.style.setProperty('--i', String(k))
        const img = document.createElement('img')
        img.className = 'ad-obj__img'
        img.src = src
        img.alt = ''
        const badge = document.createElement('span')
        badge.className = 'ad-obj__badge'
        badge.setAttribute('aria-hidden', 'true')
        slot.append(img, badge)
        el.appendChild(slot)
        made.push(slot)
      }
      return made
    }

    function labelFor(p, n) {
      return n === 1 ? p.obj : p.objPlural
    }

    function buildProblem(p) {
      eqEl.style.setProperty('--total', String(p.a + p.b))
      const a = fillGroup(groupAEl, p.a, p.img, p.a + ' ' + labelFor(p, p.a))
      const b = fillGroup(groupBEl, p.b, p.img, p.b + ' ' + labelFor(p, p.b))
      objects = a.concat(b)
      groupAEl.classList.remove('is-in')
      groupBEl.classList.remove('is-in')
      plusEl.classList.remove('is-in')
      answerEl.classList.remove('is-solved')
      valueEl.textContent = '?'
      answerEl.setAttribute('aria-label', 'Answer hidden')
    }

    function at(ms, fn) {
      makeTimer(Math.max(0, ms + AUDIO_START_LATENCY_MS), fn)
    }

    function scheduleTimeline(p) {
      at(p.aAtMs, () => retrigger(groupAEl, 'is-in'))
      at(p.joinAtMs, () => retrigger(plusEl, 'is-in'))
      at(p.bAtMs, () => retrigger(groupBEl, 'is-in'))
      p.countAtMs.forEach((ms, k) => {
        at(ms, () => {
          const slot = objects[k]
          if (!slot) return
          slot.classList.add('is-counted')
          slot.querySelector('.ad-obj__badge').textContent = String(k + 1)
          valueEl.textContent = String(k + 1)
          retrigger(valueEl, 'is-ticking')
        })
      })
      at(p.sumWordAtMs, () => {
        valueEl.textContent = String(p.sum)
        answerEl.classList.add('is-solved')
        answerEl.setAttribute('aria-label', 'The answer is ' + p.sum)
        retrigger(answerEl, 'is-landing')
        audio.chime('next')
      })
    }

    async function playProblem(i, gen) {
      const p = MATH_PROBLEMS[i]
      ctx.setProgress(i, TOTAL)
      buildProblem(p)
      scheduleTimeline(p)
      await audio.play(p.clip)
      if (destroyed || gen !== runGen) return
      await delay(HOLD_MS)
    }

    async function finishAll(gen) {
      ctx.setProgress(TOTAL, TOTAL)
      audio.chime('complete')
      confetti(root)
      await delay(FINISH_HOLD_MS)
      if (destroyed || gen !== runGen) return
      ctx.onDone()
    }

    async function run(startIndex, withIntro) {
      const gen = runGen
      if (withIntro) {
        buildProblem(MATH_PROBLEMS[startIndex])
        await audio.play(VOICE_INTRO)
        if (destroyed || gen !== runGen) return
      }
      for (let i = startIndex; i < TOTAL; i++) {
        if (destroyed || gen !== runGen) return
        await playProblem(i, gen)
      }
      if (destroyed || gen !== runGen) return
      await finishAll(gen)
    }

    function seekTo(i) {
      if (destroyed) return
      runGen += 1
      clearTimers()
      audio.stopAll()
      run(Math.max(0, Math.min(i, TOTAL - 1)), false)
    }

    ctx.onPauseChange(setPaused)
    ctx.onSeek(seekTo)

    ctx.setProgress(0, TOTAL)
    run(0, true)

    return function cleanup() {
      destroyed = true
      clearTimers()
      audio.stopAll()
    }
  },
}

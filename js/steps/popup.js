import * as audio from '../audio.js'
import { confetti, pointerHand } from '../fx.js'

const BURROW_COUNT = 5
const WAVE_MIN_MS = 2600
const WAVE_MAX_MS = 3400
const GAP_MS = 550
const CORRECT_HOLD_MS = 1300
const STAR_FLY_MS = 900
const IDLE_MS = 6000
const HINT_MS = 1800
const FINISH_HOLD_MS = 1600
const SPEAKER_PLAY_MS = 1200
const SFX_BOING = './assets/audio/sfx/boing.mp3'
const SFX_CORRECT = './assets/audio/sfx/correct.mp3'
const SFX_WRONG = './assets/audio/sfx/wrong.mp3'

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

function pickDistractors(words, target, n) {
  const pool = words.filter((w) => w.word !== target.word)
  return shuffle(pool).slice(0, n)
}

function pickSlots(n) {
  const all = []
  for (let i = 0; i < BURROW_COUNT; i++) all.push(i)
  return shuffle(all).slice(0, n)
}

function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

function burrowTemplate(i) {
  return (
    '<div class="pu-burrow" data-burrow="' + i + '">' +
      '<div class="pu-burrow__glow" aria-hidden="true"></div>' +
      '<div class="pu-burrow__well">' +
        '<button type="button" class="pu-burrow__critter" data-critter="' + i + '" tabindex="-1">' +
          '<img class="pu-burrow__img" alt="" />' +
        '</button>' +
      '</div>' +
      '<div class="pu-burrow__mound" aria-hidden="true">' +
        '<span class="pu-burrow__hole"></span>' +
      '</div>' +
    '</div>'
  )
}

export default {
  id: 'popup',
  title: 'Pop-Up Friends',
  mount(root, ctx) {
    root.classList.add('step-popup')

    root.innerHTML =
      '<div class="pu-stage">' +
        '<div class="pu-top">' +
          '<div class="pu-prompt">' +
            '<button type="button" class="pu-speaker" data-speaker aria-label="Play the word again">' +
              '<span aria-hidden="true">🔊</span>' +
            '</button>' +
            '<div class="pu-prompt__body">' +
              '<span class="pu-prompt__chip" data-chip></span>' +
              '<span class="pu-prompt__word" data-word></span>' +
            '</div>' +
          '</div>' +
          '<div class="pu-scorerow" data-scorerow role="status" aria-label="Friends found"></div>' +
        '</div>' +
        '<div class="pu-field" data-field role="group" aria-label="Candy burrows">' +
          '<div class="pu-row pu-row--back">' + burrowTemplate(0) + burrowTemplate(1) + burrowTemplate(2) + '</div>' +
          '<div class="pu-row pu-row--front">' + burrowTemplate(3) + burrowTemplate(4) + '</div>' +
        '</div>' +
      '</div>'

    const stageEl = root.querySelector('.pu-stage')
    const fieldEl = root.querySelector('[data-field]')
    const speakerEl = root.querySelector('[data-speaker]')
    const chipEl = root.querySelector('[data-chip]')
    const wordEl = root.querySelector('[data-word]')
    const scoreRowEl = root.querySelector('[data-scorerow]')

    const burrowEls = []
    for (let i = 0; i < BURROW_COUNT; i++) {
      const wrap = root.querySelector('.pu-burrow[data-burrow="' + i + '"]')
      burrowEls.push({
        wrap,
        critter: wrap.querySelector('.pu-burrow__critter'),
        img: wrap.querySelector('.pu-burrow__img'),
      })
    }

    const words = ctx.unit.words
    const total = words.length

    scoreRowEl.innerHTML = words.map((_, i) => '<span class="pu-star" data-star="' + i + '">⭐</span>').join('')
    const scoreEls = Array.from(scoreRowEl.querySelectorAll('[data-star]'))

    const order = shuffle(words)
    const burrowState = []
    for (let i = 0; i < BURROW_COUNT; i++) burrowState.push({ up: false, isTarget: false })

    let destroyed = false
    let paused = ctx.isPaused()
    let roundIndex = 0
    let roundGen = 0
    let missCount = 0
    let scaffolding = false
    let idleTimer = null

    const timers = new Set()

    function armTimer(t) {
      t.startedAt = performance.now()
      t.id = setTimeout(() => {
        timers.delete(t)
        t.id = null
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

    function cancelScheduled(t) {
      if (!t) return
      if (t.id != null) clearTimeout(t.id)
      timers.delete(t)
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
      if (destroyed || paused === next) return
      paused = next
      root.classList.toggle('is-paused', paused)
      if (paused) {
        timers.forEach(disarmTimer)
        audio.pauseAll()
      } else {
        timers.forEach((t) => {
          if (t.id == null) armTimer(t)
        })
        audio.resumeAll()
      }
    }

    ctx.onPauseChange(setPaused)
    if (paused) root.classList.add('is-paused')

    function setCritterClass(slotIdx, cls) {
      const b = burrowEls[slotIdx]
      b.critter.classList.remove('is-up', 'is-wrong', 'is-correct', 'is-sink')
      void b.critter.offsetWidth
      if (cls) b.critter.classList.add(cls)
      b.wrap.classList.toggle('is-up', cls === 'is-up')
    }

    function popUp(slotIdx, word, isTarget) {
      const b = burrowEls[slotIdx]
      burrowState[slotIdx] = { up: true, isTarget }
      b.img.src = word.img
      b.img.alt = word.word
      b.wrap.dataset.role = isTarget ? 'target' : 'distractor'
      b.critter.setAttribute('aria-label', word.word)
      b.critter.tabIndex = 0
      setCritterClass(slotIdx, 'is-up')
      audio.play(SFX_BOING)
    }

    function duck(slotIdx, kind) {
      const b = burrowEls[slotIdx]
      burrowState[slotIdx].up = false
      b.critter.tabIndex = -1
      b.critter.removeAttribute('aria-label')
      setCritterClass(slotIdx, kind === 'wrong' ? 'is-wrong' : kind === 'correct' ? 'is-correct' : 'is-sink')
    }

    function hardResetBurrows() {
      for (let i = 0; i < BURROW_COUNT; i++) {
        burrowState[i] = { up: false, isTarget: false }
        const b = burrowEls[i]
        b.critter.classList.remove('is-up', 'is-wrong', 'is-correct', 'is-sink')
        b.critter.tabIndex = -1
        b.critter.removeAttribute('aria-label')
        b.wrap.classList.remove('is-up')
        delete b.wrap.dataset.role
      }
    }

    function showPrompt(w) {
      const parts = w.letters.split(' ')
      chipEl.textContent = parts[0] || ''
      wordEl.textContent = w.word
    }

    function armIdle() {
      idleTimer = schedule(onIdle, IDLE_MS)
    }

    function cancelIdle() {
      if (idleTimer) {
        cancelScheduled(idleTimer)
        idleTimer = null
      }
    }

    function resetIdle() {
      cancelIdle()
      armIdle()
    }

    async function onIdle() {
      idleTimer = null
      if (destroyed || paused) return
      const target = order[roundIndex]
      audio.play(target.utter)
      const upTargetSlot = burrowState.findIndex((b) => b.up && b.isTarget)
      let removeHint = null
      if (upTargetSlot !== -1) {
        removeHint = pointerHand(fieldEl, burrowEls[upTargetSlot].critter)
      }
      await wait(HINT_MS)
      if (removeHint) removeHint()
      if (destroyed) return
      armIdle()
    }

    function flyStar(slotIdx, idx) {
      const scoreSlot = scoreEls[idx]
      if (!scoreSlot) return
      if (reducedMotion()) {
        scoreSlot.classList.add('is-filled')
        return
      }
      const fromEl = burrowEls[slotIdx].critter
      const stageRect = stageEl.getBoundingClientRect()
      const fromRect = fromEl.getBoundingClientRect()
      const toRect = scoreSlot.getBoundingClientRect()
      const star = document.createElement('span')
      star.className = 'pu-flying-star'
      star.textContent = '⭐'
      star.setAttribute('aria-hidden', 'true')
      const startX = fromRect.left - stageRect.left + fromRect.width / 2
      const startY = fromRect.top - stageRect.top + fromRect.height / 2
      const dx = toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2)
      const dy = toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2)
      star.style.left = startX + 'px'
      star.style.top = startY + 'px'
      star.style.setProperty('--dx', dx + 'px')
      star.style.setProperty('--dy', dy + 'px')
      stageEl.appendChild(star)
      schedule(() => {
        star.remove()
        scoreSlot.classList.add('is-filled')
      }, STAR_FLY_MS)
    }

    async function runWave(target, gen) {
      const count = Math.random() < 0.5 ? 2 : 3
      const distractors = pickDistractors(words, target, count - 1)
      const words = shuffle([target, ...distractors])
      const slots = pickSlots(count)
      slots.forEach((slotIdx, i) => popUp(slotIdx, words[i], words[i] === target))
      const duration = WAVE_MIN_MS + Math.random() * (WAVE_MAX_MS - WAVE_MIN_MS)
      await wait(duration)
      if (gen !== roundGen || destroyed) return
      slots.forEach((slotIdx) => {
        if (burrowState[slotIdx].up) duck(slotIdx, 'sink')
      })
    }

    async function runWaves(target, gen) {
      while (gen === roundGen && !destroyed) {
        await runWave(target, gen)
        if (gen !== roundGen || destroyed) return
        await wait(GAP_MS)
      }
    }

    function startRound() {
      const gen = ++roundGen
      missCount = 0
      scaffolding = false
      fieldEl.classList.remove('is-scaffold')
      hardResetBurrows()
      const target = order[roundIndex]
      ctx.setProgress(roundIndex, total)
      showPrompt(target)
      audio.play(target.utter)
      resetIdle()
      runWaves(target, gen)
    }

    function onWrong(slotIdx) {
      duck(slotIdx, 'wrong')
      audio.play(SFX_WRONG)
      missCount += 1
      if (missCount === 2 && !scaffolding) {
        scaffolding = true
        fieldEl.classList.add('is-scaffold')
      }
    }

    async function onCorrect(slotIdx) {
      roundGen += 1
      cancelIdle()
      duck(slotIdx, 'correct')
      audio.play(SFX_CORRECT)
      burrowState.forEach((b, i) => {
        if (i !== slotIdx && b.up) duck(i, 'sink')
      })
      flyStar(slotIdx, roundIndex)
      await wait(CORRECT_HOLD_MS)
      if (destroyed) return
      roundIndex += 1
      if (roundIndex >= total) {
        await finish()
      } else {
        startRound()
      }
    }

    async function finish() {
      ctx.setProgress(total, total)
      hardResetBurrows()
      audio.chime('complete')
      confetti(root)
      await wait(FINISH_HOLD_MS)
      if (destroyed) return
      ctx.onDone()
    }

    function onCritterActivate(slotIdx) {
      if (destroyed || paused) return
      const b = burrowState[slotIdx]
      if (!b.up) return
      resetIdle()
      if (b.isTarget) onCorrect(slotIdx)
      else onWrong(slotIdx)
    }

    function onFieldClick(event) {
      const el = event.target.closest('[data-critter]')
      if (!el) return
      onCritterActivate(Number(el.dataset.critter))
    }

    function onFieldKeydown(event) {
      if (event.key !== 'Enter' && event.key !== ' ') return
      const el = event.target.closest('[data-critter]')
      if (!el) return
      event.preventDefault()
      onCritterActivate(Number(el.dataset.critter))
    }

    function onSpeakerClick() {
      if (destroyed || paused) return
      resetIdle()
      audio.play(order[roundIndex].utter)
      speakerEl.classList.add('is-playing')
      schedule(() => speakerEl.classList.remove('is-playing'), SPEAKER_PLAY_MS)
    }

    function seekTo(i) {
      if (destroyed) return
      roundGen += 1
      cancelIdle()
      clearAllTimers()
      audio.stopAll()
      roundIndex = Math.max(0, Math.min(i, total - 1))
      startRound()
    }

    fieldEl.addEventListener('click', onFieldClick)
    fieldEl.addEventListener('keydown', onFieldKeydown)
    speakerEl.addEventListener('click', onSpeakerClick)

    ctx.onSeek(seekTo)
    startRound()

    return function cleanup() {
      destroyed = true
      cancelIdle()
      clearAllTimers()
      audio.stopAll()
      fieldEl.removeEventListener('click', onFieldClick)
      fieldEl.removeEventListener('keydown', onFieldKeydown)
      speakerEl.removeEventListener('click', onSpeakerClick)
    }
  },
}

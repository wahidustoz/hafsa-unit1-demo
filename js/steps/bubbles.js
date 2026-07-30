import { UNIT1 } from '../data.js'
import * as audio from '../audio.js'
import { confetti, pointerHand } from '../fx.js'

const LETTERS = ['A', 'B', 'C']
const IDLE_MS = 6000
const HINT_MS = 2600
const MISS_SCAFFOLD_AT = 2
const POP_FLY_DELAY = 140
const POP_HIDE_DELAY = 560
const FLY_MS = 320
const CLEAR_DELAY = 420
const WRONG_SHAKE_MS = 600
const SPEAKER_GLOW_MS = 1600
const SFX_POP = './assets/audio/sfx/pop.mp3'
const SFX_WRONG = './assets/audio/sfx/wrong.mp3'

const BURST_DOTS = [
  [-46, -34, 11], [48, -28, 9], [-38, 38, 10],
  [42, 44, 12], [-6, -52, 8], [8, 54, 9]
]

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

function retrigger(el, cls) {
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
}

function wordsFor(letter) {
  return UNIT1.filter((w) => w.letter === letter)
}

function pickDistractors(letter) {
  return shuffle(UNIT1.filter((w) => w.letter !== letter)).slice(0, 3)
}

function voiceFor(letter) {
  return './assets/audio/voice/pop-the-' + letter.toLowerCase() + '.mp3'
}

export default {
  id: 'bubbles',
  title: 'Bubble Pop',
  mount(root, ctx) {
    root.classList.add('step-bubbles')

    root.innerHTML =
      '<div class="bp-stage">' +
        '<div class="prompt-banner bp-prompt">' +
          '<span class="prompt-banner__letter" data-letter aria-hidden="true"></span>' +
          '<p class="prompt-banner__text" data-prompt-text></p>' +
          '<button type="button" class="speaker-btn" data-speaker aria-label="Hear the instruction again">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
              '<path d="M4 9.5 h3.5 L12.5 5 v14 L7.5 14.5 H4 Z" fill="var(--ink)"/>' +
              '<path d="M15.5 9 q2 3 0 6 M18 6.5 q3.5 5.5 0 11" fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
        '<div class="bp-field" data-field role="group"></div>' +
        '<div class="bp-tray-zone">' +
          '<div class="tray" data-tray role="status">' +
            '<span class="tray__slot" data-slot></span>' +
            '<span class="tray__slot" data-slot></span>' +
            '<span class="tray__slot" data-slot></span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="overlay overlay--celebrate is-hidden bp-clear" data-clear role="dialog" aria-modal="true">' +
        '<div class="overlay__card">' +
          '<h2 class="overlay__title" data-clear-title>All popped!</h2>' +
          '<p class="overlay__text" data-clear-text></p>' +
          '<div class="overlay__stars" aria-hidden="true">' +
            '<svg class="star" viewBox="-13 -13 26 26"><use href="#bp-star-shape"/></svg>' +
            '<svg class="star" viewBox="-13 -13 26 26"><use href="#bp-star-shape"/></svg>' +
            '<svg class="star" viewBox="-13 -13 26 26"><use href="#bp-star-shape"/></svg>' +
          '</div>' +
          '<div class="overlay__actions">' +
            '<button type="button" class="btn btn--primary btn--xl" data-clear-next>Next</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">' +
        '<defs><path id="bp-star-shape" d="M0 -10 L3.06 -4.21 L9.51 -3.09 L4.94 1.61 L5.88 8.09 L0 5.2 L-5.88 8.09 L-4.94 1.61 L-9.51 -3.09 L-3.06 -4.21 Z"/></defs>' +
      '</svg>'

    const letterEl = root.querySelector('[data-letter]')
    const promptTextEl = root.querySelector('[data-prompt-text]')
    const speakerBtn = root.querySelector('[data-speaker]')
    const fieldEl = root.querySelector('[data-field]')
    const trayEl = root.querySelector('[data-tray]')
    const slotEls = Array.from(root.querySelectorAll('[data-slot]'))
    const clearEl = root.querySelector('[data-clear]')
    const clearTitleEl = root.querySelector('[data-clear-title]')
    const clearTextEl = root.querySelector('[data-clear-text]')
    const clearNextBtn = root.querySelector('[data-clear-next]')

    let destroyed = false
    let paused = ctx.isPaused()
    let letterIndex = 0
    let bubbles = []
    let collected = 0
    let missCount = 0
    let roundActive = false
    let hintCleanup = null
    let idleTimer = null

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

    function unschedule(t) {
      if (!t) return
      if (t.id != null) clearTimeout(t.id)
      timers.delete(t)
    }

    function clearAllTimers() {
      timers.forEach((t) => {
        if (t.id != null) clearTimeout(t.id)
      })
      timers.clear()
    }

    function clearHint() {
      if (hintCleanup) {
        hintCleanup()
        hintCleanup = null
      }
    }

    function rearmIdle() {
      unschedule(idleTimer)
      idleTimer = schedule(onIdle, IDLE_MS)
    }

    function onIdle() {
      if (destroyed || paused || !roundActive) return
      audio.play(voiceFor(LETTERS[letterIndex]))
      clearHint()
      const target = bubbles.find((b) => b.correct && !b.popped)
      if (target) {
        hintCleanup = pointerHand(root, target.btn)
        schedule(clearHint, HINT_MS)
      }
      rearmIdle()
    }

    function buildBubble(word, correct, index) {
      const wrap = document.createElement('div')
      wrap.className = 'bp-bubble bp-bubble--' + ((index % 3) + 1)
      if (correct) wrap.classList.add('bp-bubble--target')
      wrap.style.setProperty('--bp-bt', (2.6 + Math.random() * 1.2).toFixed(2) + 's')
      wrap.style.setProperty('--bp-bd', (Math.random() * 0.9).toFixed(2) + 's')
      wrap.style.setProperty('--bp-bob', (-9 - Math.random() * 6).toFixed(1) + 'px')

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'bp-bubble__btn feedback is-entering'
      btn.style.animationDelay = (index * 70) + 'ms'
      btn.setAttribute('aria-label', word.word.charAt(0).toUpperCase() + word.word.slice(1) + ' — tap to pop!')

      const ring = document.createElement('span')
      ring.className = 'bp-bubble__ring'
      ring.setAttribute('aria-hidden', 'true')

      const img = document.createElement('img')
      img.className = 'bp-bubble__img'
      img.src = word.img
      img.alt = ''

      const label = document.createElement('span')
      label.className = 'bp-bubble__word'
      label.setAttribute('aria-hidden', 'true')
      label.innerHTML = '<b>' + word.word.charAt(0) + '</b>' + word.word.slice(1)

      const burst = document.createElement('span')
      burst.className = 'bp-bubble__burst'
      burst.setAttribute('aria-hidden', 'true')
      BURST_DOTS.forEach((d, i) => {
        const dot = document.createElement('i')
        dot.style.cssText = '--dx:' + d[0] + 'px;--dy:' + d[1] + 'px;--sz:' + d[2] + 'px;--bp-delay:' + (i * 28) + 'ms'
        burst.appendChild(dot)
      })

      btn.append(ring, img, label, burst)
      wrap.appendChild(btn)

      const bubble = { word, correct, el: wrap, btn, popped: false, slotIndex: -1 }
      btn.addEventListener('click', () => onBubbleTap(bubble))

      schedule(() => {
        btn.classList.remove('is-entering')
        btn.style.animationDelay = ''
      }, 900 + index * 70)

      return bubble
    }

    function startRound(index) {
      letterIndex = index
      const letter = LETTERS[index]
      collected = 0
      missCount = 0
      roundActive = true
      clearHint()

      const correctWords = wordsFor(letter)
      const distractors = pickDistractors(letter)
      const pool = shuffle(
        correctWords.map((w) => ({ w, correct: true }))
          .concat(distractors.map((w) => ({ w, correct: false })))
      )

      fieldEl.innerHTML = ''
      fieldEl.classList.remove('is-scaffold')
      bubbles = pool.map((entry, i) => buildBubble(entry.w, entry.correct, i))
      bubbles.forEach((b) => fieldEl.appendChild(b.el))

      letterEl.textContent = letter
      promptTextEl.textContent = 'Pop the ' + letter + ' bubbles!'
      trayEl.classList.remove('is-complete')
      trayEl.setAttribute('aria-label', '0 of 3 ' + letter + ' words collected')
      slotEls.forEach((s) => {
        s.innerHTML = ''
        s.classList.remove('is-filled')
      })
      clearEl.classList.add('is-hidden')

      ctx.setProgress(index, LETTERS.length)
      audio.play(voiceFor(letter))
      rearmIdle()
    }

    function onBubbleTap(bubble) {
      if (destroyed || paused || !roundActive || bubble.popped) return
      rearmIdle()
      if (bubble.correct) {
        popBubble(bubble)
      } else {
        missCount += 1
        audio.play(SFX_WRONG)
        retrigger(bubble.btn, 'is-wrong')
        schedule(() => bubble.btn.classList.remove('is-wrong'), WRONG_SHAKE_MS)
        retrigger(letterEl, 'is-nudging')
        if (missCount === MISS_SCAFFOLD_AT) {
          fieldEl.classList.add('is-scaffold')
        }
      }
    }

    function popBubble(bubble) {
      bubble.popped = true
      collected += 1
      bubble.slotIndex = collected - 1
      const isLast = collected === 3
      if (isLast) {
        roundActive = false
        unschedule(idleTimer)
        clearHint()
      }
      audio.play(SFX_POP)
      bubble.el.classList.add('is-popping')
      schedule(() => flyToSlot(bubble, isLast), POP_FLY_DELAY)
      schedule(() => bubble.el.classList.add('is-popped'), POP_HIDE_DELAY)
    }

    function flyToSlot(bubble, isLast) {
      const slot = slotEls[bubble.slotIndex]
      if (!slot) return
      const rootRect = root.getBoundingClientRect()
      const btnRect = bubble.btn.getBoundingClientRect()
      const slotRect = slot.getBoundingClientRect()
      const size = 56
      const x0 = btnRect.left - rootRect.left + btnRect.width / 2 - size / 2
      const y0 = btnRect.top - rootRect.top + btnRect.height / 2 - size / 2
      const dx = slotRect.left - rootRect.left + slotRect.width / 2 - size / 2 - x0
      const dy = slotRect.top - rootRect.top + slotRect.height / 2 - size / 2 - y0

      const fly = document.createElement('div')
      fly.className = 'bp-fly'
      fly.setAttribute('aria-hidden', 'true')
      const img = document.createElement('img')
      img.src = bubble.word.img
      img.alt = ''
      fly.appendChild(img)
      fly.style.left = x0 + 'px'
      fly.style.top = y0 + 'px'
      root.appendChild(fly)

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fly.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(.92) rotate(6deg)'
        })
      })

      schedule(() => {
        fly.remove()
        const slotImg = document.createElement('img')
        slotImg.src = bubble.word.img
        slotImg.alt = bubble.word.word
        slot.innerHTML = ''
        slot.appendChild(slotImg)
        slot.classList.add('is-filled')
        const filledCount = slotEls.filter((s) => s.classList.contains('is-filled')).length
        trayEl.setAttribute('aria-label', filledCount + ' of 3 ' + LETTERS[letterIndex] + ' words collected')
        audio.play(bubble.word.utter)
        if (isLast) {
          trayEl.classList.add('is-complete')
          schedule(showClear, CLEAR_DELAY)
        }
      }, FLY_MS)
    }

    function showClear() {
      const letter = LETTERS[letterIndex]
      const isLast = letterIndex === LETTERS.length - 1
      audio.chime('complete')
      confetti(root)
      clearTitleEl.textContent = 'All popped!'
      clearTextEl.textContent = 'Letter ' + letter + ' — every bubble found'
      clearNextBtn.textContent = isLast ? 'Great job!' : 'Letter ' + LETTERS[letterIndex + 1] + '!'
      clearEl.classList.remove('is-hidden')
    }

    function onClearNext() {
      if (destroyed) return
      const isLast = letterIndex === LETTERS.length - 1
      clearEl.classList.add('is-hidden')
      if (isLast) {
        ctx.setProgress(LETTERS.length, LETTERS.length)
        ctx.onDone()
      } else {
        startRound(letterIndex + 1)
      }
    }

    function onSpeakerClick() {
      if (destroyed || paused) return
      rearmIdle()
      retrigger(speakerBtn, 'is-playing')
      schedule(() => speakerBtn.classList.remove('is-playing'), SPEAKER_GLOW_MS)
      audio.play(voiceFor(LETTERS[letterIndex]))
    }

    clearNextBtn.addEventListener('click', onClearNext)
    speakerBtn.addEventListener('click', onSpeakerClick)

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

    startRound(0)

    return function cleanup() {
      destroyed = true
      clearAllTimers()
      clearHint()
      audio.stopAll()
      clearNextBtn.removeEventListener('click', onClearNext)
      speakerBtn.removeEventListener('click', onSpeakerClick)
    }
  }
}

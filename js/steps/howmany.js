import * as audio from '../audio.js'
import { confetti, pointerHand } from '../fx.js'

const U2 = './assets/audio/unit2/'
const SFX_CORRECT = './assets/audio/sfx/correct.mp3'
const SFX_WRONG = './assets/audio/sfx/wrong.mp3'
const VOICE_PROMPT = U2 + 'how-many.mp3'
const VOICE_DONE = U2 + 'nice-counting.mp3'

const IMAGES = [
  './assets/images/apple.png',
  './assets/images/ball.png',
  './assets/images/cup.png',
  './assets/images/car.png',
  './assets/images/bear.png',
  './assets/images/bag.png',
]
const COUNTS = [1, 2, 3, 4, 5]
const CHOICES = 3
const MISS_SCAFFOLD_AT = 2
const IDLE_MS = 7000
const HINT_MS = 2200
const NEXT_DELAY_MS = 1500
const FINISH_HOLD_MS = 1600
const WRONG_SHAKE_MS = 600
const SPEAKER_GLOW_MS = 1400

const SPEAKER_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M4 9.5 h3.5 L12.5 5 v14 L7.5 14.5 H4 Z" fill="var(--ink)"/>' +
    '<path d="M15.5 9 q2 3 0 6 M18 6.5 q3.5 5.5 0 11" fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round"/>' +
  '</svg>'

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

function buildRounds() {
  const order = shuffle(COUNTS)
  const art = shuffle(IMAGES)
  return order.map((count, i) => ({
    count,
    img: art[i % art.length],
    options: shuffle(shuffle(COUNTS.filter((n) => n !== count)).slice(0, CHOICES - 1).concat(count)),
  }))
}

export default {
  id: 'howmany',
  title: 'How many?',
  noPause: true,
  noTitle: true,
  mount(root, ctx) {
    root.classList.add('step-howmany')

    root.innerHTML =
      '<div class="hm-stage">' +
        '<div class="hm-prompt">' +
          '<p class="hm-prompt__text t-display">How many?</p>' +
          '<button type="button" class="speaker-btn" data-speaker aria-label="Hear the question again">' +
            SPEAKER_SVG +
          '</button>' +
        '</div>' +
        '<div class="hm-plate" data-plate role="img"></div>' +
        '<div class="hm-choices" data-choices role="group" aria-label="Pick the number"></div>' +
      '</div>'

    const plateEl = root.querySelector('[data-plate]')
    const choicesEl = root.querySelector('[data-choices]')
    const speakerEl = root.querySelector('[data-speaker]')

    const rounds = buildRounds()
    const TOTAL = rounds.length

    let destroyed = false
    let roundIndex = 0
    let missCount = 0
    let roundActive = false
    let hintCleanup = null
    let idleTimer = null
    const timers = new Set()

    function schedule(cb, ms) {
      const t = { id: null }
      t.id = setTimeout(() => {
        timers.delete(t)
        cb()
      }, Math.max(0, ms))
      timers.add(t)
      return t
    }

    function unschedule(t) {
      if (!t) return
      clearTimeout(t.id)
      timers.delete(t)
    }

    function clearTimers() {
      timers.forEach((t) => clearTimeout(t.id))
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
      if (destroyed || !roundActive) return
      clearHint()
      audio.playVoice(VOICE_PROMPT)
      const target = choicesEl.querySelector('.hm-card[data-correct="1"]')
      if (target) {
        hintCleanup = pointerHand(root, target)
        schedule(clearHint, HINT_MS)
      }
      rearmIdle()
    }

    function buildRound(round) {
      plateEl.innerHTML = ''
      plateEl.style.setProperty('--n', String(round.count))
      plateEl.setAttribute('aria-label', 'A group of things to count')
      for (let k = 0; k < round.count; k++) {
        const img = document.createElement('img')
        img.className = 'hm-plate__obj'
        img.style.setProperty('--i', String(k))
        img.src = round.img
        img.alt = ''
        plateEl.appendChild(img)
      }

      choicesEl.innerHTML = ''
      choicesEl.classList.remove('is-scaffold')
      round.options.forEach((value, k) => {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'hm-card feedback'
        btn.style.setProperty('--i', String(k))
        btn.dataset.value = String(value)
        if (value === round.count) btn.dataset.correct = '1'
        btn.setAttribute('aria-label', 'Number ' + value)
        btn.textContent = String(value)
        choicesEl.appendChild(btn)
      })
    }

    function startRound(index) {
      roundIndex = index
      missCount = 0
      roundActive = true
      clearHint()
      buildRound(rounds[index])
      ctx.setProgress(index, TOTAL)
      audio.playVoice(VOICE_PROMPT)
      rearmIdle()
    }

    function onCardTap(btn) {
      if (destroyed || !roundActive) return
      rearmIdle()
      const round = rounds[roundIndex]
      if (Number(btn.dataset.value) === round.count) {
        roundActive = false
        unschedule(idleTimer)
        clearHint()
        retrigger(btn, 'is-correct')
        audio.play(SFX_CORRECT)
        plateEl.classList.add('is-solved')
        audio.playVoice(U2 + 'total-' + round.count + '.mp3').then(() => {
          if (destroyed) return
          schedule(goNext, NEXT_DELAY_MS)
        })
        return
      }
      missCount += 1
      audio.play(SFX_WRONG)
      retrigger(btn, 'is-wrong')
      schedule(() => btn.classList.remove('is-wrong'), WRONG_SHAKE_MS)
      if (missCount === MISS_SCAFFOLD_AT) choicesEl.classList.add('is-scaffold')
    }

    function goNext() {
      if (destroyed) return
      plateEl.classList.remove('is-solved')
      if (roundIndex + 1 >= TOTAL) finishAll()
      else startRound(roundIndex + 1)
    }

    function finishAll() {
      ctx.setProgress(TOTAL, TOTAL)
      audio.chime('complete')
      confetti(root)
      audio.playVoice(VOICE_DONE)
      schedule(() => {
        if (destroyed) return
        ctx.onDone()
      }, FINISH_HOLD_MS)
    }

    function onChoicesClick(event) {
      const btn = event.target.closest('.hm-card')
      if (btn) onCardTap(btn)
    }

    function onSpeakerClick() {
      if (destroyed) return
      rearmIdle()
      retrigger(speakerEl, 'is-playing')
      schedule(() => speakerEl.classList.remove('is-playing'), SPEAKER_GLOW_MS)
      audio.playVoice(VOICE_PROMPT)
    }

    function seekTo(i) {
      if (destroyed) return
      clearTimers()
      clearHint()
      audio.stopAll()
      plateEl.classList.remove('is-solved')
      startRound(Math.max(0, Math.min(i, TOTAL - 1)))
    }

    choicesEl.addEventListener('click', onChoicesClick)
    speakerEl.addEventListener('click', onSpeakerClick)
    ctx.onSeek(seekTo)

    startRound(0)

    return function cleanup() {
      destroyed = true
      clearTimers()
      clearHint()
      audio.stopAll()
      choicesEl.removeEventListener('click', onChoicesClick)
      speakerEl.removeEventListener('click', onSpeakerClick)
    }
  },
}

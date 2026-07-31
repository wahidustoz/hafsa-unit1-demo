import * as audio from '../audio.js'
import { confetti, pointerHand } from '../fx.js'

const U2 = './assets/audio/unit2/'
const SFX_CORRECT = './assets/audio/sfx/correct.mp3'
const SFX_WRONG = './assets/audio/sfx/wrong.mp3'
const VOICE_TO_NUMBER = U2 + 'find-the-number.mp3'
const VOICE_TO_PLATE = U2 + 'find-that-many.mp3'
const VOICE_DONE = U2 + 'you-know-your-numbers.mp3'

const IMAGES = [
  './assets/images/apple.png',
  './assets/images/ball.png',
  './assets/images/cup.png',
  './assets/images/car.png',
  './assets/images/bear.png',
  './assets/images/bag.png',
]
const COUNTS = [1, 2, 3, 4, 5]
const ROUND_COUNT = 6
const CHOICES = 3
const MISS_SCAFFOLD_AT = 2
const IDLE_MS = 7000
const HINT_MS = 2200
const NEXT_DELAY_MS = 1400
const FINISH_HOLD_MS = 1800
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
  const targets = shuffle(COUNTS).concat(shuffle(COUNTS)).slice(0, ROUND_COUNT)
  const art = shuffle(IMAGES)
  return targets.map((count, i) => ({
    kind: i % 2 === 0 ? 'toNumber' : 'toPlate',
    count,
    img: art[i % art.length],
    options: shuffle(shuffle(COUNTS.filter((n) => n !== count)).slice(0, CHOICES - 1).concat(count)),
  }))
}

export default {
  id: 'matchup',
  title: 'Number Match',
  mount(root, ctx) {
    root.classList.add('step-matchup')

    root.innerHTML =
      '<div class="mu-stage">' +
        '<div class="mu-top">' +
          '<div class="prompt-banner mu-prompt">' +
            '<span class="prompt-banner__letter mu-prompt__mark" aria-hidden="true">🔎</span>' +
            '<p class="prompt-banner__text" data-prompt-text></p>' +
            '<button type="button" class="speaker-btn" data-speaker aria-label="Hear the instruction again">' +
              SPEAKER_SVG +
            '</button>' +
          '</div>' +
          '<div class="mu-stars" data-stars role="status" aria-label="Matches found"></div>' +
        '</div>' +
        '<div class="mu-cue" data-cue role="img"></div>' +
        '<div class="mu-options" data-options role="group" aria-label="Pick the match"></div>' +
      '</div>'

    const promptTextEl = root.querySelector('[data-prompt-text]')
    const speakerEl = root.querySelector('[data-speaker]')
    const starsEl = root.querySelector('[data-stars]')
    const cueEl = root.querySelector('[data-cue]')
    const optionsEl = root.querySelector('[data-options]')

    const rounds = buildRounds()
    const TOTAL = rounds.length

    starsEl.innerHTML = rounds
      .map((_, i) => '<span class="mu-star" data-star="' + i + '">⭐</span>')
      .join('')
    const starEls = Array.from(starsEl.querySelectorAll('[data-star]'))

    let destroyed = false
    let paused = ctx.isPaused()
    let roundIndex = 0
    let missCount = 0
    let roundActive = false
    let hintCleanup = null
    let idleTimer = null
    const timers = new Set()

    root.classList.toggle('is-paused', paused)

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
      t.remaining = Math.max(0, t.remaining - (performance.now() - t.startedAt))
      t.id = null
    }

    function schedule(cb, ms) {
      const t = { cb, remaining: ms, id: null, startedAt: 0 }
      timers.add(t)
      if (!paused) armTimer(t)
      return t
    }

    function unschedule(t) {
      if (!t) return
      if (t.id != null) clearTimeout(t.id)
      timers.delete(t)
    }

    function clearTimers() {
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

    function clearHint() {
      if (hintCleanup) {
        hintCleanup()
        hintCleanup = null
      }
    }

    function voiceFor(round) {
      return round.kind === 'toNumber' ? VOICE_TO_NUMBER : VOICE_TO_PLATE
    }

    function rearmIdle() {
      unschedule(idleTimer)
      idleTimer = schedule(onIdle, IDLE_MS)
    }

    function onIdle() {
      if (destroyed || paused || !roundActive) return
      clearHint()
      audio.play(voiceFor(rounds[roundIndex]))
      const target = optionsEl.querySelector('.mu-option[data-correct="1"]')
      if (target) {
        hintCleanup = pointerHand(root, target)
        schedule(clearHint, HINT_MS)
      }
      rearmIdle()
    }

    function fillPlate(host, count, src) {
      host.style.setProperty('--n', String(count))
      for (let k = 0; k < count; k++) {
        const img = document.createElement('img')
        img.className = 'mu-plate__obj'
        img.style.setProperty('--i', String(k))
        img.src = src
        img.alt = ''
        host.appendChild(img)
      }
    }

    function buildRound(round) {
      cueEl.innerHTML = ''
      cueEl.className = 'mu-cue mu-cue--' + (round.kind === 'toNumber' ? 'plate' : 'digit')
      if (round.kind === 'toNumber') {
        cueEl.setAttribute('aria-label', 'A group of things to count')
        fillPlate(cueEl, round.count, round.img)
      } else {
        cueEl.setAttribute('aria-label', 'Number ' + round.count)
        const glyph = document.createElement('span')
        glyph.className = 'mu-cue__digit'
        glyph.textContent = String(round.count)
        cueEl.appendChild(glyph)
      }
      retrigger(cueEl, 'is-in')

      optionsEl.innerHTML = ''
      optionsEl.classList.remove('is-scaffold')
      optionsEl.className = 'mu-options mu-options--' + (round.kind === 'toNumber' ? 'digit' : 'plate')
      round.options.forEach((value, k) => {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'mu-option feedback'
        btn.style.setProperty('--i', String(k))
        btn.dataset.value = String(value)
        if (value === round.count) btn.dataset.correct = '1'
        if (round.kind === 'toNumber') {
          btn.setAttribute('aria-label', 'Number ' + value)
          const glyph = document.createElement('span')
          glyph.className = 'mu-option__digit'
          glyph.textContent = String(value)
          btn.appendChild(glyph)
        } else {
          btn.setAttribute('aria-label', 'A group of ' + value)
          const plate = document.createElement('span')
          plate.className = 'mu-option__plate'
          fillPlate(plate, value, round.img)
          btn.appendChild(plate)
        }
        optionsEl.appendChild(btn)
      })

      promptTextEl.textContent = round.kind === 'toNumber' ? 'Find the number!' : 'Find that many!'
    }

    function startRound(index) {
      roundIndex = index
      missCount = 0
      roundActive = true
      clearHint()
      buildRound(rounds[index])
      starEls.forEach((el, i) => el.classList.toggle('is-filled', i < index))
      ctx.setProgress(index, TOTAL)
      audio.play(voiceFor(rounds[index]))
      rearmIdle()
    }

    function onOptionTap(btn) {
      if (destroyed || paused || !roundActive) return
      rearmIdle()
      const round = rounds[roundIndex]
      if (Number(btn.dataset.value) === round.count) {
        roundActive = false
        unschedule(idleTimer)
        clearHint()
        retrigger(btn, 'is-correct')
        audio.play(SFX_CORRECT)
        const star = starEls[roundIndex]
        if (star) star.classList.add('is-filled')
        audio.play(U2 + 'num-' + round.count + '.mp3')
        schedule(goNext, NEXT_DELAY_MS)
        return
      }
      missCount += 1
      audio.play(SFX_WRONG)
      retrigger(btn, 'is-wrong')
      schedule(() => btn.classList.remove('is-wrong'), WRONG_SHAKE_MS)
      if (missCount === MISS_SCAFFOLD_AT) optionsEl.classList.add('is-scaffold')
    }

    function goNext() {
      if (destroyed) return
      if (roundIndex + 1 >= TOTAL) finishAll()
      else startRound(roundIndex + 1)
    }

    function finishAll() {
      ctx.setProgress(TOTAL, TOTAL)
      audio.chime('complete')
      confetti(root)
      audio.play(VOICE_DONE)
      schedule(() => {
        if (destroyed) return
        ctx.onDone()
      }, FINISH_HOLD_MS)
    }

    function onOptionsClick(event) {
      const btn = event.target.closest('.mu-option')
      if (btn) onOptionTap(btn)
    }

    function onSpeakerClick() {
      if (destroyed || paused) return
      rearmIdle()
      retrigger(speakerEl, 'is-playing')
      schedule(() => speakerEl.classList.remove('is-playing'), SPEAKER_GLOW_MS)
      audio.play(voiceFor(rounds[roundIndex]))
    }

    function seekTo(i) {
      if (destroyed) return
      clearTimers()
      clearHint()
      audio.stopAll()
      startRound(Math.max(0, Math.min(i, TOTAL - 1)))
    }

    optionsEl.addEventListener('click', onOptionsClick)
    speakerEl.addEventListener('click', onSpeakerClick)
    ctx.onPauseChange(setPaused)
    ctx.onSeek(seekTo)

    startRound(0)

    return function cleanup() {
      destroyed = true
      clearTimers()
      clearHint()
      audio.stopAll()
      optionsEl.removeEventListener('click', onOptionsClick)
      speakerEl.removeEventListener('click', onSpeakerClick)
    }
  },
}

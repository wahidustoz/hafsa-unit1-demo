import * as audio from '../audio.js'
import { confetti, pointerHand } from '../fx.js'

const U2 = './assets/audio/unit2/'
const SFX_POP = './assets/audio/sfx/pop.mp3'
const VOICE_PROMPT = U2 + 'count-with-me.mp3'
const VOICE_DONE = U2 + 'nice-counting.mp3'

const ROUNDS = [
  { count: 1, img: './assets/images/apple.png', obj: 'apples' },
  { count: 2, img: './assets/images/ball.png', obj: 'balls' },
  { count: 3, img: './assets/images/cup.png', obj: 'cups' },
  { count: 4, img: './assets/images/car.png', obj: 'cars' },
  { count: 5, img: './assets/images/bear.png', obj: 'bears' },
]
const TOTAL = ROUNDS.length
const IDLE_MS = 6500
const HINT_MS = 2200
const NEXT_DELAY_MS = 1700
const FINISH_HOLD_MS = 1600
const SPEAKER_GLOW_MS = 1400

const SPEAKER_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M4 9.5 h3.5 L12.5 5 v14 L7.5 14.5 H4 Z" fill="var(--ink)"/>' +
    '<path d="M15.5 9 q2 3 0 6 M18 6.5 q3.5 5.5 0 11" fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round"/>' +
  '</svg>'

function retrigger(el, cls) {
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
}

export default {
  id: 'count',
  title: 'Count Along',
  noPause: true,
  mount(root, ctx) {
    root.classList.add('step-count')

    root.innerHTML =
      '<div class="ct-stage">' +
        '<div class="prompt-banner ct-prompt">' +
          '<span class="prompt-banner__letter ct-prompt__mark" aria-hidden="true">👆</span>' +
          '<p class="prompt-banner__text">Touch each one and count!</p>' +
          '<button type="button" class="speaker-btn" data-speaker aria-label="Hear the instruction again">' +
            SPEAKER_SVG +
          '</button>' +
        '</div>' +
        '<div class="ct-field" data-field role="group"></div>' +
        '<div class="tray ct-tally" data-tally role="status"></div>' +
      '</div>'

    const fieldEl = root.querySelector('[data-field]')
    const tallyEl = root.querySelector('[data-tally]')
    const speakerEl = root.querySelector('[data-speaker]')

    let destroyed = false
    let roundIndex = 0
    let counted = 0
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
      audio.play(VOICE_PROMPT)
      const next = fieldEl.querySelector('.ct-obj:not(.is-counted)')
      if (next) {
        hintCleanup = pointerHand(root, next)
        schedule(clearHint, HINT_MS)
      }
      rearmIdle()
    }

    function buildTally(n) {
      tallyEl.innerHTML = ''
      tallyEl.setAttribute('aria-label', '0 of ' + n + ' counted')
      for (let k = 0; k < n; k++) {
        const slot = document.createElement('span')
        slot.className = 'tray__slot ct-tally__slot'
        tallyEl.appendChild(slot)
      }
    }

    function buildField(round) {
      fieldEl.innerHTML = ''
      fieldEl.style.setProperty('--n', String(round.count))
      for (let k = 0; k < round.count; k++) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'ct-obj feedback'
        btn.style.setProperty('--i', String(k))
        btn.setAttribute('aria-label', 'Count this one')

        const img = document.createElement('img')
        img.className = 'ct-obj__img'
        img.src = round.img
        img.alt = ''

        const badge = document.createElement('span')
        badge.className = 'ct-obj__badge'
        badge.setAttribute('aria-hidden', 'true')

        btn.append(img, badge)
        fieldEl.appendChild(btn)
      }
    }

    function startRound(index) {
      roundIndex = index
      const round = ROUNDS[index]
      counted = 0
      roundActive = true
      clearHint()
      buildField(round)
      buildTally(round.count)
      ctx.setProgress(index, TOTAL)
      audio.play(VOICE_PROMPT)
      rearmIdle()
    }

    function onObjectTap(btn) {
      if (destroyed || !roundActive) return
      rearmIdle()
      if (btn.classList.contains('is-counted')) {
        retrigger(btn, 'is-wrong')
        schedule(() => btn.classList.remove('is-wrong'), 600)
        return
      }
      counted += 1
      btn.classList.add('is-counted')
      btn.querySelector('.ct-obj__badge').textContent = String(counted)
      btn.setAttribute('aria-label', 'Counted ' + counted)
      const slot = tallyEl.children[counted - 1]
      if (slot) {
        slot.textContent = String(counted)
        slot.classList.add('is-filled')
      }
      tallyEl.setAttribute('aria-label', counted + ' of ' + ROUNDS[roundIndex].count + ' counted')
      audio.play(SFX_POP)
      audio.play(U2 + 'num-' + counted + '.mp3')
      if (counted === ROUNDS[roundIndex].count) finishRound()
    }

    function finishRound() {
      roundActive = false
      unschedule(idleTimer)
      clearHint()
      tallyEl.classList.add('is-complete')
      audio.play(U2 + 'total-' + ROUNDS[roundIndex].count + '.mp3').then(() => {
        if (destroyed) return
        audio.chime('next')
        schedule(goNext, NEXT_DELAY_MS)
      })
    }

    function goNext() {
      if (destroyed) return
      tallyEl.classList.remove('is-complete')
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

    function onFieldClick(event) {
      const btn = event.target.closest('.ct-obj')
      if (btn) onObjectTap(btn)
    }

    function onSpeakerClick() {
      if (destroyed) return
      rearmIdle()
      retrigger(speakerEl, 'is-playing')
      schedule(() => speakerEl.classList.remove('is-playing'), SPEAKER_GLOW_MS)
      audio.play(VOICE_PROMPT)
    }

    function seekTo(i) {
      if (destroyed) return
      clearTimers()
      clearHint()
      audio.stopAll()
      tallyEl.classList.remove('is-complete')
      startRound(Math.max(0, Math.min(i, TOTAL - 1)))
    }

    fieldEl.addEventListener('click', onFieldClick)
    speakerEl.addEventListener('click', onSpeakerClick)
    ctx.onSeek(seekTo)

    startRound(0)

    return function cleanup() {
      destroyed = true
      clearTimers()
      clearHint()
      audio.stopAll()
      fieldEl.removeEventListener('click', onFieldClick)
      speakerEl.removeEventListener('click', onSpeakerClick)
    }
  },
}

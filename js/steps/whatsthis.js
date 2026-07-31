import { UNIT1 } from '../data.js'
import * as audio from '../audio.js'
import { confetti } from '../fx.js'

function shuffle(list) {
  const result = list.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return result
}

function replay(el, className) {
  el.classList.remove(className)
  void el.offsetWidth
  el.classList.add(className)
}

const POINTER_SRC = './assets/images/pointer.png'
const VOICE_WHATS_THIS = './assets/audio/voice/whats-this.mp3'

export default {
  id: 'whatsthis',
  title: "What's this?",
  noPause: true,
  mount(root, ctx) {
    root.classList.add('step-whatsthis')

    const order = shuffle(UNIT1)
    const total = order.length
    let index = 0
    let phase = 'prompt'
    let advanceTimer = null
    let advanceRemaining = 0
    let advanceStartedAt = 0
    let destroyed = false

    root.innerHTML = `
      <div class="wt-stage">
        <div class="wt-row1">
          <div class="wt-prompt t-display">What's this?</div>
          <div class="wt-answer">
            <div class="wt-letters">
              <span class="wt-letter"></span>
              <span class="wt-letter"></span>
            </div>
            <div class="wt-word t-display"></div>
          </div>
        </div>
        <div class="wt-row2">
          <div class="wt-plinth" role="button" tabindex="0" aria-label="Tap to hear this word">
            <div class="wt-glow" aria-hidden="true"></div>
            <img class="wt-object" alt="" />
            <img class="wt-pointer" src="${POINTER_SRC}" alt="" aria-hidden="true" />
          </div>
          <div class="wt-shadow" aria-hidden="true"></div>
        </div>
      </div>
    `

    const letterEls = root.querySelectorAll('.wt-letter')
    const wordEl = root.querySelector('.wt-word')
    const plinth = root.querySelector('.wt-plinth')
    const objectImg = root.querySelector('.wt-object')

    function currentWord() {
      return order[index]
    }

    function loadWord() {
      const w = currentWord()
      objectImg.src = w.img
      objectImg.alt = w.word
      const parts = w.letters.split(' ')
      letterEls[0].textContent = parts[0] || ''
      letterEls[1].textContent = parts[1] || ''
      wordEl.textContent = w.word
    }

    function clearAdvanceTimer() {
      if (advanceTimer !== null) {
        clearTimeout(advanceTimer)
        advanceTimer = null
      }
    }

    function scheduleAdvance(ms) {
      advanceRemaining = ms
      advanceStartedAt = performance.now()
      clearAdvanceTimer()
      if (!ctx.isPaused()) {
        advanceTimer = setTimeout(goNext, advanceRemaining)
      }
    }

    function showPrompt() {
      phase = 'prompt'
      root.classList.remove('is-answer')
      plinth.classList.remove('is-glowing')
      replay(plinth, 'is-popped')
      audio.play(VOICE_WHATS_THIS)
    }

    function onPlinthActivate() {
      if (phase !== 'prompt' || destroyed || ctx.isPaused()) return
      phase = 'revealing'
      root.classList.add('is-answer')
      replay(plinth, 'is-popped')
      replay(plinth, 'is-glowing')
      audio.stopAll()
      audio.play(currentWord().utter).then(onUtterEnded)
    }

    function onUtterEnded() {
      if (destroyed) return
      phase = 'holding'
      audio.chime('next')
      scheduleAdvance(2200)
    }

    function goNext() {
      if (destroyed) return
      clearAdvanceTimer()
      index += 1
      ctx.setProgress(index, total)
      if (index >= total) {
        finish()
      } else {
        loadWord()
        showPrompt()
      }
    }

    function finish() {
      phase = 'done'
      audio.chime('complete')
      confetti(root)
      ctx.onDone()
    }

    function handlePauseChange(paused) {
      if (destroyed) return
      if (paused) {
        audio.pauseAll()
        root.classList.add('is-paused')
        if (advanceTimer !== null) {
          clearAdvanceTimer()
          advanceRemaining = Math.max(0, advanceRemaining - (performance.now() - advanceStartedAt))
        }
      } else {
        audio.resumeAll()
        root.classList.remove('is-paused')
        if (phase === 'holding') {
          advanceStartedAt = performance.now()
          advanceTimer = setTimeout(goNext, advanceRemaining)
        }
      }
    }

    function seekTo(i) {
      if (destroyed) return
      clearAdvanceTimer()
      audio.stopAll()
      index = Math.max(0, Math.min(i, total - 1))
      ctx.setProgress(index, total)
      loadWord()
      showPrompt()
    }

    plinth.addEventListener('click', onPlinthActivate)
    plinth.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onPlinthActivate()
      }
    })

    ctx.onPauseChange(handlePauseChange)
    ctx.onSeek(seekTo)
    if (ctx.isPaused()) {
      root.classList.add('is-paused')
    }

    loadWord()
    showPrompt()
    ctx.setProgress(0, total)

    return function cleanup() {
      destroyed = true
      clearAdvanceTimer()
      audio.stopAll()
    }
  }
}

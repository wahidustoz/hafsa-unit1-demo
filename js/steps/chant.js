import { findUnit } from '../units.js'
import * as audio from '../audio.js'
import { confetti } from '../fx.js'

const SEEK_EPSILON = 0.01

function routeUnit() {
  const match = /#\/unit\/(\d+)/.exec(location.hash || '')
  return findUnit(match ? Number(match[1]) : 1)
}

function lastIndexAt(cues, key, time) {
  let found = -1
  for (let i = 0; i < cues.length; i++) {
    if (time >= cues[i][key]) found = i
    else break
  }
  return found
}

function make(tag, cls) {
  const el = document.createElement(tag)
  el.className = cls
  return el
}

function retrigger(el, cls) {
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
}

export default {
  id: 'chant',
  title: 'Chanting',
  mount(root, ctx) {
    root.classList.add('step-chant')

    const unit = routeUnit()
    const cues = unit.chant.cues
    const total = cues.length

    const stage = make('div', 'chant-stage is-intro')

    const lettersRow = make('div', 'chant-letters')

    const objectRow = make('div', 'chant-object')
    const burst = make('span', 'chant-object__burst')
    const float = make('span', 'chant-object__float')
    const objectImg = make('img', 'chant-object__img')
    objectImg.alt = ''
    float.append(objectImg)
    objectRow.append(burst, float)

    const wordRow = make('p', 'chant-word')
    wordRow.setAttribute('aria-live', 'polite')

    stage.append(lettersRow, objectRow, wordRow)

    const startOverlay = make('div', 'chant-start is-hidden')
    const startBtn = make('button', 'btn btn--celebration btn--l')
    startBtn.type = 'button'
    startBtn.textContent = 'Tap to start'
    startOverlay.append(startBtn)

    root.append(stage, startOverlay)

    cues.forEach((cue) => {
      const warm = new Image()
      warm.src = cue.img
    })

    const audioEl = new Audio(unit.chant.audio)
    audioEl.preload = 'auto'

    let active = true
    let rafId = null
    let finished = false
    let lettersShown = ''
    let beatShown = -2
    let wordShown = -2
    let doneShown = -1

    function buildLetters(cue) {
      lettersShown = cue.letters
      lettersRow.innerHTML = ''
      cue.letters.trim().split(/\s+/).forEach((glyph, i) => {
        const span = make('span', 'chant-letters__glyph')
        span.style.setProperty('--i', String(i))
        span.textContent = glyph
        lettersRow.append(span)
      })
      retrigger(lettersRow, 'is-changing')
    }

    function sayLetters(cue) {
      if (cue.letters !== lettersShown) buildLetters(cue)
      lettersRow.style.setProperty('--say-step', ((cue.t - cue.beat) / 2).toFixed(3) + 's')
      retrigger(lettersRow, 'is-saying')
    }

    function showWord(cue) {
      stage.classList.remove('is-intro')
      objectImg.src = cue.img
      wordRow.innerHTML = ''
      Array.from(cue.word).forEach((letter, i) => {
        const span = make('span', 'chant-word__glyph')
        span.style.setProperty('--i', String(i))
        span.textContent = letter
        wordRow.append(span)
      })
      retrigger(objectRow, 'is-live')
      retrigger(wordRow, 'is-live')
    }

    function hideWord() {
      objectRow.classList.remove('is-live')
      wordRow.classList.remove('is-live')
    }

    function render(force) {
      if (force) {
        beatShown = -2
        lettersShown = ''
      }

      const time = audioEl.currentTime || 0
      const beatIdx = lastIndexAt(cues, 'beat', time)
      const wordIdx = lastIndexAt(cues, 't', time)

      if (beatIdx !== beatShown) {
        beatShown = beatIdx
        if (beatIdx >= 0) sayLetters(cues[beatIdx])
      }

      if (wordIdx !== wordShown) {
        wordShown = wordIdx
        if (wordIdx >= 0) showWord(cues[wordIdx])
        else hideWord()
      }

      const done = finished ? total : Math.max(0, beatIdx)
      if (done !== doneShown) {
        doneShown = done
        ctx.setProgress(done, total)
      }
    }

    function loop() {
      if (!active) return
      render(false)
      rafId = requestAnimationFrame(loop)
    }

    function onEnded() {
      if (!active) return
      finished = true
      render(false)
      audio.chime('complete')
      confetti(root)
      ctx.onDone()
    }

    function onPlay() {
      finished = false
      startOverlay.classList.add('is-hidden')
    }

    function tryPlay() {
      const p = audioEl.play()
      if (p && p.catch) p.catch(() => startOverlay.classList.remove('is-hidden'))
    }

    startBtn.addEventListener('click', tryPlay)

    audioEl.addEventListener('ended', onEnded)
    audioEl.addEventListener('play', onPlay)

    function setPaused(paused) {
      root.classList.toggle('is-paused', paused)
      if (paused) {
        audioEl.pause()
        return
      }
      tryPlay()
    }

    ctx.onPauseChange((paused) => {
      if (!active) return
      setPaused(paused)
    })

    ctx.onSeek((i) => {
      if (!active) return
      const cue = cues[i]
      if (!cue) return
      finished = false
      audioEl.currentTime = cue.beat + SEEK_EPSILON
      tryPlay()
      render(true)
    })

    buildLetters(cues[0])
    render(false)
    loop()

    setPaused(ctx.isPaused())

    return function cleanup() {
      active = false
      if (rafId) cancelAnimationFrame(rafId)
      audioEl.pause()
      audioEl.removeEventListener('ended', onEnded)
      audioEl.removeEventListener('play', onPlay)
      audio.stopAll()
    }
  },
}

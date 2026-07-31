import { UNIT1, CHANT_CUES } from '../data.js'
import * as audio from '../audio.js'
import { confetti } from '../fx.js'

function curIdx(t){
  let i = -1
  for (let k = 0; k < CHANT_CUES.length; k++){
    if (t >= CHANT_CUES[k].t) i = k
    else break
  }
  return i
}

export default {
  id: 'chant',
  title: 'Chanting',
  mount(root, ctx){
    root.classList.add('step-chant')

    const caption = document.createElement('div')
    caption.className = 'chant-caption'
    caption.setAttribute('aria-live', 'polite')

    const captionCurrent = document.createElement('p')
    captionCurrent.className = 'chant-caption__current'
    const captionNext = document.createElement('p')
    captionNext.className = 'chant-caption__next'
    caption.append(captionCurrent, captionNext)

    const karaoke = document.createElement('div')
    karaoke.className = 'chant-karaoke'
    karaoke.setAttribute('role', 'status')
    karaoke.setAttribute('aria-label', 'Chant progress')
    const karaokeFill = document.createElement('div')
    karaokeFill.className = 'chant-karaoke__fill'
    karaoke.appendChild(karaokeFill)

    const grid = document.createElement('div')
    grid.className = 'chant-grid'
    grid.setAttribute('role', 'group')
    grid.setAttribute('aria-label', 'Unit 1 words')

    const tiles = UNIT1.map(item => {
      const tile = document.createElement('div')
      tile.className = 'chant-tile'

      const art = document.createElement('div')
      art.className = 'chant-tile__art'
      const img = document.createElement('img')
      img.src = item.img
      img.alt = item.word
      art.appendChild(img)

      const word = document.createElement('p')
      word.className = 'chant-tile__word'
      word.innerHTML = `<b>${item.word[0]}</b>${item.word.slice(1)}`

      tile.append(art, word)
      grid.appendChild(tile)
      return tile
    })

    root.append(caption, karaoke, grid)

    const audioEl = new Audio('./assets/audio/chant.mp3')
    audioEl.preload = 'auto'

    let active = true
    let rafId = null
    let finished = false
    let lastIdx = -2
    let lastFinished = false

    function render(){
      const t = audioEl.currentTime || 0
      const idx = finished ? CHANT_CUES.length - 1 : curIdx(t)

      const pct = audioEl.duration ? Math.min(100, (t / audioEl.duration) * 100) : 0
      karaoke.style.setProperty('--p', Math.round(pct) + '%')

      if (idx === lastIdx && finished === lastFinished) return
      lastIdx = idx
      lastFinished = finished

      tiles.forEach((tile, i) => {
        tile.classList.toggle('is-current', !finished && i === idx)
        tile.classList.toggle('is-sung', finished || i < idx)
      })

      const sungCount = finished ? UNIT1.length : Math.max(0, idx)
      ctx.setProgress(sungCount, UNIT1.length)

      if (finished){
        captionCurrent.textContent = 'Great chanting!'
        captionNext.textContent = 'Unit 1 chant complete!'
      } else if (idx < 0){
        captionCurrent.textContent = 'Here we go!'
        captionNext.textContent = CHANT_CUES[0].text
      } else {
        captionCurrent.textContent = CHANT_CUES[idx].text
        captionNext.textContent = idx + 1 < CHANT_CUES.length ? CHANT_CUES[idx + 1].text : 'Last word — nearly there!'
      }

      captionCurrent.classList.remove('is-popping')
      void captionCurrent.offsetWidth
      captionCurrent.classList.add('is-popping')
    }

    function loop(){
      if (!active) return
      render()
      rafId = requestAnimationFrame(loop)
    }

    function onEnded(){
      if (!active) return
      finished = true
      render()
      audio.chime('complete')
      confetti(root)
      ctx.onDone()
    }

    function onPlay(){
      finished = false
    }

    audioEl.addEventListener('ended', onEnded)
    audioEl.addEventListener('play', onPlay)

    if (!ctx.isPaused()){
      const p = audioEl.play()
      if (p && p.catch) p.catch(() => {})
    }

    ctx.onPauseChange(paused => {
      if (!active) return
      if (paused){
        audioEl.pause()
      } else {
        const p = audioEl.play()
        if (p && p.catch) p.catch(() => {})
      }
    })

    ctx.onSeek(i => {
      if (!active) return
      const cue = CHANT_CUES[i]
      if (!cue) return
      finished = false
      audioEl.currentTime = cue.t
      const p = audioEl.play()
      if (p && p.catch) p.catch(() => {})
      render()
    })

    render()
    loop()

    return function cleanup(){
      active = false
      if (rafId) cancelAnimationFrame(rafId)
      audioEl.pause()
      audioEl.removeEventListener('ended', onEnded)
      audioEl.removeEventListener('play', onPlay)
      audio.stopAll()
    }
  }
}

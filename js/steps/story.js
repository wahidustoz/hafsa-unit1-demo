import * as audio from '../audio.js'
import { confetti } from '../fx.js'

const PAD = 6
const HL = 2.5
const DUR = 0.85
const STEP = 0.5
const ATTRACT_TAIL = 1.5
const FRAME_ASPECT = 941 / 770
const ARROW_MIN_W = 0.065
const ARROW_W_SCALE = 1.1
const ARROW_LIFT = 1.55
const ARROW_RATIO = 1.3
const ARROW_SVG =
  '<svg class="story-obj__arrow" viewBox="0 0 100 130" aria-hidden="true" focusable="false">' +
  '<path d="M35 10 h30 v52 h22 L50 122 L13 62 h22 Z" fill="var(--primary)" stroke="var(--white)" stroke-width="7" stroke-linejoin="round"/>' +
  '</svg>'

function arrowRect(object, canvasW, canvasH) {
  const territory = object.territory
  const w = Math.max(territory[2] * ARROW_W_SCALE, canvasW * ARROW_MIN_W)
  return [
    territory[0] + territory[2] / 2 - w / 2,
    territory[1] - (w / canvasW) * ARROW_LIFT * canvasH,
    w,
    w * ARROW_RATIO,
  ]
}

function rectFor(object, canvasW, canvasH) {
  return object.mode === 'arrow' ? arrowRect(object, canvasW, canvasH) : object.box
}

function cropFor(story) {
  const canvasW = story.canvas[0]
  const canvasH = story.canvas[1]
  const h = Math.min(canvasH, canvasW / FRAME_ASPECT)
  let top = canvasH
  let bottom = 0
  story.objects.forEach((object) => {
    const rect = rectFor(object, canvasW, canvasH)
    if (rect[1] < top) top = rect[1]
    if (rect[1] + rect[3] > bottom) bottom = rect[1] + rect[3]
  })
  const y = Math.min(Math.max((top + bottom) / 2 - h / 2, 0), canvasH - h)
  return { x: 0, y, w: canvasW, h }
}

function pct(rect, crop) {
  return {
    l: ((rect[0] - crop.x) / crop.w) * 100,
    t: ((rect[1] - crop.y) / crop.h) * 100,
    w: (rect[2] / crop.w) * 100,
    h: (rect[3] / crop.h) * 100,
  }
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

function buildSchedule(story, attractStop) {
  const keys = story.objects.map((o) => o.key)
  let pool = shuffle(keys)
  let pi = 0
  let t = 0.4
  const sched = []
  while (t < attractStop - 0.15) {
    const n = Math.random() < 0.35 ? 2 : 1
    const group = []
    for (let j = 0; j < n; j++) {
      if (pi >= pool.length) {
        pool = shuffle(keys)
        pi = 0
      }
      group.push(pool[pi++])
    }
    sched.push({ s: t, e: t + DUR, keys: group })
    t += STEP
  }
  return sched
}

function attractActive(t, sched) {
  const active = new Set()
  for (const slot of sched) {
    if (t >= slot.s && t < slot.e) slot.keys.forEach((k) => active.add(k))
  }
  return active
}

function lastBeatKey(t, beats, lead) {
  let b = null
  for (const beat of beats) {
    if (t >= beat.t - lead) b = beat
  }
  if (!b) return null
  return t - (b.t - lead) < HL ? b.key : null
}

function curLyric(t, lyrics) {
  let L = null
  for (const ly of lyrics) {
    if (t >= ly.t) L = ly
  }
  return L
}

function escRe(s) {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

export default {
  id: 'story',
  title: 'Story',
  mount(root, ctx) {
    root.classList.add('step-story')

    const story = ctx.unit.story
    const canvasW = story.canvas[0]
    const canvasH = story.canvas[1]
    const crop = cropFor(story)
    const attractStop = Math.max(0.5, story.attractEnd - ATTRACT_TAIL)
    const beats = story.beats
    const lyrics = story.lyrics

    root.style.setProperty('--story-crop-w', String(crop.w))
    root.style.setProperty('--story-crop-h', String(crop.h))
    root.style.setProperty('--story-canvas-w', String(canvasW))
    root.style.setProperty('--story-canvas-h', String(canvasH))
    root.style.setProperty('--story-crop-y', String(crop.y))

    const frame = document.createElement('div')
    frame.className = 'story-frame'
    frame.style.backgroundImage = 'url("' + story.scene + '")'

    const badgeEl = document.createElement('div')
    badgeEl.className = 'story-badge'
    badgeEl.textContent = 'Get ready! 🎵'
    badgeEl.setAttribute('aria-hidden', 'true')
    frame.appendChild(badgeEl)

    const wrappers = {}
    story.objects.forEach((o) => {
      const wrap = document.createElement('div')
      wrap.className = 'story-obj'
      wrap.setAttribute('aria-hidden', 'true')
      const b = pct(rectFor(o, canvasW, canvasH), crop)
      wrap.style.left = b.l + '%'
      wrap.style.top = b.t + '%'
      wrap.style.width = b.w + '%'
      wrap.style.height = b.h + '%'

      if (o.mode === 'arrow') {
        wrap.innerHTML = ARROW_SVG
      } else {
        const halo = document.createElement('img')
        halo.className = 'story-obj__halo'
        halo.src = o.halo
        halo.alt = ''

        const cut = document.createElement('img')
        cut.className = 'story-obj__cut'
        cut.src = o.cut
        cut.alt = ''
        cut.style.left = (PAD / o.box[2]) * 100 + '%'
        cut.style.top = (PAD / o.box[3]) * 100 + '%'
        cut.style.width = ((o.box[2] - 2 * PAD) / o.box[2]) * 100 + '%'
        cut.style.height = 'auto'

        wrap.append(halo, cut)
      }

      frame.appendChild(wrap)
      wrappers[o.key] = wrap
    })

    const captionEl = document.createElement('div')
    captionEl.className = 'story-caption'
    captionEl.setAttribute('role', 'status')
    captionEl.setAttribute('aria-live', 'polite')
    const captionTextEl = document.createElement('span')
    captionEl.appendChild(captionTextEl)
    frame.appendChild(captionEl)

    root.appendChild(frame)

    const audioEl = new Audio(story.audio)
    audioEl.preload = 'auto'

    let alive = true
    let rafId = null
    let sched = buildSchedule(story, attractStop)
    let curSig = ''
    let lastProgress = -1

    function setLit(activeKeys) {
      for (const o of story.objects) {
        wrappers[o.key].classList.toggle('is-lit', activeKeys.has(o.key))
      }
    }

    function renderCaption(ly) {
      if (!ly) {
        captionEl.classList.remove('is-on')
        return
      }
      let html = ly.text
      if (ly.hl) {
        const re = new RegExp('\\b(' + escRe(ly.hl) + 's?)\\b', 'i')
        html = html.replace(re, '<span class="story-caption__accent">$1</span>')
      }
      captionTextEl.innerHTML = html
      captionEl.classList.add('is-on')
    }

    function applyAt(t) {
      if (t < attractStop) {
        badgeEl.classList.add('is-on')
        const active = attractActive(t, sched)
        const sig = 'A' + [...active].sort().join(',')
        if (sig !== curSig) {
          curSig = sig
          setLit(active)
          renderCaption(null)
        }
      } else {
        badgeEl.classList.remove('is-on')
        const activeKey = lastBeatKey(t, beats, story.lead)
        const ly = curLyric(t, lyrics)
        const sig = 'C' + (activeKey || '') + '|' + (ly ? ly.t : '')
        if (sig !== curSig) {
          curSig = sig
          setLit(activeKey ? new Set([activeKey]) : new Set())
          renderCaption(ly)
        }
      }

      let done = 0
      for (const b of beats) if (t >= b.t) done++
      if (done !== lastProgress) {
        lastProgress = done
        ctx.setProgress(done, beats.length)
      }
    }

    function tick() {
      if (!alive) return
      applyAt(audioEl.currentTime || 0)
      rafId = requestAnimationFrame(tick)
    }

    function onEnded() {
      if (!alive) return
      cancelAnimationFrame(rafId)
      curSig = ''
      setLit(new Set())
      renderCaption(null)
      badgeEl.classList.remove('is-on')
      ctx.setProgress(beats.length, beats.length)
      audio.chime('complete')
      confetti(root)
      ctx.onDone()
    }

    audioEl.addEventListener('ended', onEnded)

    function setPaused(paused) {
      root.classList.toggle('is-paused', paused)
      if (!alive) return
      if (paused) {
        audioEl.pause()
      } else {
        const p = audioEl.play()
        if (p && p.catch) p.catch(() => {})
      }
    }

    ctx.onPauseChange(setPaused)

    ctx.onSeek((i) => {
      if (!alive) return
      const beat = beats[i]
      if (!beat) return
      curSig = ''
      audioEl.currentTime = Math.max(0, beat.t - story.lead)
      applyAt(audioEl.currentTime)
      const p = audioEl.play()
      if (p && p.catch) p.catch(() => {})
    })

    const startPaused = ctx.isPaused()
    if (startPaused) root.classList.add('is-paused')
    else {
      const p = audioEl.play()
      if (p && p.catch) p.catch(() => {})
    }

    ctx.setProgress(0, beats.length)
    applyAt(audioEl.currentTime || 0)
    rafId = requestAnimationFrame(tick)

    return function cleanup() {
      alive = false
      if (rafId) cancelAnimationFrame(rafId)
      audioEl.pause()
      audioEl.removeEventListener('ended', onEnded)
      audio.stopAll()
    }
  },
}

/**
 * <pf-video>: a DASH video player for blog posts, built on @amazon/vinyl.
 *
 * Use it straight from Markdown:
 *
 *   <pf-video src="/videos/<slug>/manifest.mpd"
 *             poster="/videos/<slug>/poster.jpg"
 *             aspect="1920/1110"
 *             title="What the video shows"></pf-video>
 *
 * `scripts/video/package-dash.sh <file> <slug>` produces the folder and
 * prints this snippet. `aspect` (width/height) reserves the right box before
 * anything loads; without it the poster's size is used, then the video's.
 *
 * The UI follows the Vinyl website's transport (play, scrub bar with the
 * fetched range, time, volume, quality, fullscreen). Vinyl itself is loaded
 * lazily: the module is prefetched when the player nears the viewport, and
 * the player is created on first play, so pages that never play a video
 * download no media.
 *
 * Keyboard (when the player has focus): Space/K play or pause, ←/→ seek 5 s,
 * ↑/↓ volume, M mute, F fullscreen.
 */
import type { VinylPlayer } from '@amazon/vinyl'

// Material Symbols (Apache-2.0), as used by the Vinyl website.
const ICONS = {
  play: 'M320-200v-560l440 280-440 280Z',
  pause: 'M560-200v-560h160v560H560Zm-320 0v-560h160v560H240Z',
  volume:
    'M560-131v-82q90-26 145-100t55-168q0-94-55-168T560-749v-82q124 28 202 125.5T840-481q0 127-78 224.5T560-131ZM120-360v-240h160l200-200v640L280-360H120Zm440 40v-322q47 22 73.5 66t26.5 96q0 51-26.5 94.5T560-320Z',
  muted:
    'M792-56 671-177q-25 16-53 27.5T560-131v-82q14-5 27.5-10t25.5-12L480-368v208L280-360H120v-240h128L56-792l56-56 736 736-56 56Zm-8-232-58-58q17-31 25.5-65t8.5-70q0-94-55-168T560-749v-82q124 28 202 125.5T840-481q0 53-14.5 102T784-288ZM650-422l-90-90v-130q47 22 73.5 66t26.5 96q0 15-2.5 29.5T650-422ZM480-592 376-696l104-104v208Z',
  fullscreen:
    'M120-120v-200h80v120h120v80H120Zm520 0v-80h120v-120h80v200H640ZM120-640v-200h200v80H200v120h-80Zm640 0v-120H640v-80h200v200h-80Z',
  exitFullscreen:
    'M240-120v-120H120v-80h200v200h-80Zm400 0v-200h200v80H720v120h-80ZM120-640v-80h120v-120h80v200H120Zm520 0v-200h80v120h120v80H640Z',
  quality:
    'M590-300h60v-60h30q17 0 28.5-11.5T720-400v-160q0-17-11.5-28.5T680-600H560q-17 0-28.5 11.5T520-560v160q0 17 11.5 28.5T560-360h30v60Zm-350-60h60v-80h80v80h60v-240h-60v100h-80v-100h-60v240Zm340-60v-120h80v120h-80ZM160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-480H160v480Zm0 0v-480 480Z',
  check: 'M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z',
} as const

const icon = (name: keyof typeof ICONS) =>
  `<svg viewBox="0 -960 960 960" aria-hidden="true" focusable="false"><path d="${ICONS[name]}"/></svg>`

const SEEK_STEP = 5
const VOLUME_STEP = 0.1
const HIDE_CONTROLS_MS = 2500

const STYLE = `
:host {
  display: block;
  margin: 2rem 0;
  --pf-accent: var(--accent, #f0d554);
  --pf-surface: var(--bg-code, #111);
  --pf-line: var(--line, rgba(255, 255, 255, 0.09));
  --pf-text: #f5f2ea;
  --pf-muted: rgba(245, 242, 234, 0.72);
}
.frame {
  position: relative;
  aspect-ratio: var(--pf-aspect, 16 / 9);
  background: #000;
  border: 1px solid var(--pf-line);
  border-radius: 10px;
  overflow: hidden;
  outline: none;
  color: var(--pf-text);
  font-family: var(--font-body, system-ui, sans-serif);
}
.frame:focus-visible { box-shadow: 0 0 0 2px var(--pf-accent); }
:host(:fullscreen) .frame, .frame:fullscreen {
  aspect-ratio: auto; width: 100%; height: 100%; border: 0; border-radius: 0;
}
video {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: contain; background: #000; cursor: pointer;
}
.big-play {
  position: absolute; inset: 0; margin: auto;
  width: 72px; height: 72px; border-radius: 50%; border: 0;
  background: rgba(17, 17, 17, 0.72); color: var(--pf-accent);
  display: grid; place-items: center; cursor: pointer;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.18);
  transition: transform 0.15s ease, background 0.15s ease;
}
.big-play:hover { transform: scale(1.06); background: rgba(17, 17, 17, 0.86); }
.big-play svg { width: 36px; height: 36px; fill: currentColor; margin-left: 4px; }
.frame.started .big-play { display: none; }
.spinner {
  position: absolute; inset: 0; margin: auto; width: 44px; height: 44px;
  border-radius: 50%; border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--pf-accent); animation: spin 0.9s linear infinite;
  display: none; pointer-events: none;
}
.frame.stalled .spinner { display: block; }
@keyframes spin { to { transform: rotate(360deg); } }
.message {
  position: absolute; left: 1rem; right: 1rem; bottom: 1rem;
  padding: 0.6rem 0.9rem; border-radius: 8px; font-size: 0.9rem;
  background: rgba(17, 17, 17, 0.85); display: none;
}
.frame.has-message .message { display: block; }
.controls {
  position: absolute; left: 0; right: 0; bottom: 0;
  display: flex; align-items: center; gap: 0.5rem;
  padding: 1.6rem 0.75rem 0.5rem;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.78));
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.frame:not(.started) .controls { display: none; }
.frame.idle .controls { opacity: 0; transform: translateY(40%); pointer-events: none; }
.frame.idle { cursor: none; }
button.ctl {
  flex: none; width: 34px; height: 34px; border: 0; border-radius: 50%;
  background: none; color: var(--pf-text); cursor: pointer;
  display: grid; place-items: center; padding: 0;
}
button.ctl:hover { background: rgba(255, 255, 255, 0.14); }
button.ctl:focus-visible, .scrub:focus-visible, .menu button:focus-visible, input:focus-visible {
  outline: 2px solid var(--pf-accent); outline-offset: 1px;
}
button.ctl svg { width: 20px; height: 20px; fill: currentColor; }
button.play { background: var(--pf-accent); color: #191919; }
button.play:hover { background: #fff3b0; }
.time {
  flex: none; min-width: 3.2em; font-size: 0.75rem; text-align: center;
  font-variant-numeric: tabular-nums; color: var(--pf-muted);
}
.scrub {
  flex: 1; height: 22px; display: flex; align-items: center;
  cursor: pointer; touch-action: none; border-radius: 4px;
}
.bar { position: relative; width: 100%; height: 4px; border-radius: 999px; background: rgba(255, 255, 255, 0.2); transition: height 0.15s ease; }
.scrub:hover .bar, .scrub.dragging .bar { height: 6px; }
.fetched, .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: inherit; width: 0; }
.fetched { background: rgba(255, 255, 255, 0.32); }
.fill { background: var(--pf-accent); }
.handle {
  position: absolute; top: 50%; left: 0; width: 12px; height: 12px; border-radius: 50%;
  background: var(--pf-accent); transform: translate(-50%, -50%) scale(0); transition: transform 0.15s ease;
}
.scrub:hover .handle, .scrub.dragging .handle, .scrub:focus-visible .handle { transform: translate(-50%, -50%) scale(1); }
.volume { display: flex; align-items: center; }
.volume input { width: 0; opacity: 0; transition: width 0.2s ease, opacity 0.2s ease; accent-color: var(--pf-accent); }
.volume:hover input, .volume:focus-within input { width: 72px; opacity: 1; }
.quality { position: relative; }
.menu {
  position: absolute; right: 0; bottom: 42px; min-width: 9rem; padding: 0.3rem;
  background: rgba(17, 17, 17, 0.94); border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px; display: none;
}
.menu.open { display: block; }
.menu button {
  width: 100%; display: flex; align-items: center; gap: 0.4rem;
  padding: 0.35rem 0.5rem; border: 0; border-radius: 5px; background: none;
  color: var(--pf-text); font: inherit; font-size: 0.85rem; cursor: pointer; text-align: left;
}
.menu button:hover { background: rgba(255, 255, 255, 0.1); }
.menu svg { width: 16px; height: 16px; fill: var(--pf-accent); visibility: hidden; flex: none; }
.menu button[aria-checked="true"] svg { visibility: visible; }
@media (max-width: 520px) {
  .volume input, .time.remaining { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .spinner { animation-duration: 2.5s; }
  .controls, .big-play, .bar, .handle { transition: none; }
}
`

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function mediaSourceSupported(): boolean {
  return 'MediaSource' in window || 'ManagedMediaSource' in window
}

let vinylModule: Promise<typeof import('@amazon/vinyl')> | null = null
function loadVinyl() {
  vinylModule ??= import('@amazon/vinyl')
  return vinylModule
}

export class PfVideo extends HTMLElement {
  static observedAttributes = ['aspect', 'poster']

  private readonly root: ShadowRoot
  private readonly frame: HTMLDivElement
  private readonly video: HTMLVideoElement
  private readonly els: Record<string, HTMLElement> = {}
  private player: VinylPlayer | null = null
  private creating: Promise<VinylPlayer> | null = null
  private cleanups: (() => void)[] = []
  private idleTimer: ReturnType<typeof setTimeout> | undefined
  private dragging = false
  private maxHeight: number | null = null

  constructor() {
    super()
    this.root = this.attachShadow({ mode: 'open' })
    this.root.innerHTML = `
      <style>${STYLE}</style>
      <div class="frame" tabindex="0" role="region">
        <video playsinline preload="none"></video>
        <button class="big-play" type="button" aria-label="Play video">${icon('play')}</button>
        <div class="spinner" role="status" aria-label="Loading"></div>
        <div class="message" role="alert"></div>
        <div class="controls">
          <button class="ctl play" type="button" aria-label="Play">${icon('play')}</button>
          <span class="time elapsed" aria-hidden="true">0:00</span>
          <div class="scrub" role="slider" tabindex="0" aria-label="Seek"
               aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" aria-valuetext="0:00">
            <div class="bar"><div class="fetched"></div><div class="fill"></div><div class="handle"></div></div>
          </div>
          <span class="time remaining" aria-hidden="true">0:00</span>
          <div class="volume">
            <button class="ctl mute" type="button" aria-label="Mute">${icon('volume')}</button>
            <input class="vol" type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume" />
          </div>
          <div class="quality">
            <button class="ctl quality-btn" type="button" aria-label="Quality"
                    aria-haspopup="menu" aria-expanded="false">${icon('quality')}</button>
            <div class="menu" role="menu" aria-label="Quality"></div>
          </div>
          <button class="ctl fs" type="button" aria-label="Fullscreen">${icon('fullscreen')}</button>
        </div>
      </div>`
    const $ = <T extends HTMLElement>(sel: string) => this.root.querySelector(sel) as T
    this.frame = $('.frame')
    this.video = $('video')
    for (const name of [
      'big-play', 'message', 'play', 'elapsed', 'scrub', 'fetched', 'fill', 'handle',
      'remaining', 'mute', 'vol', 'quality-btn', 'menu', 'fs',
    ]) {
      this.els[name] = $(`.${name}`)
    }
  }

  connectedCallback() {
    const label = this.getAttribute('title') || 'Video'
    this.frame.setAttribute('aria-label', `${label} (video player)`)
    this.applyAspect()
    this.applyPoster()

    const on = <K extends keyof HTMLElementEventMap>(
      target: EventTarget,
      type: K | string,
      fn: (e: any) => void,
      opts?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, fn, opts)
      this.cleanups.push(() => target.removeEventListener(type, fn, opts))
    }

    on(this.els['big-play'], 'click', () => this.togglePlay())
    on(this.els.play, 'click', () => this.togglePlay())
    on(this.video, 'click', () => this.togglePlay())
    on(this.els.mute, 'click', () => this.toggleMute())
    on(this.els.vol, 'input', () => this.setVolume(Number((this.els.vol as HTMLInputElement).value)))
    on(this.els.fs, 'click', () => this.toggleFullscreen())
    on(this.els['quality-btn'], 'click', () => this.toggleMenu())
    on(this.frame, 'keydown', (e: KeyboardEvent) => this.onKey(e))
    on(this.frame, 'pointermove', () => this.poke())
    on(this.frame, 'pointerdown', () => this.poke())
    on(this.frame, 'focusin', () => this.poke())
    on(document, 'fullscreenchange', () => this.onFullscreenChange())
    on(document, 'pointerdown', (e: PointerEvent) => {
      if (!e.composedPath().includes(this.els['quality-btn'].parentElement!)) this.closeMenu()
    })
    this.bindScrub(on)

    if (!mediaSourceSupported()) {
      this.showMessage("This browser can't stream this video.")
      ;(this.els['big-play'] as HTMLButtonElement).disabled = true
      return
    }
    // Prefetch the player module as the video approaches the viewport.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadVinyl()
          io.disconnect()
        }
      },
      { rootMargin: '400px' },
    )
    io.observe(this)
    this.cleanups.push(() => io.disconnect())
  }

  disconnectedCallback() {
    for (const cleanup of this.cleanups.splice(0)) cleanup()
    clearTimeout(this.idleTimer)
    this.player?.dispose()
    this.player = null
    this.creating = null
  }

  attributeChangedCallback() {
    this.applyAspect()
    this.applyPoster()
  }

  private applyAspect(ratio?: string) {
    const value = ratio ?? this.getAttribute('aspect')
    const match = value?.match(/^\s*(\d+(?:\.\d+)?)\s*[/:x]\s*(\d+(?:\.\d+)?)\s*$/)
    if (match) this.frame.style.setProperty('--pf-aspect', `${match[1]} / ${match[2]}`)
  }

  private applyPoster() {
    const poster = this.getAttribute('poster')
    if (!poster) return
    this.video.poster = poster
    if (this.hasAttribute('aspect')) return
    const img = new Image()
    img.onload = () => {
      if (!this.hasAttribute('aspect') && img.naturalWidth) {
        this.applyAspect(`${img.naturalWidth}/${img.naturalHeight}`)
      }
    }
    img.src = poster
  }

  private async ensurePlayer(): Promise<VinylPlayer> {
    if (this.player) return this.player
    this.creating ??= (async () => {
      const src = this.getAttribute('src')
      if (!src) throw new Error('pf-video: missing src')
      const { createVinylPlayer } = await loadVinyl()
      const player = createVinylPlayer({ media: this.video })
      this.player = player
      this.bindPlayer(player)
      player.load({ type: 'dash', uri: new URL(src, document.baseURI).href })
      return player
    })()
    return this.creating
  }

  private bindPlayer(player: VinylPlayer) {
    const render = () => this.renderTime()
    player.on('timeUpdate', render)
    player.on('durationChange', render)
    player.on('fetchedRangesChange', render)
    player.on('play', () => this.renderPlaying())
    player.on('playing', () => {
      this.renderPlaying()
      this.setStalled(false)
    })
    player.on('pause', () => this.renderPlaying())
    player.on('ended', () => this.renderPlaying())
    player.on('stallEntered', () => this.setStalled(true))
    player.on('stallEnded', () => this.setStalled(false))
    player.on('seeking', () => this.setStalled(!player.canPlay))
    player.on('seeked', () => this.setStalled(false))
    player.on('volumeChange', () => this.renderVolume())
    player.on('mutedChange', () => this.renderVolume())
    player.on('qualitiesChange', () => this.renderMenu())
    player.on('playbackQualityChange', () => this.renderMenu())
    player.on('loadedMetadata', () => {
      if (!this.hasAttribute('aspect') && !this.hasAttribute('poster') && this.video.videoWidth) {
        this.applyAspect(`${this.video.videoWidth}/${this.video.videoHeight}`)
      }
    })
    player.on('error', ({ error }) => {
      this.setStalled(false)
      this.showMessage(`Playback failed: ${error.message || 'unknown error'}`)
    })
  }

  private async togglePlay() {
    if (this.player && !this.player.paused && !this.player.ended) {
      this.player.pause()
      return
    }
    this.frame.classList.add('started')
    this.setStalled(true)
    try {
      const player = await this.ensurePlayer()
      if (player.ended) await player.seekTo(0)
      await player.play()
      this.frame.focus({ preventScroll: true })
    } catch (error) {
      this.setStalled(false)
      if ((error as Error)?.name !== 'AbortError') {
        this.showMessage(`Couldn't start playback: ${(error as Error)?.message ?? error}`)
      }
    }
  }

  private toggleMute() {
    const p = this.player
    if (!p) return
    p.muted = !p.muted
    if (!p.muted && p.volume === 0) p.volume = 0.5
  }

  private setVolume(value: number) {
    const p = this.player
    if (!p) return
    p.volume = Math.min(1, Math.max(0, value))
    p.muted = p.volume === 0
  }

  private toggleFullscreen() {
    if (document.fullscreenElement === this) {
      void document.exitFullscreen().catch(() => {})
    } else if (this.requestFullscreen) {
      void this.requestFullscreen().catch(() => {})
    } else {
      // iOS Safari: only the <video> element can go fullscreen.
      ;(this.video as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen?.()
    }
  }

  private onFullscreenChange() {
    const full = document.fullscreenElement === this
    this.els.fs.innerHTML = icon(full ? 'exitFullscreen' : 'fullscreen')
    this.els.fs.setAttribute('aria-label', full ? 'Exit fullscreen' : 'Fullscreen')
  }

  private onKey(e: KeyboardEvent) {
    const target = e.composedPath()[0] as HTMLElement
    const inRange = target instanceof HTMLInputElement
    const inMenu = this.els.menu.contains(target)
    const p = this.player
    switch (e.key) {
      case ' ':
      case 'k':
        if (target instanceof HTMLButtonElement) return
        e.preventDefault()
        void this.togglePlay()
        break
      case 'ArrowLeft':
      case 'ArrowRight':
        if (inRange || inMenu || !p) return
        e.preventDefault()
        void p.seekTo(Math.min(p.duration, Math.max(0, p.currentTime + (e.key === 'ArrowLeft' ? -SEEK_STEP : SEEK_STEP))))
        break
      case 'ArrowUp':
      case 'ArrowDown':
        if (inRange || inMenu || !p) return
        e.preventDefault()
        this.setVolume(p.volume + (e.key === 'ArrowUp' ? VOLUME_STEP : -VOLUME_STEP))
        break
      case 'm':
        this.toggleMute()
        break
      case 'f':
        this.toggleFullscreen()
        break
      case 'Escape':
        if (this.els.menu.classList.contains('open')) {
          this.closeMenu()
          ;(this.els['quality-btn'] as HTMLButtonElement).focus()
        }
        break
      default:
        return
    }
    this.poke()
  }

  private bindScrub(on: (t: EventTarget, type: string, fn: (e: any) => void) => void) {
    const scrub = this.els.scrub
    const pctAt = (clientX: number) => {
      const rect = scrub.getBoundingClientRect()
      return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    }
    const preview = (pct: number) => this.renderProgress(pct)
    on(scrub, 'pointerdown', (e: PointerEvent) => {
      if (!this.player) return
      this.dragging = true
      scrub.classList.add('dragging')
      scrub.setPointerCapture(e.pointerId)
      preview(pctAt(e.clientX))
    })
    on(scrub, 'pointermove', (e: PointerEvent) => {
      if (this.dragging) preview(pctAt(e.clientX))
    })
    const end = (e: PointerEvent) => {
      if (!this.dragging || !this.player) return
      this.dragging = false
      scrub.classList.remove('dragging')
      void this.player.seekTo(pctAt(e.clientX) * this.player.duration)
    }
    on(scrub, 'pointerup', end)
    on(scrub, 'pointercancel', () => {
      this.dragging = false
      scrub.classList.remove('dragging')
      this.renderTime()
    })
    on(scrub, 'keydown', (e: KeyboardEvent) => {
      const p = this.player
      if (!p) return
      const jump = { Home: -Infinity, End: Infinity, PageUp: 30, PageDown: -30 } as Record<string, number>
      if (e.key in jump) {
        e.preventDefault()
        void p.seekTo(Math.min(p.duration, Math.max(0, p.currentTime + jump[e.key])))
      }
    })
  }

  private renderTime() {
    const p = this.player
    if (!p) return
    if (!this.dragging) this.renderProgress(p.currentTimePercent)
    ;(this.els.fetched as HTMLElement).style.width = `${p.fetchedTimePercent * 100}%`
    this.els.elapsed.textContent = formatTime(p.currentTime)
    this.els.remaining.textContent = `-${formatTime(p.duration - p.currentTime)}`
    const scrub = this.els.scrub
    scrub.setAttribute('aria-valuemax', String(Math.round(p.duration) || 0))
    scrub.setAttribute('aria-valuenow', String(Math.round(p.currentTime)))
    scrub.setAttribute('aria-valuetext', `${formatTime(p.currentTime)} of ${formatTime(p.duration)}`)
  }

  private renderProgress(pct: number) {
    const css = `${Math.min(1, Math.max(0, pct)) * 100}%`
    ;(this.els.fill as HTMLElement).style.width = css
    ;(this.els.handle as HTMLElement).style.left = css
  }

  private renderPlaying() {
    const p = this.player
    const playing = !!p && !p.paused && !p.ended
    this.els.play.innerHTML = icon(playing ? 'pause' : 'play')
    this.els.play.setAttribute('aria-label', playing ? 'Pause' : 'Play')
    if (!playing) {
      this.frame.classList.remove('idle')
      clearTimeout(this.idleTimer)
    } else {
      this.poke()
    }
  }

  private renderVolume() {
    const p = this.player
    if (!p) return
    const silent = p.muted || p.volume === 0
    this.els.mute.innerHTML = icon(silent ? 'muted' : 'volume')
    this.els.mute.setAttribute('aria-label', silent ? 'Unmute' : 'Mute')
    ;(this.els.vol as HTMLInputElement).value = String(p.muted ? 0 : p.volume)
  }

  private setStalled(stalled: boolean) {
    this.frame.classList.toggle('stalled', stalled)
  }

  private showMessage(text: string) {
    this.els.message.textContent = text
    this.frame.classList.add('has-message')
  }

  // Controls hide after a moment without interaction while playing.
  private poke() {
    this.frame.classList.remove('idle')
    clearTimeout(this.idleTimer)
    const p = this.player
    if (!p || p.paused || this.els.menu.classList.contains('open')) return
    this.idleTimer = setTimeout(() => {
      if (!this.frame.matches(':focus-within') || document.fullscreenElement === this) {
        this.frame.classList.add('idle')
      }
    }, HIDE_CONTROLS_MS)
  }

  // Quality: "Auto" lets ABR pick; a rung caps ABR at that height, the same
  // way the Vinyl website's resolution setting does (abr.maxHeight).
  private videoHeights(): number[] {
    const heights = (this.player?.qualities ?? [])
      .filter((q) => q.contentType === 'video' && q.height)
      .map((q) => q.height as number)
    return [...new Set(heights)].sort((a, b) => b - a)
  }

  private renderMenu() {
    const menu = this.els.menu
    const current = this.player?.getPlaybackQuality('video')?.height
    const items: [number | null, string][] = [
      [null, current ? `Auto (${current}p)` : 'Auto'],
      ...this.videoHeights().map((h): [number, string] => [h, `${h}p`]),
    ]
    menu.replaceChildren(
      ...items.map(([height, label]) => {
        const b = document.createElement('button')
        b.type = 'button'
        b.setAttribute('role', 'menuitemradio')
        b.setAttribute('aria-checked', String(height === this.maxHeight))
        b.innerHTML = `${icon('check')}<span></span>`
        b.querySelector('span')!.textContent = label
        b.addEventListener('click', () => {
          this.setMaxHeight(height)
          this.closeMenu()
          ;(this.els['quality-btn'] as HTMLButtonElement).focus()
        })
        b.addEventListener('keydown', (e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
          e.preventDefault()
          const buttons = [...menu.querySelectorAll('button')]
          const i = buttons.indexOf(b) + (e.key === 'ArrowDown' ? 1 : -1)
          buttons[(i + buttons.length) % buttons.length].focus()
        })
        return b
      }),
    )
  }

  private setMaxHeight(height: number | null) {
    const p = this.player
    if (!p) return
    this.maxHeight = height
    p.configure({ abr: { ...p.options.abr, maxHeight: height } })
    this.renderMenu()
  }

  private toggleMenu() {
    if (this.els.menu.classList.contains('open')) {
      this.closeMenu()
      return
    }
    this.renderMenu()
    this.els.menu.classList.add('open')
    this.els['quality-btn'].setAttribute('aria-expanded', 'true')
    this.els.menu.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
  }

  private closeMenu() {
    this.els.menu.classList.remove('open')
    this.els['quality-btn'].setAttribute('aria-expanded', 'false')
    this.poke()
  }
}

if (!customElements.get('pf-video')) customElements.define('pf-video', PfVideo)

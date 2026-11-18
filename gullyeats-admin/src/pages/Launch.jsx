import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Maximize, Rocket } from 'lucide-react'
import useUrlState from '../hooks/useUrlState'

/*
 * The launch ceremony: a big button, 3… 2… 1…, then confetti and "GullyEats
 * is live!". For the event's screen only: nothing in the apps changes.
 *
 * The muhurat (LAUNCH_AT; ?at=<date and time> overrides it, for a rehearsal) shows a big
 * countdown and starts 3… 2… 1… by itself so "live" lands on that exact
 * minute. Times are India time, whatever the laptop's clock zone. Browsers allow sound and full
 * screen only after a click, so press Full screen once before the moment.
 */

// Friday 20 Nov 2026, 6:45 pm IST (as a datetime-local value).
const LAUNCH_AT = '2026-11-20T18:45'
const COUNT_FROM = 3
const SECOND = 1000
const ORANGE = ['#FE5200', '#ff9a66', '#FFC21A', '#FFFFFF', '#16A34A', '#A78BFA']

let audio
function beep(freq, ms) {
  try {
    audio ||= new AudioContext()
    if (audio.state === 'suspended') audio.resume()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.25, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + ms / 1000)
    osc.connect(gain).connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + ms / 1000)
  } catch {
    // No sound (blocked or unsupported): the countdown still runs.
  }
}

// Paper confetti falling over the whole screen for a few seconds.
function Confetti() {
  const canvas = useRef(null)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const c = canvas.current
    const ctx = c.getContext('2d')
    const resize = () => {
      c.width = window.innerWidth
      c.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)
    const pieces = Array.from({ length: 220 }, () => ({
      x: Math.random() * c.width,
      y: -20 - Math.random() * c.height,
      w: 6 + Math.random() * 8,
      h: 8 + Math.random() * 10,
      vy: 2 + Math.random() * 4,
      vx: -1.5 + Math.random() * 3,
      spin: Math.random() * Math.PI,
      vs: -0.2 + Math.random() * 0.4,
      color: ORANGE[Math.floor(Math.random() * ORANGE.length)],
    }))
    const end = Date.now() + 9000
    let frame
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height)
      for (const p of pieces) {
        p.y += p.vy
        p.x += p.vx
        p.spin += p.vs
        // Keep raining until the end, then let the last pieces fall away.
        if (p.y > c.height + 20 && Date.now() < end) p.y = -20
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.spin)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.cos(p.spin * 2))
        ctx.restore()
      }
      if (pieces.some((p) => p.y < c.height + 20)) frame = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [])
  return <canvas ref={canvas} className="pointer-events-none fixed inset-0" aria-hidden="true" />
}

const two = (n) => String(n).padStart(2, '0')
// A datetime-local value has no zone: read it as IST.
const istMs = (v) => {
  if (!v) return NaN
  if (/(Z|[+-]\d\d:\d\d)$/i.test(v)) return new Date(v).getTime()
  return new Date(`${/T\d\d:\d\d$/.test(v) ? `${v}:00` : v}+05:30`).getTime()
}
const whenText = (ms) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(ms)

// Days / hours / minutes / seconds left, as big tiles.
function Countdown({ ms }) {
  const s = Math.ceil(ms / 1000)
  const parts = [
    [Math.floor(s / 86400), 'Days'],
    [Math.floor((s % 86400) / 3600), 'Hours'],
    [Math.floor((s % 3600) / 60), 'Minutes'],
    [s % 60, 'Seconds'],
  ]
  return (
    <div className="mt-10 flex gap-2 sm:gap-4" role="timer" aria-label={`${parts.map(([n, l]) => `${n} ${l}`).join(', ')} to launch`}>
      {parts.map(([n, label]) => (
        <div key={label} className="w-[19vw] max-w-[140px] rounded-2xl border border-white/10 bg-white/5 py-3 sm:py-5">
          <div className="font-mono text-[9vw] font-bold leading-none tabular-nums text-white sm:text-6xl">{two(n)}</div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/50 sm:text-xs">{label}</div>
        </div>
      ))}
    </div>
  )
}

export default function Launch() {
  const [at] = useUrlState('at', LAUNCH_AT)
  const [count, setCount] = useState(null) // 3, 2, 1, then 0 = live
  const [now, setNow] = useState(() => Date.now())
  const liveAt = useRef(0) // when "live" shows; each number is timed back from it
  const atMs = istMs(at)

  const start = (at = Date.now() + COUNT_FROM * SECOND) => {
    if (count !== null) return
    liveAt.current = at
    setCount(COUNT_FROM)
  }

  // Tick the countdown: a beep per number, a higher one when it goes live.
  // Each number is due at liveAt - n s, so timer delays never add up.
  useEffect(() => {
    if (count === null) return
    beep(count === 0 ? 1320 : 660, count === 0 ? 700 : 250)
    if (count === 0) return
    const due = liveAt.current - (count - 1) * SECOND
    const t = setTimeout(() => setCount((c) => c - 1), Math.max(0, due - Date.now()))
    return () => clearTimeout(t)
  }, [count])

  // The muhurat clock: start so that "live" lands exactly on the set time.
  useEffect(() => {
    if (!atMs || count !== null) return
    const t = setInterval(() => {
      const left = atMs - Date.now()
      setNow(Date.now())
      // Up to 2 min late still fires (a background tab's timers can run once
      // a minute); opening the page later than that doesn't replay a launch.
      if (left <= COUNT_FROM * SECOND && left > -2 * 60 * SECOND) start(Math.max(atMs, Date.now()))
    }, 50)
    return () => clearInterval(t)
  })

  const fullScreen = () => {
    beep(0, 1) // unlocks sound for an automatic start later
    document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const left = atMs - now

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0B1230] px-4 text-center text-white">
      {count === null && (
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-white/60 hover:text-white">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <button onClick={fullScreen} className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm text-white/80 hover:bg-white/10">
            <Maximize size={16} /> Full screen
          </button>
        </div>
      )}

      {count === null && (
        <>
          <h1 className="text-4xl font-bold sm:text-6xl">
            <span className="text-brand">Gully</span>Eats
          </h1>
          {atMs > now && (
            <>
              <p className="mt-6 text-lg text-white/70 sm:text-2xl">Launching {whenText(atMs)} IST</p>
              <Countdown ms={left} />
            </>
          )}
          <button
            onClick={start}
            className="mt-12 flex items-center gap-3 rounded-full bg-brand px-10 py-5 text-xl font-semibold shadow-[0_0_60px_rgba(254,82,0,0.5)] transition hover:scale-105 hover:bg-brand-600 sm:text-2xl"
          >
            <Rocket size={28} /> Launch GullyEats
          </button>
        </>
      )}

      {count > 0 && (
        <div key={count} className="motion-safe:animate-[launch-pop_1s_ease-out] text-[40vmin] font-bold leading-none text-brand" aria-live="assertive">
          {count}
        </div>
      )}

      {count === 0 && (
        <>
          <Confetti />
          <div className="motion-safe:animate-[launch-pop_1.2s_ease-out]" aria-live="assertive">
            <h1 className="text-5xl font-bold sm:text-8xl">
              <span className="text-brand">Gully</span>Eats is live! 🎉
            </h1>
            <p className="mt-6 text-xl text-white/70 sm:text-3xl">Thank you for being part of the day.</p>
          </div>
          <button onClick={() => setCount(null)} className="absolute bottom-6 text-sm text-white/40 hover:text-white/80">
            Back
          </button>
        </>
      )}
    </div>
  )
}

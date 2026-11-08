import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiArrowLeftSLine, RiFlashlightFill, RiPauseFill, RiPlayFill, RiRestaurant2Line, RiTrophyLine } from 'react-icons/ri'

import useOrder from '../hooks/useOrder'
import { createGame, draw, istDay, MAX_HITS, result, ROUND_MS, seedFor, step, WORLD_WIDTH } from '../game/nebula'
import { usePulseKey } from '../utils/pulse'
import { play, saveRound, submitRound } from '../utils/play'

/*
 * Nebula Rush, opened from the token page. The order stays live while playing
 * (useOrder without `page`, so nothing navigates mid-round): a pill shows its
 * status, and when the food is served the game pauses with a big banner.
 * Nothing is sent to the server until a round ends.
 */

const STATUS = { PENDING: 'Pay at counter', PAID: 'In the queue', SERVED: 'Ready!', CANCELLED: 'Cancelled' }
const DRAG = 1.5 // ship moves this much faster than the finger, so short swipes cross the screen

export default function NebulaRush() {
  const navigate = useNavigate()
  const { order, cartId, orderId } = useOrder()
  const key = usePulseKey()
  const back = `/c/${cartId}/order/${orderId}`

  const canvasRef = useRef(null)
  const boxRef = useRef(null)
  const gameRef = useRef(null)
  const viewRef = useRef({ scale: 1, ox: 0, oy: 0, dpr: 1 })
  const inputRef = useRef({ dx: 0, dy: 0 })
  const phaseRef = useRef('countdown')
  const [phase, setPhaseState] = useState('countdown') // countdown | playing | paused | over
  const [count, setCount] = useState(3)
  const [round, setRound] = useState(0) // bumps to start a new round
  const [summary, setSummary] = useState(null) // { ...result, best, newBest, rank, sending, error }
  const [ready, setReady] = useState(false)
  const [board, setBoard] = useState(null) // null closed, 'loading', or data
  const alerted = useRef(false)

  const setPhase = useCallback((p) => {
    phaseRef.current = p
    setPhaseState(p)
  }, [])

  // Fit the 360-wide world into the screen, sharp on high-density phones.
  const fit = useCallback(() => {
    const canvas = canvasRef.current
    const game = gameRef.current
    if (!canvas || !game) return
    const { width, height } = boxRef.current.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    const scale = Math.min(width / game.w, height / game.h)
    viewRef.current = { scale, ox: (width - game.w * scale) / 2, oy: (height - game.h * scale) / 2, dpr }
  }, [])

  // New round: same daily seed, 3-2-1, go.
  useEffect(() => {
    const { width, height } = boxRef.current.getBoundingClientRect()
    gameRef.current = createGame(seedFor(istDay()), { width: width || WORLD_WIDTH, height: height || 640 })
    gameRef.current.day = istDay()
    fit()
    setSummary(null)
    setPhase('countdown')
  }, [round, fit, setPhase])

  // The countdown (also used when resuming).
  useEffect(() => {
    if (phase !== 'countdown') return undefined
    setCount(3)
    let n = 3
    const id = setInterval(() => {
      n -= 1
      if (n > 0) setCount(n)
      else {
        clearInterval(id)
        setPhase('playing')
      }
    }, 650)
    return () => clearInterval(id)
  }, [phase, setPhase])

  const finish = useCallback(
    async (game) => {
      const r = result(game)
      const { best, newBest } = saveRound(game.day, r)
      setSummary({ ...r, best, newBest, rank: null, sending: Boolean(key), error: '' })
      setPhase('over')
      if (!key) return
      try {
        const s = await submitRound(key, game.day, r)
        setSummary((x) => x && { ...x, rank: s?.rank ?? null, best: Math.max(x.best, s?.best || 0), sending: false })
      } catch (e) {
        setSummary((x) => x && { ...x, sending: false, error: e.status ? e.message : 'Offline: your score will be sent next round.' })
      }
    },
    [key, setPhase],
  )

  // The loop: step only while playing, draw always (so pause shows the frozen scene).
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const frame = (now) => {
      const game = gameRef.current
      const canvas = canvasRef.current
      const dt = now - last
      last = now
      if (game && canvas) {
        if (phaseRef.current === 'playing') {
          const input = inputRef.current
          step(game, dt, { dx: input.dx, dy: input.dy })
          input.dx = 0
          input.dy = 0
          if (game.over) finish(game)
        } else {
          inputRef.current = { dx: 0, dy: 0 }
        }
        const ctx = canvas.getContext('2d')
        const { scale, ox, oy, dpr } = viewRef.current
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.fillStyle = '#070b1f'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy)
        draw(ctx, game)
        hud(ctx, game)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    window.addEventListener('resize', fit)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', fit)
    }
  }, [fit, finish])

  const pause = useCallback(() => {
    if (phaseRef.current === 'playing' || phaseRef.current === 'countdown') setPhase('paused')
  }, [setPhase])

  // Leaving the tab or the app pauses.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && pause()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', pause)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('blur', pause)
    }
  }, [pause])

  // Food's ready: pause and say so, once. Other changes only update the pill.
  const status = order?.status
  useEffect(() => {
    if (status !== 'SERVED' || alerted.current) return
    alerted.current = true
    pause()
    setReady(true)
    navigator.vibrate?.([200, 100, 200])
  }, [status, pause])

  // Relative drag: the ship moves with the finger wherever it touches.
  const last = useRef(null)
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    last.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerMove = (e) => {
    if (!last.current) return
    const k = DRAG / viewRef.current.scale
    inputRef.current.dx += (e.clientX - last.current.x) * k
    inputRef.current.dy += (e.clientY - last.current.y) * k
    last.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = () => {
    last.current = null
  }

  const openBoard = async () => {
    setBoard('loading')
    try {
      setBoard(await play(key, `/leaderboard?day=${gameRef.current?.day || istDay()}`))
    } catch (e) {
      setBoard({ error: e.message })
    }
  }

  return (
    <div className='fixed inset-0 z-0 mx-auto flex max-w-md flex-col bg-[#070b1f] text-white select-none'>
      <header className='relative z-10 flex h-14 items-center gap-2 px-3'>
        <button
          type='button'
          onClick={() => navigate(back)}
          aria-label='Back to your order'
          className='flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition active:scale-90'
        >
          <RiArrowLeftSLine size={24} />
        </button>
        <button
          type='button'
          onClick={() => navigate(back)}
          className='flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold'
        >
          <RiRestaurant2Line size={14} className='shrink-0 text-primary' />
          <span className='truncate'>
            Token #{order?.orderNumber ?? '…'} · {STATUS[status] || 'Loading'}
          </span>
          {status === 'SERVED' && <span className='h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#22c55e]' />}
        </button>
        <button
          type='button'
          onClick={() => (phase === 'paused' ? setPhase('countdown') : pause())}
          disabled={phase === 'over'}
          aria-label={phase === 'paused' ? 'Resume' : 'Pause'}
          className='flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition active:scale-90 disabled:opacity-30'
        >
          {phase === 'paused' ? <RiPlayFill size={20} /> : <RiPauseFill size={20} />}
        </button>
      </header>

      <div
        ref={boxRef}
        className='relative flex-1 touch-none'
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={canvasRef} className='absolute inset-0 h-full w-full' aria-label='Nebula Rush game. Drag anywhere to fly the ship.' />

        {phase === 'countdown' && (
          <Overlay>
            <p key={count} className='animate-pop text-8xl font-bold text-[#7df9ff]'>
              {count}
            </p>
            <p className='mt-4 text-sm text-white/70'>Drag anywhere to fly · grab ⚡ energy · dodge rocks</p>
          </Overlay>
        )}

        {phase === 'paused' && !ready && (
          <Overlay dim>
            <p className='text-2xl font-bold'>Paused</p>
            <GameButton onClick={() => setPhase('countdown')}>
              <RiPlayFill size={20} /> Resume
            </GameButton>
            <button type='button' onClick={() => navigate(back)} className='mt-3 text-sm font-semibold text-white/70 underline-offset-4 hover:underline'>
              Back to my order
            </button>
          </Overlay>
        )}

        {phase === 'over' && summary && (
          <Overlay dim>
            <p className='text-xs font-bold uppercase tracking-[0.25em] text-[#a78bfa]'>
              {summary.hits >= MAX_HITS ? 'Ship down' : 'Time’s up'}
            </p>
            <p className='animate-pop mt-1 text-6xl font-bold tabular-nums'>{summary.score}</p>
            {summary.newBest && summary.score > 0 && (
              <p className='mt-2 rounded-full bg-[#fde047] px-3 py-1 text-xs font-bold text-[#1c0b33]'>New best today!</p>
            )}
            <div className='mt-5 grid w-full max-w-xs grid-cols-3 gap-2 text-center'>
              <Stat label='Rocks' value={summary.kills} />
              <Stat label='Energy' value={summary.energy} />
              <Stat label='Best today' value={summary.best} />
            </div>
            <p className='mt-4 h-5 text-sm text-white/80'>
              {summary.sending
                ? 'Saving your score…'
                : summary.error
                  ? summary.error
                  : summary.rank
                    ? `You’re #${summary.rank} today`
                    : key
                      ? ''
                      : 'Place an order to join the leaderboard'}
            </p>
            <div className='mt-4 flex w-full max-w-xs flex-col gap-2.5'>
              <GameButton onClick={() => setRound((r) => r + 1)}>
                <RiPlayFill size={20} /> Play again
              </GameButton>
              <button
                type='button'
                onClick={openBoard}
                className='flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/10 font-semibold ring-1 ring-white/20 transition active:scale-[0.98]'
              >
                <RiTrophyLine size={18} className='text-[#fde047]' /> Today’s leaderboard
              </button>
              <button type='button' onClick={() => navigate(back)} className='mt-1 text-sm font-semibold text-white/70'>
                Back to my order
              </button>
            </div>
          </Overlay>
        )}

        {ready && (
          <Overlay dim>
            <span className='animate-pop flex h-20 w-20 items-center justify-center rounded-full bg-[#22c55e] text-4xl'>🍽️</span>
            <p className='mt-4 text-center text-2xl font-bold leading-tight'>Your food is ready for pickup!</p>
            <p className='mt-1 text-white/70'>Token #{order?.orderNumber}</p>
            <div className='mt-6 flex w-full max-w-xs flex-col gap-2.5'>
              <GameButton onClick={() => navigate(`${back}/served`)}>View order</GameButton>
              <button
                type='button'
                onClick={() => setReady(false)}
                className='h-12 rounded-2xl bg-white/10 font-semibold ring-1 ring-white/20 transition active:scale-[0.98]'
              >
                {phase === 'over' ? 'Close' : 'Finish this round'}
              </button>
            </div>
          </Overlay>
        )}
      </div>

      {board && <Leaderboard board={board} onClose={() => setBoard(null)} />}
    </div>
  )
}

// Score, time bar, hits and combo, drawn on the canvas over the game.
function hud(ctx, game) {
  const { w } = game
  const left = Math.max(0, ROUND_MS - game.t)
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(16, 10, w - 32, 4)
  ctx.fillStyle = left < 10000 ? '#ff6b6b' : '#22d3ee'
  ctx.fillRect(16, 10, (w - 32) * (left / ROUND_MS), 4)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 26px Poppins, system-ui, sans-serif'
  ctx.fillText(String(game.score), 16, 46)
  if (game.combo > 1) {
    ctx.fillStyle = '#fde047'
    ctx.font = '700 13px Poppins, system-ui, sans-serif'
    ctx.fillText(`⚡ x${game.combo}`, 16, 66)
  }

  ctx.textAlign = 'right'
  ctx.fillStyle = left < 10000 ? '#ff6b6b' : '#ffffff'
  ctx.font = '700 20px Poppins, system-ui, sans-serif'
  ctx.fillText(`${Math.ceil(left / 1000)}s`, w - 16, 42)
  for (let i = 0; i < MAX_HITS; i++) {
    ctx.fillStyle = i < MAX_HITS - game.hits ? '#fe5200' : 'rgba(255,255,255,0.18)'
    ctx.beginPath()
    ctx.arc(w - 22 - i * 16, 60, 5, 0, Math.PI * 2)
    ctx.fill()
  }
}

function Overlay({ children, dim = false }) {
  return (
    <div
      className={`animate-fade absolute inset-0 z-10 flex flex-col items-center justify-center px-6 ${dim ? 'bg-[#070b1f]/80 backdrop-blur-sm' : ''}`}
      onPointerDown={(e) => dim && e.stopPropagation()}
    >
      {children}
    </div>
  )
}

function GameButton({ children, onClick }) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='mt-5 flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-white shadow-[0_8px_24px_-8px_rgb(254_82_0/0.7)] transition active:scale-[0.98]'
    >
      {children}
    </button>
  )
}

function Stat({ label, value }) {
  return (
    <div className='rounded-2xl bg-white/8 px-2 py-3 ring-1 ring-white/10'>
      <p className='text-xl font-bold tabular-nums'>{value}</p>
      <p className='text-[11px] text-white/60'>{label}</p>
    </div>
  )
}

function Leaderboard({ board, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const me = board?.me
  const meShown = board?.top?.some((r) => r.me)
  return (
    <div className='fixed inset-0 z-50 flex items-end justify-center'>
      <div className='animate-fade absolute inset-0 bg-black/60' onClick={onClose} />
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='board-title'
        className='animate-sheet pb-safe relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-[#110a2e] px-5 pt-3 text-white ring-1 ring-white/10'
      >
        <div className='mx-auto h-1 w-10 rounded-full bg-white/20' />
        <h2 id='board-title' className='mt-5 flex items-center gap-2 text-xl font-bold'>
          <RiTrophyLine className='text-[#fde047]' /> Today’s top pilots
        </h2>
        <p className='mt-1 text-sm text-white/60'>Same rocks for everyone today. Resets at midnight.</p>
        {board === 'loading' ? (
          <p className='py-10 text-center text-white/60'>Loading…</p>
        ) : board.error ? (
          <p className='py-10 text-center text-white/70'>{board.error}</p>
        ) : board.top.length === 0 ? (
          <p className='py-10 text-center text-white/70'>No scores yet today. Be the first! 🚀</p>
        ) : (
          <ol className='mt-4 space-y-1.5'>
            {board.top.map((r) => (
              <Row key={r.rank} row={r} />
            ))}
            {me?.rank && !meShown && (
              <>
                <li className='py-1 text-center text-white/40'>⋯</li>
                <Row row={{ rank: me.rank, alias: me.alias, score: me.best, me: true }} />
              </>
            )}
          </ol>
        )}
        <button type='button' onClick={onClose} className='my-5 h-12 w-full rounded-2xl bg-white/10 font-semibold ring-1 ring-white/15'>
          Close
        </button>
      </div>
    </div>
  )
}

const MEDALS = ['🥇', '🥈', '🥉']
function Row({ row }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 ${row.me ? 'bg-primary/25 ring-1 ring-primary/60' : 'bg-white/5'}`}
    >
      <span className='w-7 text-center text-sm font-bold tabular-nums text-white/70'>{MEDALS[row.rank - 1] || row.rank}</span>
      <span className='min-w-0 flex-1 truncate text-sm font-semibold'>
        {row.alias}
        {row.me && <span className='ml-2 text-xs text-primary'>You</span>}
      </span>
      <span className='flex items-center gap-1 text-sm font-bold tabular-nums'>
        <RiFlashlightFill size={14} className='text-[#fde047]' />
        {row.score}
      </span>
    </li>
  )
}

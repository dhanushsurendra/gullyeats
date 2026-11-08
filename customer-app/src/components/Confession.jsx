import { useEffect, useRef, useState } from 'react'
import { RiChat3Line, RiFlag2Line, RiHeart3Fill, RiHeart3Line } from 'react-icons/ri'

import { Button } from './ui'
import { compact, REPORT_REASONS, timeAgo } from '../utils/pulse'

/* Pieces of the GullyPulse confession pages. */

const AVATARS = [
  ['bg-amber-100', '🦊'],
  ['bg-rose-100', '🐼'],
  ['bg-violet-100', '🦉'],
  ['bg-sky-100', '🐧'],
  ['bg-lime-100', '🐸'],
  ['bg-orange-100', '🐯'],
  ['bg-pink-100', '🐙'],
  ['bg-teal-100', '🐨'],
]

// A random-looking but stable animal avatar per post, so the feed isn't a wall
// of identical faces. It says nothing about who wrote it.
export function Avatar({ seed = '', small = false }) {
  const n = [...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  const [bg, emoji] = AVATARS[n % AVATARS.length]
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full ${bg} ${small ? 'h-8 w-8 text-base' : 'h-10 w-10 text-xl'}`}
    >
      {emoji}
    </span>
  )
}

// Heart that pops in the middle of a post on double tap.
function Burst({ show }) {
  if (!show) return null
  return (
    <span className='pointer-events-none absolute inset-0 flex items-center justify-center' aria-hidden>
      <RiHeart3Fill size={88} className='animate-heart text-primary drop-shadow-lg' />
    </span>
  )
}

/*
 * One confession. Double tap the text to like (never unlikes, like other
 * apps). onOpen makes the comment button open the post.
 */
export function ConfessionCard({ confession: c, onLike, onOpen, onReport, large = false, style }) {
  const [burst, setBurst] = useState(0)
  const lastTap = useRef(0)

  useEffect(() => {
    if (!burst) return undefined
    const t = setTimeout(() => setBurst(0), 800)
    return () => clearTimeout(t)
  }, [burst])

  const doubleTapLike = () => {
    setBurst((b) => b + 1)
    if (!c.liked) onLike(true)
  }
  // Touch: two taps within 300 ms. Mouse: the browser's own double click.
  const onPointerUp = (e) => {
    if (e.pointerType === 'mouse') return
    const now = Date.now()
    if (now - lastTap.current < 300) {
      lastTap.current = 0
      doubleTapLike()
    } else {
      lastTap.current = now
    }
  }

  return (
    <article className='animate-fade-up rounded-card bg-white p-4 shadow-card' style={style}>
      <header className='flex items-center gap-3'>
        <Avatar seed={c.id} />
        <div className='min-w-0 flex-1 leading-tight'>
          <p className='text-sm font-semibold'>
            Anonymous
            {c.mine && <span className='ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary'>You</span>}
          </p>
          <p className='text-xs text-grey-500'>
            <time dateTime={c.createdAt}>{timeAgo(c.createdAt)}</time> · #{c.id}
          </p>
        </div>
        {onReport && !c.mine && (
          <button
            type='button'
            onClick={onReport}
            aria-label='Report this confession'
            className='-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-grey-400 transition hover:bg-grey-100 hover:text-grey-700 active:scale-90'
          >
            <RiFlag2Line size={18} />
          </button>
        )}
      </header>

      <div
        className='relative mt-3 touch-manipulation select-none'
        onPointerUp={onPointerUp}
        onDoubleClick={doubleTapLike}
      >
        <p className={`whitespace-pre-wrap break-words leading-relaxed text-grey-800 ${large ? 'text-[17px]' : 'text-[15px]'}`}>
          {c.text}
        </p>
        <Burst key={burst} show={burst > 0} />
      </div>

      <footer className='mt-4 flex items-center gap-1 border-t border-grey-100 pt-2'>
        <button
          type='button'
          onClick={() => onLike(!c.liked)}
          aria-pressed={c.liked}
          aria-label={c.liked ? 'Unlike' : 'Like'}
          className={`flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition active:scale-90 ${
            c.liked ? 'text-primary' : 'text-grey-500 hover:bg-grey-100'
          }`}
        >
          {c.liked ? <RiHeart3Fill size={20} className='animate-pop' /> : <RiHeart3Line size={20} />}
          <span className='tabular-nums'>{compact(c.likes)}</span>
        </button>
        {onOpen ? (
          <button
            type='button'
            onClick={onOpen}
            aria-label={`${c.comments} comments`}
            className='flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-grey-500 transition hover:bg-grey-100 active:scale-90'
          >
            <RiChat3Line size={20} />
            <span className='tabular-nums'>{compact(c.comments)}</span>
          </button>
        ) : (
          <span className='flex h-10 items-center gap-1.5 px-3 text-sm font-semibold text-grey-500'>
            <RiChat3Line size={20} />
            <span className='tabular-nums'>{compact(c.comments)}</span>
          </span>
        )}
        <span className='ml-auto pr-1 text-[11px] text-grey-400'>Double tap to like</span>
      </footer>
    </article>
  )
}

export function ConfessionSkeleton() {
  return (
    <div className='rounded-card bg-white p-4 shadow-card' aria-hidden>
      <div className='flex items-center gap-3'>
        <div className='skeleton h-10 w-10 rounded-full' />
        <div className='flex-1 space-y-2'>
          <div className='skeleton h-3 w-24' />
          <div className='skeleton h-2.5 w-16' />
        </div>
      </div>
      <div className='mt-4 space-y-2'>
        <div className='skeleton h-3 w-full' />
        <div className='skeleton h-3 w-4/5' />
      </div>
    </div>
  )
}

// Bottom sheet to pick a report reason.
export function ReportSheet({ what = 'confession', onClose, onSubmit }) {
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const send = async () => {
    setSending(true)
    setError('')
    try {
      await onSubmit(reason)
    } catch (e) {
      setError(e.message)
      setSending(false)
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-end justify-center'>
      <div className='animate-fade absolute inset-0 bg-grey-900/40 backdrop-blur-[2px]' onClick={onClose} />
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='report-title'
        className='animate-sheet pb-safe relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white px-5 pt-3'
      >
        <div className='mx-auto h-1 w-10 rounded-full bg-grey-200' />
        <h2 id='report-title' className='mt-5 text-xl font-semibold'>
          Report this {what}
        </h2>
        <p className='mt-1 text-sm text-grey-500'>Reports are anonymous. Our team reviews every one.</p>
        <div className='mt-4 space-y-2' role='radiogroup' aria-label='Reason'>
          {REPORT_REASONS.map(([value, label]) => (
            <button
              key={value}
              type='button'
              role='radio'
              aria-checked={reason === value}
              onClick={() => setReason(value)}
              className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] transition active:scale-[0.99] ${
                reason === value ? 'bg-primary-soft font-semibold text-primary ring-2 ring-primary/40' : 'bg-grey-50 text-grey-800 ring-1 ring-grey-200'
              }`}
            >
              {label}
              <span
                className={`h-4 w-4 rounded-full border-2 ${reason === value ? 'border-primary bg-primary shadow-[inset_0_0_0_2px_white]' : 'border-grey-300'}`}
              />
            </button>
          ))}
        </div>
        {error && <p className='mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger'>{error}</p>}
        <div className='mt-5 space-y-2.5'>
          <Button variant='dangerSolid' onClick={send} loading={sending} disabled={!reason}>
            Report
          </Button>
          <Button variant='ghost' onClick={onClose} disabled={sending}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

// A short message at the bottom of the screen. Clears itself.
export function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return undefined
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [message, onDone])
  if (!message) return null
  return (
    <div className='pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4' role='status' aria-live='polite'>
      <p className='animate-fade-up max-w-sm rounded-2xl bg-grey-900 px-4 py-3 text-center text-sm font-medium text-white shadow-float'>
        {message}
      </p>
    </div>
  )
}

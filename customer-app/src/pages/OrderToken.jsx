import { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  RiArrowRightSLine,
  RiChat3Line,
  RiCheckLine,
  RiEditLine,
  RiDoubleQuotesL,
  RiFireLine,
  RiBrainLine,
  RiNotification3Line,
  RiFlashlightLine,
  RiHeart3Fill,
  RiHeart3Line,
  RiPlayFill,
  RiQuillPenLine,
  RiSpaceShipLine,
} from 'react-icons/ri'

import CancelOrderModal from '../components/CancelOrderModal'
import { Avatar, Toast } from '../components/Confession'
import { useLike } from '../hooks/usePulse'
import { Button, Card, LoadingScreen, Page, Row, StatusScreen, TopBar } from '../components/ui'
import { api } from '../constants/api'
import useOrder from '../hooks/useOrder'
import { rupees } from '../utils/format'
import { pulse, timeAgo, usePulseKey } from '../utils/pulse'
import { bestToday } from '../utils/play'
import { GAMES } from '../game/catalog'
import { enablePush, pushPermission } from '../utils/push'

const STEPS = ['Placed', 'Paid', 'Preparing', 'Served']

const tokens = (list) => list.map((n) => `#${n}`).join(', ')

/*
 * Where the cart's queue is: what's cooking now, and this order's place.
 * Places are counted in payment order, so they're a good guess, not a promise.
 */
function Queue({ queue, isPending }) {
  if (!queue) return null
  const { preparing = [], nextUp, waiting = 0, isPreparing, ahead } = queue
  if (!waiting && !isPending) return null

  const now = preparing.length
    ? { label: 'Now preparing', value: tokens(preparing) }
    : nextUp != null
      ? { label: 'Next up', value: `#${nextUp}` }
      : null
  const place = isPending
    ? waiting
      ? `${waiting} ${waiting === 1 ? 'order' : 'orders'} in the queue. Pay at the counter to join it.`
      : 'Pay at the counter to join the queue.'
    : isPreparing
      ? 'Yours is on the stove.'
      : ahead === 0
        ? "You're next."
        : ahead != null
          ? `${ahead} ${ahead === 1 ? 'order' : 'orders'} ahead of you.`
          : null

  return (
    <Card className='animate-fade-up flex items-center gap-4 [animation-delay:90ms]'>
      <span className='flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-500'>
        <RiFireLine size={26} />
      </span>
      <div className='min-w-0'>
        {now && (
          <p className='text-[15px]'>
            <span className='text-grey-500'>{now.label} </span>
            <b className='tabular-nums'>{now.value}</b>
          </p>
        )}
        {place && <p className={now ? 'text-sm text-grey-600' : 'text-[15px] font-semibold'}>{place}</p>}
      </div>
    </Card>
  )
}

function Progress({ status, preparing }) {
  const reached = status === 'SERVED' ? 3 : status === 'PAID' ? (preparing ? 2 : 1) : 0
  // Equal columns, so the circles are evenly spaced whatever each label's
  // length; each line runs from the previous circle's centre to this one's.
  return (
    <ol className='grid' style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))` }}>
      {STEPS.map((label, i) => (
        <li key={label} className='relative flex flex-col items-center gap-1.5'>
          {i > 0 && (
            <span
              aria-hidden='true'
              className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 transition-colors duration-500 ${
                i <= reached ? 'bg-success' : 'bg-grey-200'
              }`}
            />
          )}
          <span
            className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-500 ${
              i <= reached ? 'bg-success text-white' : 'bg-grey-100 text-grey-400'
            } ${i === reached + 1 ? 'ring-4 ring-primary-soft' : ''}`}
          >
            {i <= reached ? <RiCheckLine size={18} /> : i + 1}
          </span>
          <span className={`text-center text-xs font-medium ${i <= reached ? 'text-grey-900' : 'text-grey-400'}`}>{label}</span>
        </li>
      ))}
    </ol>
  )
}

// GullyPlay: today's games, two taps from the token. Always dark (they're
// arcade games), in either app theme.
const PLAY = [
  { id: 'nebula', icon: <RiSpaceShipLine size={22} className='text-[#7df9ff]' />, ring: 'ring-[#22d3ee]/40' },
  { id: 'reflex', icon: <RiFlashlightLine size={22} className='text-[#fde047]' />, ring: 'ring-[#fde047]/40' },
  { id: 'synapse', icon: <RiBrainLine size={22} className='text-[#f472b6]' />, ring: 'ring-[#f472b6]/40' },
]

function GameCard({ here }) {
  const navigate = useNavigate()
  return (
    <section className='animate-fade-up relative overflow-hidden rounded-card bg-linear-to-br from-[#0b1230] via-[#1a0f45] to-[#2a0f45] p-4 text-white shadow-card [animation-delay:90ms]'>
      <span className='absolute right-10 top-4 h-1 w-1 rounded-full bg-white/70' />
      <span className='absolute left-1/2 top-6 h-0.5 w-0.5 rounded-full bg-white/50' />
      <p className='text-[11px] font-bold uppercase tracking-wider text-[#a78bfa]'>GullyPlay · daily challenge</p>
      <div className='flex items-baseline justify-between gap-2'>
        <h2 className='text-lg font-bold leading-tight'>Play while you wait</h2>
        <button type='button' onClick={() => navigate('/play/how-to-play')} className='shrink-0 text-xs font-semibold text-[#7df9ff] underline underline-offset-4'>
          How to play
        </button>
      </div>
      {/* An odd last game takes the full width. */}
      <div className='mt-3 grid grid-cols-2 gap-2.5 [&>*:last-child:nth-child(odd)]:col-span-2'>
        {PLAY.map(({ id, icon, ring }) => {
          const g = GAMES[id]
          const best = bestToday(id)
          return (
            <button
              key={id}
              type='button'
              onClick={() => navigate(`${here}/play/${id}`)}
              className='flex flex-col items-start gap-2 rounded-2xl bg-white/8 p-3 text-left ring-1 ring-white/10 transition active:scale-[0.97]'
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ${ring}`}>
                {icon}
              </span>
              <span>
                <span className='block text-[15px] font-bold leading-tight'>{g.title}</span>
                <span className='block text-xs text-white/65'>{best ? `Best today: ${best}` : `${g.tagline} · ${g.seconds}s`}</span>
              </span>
              <span className='mt-auto inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold'>
                <RiPlayFill size={14} /> Play
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// GullyPulse while you wait: swipe the top confessions (like them right
// here), or start one from a prompt. Posting brings the customer back here.
const PROMPTS = ['I secretly…', 'Never told anyone, but…', 'My guilty pleasure is…', 'Unpopular opinion:', 'I still regret…']

function PulseCard({ here }) {
  const navigate = useNavigate()
  const key = usePulseKey()
  const [feed, setFeed] = useState(null) // { items, today }
  const [note, setNote] = useState('')
  const clearNote = useCallback(() => setNote(''), [])

  useEffect(() => {
    let live = true
    pulse(key, '/feed')
      .then((d) => live && setFeed({ items: d.items.slice(0, 5), today: d.today || 0 }))
      .catch(() => live && setFeed({ items: [], today: 0 }))
    return () => {
      live = false
    }
  }, [key])

  const update = useCallback(
    (id, fn) => setFeed((f) => f && { ...f, items: f.items.map((c) => (c.id === id ? fn(c) : c)) }),
    [],
  )
  const like = useLike(key, update, setNote)
  const write = (prefill = '') => navigate('/confessions/new', { state: { from: here, prefill } })

  return (
    // Not <Card>: its p-4 can't be overridden, and the carousel runs edge to edge.
    <section className='animate-fade-up overflow-hidden rounded-card bg-surface shadow-card [animation-delay:100ms]'>
      <div className='px-4 pt-4'>
        <div className='flex items-center justify-between gap-2'>
          <span className='inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary'>
            <span className='h-2 w-2 animate-pulse rounded-full bg-primary' /> GullyPulse
          </span>
          {feed?.today > 0 && (
            <span className='rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-grey-600 shadow-card'>
              🔥 {feed.today} {feed.today === 1 ? 'confession' : 'confessions'} today
            </span>
          )}
        </div>
        <h2 className='mt-2 text-lg font-bold leading-snug'>While you wait… what’s your secret?</h2>
        <p className='text-sm text-grey-500'>100% anonymous. Not even the vendor knows it’s you.</p>
      </div>

      {feed === null ? (
        <div className='flex gap-3 overflow-hidden px-4 py-3' aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className='skeleton h-32 w-[80%] shrink-0 rounded-2xl' />
          ))}
        </div>
      ) : feed.items.length ? (
        <ul
          className='flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          aria-label='Top confessions'
        >
          {feed.items.map((c) => (
            <li key={c.id} className='w-[80%] shrink-0 snap-start'>
              <div className='flex h-full flex-col rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-grey-200/60'>
                <button type='button' onClick={() => navigate(`/confessions/${c.id}`)} className='flex-1 text-left'>
                  <span className='flex items-center gap-2'>
                    <Avatar seed={c.id} small />
                    <span className='text-xs text-grey-500'>Anonymous · {timeAgo(c.createdAt)}</span>
                  </span>
                  <span className='mt-2 line-clamp-3 text-sm leading-relaxed text-grey-800'>{c.text}</span>
                </button>
                <span className='mt-2 flex items-center gap-1'>
                  <button
                    type='button'
                    onClick={() => like(c, !c.liked)}
                    aria-pressed={c.liked}
                    aria-label={c.liked ? 'Unlike' : 'Like'}
                    className={`-ml-1.5 flex h-9 items-center gap-1 rounded-full px-2 text-xs font-semibold transition active:scale-90 ${c.liked ? 'text-primary' : 'text-grey-500'}`}
                  >
                    {c.liked ? <RiHeart3Fill size={18} className='animate-pop' /> : <RiHeart3Line size={18} />} {c.likes}
                  </button>
                  <button
                    type='button'
                    onClick={() => navigate(`/confessions/${c.id}`)}
                    aria-label={`${c.comments} comments`}
                    className='flex h-9 items-center gap-1 rounded-full px-2 text-xs font-semibold text-grey-500'
                  >
                    <RiChat3Line size={17} /> {c.comments}
                  </button>
                </span>
              </div>
            </li>
          ))}
          <li className='w-[40%] shrink-0 snap-start'>
            <button
              type='button'
              onClick={() => navigate('/confessions')}
              className='flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-primary/30 text-sm font-semibold text-primary'
            >
              <RiArrowRightSLine size={24} /> See all
            </button>
          </li>
        </ul>
      ) : (
        <p className='px-4 py-3 text-sm text-grey-600'>Nobody has confessed yet. Be the first 🤫</p>
      )}

      <div className='flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
        {PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type='button'
            onClick={() => write(`${prompt.replace(/…$/, '')} `)}
            className='shrink-0 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/30 transition active:scale-95'
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className='p-4'>
        <button
          type='button'
          onClick={() => write()}
          className='flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-semibold text-white shadow-[0_6px_20px_-6px_rgb(254_82_0/0.6)] transition hover:bg-primary-dark active:scale-[0.98]'
        >
          <RiQuillPenLine size={18} /> Confess anonymously
        </button>
      </div>
      <Toast message={note} onDone={clearNote} />
    </section>
  )
}

export default function OrderToken() {
  const location = useLocation()
  const navigate = useNavigate()
  const cart = useSelector((state) => state.cart.details)
  const { order, setOrder, error, retry, cartId, orderId, queue } = useOrder({ page: '' })

  const [truthLine, setTruthLine] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  // "Posted anonymously" after coming back from writing a confession.
  const [toast, setToast] = useState(location.state?.toast || '')

  // Notifications: on by themselves once allowed (on an earlier order too);
  // otherwise a button asks, since browsers only prompt from a tap.
  const [notify, setNotify] = useState(() => (pushPermission() === 'default' ? 'ask' : 'off'))
  const turnOnNotify = async () => {
    setNotify('busy')
    try {
      setNotify((await enablePush(orderId)) ? 'on' : 'off')
    } catch {
      setNotify(pushPermission() === 'default' ? 'ask' : 'off')
    }
  }
  useEffect(() => {
    if (pushPermission() !== 'granted') return
    enablePush(orderId).then((on) => setNotify(on ? 'on' : 'off'), () => {})
  }, [orderId])

  useEffect(() => {
    if (location.state?.toast) navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

  useEffect(() => {
    api('/orders/get-truth-line')
      .then((d) => setTruthLine(typeof d === 'string' ? d : d?.text || ''))
      .catch(() => {})
  }, [])

  if (!order) {
    return (
      <Page>
        {error ? (
          <StatusScreen icon='🧾' title="Couldn't load your order" message={error}>
            <Button onClick={retry}>Try again</Button>
            <Button variant='ghost' onClick={() => navigate(`/c/${cartId}/menu`)}>
              Back to menu
            </Button>
          </StatusScreen>
        ) : (
          <LoadingScreen label='Fetching your token…' blocks={['h-56', 'h-16', 'h-40', 'h-13']} />
        )}
      </Page>
    )
  }

  const total = Number(order.totalPrice || 0)
  const paid = Number(order.paidAmount || 0)
  const due = Math.max(0, total - paid)
  const adjustment = order.paymentAdjustment
  const isPending = order.status === 'PENDING'
  // Once money has changed hands, only the vendor can cancel (and refund).
  const canCancel = isPending && paid === 0

  const cancel = async () => {
    setCancelling(true)
    setCancelError('')
    try {
      setOrder(await api(`/orders/delete-order/${orderId}`, { method: 'DELETE' }))
      // useOrder moves to the cancelled page.
    } catch (e) {
      setCancelError(e.message)
      setCancelling(false)
    }
  }

  const headline = isPending
    ? paid > 0
      ? `Pay ${rupees(due)} more at the counter`
      : `Pay ${rupees(due)} at the counter`
    : order.preparingAt
      ? 'Your food is being prepared'
      : "Paid. You're in the queue"
  const detail = isPending
    ? 'Show your token when you pay. Cooking starts after payment.'
    : notify === 'on'
      ? "We'll send you a notification when it's ready."
      : "We'll let you know here when it's ready. Keep this page open."

  return (
    <Page>
      <TopBar title={cart?.cartName || 'Your order'} subtitle='Order placed' onBack={() => navigate(`/c/${cartId}/menu`)} />

      <main className='flex-1 space-y-4 px-4 py-4'>
        <section className='animate-fade-up relative overflow-hidden rounded-card bg-linear-to-br from-[#ff7a2e] to-primary px-5 py-6 text-center text-white shadow-float'>
          <span className='absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10' />
          <span className='absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-white/10' />
          <p className='relative text-xs font-semibold uppercase tracking-[0.2em] text-white/80'>Your token</p>
          <p className='animate-pop relative mt-1 text-7xl font-bold tabular-nums leading-none'>{order.orderNumber}</p>
          <p className='relative mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium'>
            <span className='h-2 w-2 animate-pulse rounded-full bg-surface' /> Live updates on
          </p>
        </section>

        <Card className='animate-fade-up space-y-4 [animation-delay:60ms]'>
          <Progress status={order.status} preparing={Boolean(order.preparingAt)} />
          <div className={`rounded-2xl px-4 py-3 ${isPending ? 'bg-primary-soft' : 'bg-success-soft'}`}>
            <p className={`text-[15px] font-semibold ${isPending ? 'text-primary' : 'text-success'}`}>{headline}</p>
            <p className='mt-0.5 text-sm text-grey-600'>{detail}</p>
          </div>
          {(notify === 'ask' || notify === 'busy') && (
            <Button variant='secondary' loading={notify === 'busy'} onClick={turnOnNotify}>
              <RiNotification3Line size={18} /> Notify me when it's ready
            </Button>
          )}
          {adjustment?.action === 'RETURN' && adjustment.amount > 0 && (
            <p className='rounded-2xl bg-grey-100 px-4 py-3 text-sm text-grey-700'>
              Your order got smaller. Collect <b>{rupees(adjustment.amount)}</b> back from the vendor.
            </p>
          )}
        </Card>

        <Queue queue={queue} isPending={isPending} />

        <GameCard here={location.pathname} />

        <PulseCard here={location.pathname} />

        <Card className='animate-fade-up [animation-delay:120ms]'>
          <h2 className='text-[15px] font-semibold'>Your order</h2>
          <ul className='mt-3 space-y-2'>
            {(order.orderItems || []).map((item) => (
              <li key={item.menuItemId || item._id} className='flex justify-between gap-3 text-sm'>
                <span className='text-grey-700'>
                  <span className='font-semibold text-grey-900'>{item.quantity} ×</span> {item.name}
                </span>
                <span className='tabular-nums'>{rupees(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className='my-3 border-t border-dashed border-grey-200' />
          <div className='space-y-2'>
            <Row label='Platform fee' value={rupees(order.platformFee)} />
            {Number(order.parcelCharge) > 0 && <Row label='Parcel charge' value={rupees(order.parcelCharge)} />}
            {paid > 0 && paid < total && <Row label='Paid so far' value={rupees(paid)} />}
            <Row label='Total' value={rupees(total)} strong />
          </div>
        </Card>

        {truthLine && (
          <Card tone='bg-ink text-white' className='animate-fade-up [animation-delay:180ms]'>
            <RiDoubleQuotesL className='text-primary' size={24} />
            <p className='mt-1 text-[15px] italic leading-relaxed text-white/90'>{truthLine}</p>
            <p className='mt-2 text-xs text-white/40'>Something to read while you wait</p>
          </Card>
        )}

        <div className='space-y-2.5 pt-1'>
          <Button variant='secondary' onClick={() => navigate(`/c/${cartId}/order/${orderId}/add`)}>
            <RiEditLine size={18} /> Add or change items
          </Button>
          {canCancel ? (
            <Button variant='ghost' className='text-danger hover:bg-danger-soft' onClick={() => setConfirming(true)}>
              Cancel order
            </Button>
          ) : (
            <p className='px-4 py-2 text-center text-xs text-grey-400'>To cancel a paid order, ask the vendor.</p>
          )}
        </div>
      </main>

      {confirming && (
        <CancelOrderModal
          token={order.orderNumber}
          onCancel={cancel}
          onKeepWaiting={() => {
            setConfirming(false)
            setCancelError('')
          }}
          cancelling={cancelling}
          error={cancelError}
        />
      )}
      <Toast message={toast} onDone={() => setToast('')} />
    </Page>
  )
}

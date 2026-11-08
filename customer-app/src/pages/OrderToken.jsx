import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { RiCheckLine, RiEditLine, RiDoubleQuotesL, RiFireLine } from 'react-icons/ri'

import CancelOrderModal from '../components/CancelOrderModal'
import { Button, Card, LoadingScreen, Page, Row, StatusScreen, TopBar } from '../components/ui'
import { api } from '../constants/api'
import useOrder from '../hooks/useOrder'
import { rupees } from '../utils/format'

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

export default function OrderToken() {
  const navigate = useNavigate()
  const cart = useSelector((state) => state.cart.details)
  const { order, setOrder, error, retry, cartId, orderId, queue } = useOrder({ page: '' })

  const [truthLine, setTruthLine] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

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
          <LoadingScreen label='Fetching your token…' />
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
            <span className='h-2 w-2 animate-pulse rounded-full bg-white' /> Live updates on
          </p>
        </section>

        <Card className='animate-fade-up space-y-4 [animation-delay:60ms]'>
          <Progress status={order.status} preparing={Boolean(order.preparingAt)} />
          <div className={`rounded-2xl px-4 py-3 ${isPending ? 'bg-primary-soft' : 'bg-success-soft'}`}>
            <p className={`text-[15px] font-semibold ${isPending ? 'text-primary' : 'text-success'}`}>{headline}</p>
            <p className='mt-0.5 text-sm text-grey-600'>{detail}</p>
          </div>
          {adjustment?.action === 'RETURN' && adjustment.amount > 0 && (
            <p className='rounded-2xl bg-grey-100 px-4 py-3 text-sm text-grey-700'>
              Your order got smaller. Collect <b>{rupees(adjustment.amount)}</b> back from the vendor.
            </p>
          )}
        </Card>

        <Queue queue={queue} isPending={isPending} />

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
          <Card tone='bg-grey-900 text-white' className='animate-fade-up [animation-delay:180ms]'>
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
    </Page>
  )
}

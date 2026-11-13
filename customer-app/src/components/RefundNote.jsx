import { useState } from 'react'
import { RiCheckboxCircleFill } from 'react-icons/ri'

import { api } from '../constants/api'
import { rupees } from '../utils/format'

// Money the vendor owes back on a paid order that was cancelled or made
// smaller: still owed, handed back (the cart marked it), or flagged by the
// customer as not received. Orders from before the refund log only have
// paymentAdjustment.
function refundState(order) {
  const log = order.refunds?.length
    ? order.refunds
    : order.paymentAdjustment?.action === 'RETURN' && order.paymentAdjustment.amount > 0
      ? [{ amount: order.paymentAdjustment.amount }]
      : []
  const owed = log.filter((r) => !r.refundedAt).reduce((t, r) => t + r.amount, 0)
  const last = log.findLast((r) => r.refundedAt)
  return { owed, last }
}

export default function RefundNote({ order, onChange, large = false }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { owed, last } = refundState(order)
  if (!owed && !last) return null

  const flag = async () => {
    setBusy(true)
    setError('')
    try {
      onChange(await api(`/orders/flag-refund/${order._id}`, { method: 'POST' }))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (owed > 0) {
    return large ? (
      <div className='rounded-card bg-primary-soft px-5 py-4 text-center'>
        <p className='text-sm text-grey-600'>Collect your money back from the vendor</p>
        <p className='mt-1 text-3xl font-bold text-primary'>{rupees(owed)}</p>
      </div>
    ) : (
      <p className='rounded-2xl bg-grey-100 px-4 py-3 text-sm text-grey-700'>
        Your order got smaller. Collect <b>{rupees(owed)}</b> back from the vendor.
      </p>
    )
  }

  return (
    <div className={`rounded-2xl bg-success-soft px-4 py-3 text-sm ${large ? 'text-center' : ''}`}>
      <p className={`flex items-center gap-1.5 font-semibold text-success ${large ? 'justify-center' : ''}`}>
        <RiCheckboxCircleFill size={18} /> {rupees(last.amount)} refunded
      </p>
      {last.flaggedAt ? (
        <p className='mt-1 text-grey-600'>You told us you didn't get it. GullyEats is checking with the cart.</p>
      ) : (
        <p className='mt-1 text-grey-600'>
          The cart says it handed this back.{' '}
          <button type='button' onClick={flag} disabled={busy} className='font-semibold text-danger underline underline-offset-2 disabled:opacity-50'>
            {busy ? 'Sending…' : "Didn't get it?"}
          </button>
        </p>
      )}
      {error && <p className='mt-1 text-danger'>{error}</p>}
    </div>
  )
}

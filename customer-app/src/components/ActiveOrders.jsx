import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { RiArrowRightSLine, RiTicket2Line } from 'react-icons/ri'

import { api } from '../constants/api'
import { forgetOrder, rememberOrder } from '../store/cartSlice'

const OPEN = ['PENDING', 'PAID']
const DAY = 24 * 60 * 60 * 1000

/*
 * The customer's open orders at this cart, so one placed earlier is always
 * a tap away: after the back button, a closed tab, or scanning the QR again.
 * Statuses are refreshed on open; served and cancelled orders drop off.
 */
export default function ActiveOrders({ cartId }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const saved = useSelector((state) => state.cart.orders) || []
  const [now] = useState(() => Date.now())
  const orders = saved
    .filter((o) => o.cartId === cartId && OPEN.includes(o.status) && now - new Date(o.createdAt) < DAY)
    // Newest first, by when it was placed (the saved list's order isn't meaningful).
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.orderNumber - a.orderNumber)
  // Sorted, so the refresh below runs when the set of orders changes, not
  // when the same orders are listed in another order.
  const ids = orders.map((o) => o._id).sort().join(',')

  useEffect(() => {
    for (const id of ids ? ids.split(',') : []) {
      api(`/orders/order/${id}`).then(
        (order) => dispatch(rememberOrder(order)),
        (e) => /not found|invalid id/i.test(e.message) && dispatch(forgetOrder(id)),
      )
    }
  }, [ids, dispatch])

  if (!orders.length) return null

  return (
    <div className='mb-4 space-y-2'>
      {orders.map((o) => (
        <button
          key={o._id}
          type='button'
          onClick={() => navigate(`/c/${cartId}/order/${o._id}`)}
          className='animate-fade-up flex w-full items-center gap-3 rounded-2xl bg-grey-900 px-4 py-3 text-left text-white shadow-float transition active:scale-[0.98]'
        >
          <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-primary'>
            <RiTicket2Line size={22} />
          </span>
          <span className='min-w-0 flex-1'>
            <span className='block text-[15px] font-semibold'>Your token #{o.orderNumber}</span>
            <span className='block text-sm text-white/60'>
              {o.status !== 'PAID'
                ? 'Pay at the counter'
                : o.preparingAt
                  ? 'Being prepared'
                  : 'Paid · in the queue'}
            </span>
          </span>
          <RiArrowRightSLine size={24} className='shrink-0 text-white/60' />
        </button>
      ))}
    </div>
  )
}

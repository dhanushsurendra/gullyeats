import { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'

import { api, orderKey, SOCKET_URL } from '../constants/api'
import { rememberOrder } from '../store/cartSlice'

// Which order page belongs to each status. PENDING and PAID share the token page.
const PAGE = { PENDING: '', PAID: '', SERVED: '/served', CANCELLED: '/cancelled' }

/*
 * Loads the order in the URL (`:orderNumber` holds the order's _id) and keeps
 * it live. With `page` set, moves to the right page when the vendor serves,
 * un-serves or cancels it.
 *
 * Refetches whenever the socket (re)connects or the tab comes back into view,
 * so updates missed while the phone was asleep still arrive.
 *
 * Also follows the cart's queue (who is being prepared, how many are ahead):
 * the server says "queue_changed" when any order there moves, and the page
 * refetches its own place.
 */
export default function useOrder({ page } = {}) {
  const { cartId, orderNumber: orderId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [queue, setQueue] = useState(null)

  const loadQueue = useCallback(() => {
    // The queue is extra: the token page works without it.
    api(`/orders/queue/${orderId}`).then(setQueue, () => {})
  }, [orderId])

  const load = useCallback(async () => {
    try {
      setOrder(await api(`/orders/order/${orderId}`))
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }, [orderId])

  useEffect(() => {
    api(`/orders/order/${orderId}`).then(setOrder, (e) => setError(e.message))
    const socket = io(SOCKET_URL, { transports: ['websocket'] })
    socket.on('connect', () => {
      socket.emit('join_order', orderKey(orderId) || orderId)
      socket.emit('join_queue', cartId)
      load()
    })
    socket.on('queue_changed', loadQueue)
    const onUpdate = (updated) => {
      if (String(updated?._id) === String(orderId)) setOrder(updated)
    }
    socket.on('order_updated', onUpdate)
    socket.on('order_cancelled', onUpdate)

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      load()
      loadQueue()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      socket.disconnect()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [orderId, cartId, load, loadQueue])

  // This order's own changes (paid, preparing) move its place too.
  const status = order?.status
  const preparingAt = order?.preparingAt
  useEffect(() => {
    if (status === 'PENDING' || status === 'PAID') loadQueue()
  }, [status, preparingAt, loadQueue])

  // Keep the saved copy current, so the menu's "your orders" list is right.
  useEffect(() => {
    if (order?._id) dispatch(rememberOrder(order))
  }, [order, dispatch])

  const target = order ? PAGE[order.status] : undefined
  useEffect(() => {
    if (page !== undefined && target !== undefined && target !== page) {
      navigate(`/c/${cartId}/order/${orderId}${target}`, { replace: true })
    }
  }, [page, target, cartId, orderId, navigate])

  return { order, setOrder, error, retry: load, cartId, orderId, queue }
}

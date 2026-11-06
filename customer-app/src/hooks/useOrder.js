import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'

import { api, SOCKET_URL } from '../constants/api'

// Which order page belongs to each status. PENDING and PAID share the token page.
const PAGE = { PENDING: '', PAID: '', SERVED: '/served', CANCELLED: '/cancelled' }

/*
 * Loads the order in the URL (`:orderNumber` holds the order's _id) and keeps
 * it live. With `page` set, moves to the right page when the vendor serves,
 * un-serves or cancels it.
 *
 * Refetches whenever the socket (re)connects or the tab comes back into view,
 * so updates missed while the phone was asleep still arrive.
 */
export default function useOrder({ page } = {}) {
  const { cartId, orderNumber: orderId } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')

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
      socket.emit('join_order', orderId)
      load()
    })
    const onUpdate = (updated) => {
      if (String(updated?._id) === String(orderId)) setOrder(updated)
    }
    socket.on('order_updated', onUpdate)
    socket.on('order_cancelled', onUpdate)

    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      socket.disconnect()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [orderId, load])

  const target = order ? PAGE[order.status] : undefined
  useEffect(() => {
    if (page !== undefined && target !== undefined && target !== page) {
      navigate(`/c/${cartId}/order/${orderId}${target}`, { replace: true })
    }
  }, [page, target, cartId, orderId, navigate])

  return { order, setOrder, error, retry: load, cartId, orderId }
}

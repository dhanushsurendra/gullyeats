import { useSelector } from 'react-redux'
import { api } from '../constants/api'

/*
 * GullyPulse (anonymous confessions). The server lets a phone post only if it
 * holds an order it placed: the order id plus the secret key create-order
 * returned, sent as X-Gully-Order.
 */

// "<orderId>.<key>" of the newest usable order on this phone, then every other
// order it holds a key for (the server shows posts from those as "mine"), or null.
export function usePulseKey() {
  return useSelector((state) => {
    const keyed = (state.cart.orders || []).filter((o) => o.accessKey)
    const order = keyed.find((o) => o.status !== 'CANCELLED')
    if (!order) return null
    return [order, ...keyed.filter((o) => o !== order)].map((o) => `${o._id}.${o.accessKey}`).join(',')
  })
}

export const pulse = (key, path = '', options = {}) =>
  api(`/confessions${path}`, { ...options, headers: key ? { 'X-Gully-Order': key } : undefined })

export const REPORT_REASONS = [
  ['abusive', 'Abusive or offensive'],
  ['sexual', 'Sexual content'],
  ['hate', 'Hate speech or discrimination'],
  ['harassment', 'Harassment or threats'],
  ['personal_info', 'Reveals someone’s identity'],
  ['spam', 'Spam'],
  ['other', 'Something else'],
]

// "now", "5m", "3h", "2d", then a date.
export function timeAgo(date) {
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n || 0))

import { store } from '../store/store'

// Set VITE_API_BASE_URL to test against a local backend.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://gullyeats.onrender.com/api'

export const SOCKET_URL = API_BASE_URL.replace(/\/api$/, '')

// "<orderId>.<key>" for an order this phone placed (the key create-order
// returned), or null. The server needs it for customer order calls.
export function orderKey(orderId) {
  const o = (store.getState().cart.orders || []).find((x) => x._id === orderId && x.accessKey)
  return o ? `${o._id}.${o.accessKey}` : null
}

// Calls the API and returns its `data`. Throws the server's own message
// (e.g. "This cart is not taking orders right now") so pages can show it.
export async function api(path, { method = 'GET', body, headers } = {}) {
  // /orders/<action>/<orderId>: prove the order is ours.
  const key = orderKey(path.match(/^\/orders\/[a-z-]+\/([a-f0-9]{24})$/)?.[1])
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'X-Gully-Order': key } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    // No response at all: the phone is offline, or the server is down or refused us (CORS).
    throw new Error(
      navigator.onLine === false ? 'No internet connection. Check your network and try again.' : 'Couldn’t reach GullyEats right now. Please try again.',
    )
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || 'Something went wrong. Please try again.')
    error.status = response.status
    error.code = data.code
    throw error
  }
  return data.data
}

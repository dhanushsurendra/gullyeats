// Vite only exposes variables starting with VITE_ (see .env.example).
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const ADMIN = import.meta.env.VITE_ADMIN_PATH || '/api/admin'

const CARTS = import.meta.env.VITE_CART_PATH || '/api/carts'

// Thrown on a 401; authSlice logs the admin out when a request fails with it.
export const SESSION_EXPIRED = 'Your session has expired. Please log in again.'

async function request(path, params) {
  const clean = Object.entries(params || {}).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  )

  const qs = clean.length ? `?${new URLSearchParams(clean)}` : ''

  let res

  try {
    res = await fetch(`${BASE}${path}${qs}`, {
      method: 'GET',
      credentials: 'include',
    })
  } catch {
    throw new Error(
      `Cannot reach the API at ${BASE}. Is the backend running and CORS enabled?`,
    )
  }

  const body = await res.json().catch(() => ({}))

  if (res.status === 401) throw new Error(SESSION_EXPIRED)
  if (!res.ok || body.success === false) {
    throw new Error(body.message || `Request failed (${res.status})`)
  }

  return body.data ?? body
}

async function post(path, payload) {
  let res

  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      ...(payload && {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    })
  } catch {
    throw new Error(`Cannot reach the API at ${BASE}.`)
  }

  const body = await res.json().catch(() => ({}))

  if (res.status === 401) throw new Error(SESSION_EXPIRED)
  if (!res.ok || body.success === false) {
    throw new Error(body.message || `Request failed (${res.status})`)
  }

  return body.data ?? body
}

export const ordersRequest = async (params = {}) => {
  const qs = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ''
    ) {
      qs.set(key, value)
    }
  })

  const res = await fetch(
    `${BASE}${ADMIN}/orders?${qs.toString()}`,
    {
      credentials: 'include',
    },
  )

  const body = await res.json().catch(() => ({}))

  if (res.status === 401) throw new Error(SESSION_EXPIRED)
  if (!res.ok || body.success === false) {
    throw new Error(
      body.message ||
        `Request failed (${res.status})`,
    )
  }

  return {
    data: body.data || [],
    pagination: body.pagination || {},
  }
}

/*
 * Admin Login
 *
 * POST /api/admin/login
 *
 * Request:
 * {
 *   email,
 *   password
 * }
 */
export const loginRequest = async (email, password) => {
  let res

  try {
    res = await fetch(`${BASE}${ADMIN}/login`, {
      method: 'POST',
      // Without this the browser drops the cross-origin Set-Cookie and every later call is 401.
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    })
  } catch {
    throw new Error(
      `Cannot reach the API at ${BASE}. Is the backend running and CORS enabled?`,
    )
  }

  const body = await res.json().catch(() => ({}))

  if (!res.ok || body.success === false) {
    throw new Error(body.message || `Login failed (${res.status})`)
  }

  return body.data ?? body
}

export const logoutRequest = async () => {
  let res

  try {
    res = await fetch(`${BASE}${ADMIN}/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    throw new Error(`Cannot reach the API at ${BASE}.`)
  }

  const body = await res.json().catch(() => ({}))

  if (!res.ok || body.success === false) {
    throw new Error(body.message || `Logout failed (${res.status})`)
  }

  return body
}

export const api = {
  overview: (p) => request(`${ADMIN}/overview`, p),

  series: (p) => request(`${ADMIN}/series`, p),

  owners: (p) => request(`${ADMIN}/owners`, p),

  carts: (p) => request(`${ADMIN}/carts`, p),

  orders: ordersRequest,

  payments: (p) => request(`${ADMIN}/payments`, p),

  feedback: (p) => request(`${ADMIN}/feedback`, p),

  activity: (p) => request(`${ADMIN}/activity`, p),

  collections: () => request(`${ADMIN}/insights/collections`),
  leakage: () => request(`${ADMIN}/insights/leakage`),
  vendors: () => request(`${ADMIN}/insights/vendors`),
  growth: () => request(`${ADMIN}/insights/growth`),
  operations: () => request(`${ADMIN}/insights/operations`),

  actions: (p) => request(`${ADMIN}/actions`, p),

  // GullyPulse moderation. kind: confession | comment.
  moderationCounts: () => request(`${ADMIN}/moderation/counts`),
  moderationQueue: (p) => request(`${ADMIN}/moderation/queue`, p),
  moderationItem: (kind, id) => request(`${ADMIN}/moderation/${kind}/${id}`),
  moderate: (kind, id, action, reason) => post(`${ADMIN}/moderation/${kind}/${id}/${action}`, { reason }),
  suspendPoster: (kind, id, days, reason) => post(`${ADMIN}/moderation/${kind}/${id}/suspend`, { days, reason }),
  suspendCart: (cartId, reason) => post(`${ADMIN}/carts/${cartId}/suspend`, { reason }),
  resumeCart: (cartId) => post(`${ADMIN}/carts/${cartId}/resume`),
  logReminder: (cartId, amount, channel) =>
    post(`${ADMIN}/carts/${cartId}/reminder`, { amount, channel }),
  disableVendor: (ownerId, reason) => post(`${ADMIN}/owners/${ownerId}/disable`, { reason }),
  enableVendor: (ownerId) => post(`${ADMIN}/owners/${ownerId}/enable`),

  cartInsights: (cartId, p) => request(`${CARTS}/sales-insights/${cartId}`, p),

  markFeePaid: (cartId) => post(`${ADMIN}/carts/${cartId}/mark-fee-paid`),

  resetVendorPin: (vendorId) =>
    post(`${ADMIN}/vendors/${encodeURIComponent(vendorId.trim())}/reset-pin`),
}

export const API_BASE = BASE

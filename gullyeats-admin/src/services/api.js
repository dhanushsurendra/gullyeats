// Vite only exposes variables starting with VITE_ (see .env.example).
// A production build calls its own site: vercel.json passes /api/* on to the
// backend, so the login cookie is first-party and browsers that block
// third-party cookies don't log the admin straight back out.
const BASE = import.meta.env.DEV ? import.meta.env.VITE_API_URL || 'http://localhost:5000' : ''

const ADMIN = import.meta.env.VITE_ADMIN_PATH || '/api/admin'

const CARTS = import.meta.env.VITE_CART_PATH || '/api/carts'

// Thrown on a 401. Pages call the API both through thunks and directly, so the
// 401 also fires this event; store/index.js logs the admin out on it.
export const SESSION_EXPIRED = 'Your session has expired. Please log in again.'
export const SESSION_EXPIRED_EVENT = 'admin:session-expired'

function expired() {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  return new Error(SESSION_EXPIRED)
}

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

  if (res.status === 401) throw expired()
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

  if (res.status === 401) throw expired()
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

  if (res.status === 401) throw expired()
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
  play: (p) => request(`${ADMIN}/insights/play`, p),
  pulse: (p) => request(`${ADMIN}/insights/pulse`, p),

  actions: (p) => request(`${ADMIN}/actions`, p),

  // New dish names from vendors, reviewed into the common list.
  dishes: () => request(`${ADMIN}/dishes`),
  dishImages: (id) => request(`${ADMIN}/dishes/${encodeURIComponent(id)}/images`),
  approveDish: (id, body) => post(`${ADMIN}/dishes/${encodeURIComponent(id)}/approve`, body),
  mergeDish: (id, into) => post(`${ADMIN}/dishes/${encodeURIComponent(id)}/merge`, { into }),
  rejectDish: (id) => post(`${ADMIN}/dishes/${encodeURIComponent(id)}/reject`),

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

  // Refunds on cancelled or reduced paid orders (status: owed | flagged).
  refunds: (p) => request(`${ADMIN}/refunds`, p),
  resolveRefundFlag: (orderId, reason) => post(`${ADMIN}/refunds/${orderId}/resolve`, { reason }),

  // GullyEats' fee per order, for orders placed from now on.
  settings: () => request(`${ADMIN}/settings`),
  updateSettings: (body) => post(`${ADMIN}/settings`, body),

  // Things that need attention (Notifications page); also pushed live over SOCKET_URL.
  notifications: (p) => request(`${ADMIN}/notifications`, p),
  readNotifications: (body) => post(`${ADMIN}/notifications/read`, body),
  socketToken: () => request(`${ADMIN}/notifications/socket-token`),
  // What's waiting in each to-do page (sidebar badges).
  todo: () => request(`${ADMIN}/todo`),

  resetVendorPin: (vendorId) =>
    post(`${ADMIN}/vendors/${encodeURIComponent(vendorId.trim())}/reset-pin`),
}

export const API_BASE = BASE

// Vercel's /api rewrite can't carry a WebSocket, so live updates go straight to the backend.
export const SOCKET_URL = import.meta.env.DEV ? BASE : import.meta.env.VITE_SOCKET_URL || 'https://api.gullyeats.in'

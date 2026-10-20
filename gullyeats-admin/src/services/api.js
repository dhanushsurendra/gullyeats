const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const ADMIN = import.meta.env.VITE_ADMIN_PATH || '/api/admin'

const CARTS = import.meta.env.VITE_CART_PATH || '/api/carts'

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

  const body = await res.json()

  if (!res.ok || body.success === false) {
    throw new Error(
      body.message ||
        `Request failed (${res.status})`,
    )
  }

  // Dashboard: limit 8 → simple array
  if (params.limit === 8) {
    return body.data || []
  }

  // Orders page → paginated response
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
    console.log('Logout response:', res)
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

  cartInsights: (cartId, p) => request(`${CARTS}/sales-insights/${cartId}`, p),
}

export const API_BASE = BASE

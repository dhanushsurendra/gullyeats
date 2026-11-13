import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { API } from './urls.js'

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))
const STATE = path.join(dir, 'state.local')
const SECRETS = path.join(dir, 'qa-secrets.local')

/** Calls the test backend. Returns { status, body } and never throws on 4xx/5xx. */
export async function call(method, route, opts = {}) {
  try {
    return await send(method, route, opts)
  } catch (e) {
    // shortcut: retries once when the server dropped an idle keep-alive socket (after slow steps like backdate);
    // the request never reached it, so a retry can't double a write.
    if (e.cause?.code !== 'ECONNRESET') throw e
    return send(method, route, opts)
  }
}

async function send(method, route, { token, body, headers = {}, raw } = {}) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  })
  return { status: res.status, headers: res.headers, body: await res.json().catch(() => ({})) }
}

// QA phone numbers start with 00999 so `node scripts/qa.js cleanup` can find them.
export const qaPhone = () => `00999${String(Math.floor(Math.random() * 1e5)).padStart(5, '0')}`

/** Onboards a vendor through the same API calls the onboarding app makes. */
export async function onboardVendor({ cartName = 'QA-Cart', open = true, qr = false } = {}) {
  const phoneNumber = qaPhone()
  const otp = await call('POST', '/vendors/send-otp', { body: { phoneNumber, role: 'vendor' } })
  if (otp.status !== 200) throw new Error(`send-otp ${otp.status} ${otp.body.message}`)
  const v = await call('POST', '/vendors/verify-otp', { body: { phoneNumber, otp: otp.body.otp } })
  if (v.status !== 200) throw new Error(`verify-otp ${v.status} ${v.body.message}`)
  const token = v.body.token
  const c = await call('POST', '/carts/create-basic-cart', { token, body: { cartName, cartCity: 'Bengaluru' } })
  if (c.status !== 201) throw new Error(`create cart ${c.status} ${c.body.message}`)
  const cartId = c.body.cart._id
  await call('POST', `/carts/update-location/${cartId}`, {
    token, body: { address: 'QA Street, Bengaluru', lat: 12.9716, lng: 77.5946 },
  })
  const m = await call('POST', `/carts/create-menu/${cartId}`, {
    token,
    body: { items: [
      { name: 'Masala Dosa', price: 60, isVeg: true },
      { name: 'Pani Puri', price: 30, isVeg: true },
      { name: 'Chicken Roll', price: 90, isVeg: false },
    ] },
  })
  if (m.status !== 201) throw new Error(`create menu ${m.status} ${m.body.message}`)
  if (qr) await call('POST', `/carts/generate-cart-qr/${cartId}`, { token })
  if (open) await call('PUT', `/carts/toggle-cart-status/${cartId}`, { token, body: { isOpen: true } })
  return { cartName, phoneNumber, pin: v.body.pin, token, userId: v.body.user._id, vendorId: v.body.user.userId, cartId, menu: m.body.data }
}

/** Places a customer QR order (no login) and returns the order with its key. */
export async function customerOrder(cartId, items) {
  const r = await call('POST', '/orders/create-order', { body: { cartId, orderItems: items } })
  return { ...r, key: r.body.data ? `${r.body.data._id}.${r.body.data.accessKey}` : null }
}

export async function adminLogin() {
  const { adminEmail, adminPassword } = secrets()
  const res = await fetch(`${API}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  })
  if (res.status !== 200) throw new Error(`admin login ${res.status}`)
  // The cookie is the session; GETs accept it as is, writes also take it as a Bearer token.
  return res.headers.get('set-cookie').match(/token=([^;]+)/)[1]
}

export const secrets = () => JSON.parse(fs.readFileSync(SECRETS, 'utf8'))
export const saveState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2))
export const state = () => JSON.parse(fs.readFileSync(STATE, 'utf8'))

/** A QR order the vendor has marked paid. */
export async function paidOrder(v, i = 0, quantity = 1) {
  const o = await customerOrder(v.cartId, [{ menuItemId: v.menu[i]._id, quantity }])
  if (o.status !== 201) throw new Error(`create-order ${o.status} ${o.body.message}`)
  const p = await call('PUT', `/orders/mark-order-paid/${o.body.data._id}`, { token: v.token })
  if (p.status !== 200) throw new Error(`mark-order-paid ${p.status} ${p.body.message}`)
  return o
}

/** Moves a QA cart's orders back by `days` (backend/scripts/qa.js backdate), so they are billable. */
export function backdate(cartId, days = 2) {
  execFileSync('node', ['scripts/qa.js', 'backdate', cartId, String(days)], { cwd: '../backend', stdio: 'pipe' })
}

/** The IST calendar date `daysAgo` days back, as YYYY-MM-DD. */
export const istDate = (daysAgo = 0) =>
  new Date(Date.now() + 5.5 * 3600e3 - daysAgo * 864e5).toISOString().slice(0, 10)

/** Posts a GullyPulse confession as the customer holding `key`. */
export const confess = (key, text) => call('POST', '/confessions', { headers: { 'X-Gully-Order': key }, body: { text } })

// ---- browser helpers (customer app) ----

/** Adds items to the basket from the menu page. */
export async function addItems(page, cartId, names) {
  await page.goto(`/c/${cartId}/menu`)
  for (const n of names) await page.getByRole('button', { name: `Add ${n}`, exact: true }).click()
}

/** Places an order from the browser (so the page holds its key); returns the order id. */
export async function placeOrder(page, cartId, names, { phone } = {}) {
  await addItems(page, cartId, names)
  await page.goto(`/c/${cartId}/cart`)
  if (phone) await page.locator('#phone').fill(phone)
  await page.getByRole('button', { name: /Place order/ }).click()
  await page.getByText('Your token', { exact: true }).waitFor()
  return page.url().split('/').pop()
}

/** "<orderId>.<accessKey>" for an order this browser placed. */
export const browserKey = (page, orderId) =>
  page.evaluate((id) => {
    const root = JSON.parse(localStorage.getItem('persist:gullyeats') || '{}')
    const o = JSON.parse(root.orders || '[]').find((x) => x._id === id)
    return o?.accessKey ? `${o._id}.${o.accessKey}` : null
  }, orderId)

/** The vendor-side order as the vendor app sees it today. */
export async function vendorOrder(v, id) {
  const d = (await call('GET', `/orders/orders-today/${v.cartId}`, { token: v.token })).body.data
  return (Array.isArray(d) ? d : d.orders || []).find((o) => o._id === id)
}

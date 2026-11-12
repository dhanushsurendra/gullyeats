// API-xxx cases from docs/qa/test-inventory.xlsx that the backend's own
// node:test suite doesn't cover: run against the real server and database.
import { test, expect } from '@playwright/test'
import { io } from 'socket.io-client'
import { call, customerOrder, adminLogin, qaPhone, state, onboardVendor } from './helpers.js'
import { API, ADMIN } from './urls.js'

const SOCKET = API.replace(/\/api$/, '')
let v
test.beforeAll(() => { v = state().vendor })
const item = (i = 0, quantity = 1) => ({ menuItemId: v.menu[i]._id, quantity })

test('API-005 auth routes refuse a request without a token', async () => {
  const routes = [
    ['GET', `/orders/orders-today/${v.cartId}`], ['GET', `/carts/sales-insights/${v.cartId}?startDate=2026-11-01&endDate=2026-11-10`],
    ['POST', '/carts/create-basic-cart'], ['PUT', `/orders/serve-order/${v.cartId}`],
    ['GET', `/payments/payment-status/${v.cartId}`], ['GET', '/admin/overview'],
  ]
  for (const [m, r] of routes) expect((await call(m, r)).status, `${m} ${r}`).toBe(401)
})

test('API-006 a malformed id is a 400, not a server error', async () => {
  for (const r of ['/carts/get-cart/abc', '/carts/get-menu-items/abc', '/orders/queue/abc']) {
    expect((await call('GET', r)).status, r).toBe(400)
  }
})

test('API-008 a customer cannot set status, parcel charge or prices', async () => {
  const r = await call('POST', '/orders/create-order', {
    body: { cartId: v.cartId, status: 'PAID', parcelCharge: 50, orderType: 'MANUAL',
      orderItems: [{ ...item(0, 2), price: 1, name: 'cheap' }], totalPrice: 1 },
  })
  expect(r.status).toBe(201)
  const o = r.body.data
  expect(o.status).toBe('PENDING')
  expect(o.orderType).toBe('QR')
  expect(o.parcelCharge).toBe(0)
  expect(o.orderItems[0].price).toBe(60)
  expect(o.totalPrice).toBe(60 * 2 + 2)
})

test('API-009 order reads need the X-Gully-Order key', async () => {
  const { body, key } = await customerOrder(v.cartId, [item()])
  const id = body.data._id
  const wrong = `${id}.${'0'.repeat(32)}`
  for (const r of [`/orders/order/${id}`, `/orders/queue/${id}`]) {
    expect((await call('GET', r)).status, `${r} no key`).toBe(404)
    expect((await call('GET', r, { headers: { 'X-Gully-Order': wrong } })).status, `${r} wrong key`).toBe(404)
    expect((await call('GET', r, { headers: { 'X-Gully-Order': key } })).status, `${r} key`).toBe(200)
  }
  // The vendor sees the order without a key; their copy never carries it.
  const asVendor = await call('GET', `/orders/order/${id}`, { token: v.token })
  expect(asVendor.status).toBe(200)
  expect(asVendor.body.data.accessKey).toBeUndefined()
  // Feedback on someone else's order is refused like a missing one.
  expect((await call('PUT', `/orders/submit-feedback/${id}`, { body: { rating: 1 } })).status).toBe(404)
})

test('API-010 parallel orders get distinct order numbers', async () => {
  const results = await Promise.all(Array.from({ length: 8 }, () => customerOrder(v.cartId, [item(1)])))
  expect(results.map((r) => r.status)).toEqual(Array(8).fill(201))
  const numbers = results.map((r) => r.body.data.orderNumber)
  expect(new Set(numbers).size).toBe(8)
})

test('API-002 send-otp allows 10 per phone per 15 minutes', async () => {
  const phoneNumber = qaPhone()
  const codes = []
  for (let i = 0; i < 11; i++) codes.push((await call('POST', '/vendors/send-otp', { body: { phoneNumber, role: 'vendor' } })).status)
  expect(codes.slice(0, 10)).toEqual(Array(10).fill(200))
  expect(codes[10]).toBe(429)
})

test('API-027 operator objects in login fields never log anyone in', async () => {
  for (const body of [
    { vendorIdentifier: { $gt: '' }, pin: { $gt: '' } },
    { vendorIdentifier: v.phoneNumber, pin: { $ne: '0000' } },
  ]) {
    const r = await call('POST', '/vendors/login', { body })
    expect(r.status, JSON.stringify(body)).toBeGreaterThanOrEqual(400)
    expect(r.body.token).toBeUndefined()
  }
  const a = await call('POST', '/admin/login', { body: { email: { $gt: '' }, password: { $gt: '' } } })
  expect(a.status).toBe(400)
})

test('API-028 forged, unsigned and garbage tokens are refused', async () => {
  const [h, p] = v.token.split('.')
  const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${p}.`
  const forged = `${h}.${Buffer.from(JSON.stringify({ _id: v.userId, role: 'admin' })).toString('base64url')}.${v.token.split('.')[2]}`
  for (const token of [none, forged, 'garbage', `${v.token}x`]) {
    expect((await call('GET', `/orders/orders-today/${v.cartId}`, { token })).status).toBe(401)
  }
})

test('ADM-008 a vendor token cannot call admin APIs', async () => {
  expect((await call('GET', '/admin/overview', { token: v.token })).status).toBe(403)
  expect((await call('POST', `/admin/carts/${v.cartId}/suspend`, { token: v.token })).status).toBe(403)
})

test('ADM-009 the admin cookie is not accepted on writes from another site', async () => {
  const token = await adminLogin()
  const cookie = `token=${token}`
  // The write is refused (CORS rejects the origin, auth ignores the cookie).
  const evil = await call('POST', `/admin/carts/${v.cartId}/reminder`, { headers: { Cookie: cookie, Origin: 'https://evil.example' } })
  expect([401, 403]).toContain(evil.status)
  // No Origin at all (a form post from a non-browser): the cookie alone is not enough for a write.
  expect((await call('POST', `/admin/carts/${v.cartId}/reminder`, { headers: { Cookie: cookie } })).status).toBe(401)
  // Reads with the cookie work; so do writes from the dashboard's own origin.
  expect((await call('GET', '/admin/overview', { headers: { Cookie: cookie } })).status).toBe(200)
  expect((await call('POST', `/admin/carts/${v.cartId}/reminder`, { headers: { Cookie: cookie, Origin: ADMIN } })).status).toBe(200)
})

test('ADM-020 a malformed orders cursor is a 400', async () => {
  const token = await adminLogin()
  expect((await call('GET', '/admin/orders?cursor=bad', { token })).status).toBe(400)
})

test('ADM-004 admin login is limited after 5 failures', async () => {
  const email = `qa-nobody-${Date.now()}@gullyeats.test`
  const codes = []
  for (let i = 0; i < 6; i++) codes.push((await call('POST', '/admin/login', { body: { email, password: 'wrong-password' } })).status)
  expect(codes.slice(0, 5)).toEqual(Array(5).fill(401))
  expect(codes[5]).toBe(429)
})

test('API-025 CORS refuses unknown origins', async () => {
  const r = await call('GET', `/carts/get-cart/${v.cartId}`, { headers: { Origin: 'https://evil.example' } })
  expect(r.headers.get('access-control-allow-origin')).toBeNull()
  expect(r.status).toBe(403)
  const ok = await call('GET', `/carts/get-cart/${v.cartId}`, { headers: { Origin: ADMIN } })
  expect(ok.headers.get('access-control-allow-origin')).toBe(ADMIN)
})

test('API-026 JSON bodies over 10kb are refused', async () => {
  const r = await call('POST', '/orders/create-order', { body: { cartId: v.cartId, pad: 'x'.repeat(20_000) } })
  expect(r.status).toBe(413)
})

test('API-017 the Razorpay webhook rejects a bad signature', async () => {
  const r = await call('POST', '/payments/webhook/razorpay', {
    raw: JSON.stringify({ event: 'payment.captured', payload: {} }),
    headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': 'bad' },
  })
  expect(r.status).toBe(400)
})

test('API-029 sockets only get the rooms they may join', async () => {
  const mine = await customerOrder(v.cartId, [item()])
  const other = await customerOrder(v.cartId, [item()])
  const customer = io(SOCKET, { transports: ['websocket'] })
  const stranger = io(SOCKET, { transports: ['websocket'], auth: { token: 'garbage' } })
  const seen = { customer: [], stranger: [], joinError: null }
  customer.on('order_updated', (o) => seen.customer.push(String(o._id)))
  stranger.on('order_updated', (o) => seen.stranger.push(String(o._id)))
  stranger.on('new_order_received', (o) => seen.stranger.push(String(o._id)))
  stranger.on('join_error', (m) => (seen.joinError = m))
  await Promise.all([customer, stranger].map((s) => new Promise((r) => s.on('connect', r))))
  customer.emit('join_order', mine.key)
  customer.emit('join_order', other.body.data._id) // id without key: must not join
  const joined = await new Promise((r) => stranger.emit('join_vendor', v.cartId, r))
  expect(joined).toBe(false)
  await new Promise((r) => setTimeout(r, 500))

  for (const o of [mine, other]) {
    expect((await call('PUT', `/orders/mark-order-paid/${o.body.data._id}`, { token: v.token })).status).toBe(200)
  }
  await new Promise((r) => setTimeout(r, 1500))
  customer.close()
  stranger.close()
  expect(seen.customer).toEqual([mine.body.data._id])
  expect(seen.stranger).toEqual([])
  expect(seen.joinError).toBeTruthy()
})

test('E2E-012 staff can run orders but not owner-only screens', async () => {
  const s = await call('POST', `/carts/add-staff/${v.cartId}`, { token: v.token, body: { name: 'QA-Staff', phoneNumber: qaPhone() } })
  expect(s.status).toBe(201)
  const login = await call('POST', '/vendors/login', { body: { vendorIdentifier: s.body.data.phoneNumber, pin: s.body.data.pinHash } })
  expect(login.status).toBe(200)
  const staff = login.body.token
  const o = await customerOrder(v.cartId, [item()])
  const id = o.body.data._id
  expect((await call('GET', `/orders/orders-today/${v.cartId}`, { token: staff })).status).toBe(200)
  expect((await call('PUT', `/orders/mark-order-paid/${id}`, { token: staff })).status).toBe(200)
  expect((await call('PUT', `/orders/serve-order/${id}`, { token: staff })).status).toBe(200)
  for (const [m, r, body] of [
    ['GET', `/carts/sales-insights/${v.cartId}?startDate=2026-11-01&endDate=2026-11-10`],
    ['POST', `/carts/add-menu-item/${v.cartId}`, { name: 'Hack', price: 1, isVeg: true }],
    ['PUT', `/carts/update-cart/${v.cartId}`, { cartName: 'Hacked' }],
    ['POST', `/carts/add-staff/${v.cartId}`, { name: 'Another', phoneNumber: qaPhone() }],
  ]) {
    expect((await call(m, r, { token: staff, body })).status, `${m} ${r}`).toBe(403)
  }
  // Staff can list their co-workers (names, phones, no PINs): findManagedCart, see NEEDS-DECISION in the report.
  expect((await call('GET', `/carts/get-all-staff/${v.cartId}`, { token: staff })).status).toBe(200)
  // A stranger vendor can't touch this cart at all.
  const other = await onboardVendor({ cartName: 'QA-Other', open: false })
  expect((await call('PUT', `/orders/mark-order-paid/${id}`, { token: other.token })).status).toBe(403)
  expect((await call('GET', `/orders/orders-today/${v.cartId}`, { token: other.token })).status).toBe(403)
})

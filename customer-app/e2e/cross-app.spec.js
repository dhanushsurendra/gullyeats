// E2E-xxx: one action in one app, checked in the others. The vendor and
// onboarding apps are driven through the same API calls they make.
import { test, expect } from '@playwright/test'
import { call, customerOrder, adminLogin, onboardVendor, qaPhone, state } from './helpers.js'

let v, admin
test.beforeAll(async () => {
  v = state().vendor
  admin = await adminLogin()
})
const item = (i = 0, quantity = 1) => ({ menuItemId: v.menu[i]._id, quantity })
const adminOrders = async () => (await call('GET', '/admin/orders?limit=100', { token: admin })).body.data

test('E2E-001 a cart onboarded with a QR appears in admin and opens from the QR link', async ({ page }) => {
  const nv = await onboardVendor({ cartName: `QA-Onboard ${Date.now() % 1e5}`, qr: true })
  const qr = await call('GET', `/carts/get-qr-details/${nv.cartId}`)
  expect(qr.status).toBe(200)
  expect(qr.body.data.qrImageUrl).toMatch(/^https:\/\//)
  // Finished onboarding: OTP sign-up is refused, PIN login works.
  expect((await call('POST', '/vendors/send-otp', { body: { phoneNumber: nv.phoneNumber, role: 'vendor' } })).status).toBe(409)
  expect((await call('POST', '/vendors/login', { body: { vendorIdentifier: nv.vendorId, pin: nv.pin } })).status).toBe(200)

  const carts = (await call('GET', '/admin/carts', { token: admin })).body.data
  const row = carts.find((c) => c.id === nv.cartId)
  expect(row, 'cart listed in admin').toBeTruthy()
  expect(row.status).toBe('LIVE')

  await page.goto(`/c/${nv.cartId}`)
  await expect(page.getByText(nv.cartName).first()).toBeVisible()
})

test('E2E-002/003/015/016 a web order flows to the vendor and admin, live and consistent', async ({ page }) => {
  await page.goto(`/c/${v.cartId}/menu`)
  await page.getByRole('button', { name: 'Add Chicken Roll', exact: true }).click()
  await page.goto(`/c/${v.cartId}/cart`)
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByText('Your token', { exact: true })).toBeVisible()
  const id = page.url().split('/').pop()

  const today = (await call('GET', `/orders/orders-today/${v.cartId}`, { token: v.token })).body.data
  const vendorCopy = (Array.isArray(today) ? today : today.orders || []).find((o) => o._id === id)
  expect(vendorCopy, 'vendor sees the order').toBeTruthy()

  const t0 = Date.now()
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await expect(page.getByText("Paid. You're in the queue")).toBeVisible()
  const lag = Date.now() - t0
  expect(lag, 'customer sees paid within 2 s').toBeLessThan(2000)

  const a = (await adminOrders()).find((o) => o.id === id)
  expect(a, 'admin lists the order').toBeTruthy()
  expect(a.amount).toBe(92)
  expect(a.status).toBe('PAID')
  expect(vendorCopy.totalPrice).toBe(92)
})

test('E2E-004 a double-clicked order is one order for the vendor', async ({ page }) => {
  const count = async () => {
    const d = (await call('GET', `/orders/orders-today/${v.cartId}`, { token: v.token })).body.data
    return (Array.isArray(d) ? d : d.orders || []).length
  }
  const before = await count()
  await page.goto(`/c/${v.cartId}/menu`)
  await page.getByRole('button', { name: 'Add Pani Puri', exact: true }).click()
  await page.goto(`/c/${v.cartId}/cart`)
  await page.getByRole('button', { name: /Place order/ }).dblclick()
  await expect(page.getByText('Your token', { exact: true })).toBeVisible()
  expect(await count()).toBe(before + 1)
})

test('E2E-005 out of stock on the vendor app stops customer orders', async ({ page }) => {
  const stock = (isInStock) => call('PATCH', `/carts/update-stock/${v.cartId}/${v.menu[2]._id}`, { token: v.token, body: { isInStock } })
  expect((await stock(false)).status).toBe(200)
  try {
    const r = await customerOrder(v.cartId, [item(2)])
    expect(r.status).toBe(400)
    expect(r.body.message).toBe('Chicken Roll is out of stock')
    await page.goto(`/c/${v.cartId}/menu`)
    await expect(page.getByRole('button', { name: 'Add Chicken Roll', exact: true })).toHaveCount(0)
  } finally {
    await stock(true)
  }
})

test('E2E-006 a price change keeps the old price on open orders only', async () => {
  const open = await customerOrder(v.cartId, [item(1)])
  const set = (price) => call('PUT', `/carts/update-menu-item/${v.cartId}`, { token: v.token, body: { id: v.menu[1]._id, price } })
  expect((await set(45)).status).toBeLessThan(300) // the API answers 201 to an update
  try {
    const edited = await call('PUT', `/orders/update-order/${open.body.data._id}`, {
      headers: { 'X-Gully-Order': open.key }, body: { orderItems: [item(1, 2)] },
    })
    expect(edited.status).toBe(200)
    expect(edited.body.data.orderItems[0].price).toBe(30)
    const fresh = await customerOrder(v.cartId, [item(1)])
    expect(fresh.body.data.orderItems[0].price).toBe(45)
  } finally {
    await set(30)
  }
})

test('E2E-007 an admin suspension stops customer and vendor orders until resumed', async () => {
  expect((await call('POST', `/admin/carts/${v.cartId}/suspend`, { token: admin })).status).toBe(200)
  try {
    expect((await customerOrder(v.cartId, [item()])).status).toBe(403)
    expect((await call('POST', '/orders/create-order', { token: v.token, body: { cartId: v.cartId, orderItems: [item()], status: 'PAID' } })).status).toBe(403)
    expect((await call('PUT', `/carts/toggle-cart-status/${v.cartId}`, { token: v.token, body: { isOpen: true } })).status).toBe(403)
  } finally {
    expect((await call('POST', `/admin/carts/${v.cartId}/resume`, { token: admin })).status).toBe(200)
  }
  await call('PUT', `/carts/toggle-cart-status/${v.cartId}`, { token: v.token, body: { isOpen: true } })
  expect((await customerOrder(v.cartId, [item()])).status).toBe(201)
})

test('E2E-008/009 disabling a vendor cuts off owner and staff; PIN reset works', async () => {
  const nv = await onboardVendor({ cartName: `QA-Disable ${Date.now() % 1e5}` })
  const s = await call('POST', `/carts/add-staff/${nv.cartId}`, { token: nv.token, body: { name: 'QA-Staff', phoneNumber: qaPhone() } })
  const staff = (await call('POST', '/vendors/login', { body: { vendorIdentifier: s.body.data.phoneNumber, pin: s.body.data.pinHash } })).body.token

  expect((await call('POST', `/admin/owners/${nv.userId}/disable`, { token: admin })).status).toBe(200)
  // Live sessions get 401 (so the apps sign out) with the disabled message.
  for (const token of [nv.token, staff]) {
    const r = await call('GET', `/orders/orders-today/${nv.cartId}`, { token })
    expect(r.status).toBe(401)
    expect(r.body.message).toMatch(/disabled/)
  }
  expect((await call('POST', '/vendors/login', { body: { vendorIdentifier: nv.vendorId, pin: nv.pin } })).status).toBe(403)
  expect((await customerOrder(nv.cartId, [{ menuItemId: nv.menu[0]._id, quantity: 1 }])).status).toBe(403)

  expect((await call('POST', `/admin/owners/${nv.userId}/enable`, { token: admin })).status).toBe(200)
  const reset = await call('POST', `/admin/vendors/${nv.vendorId}/reset-pin`, { token: admin })
  expect(reset.status).toBe(200)
  expect((await call('POST', '/vendors/login', { body: { vendorIdentifier: nv.vendorId, pin: nv.pin } })).status).toBe(401)
  expect((await call('POST', '/vendors/login', { body: { vendorIdentifier: nv.vendorId, pin: reset.body.data.pin } })).status).toBe(200)
})

test('E2E-013 a customer rating shows in admin Feedback', async () => {
  const o = await customerOrder(v.cartId, [item()])
  const id = o.body.data._id
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await call('PUT', `/orders/serve-order/${id}`, { token: v.token })
  const text = `QA feedback ${Date.now()}`
  const r = await call('PUT', `/orders/submit-feedback/${id}`, { headers: { 'X-Gully-Order': o.key }, body: { rating: 4, feedback: text } })
  expect(r.status).toBe(200)
  const fb = (await call('GET', '/admin/feedback', { token: admin })).body.data.items
  const row = fb.find((f) => f.id === id)
  expect(row).toMatchObject({ rating: 4, text })
})

// RCT-052: "Notify me when it's ready" (Web Push). An automated browser can't register
// with a real push service (Chrome refuses under automation), so the browser's push
// subscription points at a receiver in this test, standing in for Google's endpoint.
// The page flow, the saved subscription and the server's encrypted sends are all real.
import { test, expect } from '@playwright/test'
import https from 'node:https'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { call, onboardVendor, placeOrder } from './helpers.js'

let v, receiver, port
const received = []
test.beforeAll(async () => {
  v = await onboardVendor({ cartName: `QA-Push ${Date.now() % 1e5}` })
  const tls = { key: fs.readFileSync('e2e/push-key.local'), cert: fs.readFileSync('e2e/push-cert.local') }
  receiver = https.createServer(tls, (req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      received.push({ url: req.url, headers: req.headers, bytes: Buffer.concat(chunks).length })
      res.writeHead(201).end()
    })
  })
  await new Promise((r) => receiver.listen(0, 'localhost', r))
  port = receiver.address().port
})
test.afterAll(() => receiver?.close())

// A real P-256 key pair and auth secret, as a browser makes them, so the server can encrypt.
function fakeSubscription(path) {
  const ecdh = crypto.createECDH('prime256v1')
  ecdh.generateKeys()
  const b64 = (buf) => buf.toString('base64url')
  return { endpoint: `https://localhost:${port}/${path}`, keys: { p256dh: b64(ecdh.getPublicKey()), auth: b64(crypto.randomBytes(16)) } }
}

// The browser side: permission not yet asked, and a push manager that hands out our subscription.
async function stubPush(page, subscription, answer = 'granted') {
  await page.addInitScript(({ sub, answer }) => {
    // Remembered across page loads, like a real browser's permission.
    const get = () => localStorage.getItem('qa-notify') || 'default'
    Object.defineProperty(Notification, 'permission', { get })
    Notification.requestPermission = async () => (localStorage.setItem('qa-notify', answer), answer)
    const fake = { endpoint: sub.endpoint, toJSON: () => sub }
    PushManager.prototype.getSubscription = async () => null
    PushManager.prototype.subscribe = async () => fake
  }, { sub: subscription, answer })
}

test('RCT-052 Notify me: asks permission, saves the subscription, and the server pushes on serve', async ({ page }) => {
  const key = (await call('GET', '/orders/push-key')).body.data?.publicKey
  test.skip(!key, 'Web Push keys (WEBPUSH_*) are not set in backend/.env')
  const sub = fakeSubscription(`served-${Date.now()}`)
  await stubPush(page, sub)
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])

  const saved = page.waitForResponse((r) => r.url().includes(`/orders/push-subscribe/${id}`))
  await page.getByRole('button', { name: "Notify me when it's ready" }).click()
  expect((await saved).status()).toBe(200)
  await expect(page.getByRole('button', { name: "Notify me when it's ready" })).toHaveCount(0)
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await expect(page.getByText("We'll send you a notification when it's ready.")).toBeVisible()

  // Serving sends one encrypted push to the subscription.
  const before = received.length
  await call('PUT', `/orders/serve-order/${id}`, { token: v.token })
  await expect.poll(() => received.length, { timeout: 15_000 }).toBe(before + 1)
  const push = received.at(-1)
  expect(push.url).toBe(new URL(sub.endpoint).pathname)
  expect(push.headers['content-encoding']).toBe('aes128gcm')
  expect(push.headers.authorization).toMatch(/^vapid /)
  expect(push.bytes).toBeGreaterThan(0)
})

test('RCT-073 a vendor cancel pushes; a customer cancel does not', async ({ page }) => {
  const key = (await call('GET', '/orders/push-key')).body.data?.publicKey
  test.skip(!key, 'Web Push keys (WEBPUSH_*) are not set in backend/.env')
  const sub = fakeSubscription(`cancel-${Date.now()}`)
  await stubPush(page, sub)
  const byVendor = await placeOrder(page, v.cartId, ['Pani Puri'])
  await page.getByRole('button', { name: "Notify me when it's ready" }).click()
  await expect(page.getByRole('button', { name: "Notify me when it's ready" })).toHaveCount(0)
  let before = received.length
  await call('DELETE', `/orders/delete-order/${byVendor}`, { token: v.token })
  await expect.poll(() => received.length, { timeout: 15_000 }).toBe(before + 1)

  const byCustomer = await placeOrder(page, v.cartId, ['Pani Puri'])
  await expect(page.getByRole('button', { name: "Notify me when it's ready" })).toHaveCount(0) // allowed now: subscribes by itself
  before = received.length
  await page.getByRole('button', { name: 'Cancel order' }).click()
  await page.getByRole('button', { name: 'Yes, cancel order' }).click()
  await expect(page).toHaveURL(/\/cancelled$/)
  await page.waitForTimeout(3000)
  expect(received.length).toBe(before)
  expect(byCustomer).toMatch(/^[a-f0-9]{24}$/)
})

test('RCT-074 saying no to notifications leaves the page working and asks nothing more', async ({ page }) => {
  await stubPush(page, fakeSubscription('denied'), 'denied')
  const id = await placeOrder(page, v.cartId, ['Pani Puri'])
  let posted = false
  page.on('request', (r) => r.url().includes('/push-subscribe/') && (posted = true))
  await page.getByRole('button', { name: "Notify me when it's ready" }).click()
  await expect(page.getByRole('button', { name: "Notify me when it's ready" })).toHaveCount(0)
  await call('PUT', `/orders/mark-order-paid/${id}`, { token: v.token })
  await expect(page.getByText("We'll let you know here when it's ready. Keep this page open.")).toBeVisible()
  expect(posted).toBe(false)
})

test('RCT-075 the push-subscribe API refuses other people\'s orders and bad subscriptions', async () => {
  const mine = await call('POST', '/orders/create-order', { body: { cartId: v.cartId, orderItems: [{ menuItemId: v.menu[0]._id, quantity: 1 }] } })
  const id = mine.body.data._id
  const good = { subscription: fakeSubscription('api') }
  expect([401, 403, 404]).toContain((await call('POST', `/orders/push-subscribe/${id}`, { body: good })).status)
  const key = { 'X-Gully-Order': `${id}.${mine.body.data.accessKey}` }
  expect((await call('POST', `/orders/push-subscribe/${id}`, { headers: key, body: { subscription: { endpoint: 'not a url' } } })).status).toBe(400)
  expect((await call('POST', `/orders/push-subscribe/${id}`, { headers: key, body: good })).status).toBe(200)
})

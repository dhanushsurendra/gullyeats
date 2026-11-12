const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const { call, stub, restoreAll, q } = require('./helpers')
const Order = require('../models/Order')
const Cart = require('../models/Cart')
const orderKey = require('../utils/orderKey')
const webPush = require('../utils/webPush')
const c = require('../controllers/orderController')

const KEYS = webPush._webpush.generateVAPIDKeys()
const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } }
const order = { _id: '6a0000000000000000000001', cartId: '6a00000000000000000000c1', orderNumber: 7, status: 'SERVED' }

// process.env turns undefined into "undefined", so keys are deleted, not restored.
function withKeys() {
  process.env.WEBPUSH_PUBLIC_KEY = KEYS.publicKey
  process.env.WEBPUSH_PRIVATE_KEY = KEYS.privateKey
  webPush._reset()
}
afterEach(() => {
  restoreAll()
  delete process.env.WEBPUSH_PUBLIC_KEY
  delete process.env.WEBPUSH_PRIVATE_KEY
  webPush._reset()
})

test('a served order tells the subscribed phone, and a dropped subscription is removed', async () => {
  withKeys()
  const sent = []
  let unset
  stub(Order, 'findById', () => q({ ...order, pushSubscription: sub }))
  stub(Cart, 'findById', () => q({ cartName: 'Raju Chaats' }))
  stub(Order, 'updateOne', async (f, u) => { unset = u })
  stub(webPush._webpush, 'sendNotification', async (s, payload) => { sent.push({ s, payload: JSON.parse(payload) }) })

  await webPush.notifyCustomer(order)
  assert.deepStrictEqual(sent[0].s, sub)
  assert.deepStrictEqual(sent[0].payload, {
    title: 'Your food is ready!',
    body: 'Token #7 · collect it at Raju Chaats',
    tag: order._id,
    url: `/c/${order.cartId}/order/${order._id}/served`,
  })

  stub(webPush._webpush, 'sendNotification', async () => { throw Object.assign(new Error('gone'), { statusCode: 410 }) })
  await webPush.notifyCustomer({ ...order, status: 'CANCELLED' })
  assert.deepStrictEqual(unset, { $unset: { pushSubscription: 1 } })
})

test('no keys or no subscription means no push; other statuses send nothing', async () => {
  stub(webPush._webpush, 'sendNotification', async () => assert.fail('sent'))
  stub(Order, 'findById', () => q({ ...order, pushSubscription: sub }))
  await webPush.notifyCustomer(order) // no keys
  withKeys()
  await webPush.notifyCustomer({ ...order, status: 'PAID' })
  stub(Order, 'findById', () => q({ ...order }))
  await webPush.notifyCustomer(order)
})

test('saving a subscription needs the order key and a real https push endpoint', async () => {
  let saved
  stub(Order, 'findById', () => q(order))
  stub(Order, 'updateOne', async (f, u) => { saved = u.$set.pushSubscription })
  stub(orderKey, 'holdsOrderKey', async () => false)
  delete require.cache[require.resolve('../controllers/orderController')]
  let ctl = require('../controllers/orderController')
  let r = await call(ctl.savePushSubscription, { params: { orderId: order._id }, body: { subscription: sub } })
  assert.strictEqual(r.status, 404)

  restoreAll()
  stub(Order, 'findById', () => q(order))
  stub(Order, 'updateOne', async (f, u) => { saved = u.$set.pushSubscription })
  stub(orderKey, 'holdsOrderKey', async () => true)
  delete require.cache[require.resolve('../controllers/orderController')]
  ctl = require('../controllers/orderController')
  r = await call(ctl.savePushSubscription, { params: { orderId: order._id }, body: { subscription: { ...sub, endpoint: 'http://evil.local/x' } } })
  assert.strictEqual(r.status, 400)
  r = await call(ctl.savePushSubscription, { params: { orderId: order._id }, body: { subscription: { ...sub, extra: 'x' } } })
  assert.strictEqual(r.status, 200)
  assert.deepStrictEqual(saved, sub)
})

test('the push key is null until VAPID keys are set', async () => {
  let r = await call((req, res) => c.getPushKey(req, res))
  assert.strictEqual(r.body.data.publicKey, null)
  withKeys()
  r = await call((req, res) => c.getPushKey(req, res))
  assert.strictEqual(r.body.data.publicKey, KEYS.publicKey)
})

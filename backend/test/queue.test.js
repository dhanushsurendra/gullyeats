// The customer queue against a real, throwaway MongoDB.
const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

const { call } = require('./helpers')
const Order = require('../models/Order')
const Cart = require('../models/Cart')
const c = require('../controllers/orderController')

let mongo
before(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
})
after(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})

const ownerId = new mongoose.Types.ObjectId()
const cartId = new mongoose.Types.ObjectId()
const owner = { _id: String(ownerId), role: 'vendor' }
const min = (n) => new Date(Date.now() - n * 60e3)

beforeEach(async () => {
  for (const m of [Order, Cart]) await m.collection.deleteMany({})
  await Cart.collection.insertOne({ _id: cartId, userId: ownerId, cartName: 'Test' })
})

let n = 0
const KEY = 'e'.repeat(32)
async function order(status, paidMinutesAgo, extra = {}) {
  const doc = {
    _id: new mongoose.Types.ObjectId(), cartId, orderNumber: ++n, status, subtotal: 10, totalPrice: 12, platformFee: 2,
    orderItems: [{ menuItemId: new mongoose.Types.ObjectId(), name: 'Tea', price: 10, quantity: 1 }],
    paidAt: paidMinutesAgo == null ? null : min(paidMinutesAgo), createdAt: min(60), accessKey: KEY, ...extra,
  }
  await Order.collection.insertOne(doc)
  return doc
}
const queueOf = async (o) =>
  (await call(c.getQueue, { headers: { 'x-gully-order': `${o._id}.${KEY}` }, params: { orderId: String(o._id) } })).body.data

test("the queue needs the order's key", async () => {
  const o = await order('PAID', 1)
  assert.strictEqual((await call(c.getQueue, { params: { orderId: String(o._id) } })).status, 404)
})

test('the queue is paid, unserved orders in payment order', async () => {
  const first = await order('PAID', 10)
  const second = await order('PAID', 5)
  const third = await order('PAID', 1)
  await order('PENDING', null) // unpaid: not in the queue
  await order('SERVED', 20) // done
  await order('PAID', 60 * 13) // forgotten since yesterday

  assert.deepStrictEqual(await queueOf(third), {
    preparing: [], nextUp: first.orderNumber, waiting: 3, isPreparing: false, ahead: 2,
  })
  assert.strictEqual((await queueOf(second)).ahead, 1)
  assert.strictEqual((await queueOf(first)).ahead, 0)
})

test('an unpaid order sees the queue but has no place in it', async () => {
  await order('PAID', 3)
  const unpaid = await order('PENDING', null)
  const q = await queueOf(unpaid)
  assert.strictEqual(q.ahead, null)
  assert.strictEqual(q.waiting, 1)
})

test('the vendor marks preparing, and the queue shows it', async () => {
  const first = await order('PAID', 10)
  const second = await order('PAID', 5)

  let r = await call(c.setPreparing, { user: owner, params: { orderId: String(second._id) }, body: { preparing: true } })
  assert.strictEqual(r.status, 200, JSON.stringify(r.body))
  assert.ok(r.emits.some((e) => e.room === `queue:${cartId}` && e.event === 'queue_changed'))

  const q = await queueOf(second)
  assert.deepStrictEqual([q.preparing, q.nextUp, q.isPreparing], [[second.orderNumber], null, true])
  assert.strictEqual((await queueOf(first)).isPreparing, false)

  r = await call(c.setPreparing, { user: owner, params: { orderId: String(second._id) }, body: { preparing: false } })
  assert.strictEqual(r.body.data.preparingAt, null)
})

test('only paid orders can be prepared, only by the cart', async () => {
  const unpaid = await order('PENDING', null)
  const paid = await order('PAID', 1)
  let r = await call(c.setPreparing, { user: owner, params: { orderId: String(unpaid._id) }, body: { preparing: true } })
  assert.strictEqual(r.status, 400)
  r = await call(c.setPreparing, { user: owner, params: { orderId: String(paid._id) }, body: { preparing: 'yes' } })
  assert.strictEqual(r.status, 400)
  r = await call(c.setPreparing, {
    user: { _id: String(new mongoose.Types.ObjectId()), role: 'vendor' },
    params: { orderId: String(paid._id) },
    body: { preparing: true },
  })
  assert.strictEqual(r.status, 403)
})

test('marking an order unpaid stops it preparing', async () => {
  const paid = await order('PAID', 1, { preparingAt: min(1), paidAmount: 12 })
  const r = await call(c.markOrderUnpaid, { user: owner, params: { orderId: String(paid._id) } })
  assert.strictEqual(r.status, 200)
  assert.strictEqual(r.body.data.preparingAt, null)
})

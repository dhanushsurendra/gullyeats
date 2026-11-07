// Admin business insights, against a throwaway MongoDB.
const { test, before, after } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

const Cart = require('../models/Cart')
const User = require('../models/User')
const Order = require('../models/Order')
const insights = require('../controllers/insightsController')
const { call } = require('./helpers')

const DAY = 864e5
const now = Date.now()
const daysAgo = (n) => new Date(now - n * DAY)
const id = () => new mongoose.Types.ObjectId()

// Cart A (Pune): 4 served + 8 cancelled, 3 days ago -> leaks fees.
// Cart B (Goa): 6 served 10 days ago, 1 served 3 days ago -> orders dropped.
// Cart C (Pune): 30 served 2 days ago -> healthy, sets the platform rate.
const [A, B, C] = [id(), id(), id()]
const [uA, uB, uC] = [id(), id(), id()]

let mongo
before(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
  await User.collection.insertMany([
    { _id: uA, userId: 'VEN-A', role: 'vendor', name: 'Asha', phoneNumber: '111' },
    { _id: uB, userId: 'VEN-B', role: 'vendor', name: 'Bala', phoneNumber: '222' },
    { _id: uC, userId: 'VEN-C', role: 'vendor', name: 'Chitra', phoneNumber: '333' },
  ])
  await Cart.collection.insertMany([
    { _id: A, cartName: 'A', cartCity: 'Pune', userId: uA, isOpen: true, createdAt: daysAgo(40) },
    { _id: B, cartName: 'B', cartCity: 'Goa', userId: uB, isOpen: true, createdAt: daysAgo(40) },
    { _id: C, cartName: 'C', cartCity: 'Pune', userId: uC, isOpen: false, createdAt: daysAgo(40) },
  ])
  let n = 0
  const order = (cartId, status, at, extra = {}) => ({
    cartId, status, orderNumber: ++n, totalPrice: 100, platformFee: 2, parcelCharge: 0,
    orderType: 'QR', orderItems: [], createdAt: at, orderDate: at,
    ...(status === 'CANCELLED' ? {} : { paidAt: at, servedAt: new Date(+at + 10 * 60e3) }),
    ...extra,
  })
  await Order.collection.insertMany([
    ...Array.from({ length: 4 }, (_, i) =>
      order(A, 'SERVED', daysAgo(3), i === 0 ? { phoneNumber: 'p2' } : {})),
    ...Array.from({ length: 8 }, () => order(A, 'CANCELLED', daysAgo(3))),
    ...Array.from({ length: 6 }, (_, i) =>
      order(B, 'SERVED', daysAgo(10), i < 2 ? { phoneNumber: 'p1' } : {})),
    order(B, 'SERVED', daysAgo(3), { orderType: 'MANUAL', parcelCharge: 10 }),
    ...Array.from({ length: 30 }, () => order(C, 'SERVED', daysAgo(2))),
  ])
})
after(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})

test('collections lists overdue fees per cart, longest owed first, with age buckets', async () => {
  const { body } = await call(insights.collections)
  const d = body.data
  assert.deepEqual(d.totals, { amount: 82, orders: 41, carts: 3 })
  assert.deepEqual(
    d.items.map((i) => [i.cart, i.amount, i.days, i.bucket, i.phone]),
    [
      ['B', 14, 10, '8+ days', '222'],
      ['A', 8, 3, '3–7 days', '111'],
      ['C', 60, 2, '1–2 days', '333'],
    ],
  )
  assert.deepEqual(d.buckets.map((b) => b.amount), [60, 8, 14])
})

test('leakage flags carts far above the platform cancelled/unpaid rate', async () => {
  const { body } = await call(insights.leakage)
  const d = body.data
  // 8 lost of 49 orders = 16.3%; threshold = max(2x, 25%) = 32.7%.
  assert.equal(d.platform.rate, 16.3)
  assert.deepEqual(d.items.map((i) => [i.cart, i.leakRate, i.feesAtRisk]), [['A', 66.7, 16]])
})

test('vendors: carts whose orders halved this week are at risk', async () => {
  const { body } = await call(insights.vendors)
  const d = body.data
  assert.deepEqual(d.atRisk.map((c) => [c.cart, c.prev7, c.last7, c.drop]), [['B', 6, 1, 83.3]])
  assert.deepEqual(d.summary, { carts: 3, everOrdered: 3, activeNow: 3, quiet: 0, neverOrdered: 0 })
  assert.equal(d.cohorts.length, 12)
})

test('growth: unit economics and cities count paid orders only', async () => {
  const { body } = await call(insights.growth)
  const d = body.data
  assert.equal(d.runRate.last30Fees, 82)
  assert.deepEqual(d.unit, {
    activeCarts: 3, feesPerActiveCart: 27.3, gmvPerActiveCart: 1367, ordersPerCartPerDay: 0.46, aov: 100,
  })
  assert.deepEqual(
    d.cities.map((c) => [c.city, c.carts, c.live, c.orders30, c.fees30]),
    [['Pune', 2, 1, 34, 68], ['Goa', 1, 1, 7, 14]],
  )
})

test('operations: heatmap, channels, serve time and repeat customers', async () => {
  const { body } = await call(insights.operations)
  const d = body.data
  assert.equal(d.heatmap.cells.flat().reduce((a, b) => a + b, 0), 41)
  assert.equal(d.channels.qr, 40)
  assert.equal(d.channels.manual, 1)
  assert.equal(d.channels.parcel, 1)
  assert.equal(d.service.avgMins, 10)
  assert.equal(d.service.slowest.length, 1) // only C has 10+ served
  assert.deepEqual(
    { customers: d.repeat.customers, repeaters: d.repeat.repeaters, rate: d.repeat.rate },
    { customers: 2, repeaters: 1, rate: 50 },
  )
})

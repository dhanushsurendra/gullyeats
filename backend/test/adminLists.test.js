// The admin dashboard's shared date range, its charts' buckets, table search
// and the sidebar's to-do counts.
const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

const { call } = require('./helpers')
const Order = require('../models/Order')
const Cart = require('../models/Cart')
const User = require('../models/User')
const Payment = require('../models/Payment')
const Confession = require('../models/Confession')
const DishCandidate = require('../models/DishCandidate')
const admin = require('../controllers/adminController')
const notifications = require('../controllers/notificationController')
const { rangeFor, todayStart, DAY } = require('../utils/dateRange')

let mongo
before(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
})
after(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})

const owner = new mongoose.Types.ObjectId()
const momos = new mongoose.Types.ObjectId()
const chai = new mongoose.Types.ObjectId()
let n = 0
const order = (cartId, at, extra = {}) => ({
  cartId, orderNumber: ++n, status: 'SERVED', platformFee: 2, totalPrice: 100, orderItems: [], createdAt: at, ...extra,
})
beforeEach(async () => {
  for (const m of [Order, Cart, User, Payment, Confession, DishCandidate]) await m.collection.deleteMany({})
  await User.collection.insertOne({ _id: owner, role: 'vendor', name: 'Ravi Kumar' })
  await Cart.collection.insertMany([
    { _id: momos, cartName: 'Raju Momos', userId: owner },
    { _id: chai, cartName: 'Chai Point', userId: new mongoose.Types.ObjectId() },
  ])
})

test('the date range: presets, custom days, and anything unreadable is today', () => {
  const t = todayStart()
  assert.deepEqual(rangeFor({ range: '7d' }), { start: new Date(+t - 6 * DAY), end: new Date(+t + DAY) })
  const c = rangeFor({ startDate: '2026-01-01', endDate: '2026-01-31' })
  assert.equal(c.start.toISOString(), '2025-12-31T18:30:00.000Z')
  assert.equal((c.end - c.start) / DAY, 31)
  for (const bad of [{ startDate: 'x', endDate: 'y' }, { startDate: '2026-02-01', endDate: '2026-01-01' }, {}]) {
    assert.deepEqual(rangeFor(bad), { start: t, end: new Date(+t + DAY) })
  }
})

test('the chart is hourly for one day, daily for 7 days and weekly for 90', async () => {
  const at = new Date(+todayStart() + 10.5 * 3600e3) // 10:30am IST
  await Order.collection.insertOne(order(momos, at))
  let d = (await call(admin.series, { query: { range: 'today' } })).body.data
  assert.equal(d.points.length, 24)
  assert.equal(d.points[10].label, '10:00')
  assert.equal(d.points[10].orders, 1)
  d = (await call(admin.series, { query: { range: '7d' } })).body.data
  assert.equal(d.points.length, 7)
  assert.equal(d.points.at(-1).orders, 1)
  const t = todayStart()
  const from = new Date(+t - 89 * DAY + 5.5 * 3600e3).toISOString().slice(0, 10)
  const to = new Date(+t + 5.5 * 3600e3).toISOString().slice(0, 10)
  d = (await call(admin.series, { query: { startDate: from, endDate: to } })).body.data
  assert.ok(d.points.length >= 13 && d.points.length <= 14)
  assert.equal(d.totals.totalOrders, 1)
})

test('orders search by cart, owner or number, and filter by date', async () => {
  const old = new Date(+todayStart() - 40 * DAY)
  const rows = [order(momos, new Date()), order(chai, new Date()), order(chai, old)]
  await Order.collection.insertMany(rows)
  const find = async (query) => (await call(admin.orders, { query })).body.data.map((o) => o.cart)
  assert.deepEqual(await find({ q: 'momos' }), ['Raju Momos'])
  assert.deepEqual(await find({ q: 'ravi' }), ['Raju Momos'])
  assert.deepEqual(await find({ q: `#${rows[1].orderNumber}` }), ['Chai Point'])
  assert.deepEqual(await find({ q: 'chai', range: '30d' }), ['Chai Point'])
  assert.equal((await find({ q: 'chai' })).length, 2)
  assert.deepEqual(await find({ q: '.*' }), [])
})

test('payments and feedback search too', async () => {
  await Payment.collection.insertMany([
    { cartId: momos, cartName: 'Raju Momos', amount: 4, status: 'VERIFIED', paymentReference: 'a', createdAt: new Date() },
    { cartId: chai, cartName: 'Chai Point', amount: 6, status: 'VERIFIED', paymentReference: 'b', createdAt: new Date() },
  ])
  await Order.collection.insertMany([
    order(momos, new Date(), { feedback: 'too spicy', rating: 3 }),
    order(chai, new Date(), { rating: 5 }),
  ])
  const pay = (await call(admin.payments, { query: { q: 'chai' } })).body.data
  assert.deepEqual(pay.items.map((p) => p.cart), ['Chai Point'])
  const fb = (await call(admin.feedback, { query: { q: 'spicy' } })).body.data
  assert.equal(fb.total, 1)
  assert.equal(fb.items[0].text, 'too spicy')
})

test('to-do counts: flagged refunds, held or reported posts, dishes at 3 carts', async () => {
  await Order.collection.insertOne(order(momos, new Date(), {
    status: 'CANCELLED', refunds: [{ amount: 50, reason: 'CANCELLED', owedAt: new Date(), refundedAt: new Date(), flaggedAt: new Date() }],
  }))
  await Confession.collection.insertMany([
    { publicId: 'A1', status: 'PENDING_REVIEW' }, { publicId: 'A2', status: 'REPORTED' }, { publicId: 'A3', status: 'PUBLISHED' },
  ])
  const ids = [1, 2, 3].map(() => new mongoose.Types.ObjectId())
  await DishCandidate.collection.insertMany([
    { _id: 'kulhad chai', status: 'PENDING', carts: ids },
    { _id: 'pani puri', status: 'PENDING', carts: ids.slice(0, 2) },
  ])
  const d = (await call(notifications.todo)).body.data
  assert.deepEqual(d, { collections: 1, moderation: 2, dishes: 1 })
})

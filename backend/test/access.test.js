// Live-update rooms and the admin cookie, against a throwaway MongoDB.
const { test, before, after } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const { MongoMemoryServer } = require('mongodb-memory-server')

process.env.JWT_SECRET = 'test-secret'
process.env.FRONTEND_URL_ADMIN = 'https://admin.gullyeats.test'

const Cart = require('../models/Cart')
const User = require('../models/User')
const Order = require('../models/Order')
const { joinVendor, joinOrder, joinQueue } = require('../utils/socketRooms')
const auth = require('../middlewares/auth')

let mongo
const ownerId = new mongoose.Types.ObjectId()
const staffId = new mongoose.Types.ObjectId()
const strangerId = new mongoose.Types.ObjectId()
const cartId = new mongoose.Types.ObjectId()

before(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
  await Cart.collection.insertOne({ _id: cartId, userId: ownerId, cartName: 'Test' })
  await User.collection.insertOne({ _id: staffId, role: 'staff', cartId })
})
after(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})

const token = (_id, role) => jwt.sign({ _id, role }, process.env.JWT_SECRET)

// Records which rooms a socket joined and what it was told.
function fakeSocket(authToken) {
  return {
    handshake: { auth: authToken ? { token: authToken } : {} },
    rooms: [],
    emitted: [],
    join(room) { this.rooms.push(room) },
    emit(event, data) { this.emitted.push(event) },
  }
}

test("the cart's owner and staff can join its live orders", async () => {
  for (const [id, role] of [[ownerId, 'vendor'], [staffId, 'staff']]) {
    const socket = fakeSocket(token(id, role))
    assert.equal(await joinVendor(socket, String(cartId)), true)
    assert.deepEqual(socket.rooms, [String(cartId)])
  }
})

test("anyone else is refused a cart's live orders", async () => {
  for (const socket of [
    fakeSocket(), // no login
    fakeSocket('not-a-token'),
    fakeSocket(token(strangerId, 'vendor')), // another vendor
    fakeSocket(jwt.sign({ _id: ownerId, role: 'vendor' }, 'wrong-secret')),
  ]) {
    assert.equal(await joinVendor(socket, String(cartId)), false)
    assert.deepEqual(socket.rooms, [])
    assert.deepEqual(socket.emitted, ['join_error'])
  }
})

test('a customer can follow their own order only with its key', async () => {
  const socket = fakeSocket()
  const orderId = new mongoose.Types.ObjectId()
  const key = 'a'.repeat(32)
  await Order.collection.insertOne({ _id: orderId, cartId, accessKey: key })
  assert.equal(await joinOrder(socket, `${orderId}.${'b'.repeat(32)}`), false)
  assert.equal(await joinOrder(socket, String(orderId)), false) // the guessable id alone
  assert.equal(await joinOrder(socket, '1'), false)
  assert.equal(await joinOrder(socket, `${orderId}.${key}`), true)
  assert.deepEqual(socket.rooms, [`order:${orderId}`])
})

test("anyone may hear a cart's queue move (it carries no order details)", () => {
  const socket = fakeSocket()
  const cart = String(new mongoose.Types.ObjectId())
  assert.equal(joinQueue(socket, cart), true)
  assert.equal(joinQueue(socket, 'junk'), false)
  assert.deepEqual(socket.rooms, [`queue:${cart}`])
})

test("the admin cookie works for writes only from the dashboard's origin", () => {
  const cookie = token(new mongoose.Types.ObjectId(), 'admin')
  const run = (method, origin) => {
    let status = 200
    const req = { method, headers: origin ? { origin } : {}, cookies: { token: cookie } }
    const res = { status(code) { status = code; return this }, json() { return this } }
    auth(req, res, () => {})
    return status
  }
  assert.equal(run('GET'), 200)
  assert.equal(run('POST', 'https://admin.gullyeats.test'), 200)
  assert.equal(run('POST', 'https://evil.example'), 401)
  assert.equal(run('POST'), 401)
})

test('admin GMV, fees and average order count only paid and served orders', async () => {
  const Order = require('../models/Order')
  const admin = require('../controllers/adminController')
  const { call } = require('./helpers')
  const now = new Date()
  const o = (status, totalPrice) => ({
    cartId, orderNumber: Math.random(), status, totalPrice, subtotal: totalPrice - 2,
    platformFee: 2, orderItems: [], createdAt: now, orderDate: now,
  })
  await Order.collection.insertMany([
    o('PAID', 62), o('SERVED', 102), o('PENDING', 500), o('CANCELLED', 900),
  ])
  const r = await call(admin.overview, { query: { range: 'today' }, user: { role: 'admin' } })
  assert.equal(r.status, 200)
  const find = (obj, key) =>
    obj && typeof obj === 'object'
      ? key in obj ? obj[key] : Object.values(obj).map((v) => find(v, key)).find((v) => v !== undefined)
      : undefined
  assert.equal(find(r.body, 'orderGmvRange'), 164)
  assert.equal(find(find(r.body, 'aov'), 'value'), 82)
  // Overdue fees: today's orders aren't due until the day ends.
  // They still count as unpaid ("all"), just not overdue.
  assert.deepEqual(r.body.data.kpis.pendingPayments, {
    amount: 0, count: 0, carts: 0, all: { amount: 4, count: 2, carts: 1 },
  })

  // A SERVED order paid two days ago is overdue, unless a verified payment covers it.
  const Payment = require('../models/Payment')
  const old = new Date(+now - 2 * 864e5)
  await Order.collection.insertMany([
    { ...o('SERVED', 82), createdAt: old, orderDate: old, paidAt: old },
    { ...o('SERVED', 82), createdAt: old, orderDate: old, paidAt: old },
  ])
  const covered = await Order.findOne({ cartId, paidAt: old }).lean()
  await Payment.collection.insertOne({
    cartId, status: 'VERIFIED', amount: 2, orderIds: [covered._id],
    verifiedAt: now, createdAt: now, billingDate: old,
  })
  const r2 = await call(admin.overview, { query: { range: '30d' }, user: { role: 'admin' } })
  // Unpaid in all: that overdue ₹2 plus today's ₹4.
  assert.deepEqual(r2.body.data.kpis.pendingPayments, {
    amount: 2, count: 1, carts: 1, all: { amount: 6, count: 3, carts: 1 },
  })
  assert.equal(r2.body.data.kpis.collectionRate, 50)

  // The chart's AOV also divides by paid orders only, and weeks are whole.
  const s = await call(admin.series, { query: { period: '3m' } })
  assert.equal(s.body.data.totals.aov, 82)
  assert.equal(s.body.data.points.length, 13)

  // Orders page: first page reports whether there are more.
  const p1 = await call(admin.orders, { query: { limit: '3' } })
  assert.equal(p1.body.data.length, 3)
  assert.equal(p1.body.pagination.hasMore, true)
  const p2 = await call(admin.orders, { query: { limit: '3', cursor: p1.body.pagination.nextCursor } })
  assert.equal(p2.body.data.length, 3)
  assert.equal(p2.body.pagination.hasMore, false)
})

test("a day's platform fee is overdue only once its 26h grace has passed", () => {
  const { overdueBefore } = require('../utils/overdueFees')
  const ist = (s) => new Date(`${s}+05:30`)
  // Bills before the returned midnight are overdue.
  assert.deepEqual(overdueBefore(ist('2026-11-07T01:59:00')), ist('2026-11-06T00:00:00'))
  assert.deepEqual(overdueBefore(ist('2026-11-07T02:00:00')), ist('2026-11-07T00:00:00'))
  assert.deepEqual(overdueBefore(ist('2026-11-07T23:59:00')), ist('2026-11-07T00:00:00'))
})

test('feedback pages newest first until there is no more', async () => {
  const Order = require('../models/Order')
  const admin = require('../controllers/adminController')
  const { call } = require('./helpers')
  const base = Date.now()
  await Order.collection.insertMany(
    [1, 2, 3, 4, 5].map((i) => ({
      cartId, orderNumber: 100 + i, status: 'SERVED', totalPrice: 10, platformFee: 2,
      orderItems: [], feedback: `fb ${i}`, createdAt: new Date(base - i * 1000),
    })),
  )
  const p1 = await call(admin.feedback, { query: { limit: '2' } })
  assert.deepEqual(p1.body.data.items.map((f) => f.text), ['fb 1', 'fb 2'])
  assert.equal(p1.body.data.total, 5)
  const p2 = await call(admin.feedback, { query: { limit: '2', cursor: p1.body.data.pagination.nextCursor } })
  const p3 = await call(admin.feedback, { query: { limit: '2', cursor: p2.body.data.pagination.nextCursor } })
  assert.deepEqual(p3.body.data.items.map((f) => f.text), ['fb 5'])
  assert.equal(p3.body.data.pagination.hasMore, false)
  const bad = await call(admin.feedback, { query: { cursor: 'junk' } })
  assert.equal(bad.status, 400)
})

test('payments page newest first and keep the all-time summary on every page', async () => {
  const Payment = require('../models/Payment')
  const admin = require('../controllers/adminController')
  const { call } = require('./helpers')
  await Payment.deleteMany({})
  const base = Date.now()
  await Payment.collection.insertMany(
    [1, 2, 3].map((i) => ({
      cartId, status: 'VERIFIED', amount: 2, orderIds: [], paymentReference: `T-${i}`,
      createdAt: new Date(base - i * 1000),
    })),
  )
  const p1 = await call(admin.payments, { query: { limit: '2' } })
  assert.equal(p1.body.data.items.length, 2)
  assert.deepEqual(p1.body.data.summary.VERIFIED, { count: 3, amount: 6 })
  const p2 = await call(admin.payments, { query: { limit: '2', cursor: p1.body.data.pagination.nextCursor } })
  assert.equal(p2.body.data.items.length, 1)
  assert.equal(p2.body.data.pagination.hasMore, false)
  assert.deepEqual(p2.body.data.summary.VERIFIED, { count: 3, amount: 6 })
})

test("a disabled vendor's existing token stops working, and so do their staff's", async () => {
  await User.collection.insertOne({ _id: ownerId, userId: 'V-OWNER', phoneNumber: '9000000001', role: 'vendor', disabledAt: null })
  const run = (id, role) =>
    new Promise((resolve) => {
      const req = { method: 'GET', headers: { authorization: `Bearer ${token(id, role)}` } }
      const res = { status(code) { resolve(code); return this }, json() { return this } }
      auth(req, res, (err) => resolve(err ? 500 : 'next'))
    })
  assert.equal(await run(ownerId, 'vendor'), 'next')
  assert.equal(await run(staffId, 'staff'), 'next')

  await User.collection.updateOne({ _id: ownerId }, { $set: { disabledAt: new Date() } })
  // 401 so the apps sign out of the dead session.
  assert.equal(await run(ownerId, 'vendor'), 401)
  assert.equal(await run(staffId, 'staff'), 401)
  assert.equal(await run(strangerId, 'vendor'), 401) // no such account
  await User.collection.deleteOne({ _id: ownerId })
})

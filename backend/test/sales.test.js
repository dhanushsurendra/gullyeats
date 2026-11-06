// Runs the sales pipeline against a real, throwaway MongoDB (no Atlas data),
// so the aggregation itself is what's tested.
const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { call } = require('./helpers')
const Order = require('../models/Order')
const Cart = require('../models/Cart')
const { getSalesDashboard } = require('../controllers/salesController')

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
const otherCartId = new mongoose.Types.ObjectId()
const dosa = new mongoose.Types.ObjectId()
const tea = new mongoose.Types.ObjectId()

beforeEach(async () => {
  await Order.collection.deleteMany({})
  await Cart.collection.deleteMany({})
  await Cart.collection.insertOne({ _id: cartId, userId: ownerId, cartName: 'Test' })
})

const line = (menuItemId, name, price, quantity) => ({ menuItemId, name, price, quantity })

// An order created at an IST date and time; paid/served some minutes later.
function order(status, when, lines, { paidAfter, servedAfter, cart = cartId } = {}) {
  const createdAt = new Date(`${when.includes('T') ? when : `2026-11-06T${when}`}:00+05:30`)
  const at = (min) => (min === undefined ? null : new Date(createdAt.getTime() + min * 60000))
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0)
  return {
    cartId: cart,
    orderNumber: 1,
    status,
    createdAt,
    orderDate: createdAt,
    paidAt: at(paidAfter),
    servedAt: at(servedAfter),
    orderItems: lines,
    subtotal,
    parcelCharge: 0,
    platformFee: 2,
    totalPrice: subtotal + 2,
    orderType: 'MANUAL',
  }
}

async function report(orders, { startDate = '2026-11-06', endDate = '2026-11-06' } = {}) {
  if (orders.length) await Order.collection.insertMany(orders)
  const r = await call(getSalesDashboard, {
    params: { cartId: String(cartId) },
    query: { startDate, endDate },
    user: { _id: ownerId, role: 'vendor' },
  })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  return r.body.data
}

test('revenue and items count only paid and served orders', async () => {
  const r = await report([
    order('SERVED', '10:00', [line(dosa, 'Dosa', 60, 1)], { paidAfter: 1, servedAfter: 5 }),
    order('PAID', '10:30', [line(dosa, 'Dosa', 60, 1)], { paidAfter: 1 }),
    order('PENDING', '11:00', [line(tea, 'Tea', 10, 10)]), // abandoned QR order
    order('CANCELLED', '11:30', [line(tea, 'Tea', 10, 5)]),
  ])
  assert.equal(r.revenue, 124)
  assert.equal(r.totalItemsSold, 2)
  assert.equal(r.lowestOrder, 62)
  assert.equal(r.avgOrderValue, 62)
  assert.deepEqual(r.topItems.map((i) => i.name), ['Dosa'])
  // Counts still see every order.
  assert.equal(r.totalOrders, 4)
  assert.equal(r.pendingOrders, 1)
  assert.equal(r.avgPrepTime, '5 min')
})

test('payment rate includes served orders, which were paid first', async () => {
  const r = await report([
    order('SERVED', '10:00', [line(dosa, 'Dosa', 60, 1)], { paidAfter: 1, servedAfter: 5 }),
    order('SERVED', '10:10', [line(dosa, 'Dosa', 60, 1)], { paidAfter: 1, servedAfter: 5 }),
    order('PAID', '10:20', [line(dosa, 'Dosa', 60, 1)], { paidAfter: 1 }),
    order('PENDING', '10:30', [line(dosa, 'Dosa', 60, 1)]),
  ])
  assert.equal(r.paymentRate, 75)
})

test('the peak hour is the busiest hour, not the earliest of the busy ones', async () => {
  const r = await report([
    order('PAID', '09:05', [line(tea, 'Tea', 10, 1)], { paidAfter: 1 }),
    ...['13:00', '13:10', '13:20'].map((t) =>
      order('PAID', t, [line(dosa, 'Dosa', 60, 1)], { paidAfter: 1 }),
    ),
  ])
  assert.equal(r.peakHour, 13)
  // The chart still lists the hours in time order.
  assert.deepEqual(r.busyHours.map((h) => h.hour), [9, 13])
})

test('max in one order adds up the whole order, not one line', async () => {
  const r = await report([
    order('PAID', '10:00', [line(dosa, 'Dosa', 60, 2), line(tea, 'Tea', 10, 3)], { paidAfter: 1 }),
    order('PAID', '10:30', [line(tea, 'Tea', 10, 4)], { paidAfter: 1 }),
  ])
  assert.equal(r.highestItemsInOrder, 5)
})

test('time between orders ignores the overnight gap', async () => {
  const r = await report(
    [
      order('PAID', '21:00', [line(tea, 'Tea', 10, 1)], { paidAfter: 1 }),
      order('PAID', '21:10', [line(tea, 'Tea', 10, 1)], { paidAfter: 1 }),
      order('PAID', '2026-11-07T08:00', [line(tea, 'Tea', 10, 1)], { paidAfter: 1 }),
    ],
    { endDate: '2026-11-07' },
  )
  assert.equal(r.averageTimeBetweenOrders, '10 min')
})

test('a renamed menu item stays one row, under its latest name', async () => {
  const r = await report([
    order('PAID', '10:00', [line(dosa, 'Dosa', 60, 1)], { paidAfter: 1 }),
    order('PAID', '11:00', [line(dosa, 'Masala Dosa', 60, 2)], { paidAfter: 1 }),
  ])
  assert.equal(r.uniqueItemsSold, 1)
  assert.deepEqual(r.topItems, [{ name: 'Masala Dosa', revenue: 180, qty: 3 }])
})

test('only this cart and whole IST days are counted', async () => {
  const r = await report([
    order('PAID', '00:05', [line(dosa, 'Dosa', 60, 1)], { paidAfter: 1 }), // just after IST midnight
    order('PAID', '2026-11-05T23:55', [line(dosa, 'Dosa', 60, 1)], { paidAfter: 1 }), // day before
    order('PAID', '10:00', [line(dosa, 'Dosa', 60, 1)], { paidAfter: 1, cart: otherCartId }),
  ])
  assert.equal(r.totalOrders, 1)
  assert.equal(r.revenue, 62)
})

test('no orders gives zeros, not errors', async () => {
  const r = await report([])
  assert.equal(r.revenue, 0)
  assert.equal(r.highestOrder, 0)
  assert.equal(r.peakHour, null)
  assert.equal(r.averageTimeBetweenOrders, null)
  assert.deepEqual(r.topItems, [])
})

test('a malformed cart ID is a 400, not a server error', async () => {
  const r = await call(getSalesDashboard, {
    params: { cartId: 'not-an-id' },
    query: { startDate: '2026-11-06', endDate: '2026-11-06' },
    user: { _id: ownerId, role: 'vendor' },
  })
  assert.equal(r.status, 400)
})

test('another vendor cannot read this cart', async () => {
  const r = await call(getSalesDashboard, {
    params: { cartId: String(cartId) },
    query: { startDate: '2026-11-06', endDate: '2026-11-06' },
    user: { _id: new mongoose.Types.ObjectId(), role: 'vendor' },
  })
  assert.equal(r.status, 403)
})

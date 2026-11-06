const test = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const { call, stub, restoreAll, q } = require('./helpers')
const Order = require('../models/Order')
const Cart = require('../models/Cart')
const { buildSalesReport, getSalesDashboard } = require('../controllers/salesController')

test.afterEach(restoreAll)

const dosa = new mongoose.Types.ObjectId()
const tea = new mongoose.Types.ObjectId()

// An order at an IST time of day; minutes after createdAt for paid/served.
function order(status, istTime, lines, { paidAfter, servedAfter, total } = {}) {
  const createdAt = new Date(`2026-11-06T${istTime}:00+05:30`)
  const at = (min) => (min === undefined ? null : new Date(createdAt.getTime() + min * 60000))
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0)
  return {
    status,
    createdAt,
    paidAt: at(paidAfter),
    servedAt: at(servedAfter),
    orderItems: lines,
    subtotal,
    parcelCharge: 0,
    platformFee: 2,
    totalPrice: total ?? subtotal + 2,
    orderType: 'MANUAL',
  }
}
const line = (menuItemId, name, price, quantity) => ({ menuItemId, name, price, quantity })

test('revenue and items count only paid and served orders', () => {
  const r = buildSalesReport([
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
})

test('payment rate includes served orders, which were paid first', () => {
  const r = buildSalesReport([
    order('SERVED', '10:00', [line(dosa, 'Dosa', 60, 1)], { paidAfter: 1, servedAfter: 5 }),
    order('SERVED', '10:10', [line(dosa, 'Dosa', 60, 1)], { paidAfter: 1, servedAfter: 5 }),
    order('PAID', '10:20', [line(dosa, 'Dosa', 60, 1)], { paidAfter: 1 }),
    order('PENDING', '10:30', [line(dosa, 'Dosa', 60, 1)]),
  ])
  assert.equal(r.paymentRate, 75)
})

test('the peak hour is the busiest hour, not the earliest of the busy ones', () => {
  const r = buildSalesReport([
    order('PAID', '09:05', [line(tea, 'Tea', 10, 1)], { paidAfter: 1 }),
    ...['13:00', '13:10', '13:20'].map((t) =>
      order('PAID', t, [line(dosa, 'Dosa', 60, 1)], { paidAfter: 1 }),
    ),
  ])
  assert.equal(r.peakHour, 13)
  // The chart still lists the hours in time order.
  assert.deepEqual(r.busyHours.map((h) => h.hour), [9, 13])
})

test('max in one order adds up the whole order, not one line', () => {
  const r = buildSalesReport([
    order('PAID', '10:00', [line(dosa, 'Dosa', 60, 2), line(tea, 'Tea', 10, 3)], { paidAfter: 1 }),
    order('PAID', '10:30', [line(tea, 'Tea', 10, 4)], { paidAfter: 1 }),
  ])
  assert.equal(r.highestItemsInOrder, 5)
})

test('time between orders ignores the overnight gap', () => {
  const evening = order('PAID', '21:00', [line(tea, 'Tea', 10, 1)], { paidAfter: 1 })
  const later = order('PAID', '21:10', [line(tea, 'Tea', 10, 1)], { paidAfter: 1 })
  const nextMorning = { ...order('PAID', '08:00', [line(tea, 'Tea', 10, 1)], { paidAfter: 1 }) }
  nextMorning.createdAt = new Date('2026-11-07T08:00:00+05:30')
  const r = buildSalesReport([evening, later, nextMorning])
  assert.equal(r.averageTimeBetweenOrders, '10 min')
})

test('a renamed menu item stays one row, under its latest name', () => {
  const r = buildSalesReport([
    order('PAID', '10:00', [line(dosa, 'Dosa', 60, 1)], { paidAfter: 1 }),
    order('PAID', '11:00', [line(dosa, 'Masala Dosa', 60, 2)], { paidAfter: 1 }),
  ])
  assert.equal(r.uniqueItemsSold, 1)
  assert.deepEqual(r.topItems, [{ name: 'Masala Dosa', revenue: 180, qty: 3 }])
})

test('no orders gives zeros, not errors', () => {
  const r = buildSalesReport([])
  assert.equal(r.revenue, 0)
  assert.equal(r.highestOrder, 0)
  assert.equal(r.peakHour, null)
  assert.equal(r.averageTimeBetweenOrders, null)
})

test('a malformed cart ID is a 400, not a server error', async () => {
  const r = await call(getSalesDashboard, {
    params: { cartId: 'not-an-id' },
    query: { startDate: '2026-11-06', endDate: '2026-11-06' },
    user: { _id: 'u1', role: 'vendor' },
  })
  assert.equal(r.status, 400)
})

test('the dashboard reads the cart orders for whole IST days', async () => {
  const cartId = new mongoose.Types.ObjectId()
  const userId = new mongoose.Types.ObjectId()
  stub(Cart, 'findById', () => q({ _id: cartId, userId }))
  stub(Cart, 'findOne', () => q({ _id: cartId, userId }))
  let filter
  stub(Order, 'find', (f) => {
    filter = f
    return q([order('PAID', '10:00', [line(dosa, 'Dosa', 60, 1)], { paidAfter: 1 })])
  })
  const r = await call(getSalesDashboard, {
    params: { cartId: String(cartId) },
    query: { startDate: '2026-11-06', endDate: '2026-11-06' },
    user: { _id: userId, role: 'vendor' },
  })
  assert.equal(r.status, 200)
  assert.equal(r.body.data.revenue, 62)
  assert.equal(filter.createdAt.$gte.toISOString(), '2026-11-05T18:30:00.000Z')
  assert.equal(filter.createdAt.$lte.toISOString(), '2026-11-06T18:29:59.999Z')
})

// The platform-fee lock against a real, throwaway MongoDB (no Atlas data).
const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

process.env.RAZORPAY_KEY_ID ||= 'rzp_test_dummy'
process.env.RAZORPAY_KEY_SECRET ||= 'dummy_secret'

const { call } = require('./helpers')
const Order = require('../models/Order')
const Cart = require('../models/Cart')
const User = require('../models/User')
const Payment = require('../models/Payment')
const { getCartPaymentStatus, getISTMidnight } = require('../utils/cartPaymentLock')
const pay = require('../controllers/paymentController')

let mongo
before(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
})
after(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})

const DAY = 24 * 3600e3
const ownerId = new mongoose.Types.ObjectId()
const staffId = new mongoose.Types.ObjectId()
const cartId = new mongoose.Types.ObjectId()
const today = getISTMidnight(new Date())
const daysAgo = (n) => new Date(today.getTime() - n * DAY)

beforeEach(async () => {
  for (const m of [Order, Cart, User, Payment]) await m.collection.deleteMany({})
  await Cart.collection.insertOne({ _id: cartId, userId: ownerId, cartName: 'Test', address: '' })
  await User.collection.insertOne({ _id: staffId, role: 'staff', cartId })
})

let orderNumber = 0
// An order placed at 10am IST, `n` days ago.
const order = (n, status = 'SERVED') => {
  const at = new Date(daysAgo(n).getTime() + 10 * 3600e3)
  return {
    cartId, orderNumber: ++orderNumber, status, platformFee: 2, subtotal: 60,
    totalPrice: 62, orderItems: [{ name: 'Dosa', price: 60, quantity: 1 }],
    orderDate: at, createdAt: at,
  }
}
const paidDay = (n) => ({
  cartId, userId: ownerId, cartName: 'Test', totalOrders: 1, amount: 2,
  status: 'VERIFIED', paymentReference: `GUL-${n}-${Math.random()}`, billingDate: daysAgo(n),
})

test('after a day is paid, the next day with orders is billed and locks', async () => {
  await Order.collection.insertMany([order(3), order(3), order(2)])
  await Payment.collection.insertOne(paidDay(3))
  const status = await getCartPaymentStatus(cartId)
  assert.equal(status.isLocked, true)
  assert.equal(status.billingDate.getTime(), daysAgo(2).getTime())
  assert.equal(status.totalPending, 2)
})

// An order created `createdDaysAgo` at 11:40pm IST, first paid at the given time.
const lateOrder = (createdDaysAgo, status, paidAt) => {
  const at = new Date(daysAgo(createdDaysAgo).getTime() + (23 * 60 + 40) * 60e3)
  return { ...order(0, status), orderDate: at, createdAt: at, paidAt }
}
const minutesInto = (n, minutes) => new Date(daysAgo(n).getTime() + minutes * 60e3)

test('an order paid after midnight is billed on the day it was paid, not missed', async () => {
  // Three days ago is already paid. This order was placed that night and
  // paid at 12:20am the next day.
  await Payment.collection.insertOne(paidDay(3))
  await Order.collection.insertOne(lateOrder(3, 'PAID', minutesInto(2, 20)))
  const status = await getCartPaymentStatus(cartId)
  assert.equal(status.billingDate.getTime(), daysAgo(2).getTime())
  assert.equal(status.totalPending, 2)
})

test('an order edited back to unpaid stays billed once, on the day it was first paid', async () => {
  // Paid two days ago, then edited so the customer owes more: PENDING, but
  // it keeps its first payment time.
  await Order.collection.insertOne({ ...order(2, 'PENDING'), paidAt: minutesInto(2, 600) })
  const status = await getCartPaymentStatus(cartId)
  assert.equal(status.billingDate.getTime(), daysAgo(2).getTime())
  assert.equal(status.totalPending, 2)
})

test('an order marked unpaid again is not billed', async () => {
  await Order.collection.insertOne({ ...order(2, 'PENDING'), paidAt: null })
  const status = await getCartPaymentStatus(cartId)
  assert.equal(status.totalPending, 0)
})

test('the fee counts only paid and served orders', async () => {
  await Order.collection.insertMany([
    order(2, 'SERVED'), order(2, 'PAID'), order(2, 'PENDING'), order(2, 'CANCELLED'),
  ])
  const status = await getCartPaymentStatus(cartId)
  assert.equal(status.totalOrders, 2)
  assert.equal(status.totalPending, 4)
})

test('a day of only unpaid orders is never billed', async () => {
  await Order.collection.insertMany([order(2, 'PENDING'), order(2, 'CANCELLED')])
  const status = await getCartPaymentStatus(cartId)
  assert.equal(status.isLocked, false)
  assert.equal(status.totalPending, 0)
})

test("today's fee shows as upcoming, with when it locks, but isn't payable yet", async () => {
  await Order.collection.insertMany([order(0), order(0)])
  const status = await getCartPaymentStatus(cartId)
  assert.equal(status.isLocked, false)
  assert.equal(status.totalPending, 4)
  assert.equal(status.canPay, false)
  assert.equal(status.dueAt.getTime(), today.getTime() + 26 * 3600e3)
})

test('staff can see the lock but only the owner can start a payment', async () => {
  await Order.collection.insertOne(order(2))
  const asStaff = { _id: staffId, role: 'staff' }
  let r = await call(pay.getPaymentStatus, { params: { cartId: String(cartId) }, user: asStaff })
  assert.equal(r.status, 200)
  assert.equal(r.body.isLocked, true)
  r = await call(pay.createRazorpayOrder, { params: { cartId: String(cartId) }, user: asStaff })
  assert.equal(r.status, 403)
})

test("today's fee can't be paid before midnight", async () => {
  await Order.collection.insertOne(order(0))
  const r = await call(pay.createRazorpayOrder, {
    params: { cartId: String(cartId) },
    user: { _id: ownerId, role: 'vendor' },
  })
  assert.equal(r.status, 400)
  assert.match(r.body.message, /after midnight/)
})

test('a payment found captured during crash recovery can be saved', async () => {
  const p = new Payment({ ...paidDay(1), status: 'VERIFIED', verificationSource: 'RAZORPAY_RECOVERY' })
  await p.validate()
})

test('only an admin can reject a payment', async () => {
  const [p] = await Payment.insertMany([{ ...paidDay(1), status: 'PENDING' }])
  let r = await call(pay.rejectPayment, { params: { paymentId: String(p._id) }, user: { _id: ownerId, role: 'vendor' } })
  assert.equal(r.status, 403)
  r = await call(pay.rejectPayment, { params: { paymentId: String(p._id) }, user: { _id: new mongoose.Types.ObjectId(), role: 'admin' } })
  assert.equal(r.status, 200)
})

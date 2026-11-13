// Double-charge protection, cart/vendor controls and the admin action log,
// against a throwaway MongoDB. Razorpay is stood in for.
const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert')
const crypto = require('crypto')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const { MongoMemoryServer } = require('mongodb-memory-server')

process.env.RAZORPAY_KEY_ID ||= 'rzp_test_dummy'
process.env.RAZORPAY_KEY_SECRET ||= 'dummy_secret'
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test'
process.env.JWT_SECRET ||= 'test-secret'

const { call } = require('./helpers')
const Cart = require('../models/Cart')
const User = require('../models/User')
const Payment = require('../models/Payment')
const AdminAction = require('../models/AdminAction')
const Order = require('../models/Order')
const Setting = require('../models/Setting')
const pay = require('../controllers/paymentController')
const admin = require('../controllers/adminController')
const vendor = require('../controllers/vendorController')
const orders = require('../controllers/orderController')
const carts = require('../controllers/cartController')

const adminId = new mongoose.Types.ObjectId()
const ownerId = new mongoose.Types.ObjectId()
const cartId = new mongoose.Types.ObjectId()
const asAdmin = { _id: adminId, role: 'admin' }
const asOwner = { _id: ownerId, role: 'vendor' }

let mongo
before(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
})
after(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})

// Records Razorpay calls; each test sets what Razorpay answers.
let refunds
let captured
const rz = pay.razorpay
beforeEach(async () => {
  for (const m of [Cart, User, Payment, AdminAction, Order, Setting]) await m.collection.deleteMany({})
  await User.collection.insertMany([
    { _id: adminId, userId: 'ADM-1', role: 'admin', name: 'Asha Admin', phoneNumber: '900' },
    {
      _id: ownerId, userId: 'VEN-1', role: 'vendor', name: 'Ravi', phoneNumber: '901',
      pinHash: await bcrypt.hash('1234', 4),
    },
  ])
  await Cart.collection.insertOne({
    _id: cartId, userId: ownerId, cartName: 'Ravi Chaat', cartCity: 'Pune', isActive: true, isOpen: true,
  })
  refunds = []
  captured = null
  rz.payments.refund = async (id, opts) => {
    refunds.push([id, opts.amount])
    return { id: `rfnd_${refunds.length}` }
  }
  rz.orders.fetchPayments = async () => ({ items: captured ? [captured] : [] })
})

const bill = (extra) =>
  Payment.collection.insertOne({
    cartId, userId: ownerId, cartName: 'Ravi Chaat', amount: 6, totalOrders: 3, status: 'PENDING',
    razorpayOrderId: 'order_abc', paymentReference: `GUL-${Math.random()}`,
    billingDate: new Date(), orderIds: [], ...extra,
  })

function webhook(paymentId) {
  const body = Buffer.from(JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: 'order_abc', status: 'captured', amount: 600, currency: 'INR' } } },
  }))
  const signature = crypto.createHmac('sha256', 'whsec_test').update(body).digest('hex')
  return call(pay.razorpayWebhook, { body, headers: { 'x-razorpay-signature': signature } })
}

test('an online payment for a bill an admin already marked paid is refunded, once', async () => {
  // Three ₹2 orders paid two days ago, with the vendor's checkout still open.
  const twoDaysAgo = new Date(Date.now() - 2 * 864e5)
  await Order.collection.insertMany([0, 1, 2].map((i) => ({
    cartId, orderNumber: i + 1, status: 'SERVED', platformFee: 2, subtotal: 60, totalPrice: 62,
    orderItems: [], createdAt: twoDaysAgo, orderDate: twoDaysAgo, paidAt: twoDaysAgo,
  })))
  await bill()
  const marked = await call(admin.markFeePaid, { params: { cartId: String(cartId) }, user: asAdmin })
  assert.equal(marked.body.data.paidOnline, false)
  assert.equal(marked.body.data.amount, 6)

  await webhook('pay_late')
  await webhook('pay_late') // Razorpay retries webhooks
  assert.deepEqual(refunds, [['pay_late', 600]])

  // The admin's payment settles the bill; the abandoned checkout is retired
  // and carries the refund.
  assert.equal((await Payment.findOne({ cartId, verificationSource: 'MANUAL' }).lean()).amount, 6)
  const p = await Payment.findOne({ cartId, razorpayOrderId: 'order_abc' }).lean()
  assert.equal(p.status, 'EXPIRED')
  assert.deepEqual(
    p.refunds.map((r) => [r.razorpayPaymentId, r.status, r.refundId]),
    [['pay_late', 'REFUNDED', 'rfnd_1']],
  )
  const log = await AdminAction.find().sort({ createdAt: 1 }).lean()
  assert.deepEqual(log.map((l) => l.action), ['MARK_FEE_PAID', 'AUTO_REFUND'])
})

test("the bill's own online payment is never refunded", async () => {
  await bill({ status: 'VERIFIED', razorpayPaymentId: 'pay_1', verificationSource: 'WEBHOOK' })
  await webhook('pay_1')
  assert.deepEqual(refunds, [])
})

test('a failed refund is kept and raised on the dashboard', async () => {
  await bill({ status: 'VERIFIED', verificationSource: 'MANUAL' })
  rz.payments.refund = async () => {
    throw { error: { description: 'Refund window closed' } }
  }
  await webhook('pay_late')
  const p = await Payment.findOne({ cartId }).lean()
  assert.equal(p.refunds[0].status, 'FAILED')
  assert.equal(p.refunds[0].error, 'Refund window closed')
  const ov = await call(admin.overview, { query: {}, user: asAdmin })
  assert.ok(ov.body.data.attention.some((a) => a.id === 'refund'))
})

test('marking a bill paid records the online payment if the vendor already paid', async () => {
  await bill()
  captured = { id: 'pay_online', status: 'captured', amount: 600, currency: 'INR' }
  const r = await call(admin.markFeePaid, { params: { cartId: String(cartId) }, user: asAdmin })
  assert.equal(r.body.data.paidOnline, true)
  const p = await Payment.findOne({ cartId }).lean()
  assert.equal(p.verificationSource, 'RAZORPAY_RECOVERY')
  assert.equal(p.razorpayPaymentId, 'pay_online')
  assert.equal(await AdminAction.countDocuments({ action: 'MARK_FEE_PAID' }), 0)
})

test("marking a bill paid stops if Razorpay can't be checked", async () => {
  await bill()
  rz.orders.fetchPayments = async () => {
    throw new Error('timeout')
  }
  const r = await call(admin.markFeePaid, { params: { cartId: String(cartId) }, user: asAdmin })
  assert.equal(r.status, 502)
  assert.equal((await Payment.findOne({ cartId }).lean()).status, 'PENDING')
})

test('a suspended cart takes no orders and the vendor cannot reopen it', async () => {
  await call(admin.suspendCart, { params: { cartId: String(cartId) }, body: { reason: 'Fee leakage' }, user: asAdmin })
  const c = await Cart.findById(cartId).lean()
  assert.equal(c.isOpen, false)
  assert.equal(c.suspendReason, 'Fee leakage')

  const order = await call(orders.createOrder, { body: { cartId: String(cartId), orderItems: [] }, user: asOwner })
  assert.equal(order.status, 403)
  const reopen = await call(carts.toggleCartStatus, { params: { cartId: String(cartId) }, body: { isOpen: true }, user: asOwner })
  assert.equal(reopen.status, 403)

  await call(admin.resumeCart, { params: { cartId: String(cartId) }, user: asAdmin })
  const again = await call(carts.toggleCartStatus, { params: { cartId: String(cartId) }, body: { isOpen: true }, user: asOwner })
  assert.equal(again.status, 200)
})

test('a disabled vendor cannot log in and their carts are suspended', async () => {
  const r = await call(admin.disableVendor, { params: { ownerId: String(ownerId) }, user: asAdmin })
  assert.equal(r.body.data.cartsSuspended, 1)
  const login = await call(vendor.vendorLogin, { body: { vendorIdentifier: 'VEN-1', pin: '1234' } })
  assert.equal(login.status, 403)
  const wrongPin = await call(vendor.vendorLogin, { body: { vendorIdentifier: 'VEN-1', pin: '0000' } })
  assert.equal(wrongPin.status, 401) // a wrong PIN doesn't reveal the account is disabled

  // A cart can't be resumed while its vendor is disabled.
  const resume = await call(admin.resumeCart, { params: { cartId: String(cartId) }, user: asAdmin })
  assert.equal(resume.status, 409)

  await call(admin.enableVendor, { params: { ownerId: String(ownerId) }, user: asAdmin })
  const ok = await call(vendor.vendorLogin, { body: { vendorIdentifier: 'VEN-1', pin: '1234' } })
  assert.equal(ok.status, 200)
})

test('the action log lists who did what, newest first', async () => {
  await call(admin.suspendCart, { params: { cartId: String(cartId) }, body: {}, user: asAdmin })
  await call(admin.logReminder, { params: { cartId: String(cartId) }, body: { amount: 6, channel: 'whatsapp' }, user: asAdmin })
  const r = await call(admin.actions, { query: {} })
  assert.deepEqual(
    r.body.data.items.map((i) => [i.action, i.by, i.target]),
    [['SEND_REMINDER', 'Asha Admin', 'Ravi Chaat'], ['SUSPEND_CART', 'Asha Admin', 'Ravi Chaat']],
  )
  const only = await call(admin.actions, { query: { action: 'SUSPEND_CART' } })
  assert.equal(only.body.data.items.length, 1)
})

test('an online payment for a checkout replaced by a bigger bill is refunded', async () => {
  await bill({ status: 'EXPIRED' })
  await webhook('pay_old')
  assert.deepEqual(refunds, [['pay_old', 600]])
  const p = await Payment.findOne({ cartId }).lean()
  assert.equal(p.status, 'EXPIRED')
  assert.equal(p.refunds[0].status, 'REFUNDED')
})

test('an admin changes the platform fee: logged, validated, defaults to 2', async () => {
  let r = await call(admin.getSettings, { user: asAdmin })
  assert.equal(r.body.data.platformFee, 2)

  for (const platformFee of [-1, 2.5, '3', 101, undefined]) {
    r = await call(admin.updateSettings, { body: { platformFee }, user: asAdmin })
    assert.equal(r.status, 400, String(platformFee))
  }

  r = await call(admin.updateSettings, { body: { platformFee: 4 }, user: asAdmin })
  assert.equal(r.status, 200)
  assert.equal((await call(admin.getSettings, { user: asAdmin })).body.data.platformFee, 4)
  await call(admin.updateSettings, { body: { platformFee: 4 }, user: asAdmin }) // unchanged: not logged again
  const log = await AdminAction.find({ action: 'SET_PLATFORM_FEE' }).lean()
  assert.deepEqual(log.map((l) => l.details), [{ from: 2, to: 4 }])
})

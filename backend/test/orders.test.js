const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const { call, stub, restoreAll, q } = require('./helpers')
const Cart = require('../models/Cart')
const User = require('../models/User')
const Order = require('../models/Order')
const MenuItem = require('../models/Menu')
const Counter = require('../models/Counter')
const paymentLock = require('../utils/cartPaymentLock')
const c = require('../controllers/orderController')

afterEach(restoreAll)

const id = () => new mongoose.Types.ObjectId().toString()
const cartId = id()
const ownerId = id()
const dosa = { _id: id(), name: 'Dosa', price: 40, isInStock: true }
const tea = { _id: id(), name: 'Tea', price: 10, isInStock: true }
const gone = { _id: id(), name: 'Vada', price: 15, isInStock: false }
const owner = { _id: ownerId, role: 'vendor' }

function setup({ isOpen = true, order, isLocked = false } = {}) {
  const cart = { _id: cartId, userId: ownerId, isOpen, isActive: true }
  stub(paymentLock, 'getCartPaymentStatus', async () => ({ isLocked }))
  stub(Cart, 'findById', () => q(cart))
  stub(User, 'findById', () => q(null))
  stub(MenuItem, 'find', (filter) =>
    q([dosa, tea, gone].filter((m) => filter._id.$in.includes(m._id))),
  )
  stub(Counter, 'findByIdAndUpdate', async () => ({ seq: 7 }))
  stub(Order, 'create', async (doc) => ({ _id: id(), ...doc }))
  if (order) {
    order.save = async () => {}
    stub(Order, 'findById', () => q(order))
  }
}

const line = (item, quantity) => ({ menuItemId: item._id, quantity })

test('customer order uses server prices and is always PENDING QR', async () => {
  setup()
  const r = await call(c.createOrder, {
    body: {
      cartId,
      orderItems: [{ ...line(dosa, 2), price: 0 }, line(tea, 1)],
      status: 'PAID',
      orderType: 'MANUAL',
      totalPrice: 0,
      platformFee: 0,
      parcelCharge: 50,
    },
  })
  assert.strictEqual(r.status, 201)
  const o = r.body.data
  assert.strictEqual(o.status, 'PENDING')
  assert.strictEqual(o.orderType, 'QR')
  assert.strictEqual(o.subtotal, 90)
  assert.strictEqual(o.parcelCharge, 0)
  assert.strictEqual(o.platformFee, 2)
  assert.strictEqual(o.totalPrice, 92)
  assert.strictEqual(o.orderItems[0].price, 40)
})

test('customers cannot order from a closed cart', async () => {
  setup({ isOpen: false })
  const r = await call(c.createOrder, { body: { cartId, orderItems: [line(dosa, 1)] } })
  assert.strictEqual(r.status, 403)
})

test('out-of-stock and unknown items are rejected', async () => {
  setup()
  let r = await call(c.createOrder, { body: { cartId, orderItems: [line(gone, 1)] } })
  assert.strictEqual(r.status, 400)
  r = await call(c.createOrder, { body: { cartId, orderItems: [{ menuItemId: id(), quantity: 1 }] } })
  assert.strictEqual(r.status, 400)
  r = await call(c.createOrder, { body: { cartId, orderItems: [line(dosa, 0)] } })
  assert.strictEqual(r.status, 400)
})

test('vendor can create a PAID manual order with a parcel charge', async () => {
  setup({ isOpen: false })
  const r = await call(c.createOrder, {
    user: owner,
    body: { cartId, orderItems: [line(dosa, 1)], status: 'PAID', parcelCharge: 5 },
  })
  assert.strictEqual(r.status, 201)
  const o = r.body.data
  assert.strictEqual(o.status, 'PAID')
  assert.strictEqual(o.orderType, 'MANUAL')
  assert.strictEqual(o.totalPrice, 47)
  assert.strictEqual(o.paidAmount, 47)
  assert.deepStrictEqual(r.emits.map((e) => e.event), ['new_order_received'])
})

test('another vendor gets customer rules', async () => {
  setup()
  const r = await call(c.createOrder, {
    user: { _id: id(), role: 'vendor' },
    body: { cartId, orderItems: [line(dosa, 1)], status: 'PAID' },
  })
  assert.strictEqual(r.body.data.status, 'PENDING')
})

function paidOrder() {
  return {
    _id: id(),
    cartId,
    status: 'PAID',
    orderItems: [{ menuItemId: dosa._id, name: 'Dosa', price: 30, quantity: 1 }],
    subtotal: 30,
    parcelCharge: 0,
    platformFee: 2,
    totalPrice: 32,
    paidAt: new Date(),
  }
}

test('adding to a legacy paid order collects only the difference', async () => {
  const order = paidOrder() // no paidAmount: saved before it existed
  setup({ order })
  const r = await call(c.updateOrder, {
    params: { orderId: order._id },
    body: { orderItems: [line(dosa, 1), line(tea, 1)] },
  })
  assert.strictEqual(r.status, 200)
  // The dosa keeps the price it was ordered at (30, menu now says 40).
  assert.strictEqual(order.totalPrice, 42)
  assert.strictEqual(order.status, 'PENDING')
  assert.deepStrictEqual(
    { action: order.paymentAdjustment.action, amount: order.paymentAdjustment.amount },
    { action: 'COLLECT', amount: 10 },
  )
  assert.strictEqual(order.paidAmount, 32)
  assert.ok(r.emits.some((e) => e.room === cartId && e.event === 'order_updated'))
})

test('customers cannot shrink a paid order; the vendor can and returns money', async () => {
  const order = paidOrder()
  order.orderItems[0].quantity = 2
  order.totalPrice = 62
  order.paidAmount = 62
  setup({ order })
  let r = await call(c.updateOrder, {
    params: { orderId: order._id },
    body: { orderItems: [line(dosa, 1)] },
  })
  assert.strictEqual(r.status, 400)

  r = await call(c.updateOrder, {
    user: owner,
    params: { orderId: order._id },
    body: { orderItems: [line(dosa, 1)] },
  })
  assert.strictEqual(r.status, 200)
  assert.strictEqual(order.status, 'PAID')
  assert.strictEqual(order.paymentAdjustment.action, 'RETURN')
  assert.strictEqual(order.paymentAdjustment.amount, 30)
  assert.strictEqual(order.paidAmount, 32)
})

test('editing an unpaid order needs no payment adjustment', async () => {
  const order = { ...paidOrder(), status: 'PENDING', paidAt: null }
  setup({ order })
  const r = await call(c.updateOrder, {
    params: { orderId: order._id },
    body: { orderItems: [line(dosa, 3)] },
  })
  assert.strictEqual(r.status, 200)
  assert.strictEqual(order.totalPrice, 92)
  assert.strictEqual(order.paymentAdjustment, null)
})

test('customers can cancel only unpaid orders, and the cart room hears it', async () => {
  const order = paidOrder()
  setup({ order })
  let r = await call(c.deleteOrder, { params: { orderId: order._id } })
  assert.strictEqual(r.status, 400)

  order.status = 'PENDING'
  r = await call(c.deleteOrder, { params: { orderId: order._id } })
  assert.strictEqual(r.status, 200)
  assert.strictEqual(order.status, 'CANCELLED')
  assert.ok(r.emits.some((e) => e.room === cartId && e.event === 'order_cancelled'))
})

test('vendor routes need someone who manages the cart', async () => {
  const order = paidOrder()
  setup({ order })
  const r = await call(c.markOrderPaid, {
    user: { _id: id(), role: 'vendor' },
    params: { orderId: order._id },
  })
  assert.strictEqual(r.status, 403)
})

test('mark paid records the amount; serve needs payment', async () => {
  const order = { ...paidOrder(), status: 'PENDING', paidAt: null }
  setup({ order })
  let r = await call(c.serveOrder, { user: owner, params: { orderId: order._id } })
  assert.strictEqual(r.status, 400)

  r = await call(c.markOrderPaid, { user: owner, params: { orderId: order._id } })
  assert.strictEqual(r.status, 200)
  assert.strictEqual(order.paidAmount, 32)
  assert.ok(r.emits.some((e) => e.room === cartId))

  r = await call(c.serveOrder, { user: owner, params: { orderId: order._id } })
  assert.strictEqual(order.status, 'SERVED')
})

test('a customer cannot cancel a partly paid order; the vendor cancel records the return', async () => {
  // Paid 32, then the customer added a tea: PENDING again, 10 still owed.
  const order = { ...paidOrder(), status: 'PENDING', paidAmount: 32, totalPrice: 42 }
  setup({ order })
  let r = await call(c.deleteOrder, { params: { orderId: order._id } })
  assert.strictEqual(r.status, 400)
  assert.strictEqual(order.status, 'PENDING')

  r = await call(c.deleteOrder, { user: owner, params: { orderId: order._id } })
  assert.strictEqual(r.status, 200)
  assert.deepStrictEqual(
    { action: order.paymentAdjustment.action, amount: order.paymentAdjustment.amount },
    { action: 'RETURN', amount: 32 },
  )
})

test('restoring a cancelled order uses the money paid, not the payment time', async () => {
  // Marked unpaid on a billed day keeps paidAt, but nothing was paid.
  const unpaid = { ...paidOrder(), status: 'CANCELLED', paidAmount: 0 }
  setup({ order: unpaid })
  await call(c.undoDeleteOrder, { user: owner, params: { orderId: unpaid._id } })
  assert.strictEqual(unpaid.status, 'PENDING')

  restoreAll()
  const paid = { ...paidOrder(), status: 'CANCELLED', paidAmount: 32 }
  setup({ order: paid })
  await call(c.undoDeleteOrder, { user: owner, params: { orderId: paid._id } })
  assert.strictEqual(paid.status, 'PAID')
})

test('customers cannot add items while the cart is closed or locked', async () => {
  const body = { orderItems: [line(dosa, 2)] }
  let order = { ...paidOrder(), status: 'PENDING', paidAt: null }
  setup({ order, isOpen: false })
  let r = await call(c.updateOrder, { params: { orderId: order._id }, body })
  assert.strictEqual(r.status, 403)

  restoreAll()
  setup({ order, isLocked: true })
  r = await call(c.updateOrder, { params: { orderId: order._id }, body })
  assert.strictEqual(r.status, 403)

  // The vendor can still fix the order.
  r = await call(c.updateOrder, { user: owner, params: { orderId: order._id }, body })
  assert.strictEqual(r.status, 200)
})

test('feedback must be text, and is cut to 500 characters', async () => {
  const order = paidOrder()
  setup({ order })
  let r = await call(c.submitOrderFeedback, { params: { orderNumber: order._id }, body: { feedback: { $gt: '' } } })
  assert.strictEqual(r.status, 400)
  r = await call(c.submitOrderFeedback, { params: { orderNumber: order._id }, body: { feedback: 'x'.repeat(900) } })
  assert.strictEqual(r.status, 200)
  assert.strictEqual(order.feedback.length, 500)
})

test('a malformed id is a 400, not a server error', async () => {
  stub(Order, 'findById', () => {
    throw Object.assign(new Error('Cast to ObjectId failed'), { name: 'CastError' })
  })
  const r = await call(c.getOrder, { params: { orderId: 'junk' } })
  assert.strictEqual(r.status, 400)
  assert.strictEqual(r.body.message, 'Invalid ID')
})

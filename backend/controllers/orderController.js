const crypto = require('crypto')
const mongoose = require('mongoose')
const asyncHandler = require('../utils/asyncHandler')
const Order = require('../models/Order')
const Cart = require('../models/Cart')
const MenuItem = require('../models/Menu')
const TruthLine = require('../models/TruthLine')
const getNextOrderNumber = require('../utils/getNextOrderNumber')
const { canManageCart, findManagedCart, findManagedOrder } = require('../utils/cartAccess')
const Payment = require('../models/Payment')
const paymentLock = require('../utils/cartPaymentLock')
const { getISTMidnight } = paymentLock
const { holdsOrderKey } = require('../utils/orderKey')
const { notifyNewOrder } = require('../utils/push')

/** Whether a bill already covers the day [order] was paid on. */
async function isPaidDayBilled(order) {
  return Boolean(
    await Payment.exists({
      cartId: order.cartId,
      status: { $in: ['VERIFIED', 'PENDING'] },
      billingDate: getISTMidnight(order.paidAt),
    }),
  )
}

// GullyEats' fee per order, charged on top of the items.
const PLATFORM_FEE = 2
const MAX_QUANTITY = 100

function fail(res, status, message) {
  res.status(status)
  throw new Error(message)
}

// Tells the customer's order page and every vendor device about a change,
// and everyone waiting at the cart that the queue may have moved (no order
// details: they refetch their own place with getQueue).
function emitOrder(req, order, event = 'order_updated') {
  req.io.to(`order:${order._id}`).emit(event, order)
  req.io.to(order.cartId.toString()).emit(event, order)
  req.io.to(`queue:${order.cartId}`).emit('queue_changed')
}

// Paid orders still waiting to be served count as the queue; older than
// this they are forgotten ones, not a queue.
const QUEUE_HOURS = 12

function parseParcelCharge(res, value) {
  const charge = Number(value)
  if (value === null || value === '' || !Number.isFinite(charge) || charge < 0) {
    fail(res, 400, 'Parcel charge must be a number of 0 or more')
  }
  return charge
}

/**
 * Builds the order lines from the cart's menu, using the server's names and
 * prices. Lines already in previousItems (when editing an order) keep their
 * original name and price, even if the menu changed or dropped the item.
 */
async function buildOrderItems(res, cartId, orderItems, previousItems = []) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    fail(res, 400, 'Order must have at least one item')
  }

  const previous = new Map(
    previousItems.map((item) => [String(item.menuItemId), item]),
  )
  const quantities = new Map()

  for (const item of orderItems) {
    const id = String(item?.menuItemId)
    const quantity = Number(item?.quantity)

    if (!mongoose.isValidObjectId(id)) fail(res, 400, 'Invalid menu item')
    if (!Number.isInteger(quantity) || quantity < 1) {
      fail(res, 400, 'Invalid item quantity')
    }

    quantities.set(id, (quantities.get(id) || 0) + quantity)
  }

  const newIds = [...quantities.keys()].filter((id) => !previous.has(id))
  const menu = newIds.length
    ? await MenuItem.find({ _id: { $in: newIds }, cartId }).lean()
    : []
  const menuById = new Map(menu.map((item) => [String(item._id), item]))

  return [...quantities].map(([id, quantity]) => {
    if (quantity > MAX_QUANTITY) fail(res, 400, 'Item quantity is too large')

    const old = previous.get(id)
    if (old) {
      return {
        menuItemId: old.menuItemId,
        name: old.name,
        names: old.names,
        price: old.price,
        quantity,
      }
    }

    const item = menuById.get(id)
    if (!item) fail(res, 400, 'Some items are no longer on the menu')
    if (item.isInStock === false) fail(res, 400, `${item.name} is out of stock`)

    return { menuItemId: item._id, name: item.name, names: item.names, price: item.price, quantity }
  })
}

function orderTotals(orderItems, parcelCharge) {
  const subtotal = orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  )
  return {
    subtotal,
    parcelCharge,
    platformFee: PLATFORM_FEE,
    totalPrice: subtotal + parcelCharge + PLATFORM_FEE,
  }
}

// Money already collected for an order. Orders saved before paidAmount
// existed fall back to their total when PAID.
function amountPaid(order) {
  if (order.paidAmount != null) return order.paidAmount
  return order.status === 'PAID' ? order.totalPrice : 0
}

// Whether the logged-in user (if any) manages the order's cart.
async function managesOrderCart(req, order) {
  if (!req.user) return false
  const cart = await Cart.findById(order.cartId)
  return Boolean(cart) && canManageCart(req.user, cart)
}

// Customers must hold the order's key; a wrong one looks like no order.
async function requireOrderKey(req, res, order) {
  if (!(await holdsOrderKey(order._id, req.headers['x-gully-order']))) {
    fail(res, 404, 'Order not found')
  }
}

/*
 * The customer web app calls this without logging in; the vendor app sends
 * its token. Only someone who manages the cart may create PAID or MANUAL
 * orders or set a parcel charge. Prices always come from the menu.
 */
exports.createOrder = asyncHandler(async (req, res) => {
  const { cartId, orderItems, status, orderType, parcelCharge, phoneNumber } =
    req.body

  if (!cartId || !mongoose.isValidObjectId(cartId)) {
    fail(res, 400, 'cartId is required')
  }

  const cart = await Cart.findById(cartId)
  if (!cart) fail(res, 404, 'Cart not found')

  const isVendor = await canManageCart(req.user, cart)

  // Suspended by GullyEats: no orders at all, including vendor-entered ones.
  if (cart.suspendedAt) fail(res, 403, 'This cart is not taking orders right now')

  if (!isVendor && (!cart.isActive || !cart.isOpen)) {
    fail(res, 403, 'This cart is not taking orders right now')
  }

  const items = await buildOrderItems(res, cart._id, orderItems)

  let orderStatus = 'PENDING'
  let type = 'QR'
  let parcel = 0

  if (isVendor) {
    if (status !== undefined && !['PENDING', 'PAID'].includes(status)) {
      fail(res, 400, 'Invalid order status')
    }
    if (orderType !== undefined && !['QR', 'MANUAL'].includes(orderType)) {
      fail(res, 400, 'Invalid order type')
    }
    orderStatus = status || 'PENDING'
    type = orderType || 'MANUAL'
    parcel =
      parcelCharge === undefined ? 0 : parseParcelCharge(res, parcelCharge)
  }

  const totals = orderTotals(items, parcel)
  const phone = phoneNumber
    ? String(phoneNumber).replace(/\D/g, '').slice(-15)
    : ''
  const isPaid = orderStatus === 'PAID'

  const { orderNumber } = await getNextOrderNumber(cart._id)

  const order = await Order.create({
    cartId: cart._id,
    orderNumber,
    orderItems: items,
    ...totals,
    orderType: type,
    phoneNumber: phone || null,
    status: orderStatus,
    paidAt: isPaid ? new Date() : null,
    paidAmount: isPaid ? totals.totalPrice : 0,
    // Only the customer's own phone gets this (see Order.accessKey).
    accessKey: isVendor ? undefined : crypto.randomBytes(16).toString('hex'),
  })

  // The vendor's copy must not carry the customer's key.
  const forVendor = typeof order.toObject === 'function' ? order.toObject() : { ...order }
  delete forVendor.accessKey
  req.io.to(cart._id.toString()).emit('new_order_received', forVendor)
  if (isPaid) req.io.to(`queue:${cart._id}`).emit('queue_changed')
  // Vendor-entered orders were made on the vendor's own phone: no push.
  if (!isVendor) notifyNewOrder(cart, order)

  res.status(201).json({
    success: true,
    data: order,
  })
})

exports.getOrdersForToday = asyncHandler(async (req, res) => {
  const { cartId } = req.params

  await findManagedCart(req, res, cartId)

  const now = new Date()

  const istDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  const startOfDayIST = new Date(`${istDate}T00:00:00+05:30`)

  const endOfDayIST = new Date(`${istDate}T23:59:59.999+05:30`)

  const orders = await Order.find({
    cartId,
    createdAt: {
      $gte: startOfDayIST,
      $lte: endOfDayIST,
    },
  }).sort({ createdAt: -1 })

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders,
  })
})

exports.getAllOrders = asyncHandler(async (req, res) => {
  const { cartId } = req.params
  const { startDate, endDate } = req.query

  await findManagedCart(req, res, cartId)

  const filter = {
    cartId,
  }

  if (startDate || endDate) {
    filter.createdAt = {}

    if (startDate) {
      filter.createdAt.$gte = new Date(`${startDate}T00:00:00.000+05:30`)
    }

    if (endDate) {
      // Exclusive next-day boundary
      const end = new Date(`${endDate}T00:00:00.000+05:30`)

      end.setUTCDate(end.getUTCDate() + 1)

      filter.createdAt.$lt = end
    }
  }

  const orders = await Order.find(filter).sort({ createdAt: -1 }).lean()

  // ---------------------------------------------------------
  // STATUS COUNTS
  // These are ONLY from orders in the selected date range.
  // ---------------------------------------------------------

  const servedOrders = orders.filter(
    (order) => order.status === 'SERVED',
  ).length

  const cancelledOrders = orders.filter(
    (order) => order.status === 'CANCELLED',
  ).length

  const paidOrders = orders.filter((order) => order.status === 'PAID').length

  const unpaidOrders = orders.filter(
    (order) => order.status === 'PENDING',
  ).length

  res.status(200).json({
    success: true,

    count: orders.length,

    summary: {
      servedOrders,
      unpaidOrders,
      cancelledOrders,
      paidOrders,
    },

    data: orders,
  })
})

exports.getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId)
  if (!order) fail(res, 404, 'Order not found')
  if (!(await managesOrderCart(req, order))) await requireOrderKey(req, res, order)

  res.status(200).json({ success: true, data: order })
})

exports.serveOrder = asyncHandler(async (req, res) => {
  const order = await findManagedOrder(req, res, req.params.orderId)

  // Orders are served only after payment.
  if (order.status !== 'PAID') {
    fail(res, 400, 'Mark the order paid before serving it')
  }

  order.status = 'SERVED'
  order.servedAt = new Date()
  await order.save()

  emitOrder(req, order)

  res.status(200).json({
    success: true,
    message: 'Order marked as served',
    data: order,
  })
})

exports.serveOrderUndo = asyncHandler(async (req, res) => {
  const order = await findManagedOrder(req, res, req.params.orderId)

  if (order.status !== 'SERVED') {
    fail(res, 400, 'This order has not been served')
  }

  order.status = 'PAID'
  order.servedAt = null
  await order.save()

  emitOrder(req, order)

  res.status(200).json({
    success: true,
    message: 'Serve order undone',
    data: order,
  })
})

exports.markOrderPaid = asyncHandler(async (req, res) => {
  const order = await findManagedOrder(req, res, req.params.orderId)

  if (order.status !== 'PENDING' && order.status !== 'PAID') {
    fail(res, 400, 'Only open orders can be marked paid')
  }

  order.status = 'PAID'
  // An order edited back to PENDING keeps its first payment time, so its
  // platform fee stays on the day it was first billed.
  order.paidAt = order.paidAt ?? new Date()
  order.paidAmount = order.totalPrice
  order.paymentAdjustment = null
  await order.save()

  emitOrder(req, order)

  res.status(200).json({
    success: true,
    message: 'Payment confirmed',
    data: order,
  })
})

exports.markOrderUnpaid = asyncHandler(async (req, res) => {
  const order = await findManagedOrder(req, res, req.params.orderId)

  if (order.status !== 'PENDING' && order.status !== 'PAID') {
    fail(res, 400, 'Only open orders can be marked unpaid')
  }

  order.status = 'PENDING'
  // If the day this order was paid is already billed, its fee was charged:
  // keep the payment time, so paying it again doesn't charge it a second
  // time on a later day.
  if (!(order.paidAt && (await isPaidDayBilled(order)))) order.paidAt = null
  order.paidAmount = 0
  order.paymentAdjustment = null
  // Not paid, so not being cooked either.
  order.preparingAt = null
  await order.save()

  emitOrder(req, order)

  res.status(200).json({
    success: true,
    message: 'Marked unpaid',
    data: order,
  })
})

/*
 * Customers (no login) add items to their own open order; the vendor app
 * edits any open order of its cart and may change the parcel charge.
 */
exports.updateOrder = asyncHandler(async (req, res) => {
  const { orderItems, parcelCharge } = req.body

  const order = await Order.findById(req.params.orderId)
  if (!order) fail(res, 404, 'Order not found')

  const cart = await Cart.findById(order.cartId)
  const isVendor = Boolean(cart) && (await canManageCart(req.user, cart))
  if (!isVendor) await requireOrderKey(req, res, order)

  if (order.status !== 'PENDING' && order.status !== 'PAID') {
    fail(res, 400, 'This order can no longer be changed')
  }

  // Customers add items under the same rules as placing an order.
  if (
    !isVendor &&
    (!cart ||
      cart.suspendedAt ||
      !cart.isActive ||
      !cart.isOpen ||
      (await paymentLock.getCartPaymentStatus(cart._id)).isLocked)
  ) {
    fail(res, 403, 'This cart is not taking orders right now')
  }

  const items = await buildOrderItems(
    res,
    order.cartId,
    orderItems,
    order.orderItems,
  )

  const parcel =
    isVendor && parcelCharge !== undefined
      ? parseParcelCharge(res, parcelCharge)
      : order.parcelCharge || 0

  const totals = orderTotals(items, parcel)
  const paidAmount = amountPaid(order)
  const difference = totals.totalPrice - paidAmount

  if (!isVendor && paidAmount > 0 && difference < 0) {
    fail(res, 400, 'Ask the cart to remove items from a paid order')
  }

  // Only money already collected needs settling; an unpaid order just gets
  // a new total.
  const paymentAdjustment =
    paidAmount > 0 && difference !== 0
      ? {
          oldTotal: paidAmount,
          newTotal: totals.totalPrice,
          difference,
          action: difference > 0 ? 'COLLECT' : 'RETURN',
          amount: Math.abs(difference),
        }
      : null

  Object.assign(order, totals, { orderItems: items, paymentAdjustment })
  order.paidAmount = paidAmount

  if (paidAmount > 0 && difference > 0) {
    // The extra must be collected before the order continues.
    order.status = 'PENDING'
  } else if (paidAmount > 0) {
    // Covered by what was paid (e.g. an added item taken off again): paid
    // again. The vendor hands back any difference, so the total is what's paid.
    order.status = 'PAID'
    order.paidAmount = totals.totalPrice
  }

  await order.save()

  emitOrder(req, order)

  res.status(200).json({
    success: true,
    message: 'Order updated successfully',
    data: order,
    paymentAdjustment,
  })
})

exports.undoDeleteOrder = asyncHandler(async (req, res) => {
  const order = await findManagedOrder(req, res, req.params.orderId)

  if (order.status !== 'CANCELLED') {
    fail(res, 400, 'This order is not cancelled')
  }

  // Back to PAID only if the customer paid the whole total. paidAt alone
  // isn't proof: it is kept when an order on a billed day is marked unpaid.
  const paid = order.paidAmount ?? (order.paidAt ? order.totalPrice : 0)
  order.status = paid >= order.totalPrice ? 'PAID' : 'PENDING'
  order.paymentAdjustment = null
  await order.save()

  emitOrder(req, order)

  res.status(200).json({
    success: true,
    data: order,
    message: 'Order restored',
  })
})

/*
 * Cancels an order. Customers (no login) may cancel only while it is
 * unpaid; the vendor app may also cancel paid orders, which records the
 * refund to hand back.
 */
exports.deleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId)
  if (!order) fail(res, 404, 'Order not found')

  const isVendor = await managesOrderCart(req, order)
  if (!isVendor) await requireOrderKey(req, res, order)

  if (order.status !== 'PENDING' && order.status !== 'PAID') {
    fail(res, 400, 'This order can no longer be cancelled')
  }

  // An order edited after payment is PENDING but partly paid: customers
  // may cancel only orders they have paid nothing for.
  const paid = amountPaid(order)
  if (!isVendor && paid > 0) {
    fail(res, 400, 'This order is already paid. Ask the cart to cancel it.')
  }

  const paymentAdjustment =
    paid > 0
      ? {
          oldTotal: paid,
          newTotal: 0,
          difference: -paid,
          action: 'RETURN',
          amount: paid,
        }
      : null

  order.status = 'CANCELLED'
  order.paymentAdjustment = paymentAdjustment
  await order.save()

  emitOrder(req, order, 'order_cancelled')

  res.status(200).json({
    success: true,
    message: 'Order deleted successfully',
    data: order,
    paymentAdjustment,
  })
})

/*
 * The vendor marks a paid order as being cooked (preparing: true) or takes
 * that back (false). Optional: orders can go straight from PAID to SERVED.
 */
exports.setPreparing = asyncHandler(async (req, res) => {
  const order = await findManagedOrder(req, res, req.params.orderId)
  const { preparing } = req.body || {}

  if (typeof preparing !== 'boolean') fail(res, 400, 'preparing must be true or false')
  if (order.status !== 'PAID') fail(res, 400, 'Only paid orders can be prepared')

  order.preparingAt = preparing ? order.preparingAt || new Date() : null
  await order.save()

  emitOrder(req, order)

  res.status(200).json({ success: true, data: order })
})

/*
 * Where an order stands in its cart's queue, for the customer's token page
 * (no login; the customer sends the order's key). Only token numbers of
 * other orders are returned, never their details.
 *
 * The queue is the cart's paid, unserved orders in the order they were
 * paid: cooking starts after payment. `ahead` counts those paid before
 * this one, so it is an estimate if the vendor cooks out of order.
 */
exports.getQueue = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId)
    .select('cartId status paidAt preparingAt')
    .lean()
  if (!order) fail(res, 404, 'Order not found')
  await requireOrderKey(req, res, order)

  const queue = await Order.find({
    cartId: order.cartId,
    status: 'PAID',
    paidAt: { $gte: new Date(Date.now() - QUEUE_HOURS * 3600e3) },
  })
    .select('orderNumber paidAt preparingAt')
    .sort({ paidAt: 1, _id: 1 })
    .lean()

  const preparing = queue
    .filter((o) => o.preparingAt)
    .sort((a, b) => a.preparingAt - b.preparingAt)
    .map((o) => o.orderNumber)
  const mine = queue.findIndex((o) => String(o._id) === String(order._id))

  res.status(200).json({
    success: true,
    data: {
      preparing,
      // With nothing marked, the oldest paid order is the one up next.
      nextUp: preparing.length ? null : queue[0]?.orderNumber ?? null,
      waiting: queue.length,
      isPreparing: mine !== -1 && Boolean(order.preparingAt),
      ahead: mine === -1 ? null : mine,
    },
  })
})

exports.getTruthLine = asyncHandler(async (req, res) => {
  const truthLine = await TruthLine.aggregate([{ $sample: { size: 1 } }])

  if (!truthLine || truthLine.length === 0) {
    res.status(404)
    throw new Error('No truth lines found')
  }

  res.status(200).json({
    success: true,
    data: truthLine[0],
  })
})

exports.submitOrderFeedback = asyncHandler(async (req, res) => {
  const { orderNumber } = req.params
  const { feedback, rating } = req.body

  // A star rating, some words, or both.
  const text = feedback === undefined || feedback === null ? '' : feedback
  if (typeof text !== 'string') fail(res, 400, 'Feedback must be text')
  if (rating != null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
    fail(res, 400, 'Rating must be 1 to 5 stars')
  }
  if (!text.trim() && rating == null) fail(res, 400, 'Add a rating or some feedback')

  const order = await Order.findById(orderNumber)
  if (!order) fail(res, 404, 'Order not found')
  await requireOrderKey(req, res, order)
  // Only food that was handed over can be rated.
  if (order.status !== 'SERVED') fail(res, 400, 'You can rate an order once it is served')

  if (text.trim()) order.feedback = text.trim().slice(0, 500)
  if (rating != null) order.rating = rating

  await order.save()

  res.status(200).json({
    success: true,
    message: 'Feedback submitted successfully',
    data: order,
  })
})

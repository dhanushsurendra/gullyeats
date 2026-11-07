const mongoose = require('mongoose')
const asyncHandler = require('../utils/asyncHandler')
const Order = require('../models/Order')
const Cart = require('../models/Cart')
const MenuItem = require('../models/Menu')
const TruthLine = require('../models/TruthLine')
const getNextOrderNumber = require('../utils/getNextOrderNumber')
const { canManageCart, findManagedCart, findManagedOrder } = require('../utils/cartAccess')
const Payment = require('../models/Payment')
const { getISTMidnight } = require('../utils/cartPaymentLock')

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

// Tells the customer's order page and every vendor device about a change.
function emitOrder(req, order, event = 'order_updated') {
  req.io.to(`order:${order._id}`).emit(event, order)
  req.io.to(order.cartId.toString()).emit(event, order)
}

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
        price: old.price,
        quantity,
      }
    }

    const item = menuById.get(id)
    if (!item) fail(res, 400, 'Some items are no longer on the menu')
    if (item.isInStock === false) fail(res, 400, `${item.name} is out of stock`)

    return { menuItemId: item._id, name: item.name, price: item.price, quantity }
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
  })

  req.io.to(cart._id.toString()).emit('new_order_received', order)

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

  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

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

  const isVendor = await managesOrderCart(req, order)

  if (order.status !== 'PENDING' && order.status !== 'PAID') {
    fail(res, 400, 'This order can no longer be changed')
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
  } else if (paidAmount > 0 && difference < 0) {
    // The vendor hands back the difference, so the new total is what's paid.
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

  order.status = order.paidAt != null ? 'PAID' : 'PENDING'
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

  const allowed = isVendor ? ['PENDING', 'PAID'] : ['PENDING']
  if (!allowed.includes(order.status)) {
    fail(
      res,
      400,
      order.status === 'PAID'
        ? 'This order is already paid. Ask the cart to cancel it.'
        : 'This order can no longer be cancelled',
    )
  }

  const paid = amountPaid(order)
  const paymentAdjustment =
    order.status === 'PAID' && paid > 0
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
  const { feedback } = req.body

  if (!feedback?.trim()) {
    res.status(400)
    throw new Error('Feedback is required')
  }

  const order = await Order.findById(orderNumber)

  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  order.feedback = feedback.trim()

  await order.save()

  res.status(200).json({
    success: true,
    message: 'Feedback submitted successfully',
    data: order,
  })
})

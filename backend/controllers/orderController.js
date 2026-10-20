const asyncHandler = require('../utils/asyncHandler')
const Order = require('../models/Order')
const MenuItem = require('../models/Menu')
const TruthLine = require('../models/TruthLine')
const getNextOrderNumber = require('../utils/getNextOrderNumber')

exports.createOrder = asyncHandler(async (req, res) => {
  let {
    cartId,
    orderItems,
    status,
    orderType,
    subtotal,
    parcelCharge,
    platformFee,
    totalPrice,
    phoneNumber,
  } = req.body

  if (!cartId) {
    res.status(400)
    throw new Error('cartId is required')
  }

  if (!orderItems || orderItems.length === 0) {
    res.status(400)
    throw new Error('Cart is empty')
  }

  const { orderNumber } = await getNextOrderNumber(cartId)

  const order = await Order.create({
    cartId,
    orderNumber,
    orderItems,
    totalPrice,
    subtotal,
    orderType,
    parcelCharge,
    platformFee,
    phoneNumber: phoneNumber || null,
    status,
    paidAt: status === 'PAID' ? new Date() : null,
  })

  req.io.to(cartId.toString()).emit('new_order_received', order)

  res.status(201).json({
    success: true,
    data: order,
  })
})

exports.getOrdersForToday = asyncHandler(async (req, res) => {
  const { cartId } = req.params

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
  console.log('startDate:', startDate)
  console.log('endDate:', endDate)

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

  console.log('Received query parameters:', filter)
  const orders = await Order.find(filter).sort({ createdAt: -1 }).lean()

  console.log('Fetched orders:', orders)

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
  const order = await Order.findById(req.params.orderId)

  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  order.status = 'SERVED'
  order.servedAt = new Date()

  await order.save()

  // Push update to customers in this cart
  req.io.to(`order:${order._id}`).emit('order_updated', order)
  req.io.to(order.cartId.toString()).emit('order_updated', order)

  res.status(200).json({
    success: true,
    message: 'Order marked as served',
    data: order,
  })
})

exports.serveOrderUndo = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId)

  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  order.status = 'PAID'
  order.servedAt = null
  await order.save()

  req.io.to(`order:${order._id}`).emit('order_updated', order)

  res.status(200).json({
    success: true,
    message: 'Serve order undone',
    data: order,
  })
})

exports.markOrderPaid = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId)

  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  order.status = 'PAID'
  order.paidAt = new Date()
  order.paymentAdjustment = null
  await order.save()

  req.io.to(`order:${order._id}`).emit('order_updated', order)

  res.status(200).json({
    success: true,
    message: 'Payment confirmed',
    data: order,
  })
})

exports.markOrderUnpaid = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId)

  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  order.status = 'PENDING'
  order.paidAt = null
  await order.save()

  req.io.to(`order:${order._id}`).emit('order_updated', order)

  res.status(200).json({
    success: true,
    message: 'Marked unpaid',
    data: order,
  })
})

exports.updateOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params

  const { orderItems, subtotal, platformFee, parcelCharge, totalPrice } =
    req.body

  const existingOrder = await Order.findById(orderId)

  if (!existingOrder) {
    res.status(404)
    throw new Error('Order not found')
  }

  const newTotal = Number(totalPrice)

  // Money that has actually been paid/settled.
  const paidAmount = Number(existingOrder.paidAmount || 0)

  /*
   * Compare the new order total against the amount
   * that has actually been paid.
   */
  const difference = newTotal - paidAmount

  let action = 'NONE'

  if (difference > 0) {
    action = 'COLLECT'
  } else if (difference < 0) {
    action = 'RETURN'
  }

  const paymentAdjustment = {
    oldTotal: paidAmount,
    newTotal,
    difference,
    action,
    amount: Math.abs(difference),
  }

  /*
   * If there is money to collect, payment is required
   * before the order can continue preparing.
   */
  const updatedStatus = difference > 0 ? 'PENDING' : existingOrder.status

  const order = await Order.findByIdAndUpdate(
    orderId,
    {
      $set: {
        orderItems,
        subtotal,
        platformFee,
        parcelCharge,
        totalPrice: newTotal,
        status: updatedStatus,
        paymentAdjustment,
      },
    },
    {
      returnDocument: 'after',
      runValidators: true,
    },
  )

  req.io.to(existingOrder.cartId.toString()).emit('order_updated', order)

  res.status(200).json({
    success: true,
    message: 'Order updated successfully',
    data: order,
    paymentAdjustment,
  })
})

exports.undoDeleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId)

  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  console.log(order.paidAt)

  if (order.paidAt != null) {
    order.status = 'PAID'
  } else {
    order.status = 'PENDING'
  }

  order.paymentAdjustment = null

  await order.save()

  res.status(200).json({
    success: true,
    data: order,
    message: 'Order deleted successfully',
  })
})

exports.deleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId)

  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  let paymentAdjustment = null

  // Only create a refund adjustment if the order was paid.
  if (order.status === 'PAID') {
    paymentAdjustment = {
      oldTotal: order.totalPrice,
      newTotal: 0,
      difference: -order.totalPrice,
      action: 'RETURN',
      amount: order.totalPrice,
    }
  }

  order.status = 'CANCELLED'
  order.paymentAdjustment = paymentAdjustment

  await order.save()

  req.io.to(`order:${order._id}`).emit('order_cancelled', order)

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

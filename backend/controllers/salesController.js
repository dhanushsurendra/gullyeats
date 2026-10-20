const mongoose = require('mongoose')
const asyncHandler = require('../utils/asyncHandler')
const Order = require('../models/Order')

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return null
  }

  if (seconds < 60) {
    return `${Math.round(seconds)} sec`
  }

  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return secs > 0 ? `${mins} min ${secs} sec` : `${mins} min`
  }

  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hrs} hr ${mins} min`
}

function safeDivide(numerator, denominator) {
  if (!denominator) return 0
  return numerator / denominator
}

exports.getSalesDashboard = asyncHandler(async (req, res) => {
  const cartId = req.params.cartId
  const { startDate, endDate } = req.query

  if (!cartId) {
    return res
      .status(400)
      .json({ success: false, message: 'cartId is required' })
  }

  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ success: false, message: 'startDate and endDate are required' })
  }

  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  const orders = await Order.find({
    createdAt: {
      $gte: start,
      $lte: end,
    },
  })

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid startDate or endDate' })
  }

  let cartObjectId
  try {
    cartObjectId = new mongoose.Types.ObjectId(cartId)
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Invalid cartId' })
  }

  const dateMatch = {
    cartId: cartObjectId,
    createdAt: { $gte: start, $lte: end },
  }

  // Anything that represents money/items sold should exclude CANCELLED
  // orders. Anything that represents order *counts/status* should keep them,
  // otherwise cancellationRate can never be calculated.
  const excludeCancelled = { status: { $ne: 'CANCELLED' } }

  const [result] = await Order.aggregate([
    { $match: dateMatch },
    {
      $facet: {
        // ---- 1. order status counts (based on ALL orders in range) ----
        statusMetrics: [
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              pendingOrders: {
                $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] },
              },
              paidOrders: {
                $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, 1, 0] },
              },
              servedOrders: {
                $sum: { $cond: [{ $eq: ['$status', 'SERVED'] }, 1, 0] },
              },
              cancelledOrders: {
                $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] },
              },
            },
          },
        ],

        // ---- 2. revenue summary (excludes CANCELLED) ----
        summary: [
          { $match: excludeCancelled },
          {
            $group: {
              _id: null,
              revenue: { $sum: '$totalPrice' },
              validOrders: { $sum: 1 },
              highestOrder: { $max: '$totalPrice' },
              lowestOrder: { $min: '$totalPrice' },
            },
          },
        ],

        // ---- 3. revenue breakdown (excludes CANCELLED) ----
        revenueBreakdown: [
          { $match: excludeCancelled },
          {
            $group: {
              _id: null,
              subtotalRevenue: { $sum: '$subtotal' },
              parcelRevenue: { $sum: '$parcelCharge' },
              platformFeeRevenue: { $sum: '$platformFee' },
              qrRevenue: {
                $sum: {
                  $cond: [{ $eq: ['$orderType', 'QR'] }, '$totalPrice', 0],
                },
              },
              manualRevenue: {
                $sum: {
                  $cond: [{ $eq: ['$orderType', 'MANUAL'] }, '$totalPrice', 0],
                },
              },
              qrOrders: {
                $sum: { $cond: [{ $eq: ['$orderType', 'QR'] }, 1, 0] },
              },
              manualOrders: {
                $sum: { $cond: [{ $eq: ['$orderType', 'MANUAL'] }, 1, 0] },
              },
              parcelOrders: {
                $sum: { $cond: [{ $gt: ['$parcelCharge', 0] }, 1, 0] },
              },
            },
          },
        ],

        // ---- 4. item level metrics (excludes CANCELLED) ----
        itemMetrics: [
          { $match: excludeCancelled },
          { $unwind: '$orderItems' },
          {
            $group: {
              _id: null,
              totalItemsSold: { $sum: '$orderItems.quantity' },
              uniqueItemsSold: { $addToSet: '$orderItems.name' },
              highestItemsInOrder: { $max: '$orderItems.quantity' },
            },
          },
          {
            $project: {
              _id: 0,
              totalItemsSold: 1,
              highestItemsInOrder: 1,
              uniqueItemsSold: { $size: '$uniqueItemsSold' },
            },
          },
        ],

        // ---- 5. top 5 items by revenue (excludes CANCELLED) ----
        topItems: [
          { $match: excludeCancelled },
          { $unwind: '$orderItems' },
          {
            $group: {
              _id: '$orderItems.name',
              revenue: {
                $sum: {
                  $multiply: ['$orderItems.price', '$orderItems.quantity'],
                },
              },
              qty: { $sum: '$orderItems.quantity' },
            },
          },
          { $sort: { revenue: -1 } },
          { $limit: 5 },
          { $project: { _id: 0, name: '$_id', revenue: 1, qty: 1 } },
        ],

        // ---- 6. bottom 5 items by revenue (excludes CANCELLED) ----
        bottomItems: [
          { $match: excludeCancelled },
          { $unwind: '$orderItems' },
          {
            $group: {
              _id: '$orderItems.name',
              revenue: {
                $sum: {
                  $multiply: ['$orderItems.price', '$orderItems.quantity'],
                },
              },
              qty: { $sum: '$orderItems.quantity' },
            },
          },
          { $sort: { revenue: 1 } },
          { $limit: 5 },
          { $project: { _id: 0, name: '$_id', revenue: 1, qty: 1 } },
        ],

        // ---- 7. top item by volume (qty sold) (excludes CANCELLED) ----
        topVolumeItem: [
          { $match: excludeCancelled },
          { $unwind: '$orderItems' },
          {
            $group: {
              _id: '$orderItems.name',
              qty: { $sum: '$orderItems.quantity' },
            },
          },
          { $sort: { qty: -1 } },
          { $limit: 1 },
          { $project: { _id: 0, name: '$_id', qty: 1 } },
        ],

        // ---- 8. prep time metrics ----
        prepMetrics: [
          {
            $match: {
              ...excludeCancelled,
              servedAt: { $exists: true, $ne: null },
            },
          },
          {
            $project: {
              prepTime: {
                $divide: [{ $subtract: ['$servedAt', '$createdAt'] }, 1000],
              },
            },
          },
          {
            $group: {
              _id: null,
              avgPrepTime: { $avg: '$prepTime' },
              fastestOrderTime: { $min: '$prepTime' },
              slowestOrderTime: { $max: '$prepTime' },
            },
          },
        ],

        // ---- 9. payment metrics ----
        paymentMetrics: [
          {
            $match: {
              ...excludeCancelled,
              paidAt: { $exists: true, $ne: null },
            },
          },
          {
            $project: {
              paymentTime: {
                $divide: [{ $subtract: ['$paidAt', '$createdAt'] }, 1000],
              },
              serveAfterPayment: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$paidAt', null] },
                      { $ne: ['$servedAt', null] },
                    ],
                  },
                  { $divide: [{ $subtract: ['$servedAt', '$paidAt'] }, 1000] },
                  null,
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              avgPaymentTime: { $avg: '$paymentTime' },
              avgServeTimeAfterPayment: { $avg: '$serveAfterPayment' },
            },
          },
        ],

        // ---- 10. top 5 busiest hours of day (excludes CANCELLED) ----
        busyHours: [
          { $match: excludeCancelled },
          {
            $group: {
              _id: {
                $hour: {
                  date: '$createdAt',
                  timezone: 'Asia/Kolkata',
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 5 },
          { $sort: { _id: 1 } }, 
          {
            $project: {
              _id: 0,
              hour: '$_id',
              count: 1,
            },
          },
        ],

        // ---- 11. raw timestamps for "average time between orders" ----
        orderTimestamps: [
          { $match: excludeCancelled },
          { $sort: { createdAt: 1 } },
          { $project: { _id: 0, createdAt: 1 } },
        ],
      },
    },
  ])

  const statusMetrics = result.statusMetrics[0] || {
    totalOrders: 0,
    pendingOrders: 0,
    paidOrders: 0,
    servedOrders: 0,
    cancelledOrders: 0,
  }

  const summary = result.summary[0] || {
    revenue: 0,
    validOrders: 0,
    highestOrder: 0,
    lowestOrder: 0,
  }
  const revenueBreakdown = result.revenueBreakdown[0] || {
    subtotalRevenue: 0,
    parcelRevenue: 0,
    platformFeeRevenue: 0,
    qrRevenue: 0,
    manualRevenue: 0,
    qrOrders: 0,
    manualOrders: 0,
    parcelOrders: 0,
  }
  const itemMetrics = result.itemMetrics[0] || {
    totalItemsSold: 0,
    uniqueItemsSold: 0,
    highestItemsInOrder: 0,
  }
  const prepMetrics = result.prepMetrics[0] || {
    avgPrepTime: null,
    fastestOrderTime: null,
    slowestOrderTime: null,
  }
  const paymentMetrics = result.paymentMetrics[0] || {
    avgPaymentTime: null,
    avgServeTimeAfterPayment: null,
  }
  const topItems = result.topItems || []
  const bottomItems = result.bottomItems || []
  const topVolumeItem = result.topVolumeItem[0] || null
  const busyHours = result.busyHours || []
  const orderTimestamps = (result.orderTimestamps || []).map((o) => o.createdAt)

  const {
    totalOrders,
    pendingOrders,
    paidOrders,
    servedOrders,
    cancelledOrders,
  } = statusMetrics
  const { revenue, validOrders, highestOrder, lowestOrder } = summary
  const {
    subtotalRevenue,
    parcelRevenue,
    platformFeeRevenue,
    qrRevenue,
    manualRevenue,
    qrOrders,
    manualOrders,
    parcelOrders,
  } = revenueBreakdown
  const { totalItemsSold, uniqueItemsSold, highestItemsInOrder } = itemMetrics
  const { avgPrepTime, fastestOrderTime, slowestOrderTime } = prepMetrics
  const { avgPaymentTime, avgServeTimeAfterPayment } = paymentMetrics

  // ---- derived rates & averages ----
  const completionRate = safeDivide(servedOrders, totalOrders) * 100
  const paymentRate = safeDivide(paidOrders, totalOrders) * 100
  const cancellationRate = safeDivide(cancelledOrders, totalOrders) * 100

  const netRevenue = revenue - (platformFeeRevenue || 0)
  const avgOrderValue = safeDivide(revenue, validOrders)
  const revenuePerOrder = safeDivide(revenue, totalOrders)
  const avgItemsPerOrder = safeDivide(totalItemsSold, validOrders)
  const avgParcelCharge = safeDivide(parcelRevenue, parcelOrders)

  const topRevenueItem = topItems[0] || null

  const peakHour = busyHours.length > 0 ? busyHours[0].hour : null

  let averageTimeBetweenOrders = null
  if (orderTimestamps.length > 1) {
    let totalGapSeconds = 0
    for (let i = 1; i < orderTimestamps.length; i++) {
      totalGapSeconds +=
        (new Date(orderTimestamps[i]) - new Date(orderTimestamps[i - 1])) / 1000
    }
    averageTimeBetweenOrders = totalGapSeconds / (orderTimestamps.length - 1)
  }

  res.json({
    success: true,
    data: {
      // revenue
      revenue: Math.round(revenue),
      subtotalRevenue,
      parcelRevenue,
      platformFeeRevenue,
      netRevenue,

      // order counts
      totalOrders,
      pendingOrders,
      paidOrders,
      servedOrders,
      cancelledOrders,

      // rates
      completionRate,
      cancellationRate,
      paymentRate,

      // order value
      avgOrderValue,
      highestOrder,
      lowestOrder,
      revenuePerOrder,

      // items
      totalItemsSold,
      avgItemsPerOrder,
      highestItemsInOrder,
      uniqueItemsSold,

      // prep / payment timings
      avgPrepTime: formatDuration(avgPrepTime),
      fastestOrder: formatDuration(fastestOrderTime),
      slowestOrder: formatDuration(slowestOrderTime),
      avgPaymentTime: formatDuration(avgPaymentTime),
      avgServeAfterPaymentTime: formatDuration(avgServeTimeAfterPayment),

      // timing patterns
      peakHour,
      busyHours,
      averageTimeBetweenOrders: formatDuration(averageTimeBetweenOrders),

      // order type breakdown
      qrOrders,
      manualOrders,
      qrRevenue,
      manualRevenue,

      // parcel
      parcelOrders,
      avgParcelCharge,

      // top/bottom items
      topRevenueItem: topRevenueItem ? topRevenueItem.name : null,
      topVolumeItem: topVolumeItem ? topVolumeItem.name : null,
      topItems,
      bottomItems,
    },
  })
})

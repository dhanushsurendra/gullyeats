const mongoose = require('mongoose')
const asyncHandler = require('../utils/asyncHandler')
const Order = require('../models/Order')
const MenuItem = require('../models/Menu')
const { findOwnedCart } = require('../utils/cartAccess')

const TZ = 'Asia/Kolkata'

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

// Money the vendor actually received: orders are served only after payment.
const paidOnly = { status: { $in: ['PAID', 'SERVED'] } }
const notCancelled = { status: { $ne: 'CANCELLED' } }
const secondsBetween = (from, to) => ({
  $divide: [{ $subtract: [to, from] }, 1000],
})

// One row per menu item, so a renamed item stays one row under its latest
// name. Old lines without an ID fall back to their name.
const itemsByMenuItem = [
  { $match: paidOnly },
  { $sort: { createdAt: 1 } },
  { $unwind: '$orderItems' },
  {
    $group: {
      _id: { $ifNull: ['$orderItems.menuItemId', '$orderItems.name'] },
      name: { $last: '$orderItems.name' },
      revenue: {
        $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] },
      },
      qty: { $sum: '$orderItems.quantity' },
    },
  },
]
const itemFields = { $project: { _id: 0, name: 1, revenue: 1, qty: 1 } }

/**
 * The sales dashboard pipeline for one cart's orders in [start, end].
 * Revenue, items and order values count only paid orders (PAID or SERVED);
 * order counts and rates count every order, so cancellations show up.
 */
function salesPipeline(cartId, start, end) {
  return [
    {
      $match: {
        cartId: new mongoose.Types.ObjectId(cartId),
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $facet: {
        statusMetrics: [
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              pendingOrders: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
              paidOrders: { $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, 1, 0] } },
              servedOrders: { $sum: { $cond: [{ $eq: ['$status', 'SERVED'] }, 1, 0] } },
              cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
            },
          },
        ],

        // Revenue and order values, with each order's total item count, so
        // "max in one order" is the biggest order rather than the biggest line.
        paidOrders: [
          { $match: paidOnly },
          {
            $group: {
              _id: null,
              orders: { $sum: 1 },
              revenue: { $sum: '$totalPrice' },
              highestOrder: { $max: '$totalPrice' },
              lowestOrder: { $min: '$totalPrice' },
              subtotalRevenue: { $sum: '$subtotal' },
              parcelRevenue: { $sum: { $ifNull: ['$parcelCharge', 0] } },
              platformFeeRevenue: { $sum: '$platformFee' },
              qrRevenue: { $sum: { $cond: [{ $eq: ['$orderType', 'QR'] }, '$totalPrice', 0] } },
              manualRevenue: { $sum: { $cond: [{ $eq: ['$orderType', 'MANUAL'] }, '$totalPrice', 0] } },
              qrOrders: { $sum: { $cond: [{ $eq: ['$orderType', 'QR'] }, 1, 0] } },
              manualOrders: { $sum: { $cond: [{ $eq: ['$orderType', 'MANUAL'] }, 1, 0] } },
              parcelOrders: { $sum: { $cond: [{ $gt: ['$parcelCharge', 0] }, 1, 0] } },
              totalItemsSold: { $sum: { $sum: '$orderItems.quantity' } },
              highestItemsInOrder: { $max: { $sum: '$orderItems.quantity' } },
              avgPrepTime: {
                $avg: {
                  $cond: ['$servedAt', secondsBetween('$createdAt', '$servedAt'), null],
                },
              },
              fastestOrderTime: {
                $min: {
                  $cond: ['$servedAt', secondsBetween('$createdAt', '$servedAt'), null],
                },
              },
              slowestOrderTime: {
                $max: {
                  $cond: ['$servedAt', secondsBetween('$createdAt', '$servedAt'), null],
                },
              },
              avgPaymentTime: {
                $avg: {
                  $cond: ['$paidAt', secondsBetween('$createdAt', '$paidAt'), null],
                },
              },
              avgServeTimeAfterPayment: {
                $avg: {
                  $cond: [
                    { $and: ['$paidAt', '$servedAt'] },
                    secondsBetween('$paidAt', '$servedAt'),
                    null,
                  ],
                },
              },
            },
          },
        ],

        topItems: [...itemsByMenuItem, { $sort: { revenue: -1, name: 1 } }, { $limit: 5 }, itemFields],
        bottomItems: [...itemsByMenuItem, { $sort: { revenue: 1, name: 1 } }, { $limit: 5 }, itemFields],
        topVolumeItem: [...itemsByMenuItem, { $sort: { qty: -1, name: 1 } }, { $limit: 1 }, itemFields],
        uniqueItems: [...itemsByMenuItem, { $count: 'count' }],
        soldIds: [...itemsByMenuItem, { $project: { _id: 1 } }],

        // Money that never arrived: orders left unpaid, and cancelled ones.
        lost: [
          { $match: { status: { $in: ['PENDING', 'CANCELLED'] } } },
          { $group: { _id: '$status', value: { $sum: '$totalPrice' }, count: { $sum: 1 } } },
        ],

        // Paid revenue per IST day, for the trend chart.
        byDay: [
          { $match: paidOnly },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } },
              revenue: { $sum: '$totalPrice' },
              orders: { $sum: 1 },
            },
          },
        ],

        // Paying customers who gave a number; returning ones are found after.
        phones: [
          { $match: { ...paidOnly, phoneNumber: { $nin: [null, ''] } } },
          { $group: { _id: '$phoneNumber' } },
        ],

        // Busy hours count every order that wasn't cancelled: it is about
        // traffic. Busiest first, so the first row is the peak.
        busyHours: [
          { $match: notCancelled },
          {
            $group: {
              _id: { $hour: { date: '$createdAt', timezone: TZ } },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1, _id: 1 } },
          { $project: { _id: 0, hour: '$_id', count: 1 } },
        ],

        // Gaps between consecutive orders on the same IST day; the overnight
        // gap isn't time between orders.
        orderGaps: [
          { $match: notCancelled },
          {
            $setWindowFields: {
              partitionBy: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ },
              },
              sortBy: { createdAt: 1 },
              output: {
                previous: { $shift: { output: '$createdAt', by: -1, default: null } },
              },
            },
          },
          { $match: { previous: { $ne: null } } },
          {
            $group: {
              _id: null,
              averageGap: { $avg: secondsBetween('$previous', '$createdAt') },
            },
          },
        ],
      },
    },
  ]
}

/** Turns the pipeline's single result document into the dashboard fields. */
function toSalesReport(result) {
  const status = result.statusMetrics[0] || {}
  const paid = result.paidOrders[0] || {}
  const n = (value) => value || 0

  const totalOrders = n(status.totalOrders)
  const paidCount = n(paid.orders)
  const revenue = n(paid.revenue)
  const platformFeeRevenue = n(paid.platformFeeRevenue)
  const parcelRevenue = n(paid.parcelRevenue)
  const busiest = result.busyHours || []
  const lost = Object.fromEntries((result.lost || []).map((r) => [r._id, r]))

  return {
    // revenue
    revenue: Math.round(revenue),
    subtotalRevenue: n(paid.subtotalRevenue),
    parcelRevenue,
    platformFeeRevenue,
    netRevenue: revenue - platformFeeRevenue,

    // order counts
    totalOrders,
    pendingOrders: n(status.pendingOrders),
    paidOrders: n(status.paidOrders),
    servedOrders: n(status.servedOrders),
    cancelledOrders: n(status.cancelledOrders),

    // rates; served orders were paid first, so they count as paid
    completionRate: safeDivide(n(status.servedOrders), totalOrders) * 100,
    cancellationRate: safeDivide(n(status.cancelledOrders), totalOrders) * 100,
    paymentRate: safeDivide(paidCount, totalOrders) * 100,

    // order value
    avgOrderValue: safeDivide(revenue, paidCount),
    highestOrder: n(paid.highestOrder),
    lowestOrder: n(paid.lowestOrder),
    revenuePerOrder: safeDivide(revenue, totalOrders),

    // items
    totalItemsSold: n(paid.totalItemsSold),
    avgItemsPerOrder: safeDivide(n(paid.totalItemsSold), paidCount),
    highestItemsInOrder: n(paid.highestItemsInOrder),
    uniqueItemsSold: result.uniqueItems[0]?.count || 0,

    // prep / payment timings
    avgPrepTime: formatDuration(paid.avgPrepTime),
    fastestOrder: formatDuration(paid.fastestOrderTime),
    slowestOrder: formatDuration(paid.slowestOrderTime),
    avgPaymentTime: formatDuration(paid.avgPaymentTime),
    avgServeAfterPaymentTime: formatDuration(paid.avgServeTimeAfterPayment),

    // timing patterns: the peak is the busiest hour; the chart wants the
    // hours in time order
    peakHour: busiest.length ? busiest[0].hour : null,
    // Older apps chart these top 5; hours is every hour from the first order
    // to the last, quiet ones as 0, so the chart doesn't hide the gaps.
    busyHours: busiest.slice(0, 5).sort((a, b) => a.hour - b.hour),
    hours: fillHours(busiest),
    averageTimeBetweenOrders: formatDuration(result.orderGaps[0]?.averageGap),

    // order type breakdown
    qrOrders: n(paid.qrOrders),
    manualOrders: n(paid.manualOrders),
    qrRevenue: n(paid.qrRevenue),
    manualRevenue: n(paid.manualRevenue),

    // parcel
    parcelOrders: n(paid.parcelOrders),
    avgParcelCharge: safeDivide(parcelRevenue, n(paid.parcelOrders)),

    // top/bottom items
    topRevenueItem: result.topItems[0]?.name ?? null,
    topVolumeItem: result.topVolumeItem[0]?.name ?? null,
    topItems: result.topItems,
    bottomItems: result.bottomItems,

    // missed money
    unpaidValue: n(lost.PENDING?.value),
    cancelledValue: n(lost.CANCELLED?.value),

    avgWaitAfterPayment: formatDuration(paid.avgServeTimeAfterPayment),
  }
}

function fillHours(rows) {
  if (!rows.length) return []
  const count = new Map(rows.map((r) => [r.hour, r.count]))
  const hours = [...count.keys()]
  const out = []
  for (let h = Math.min(...hours); h <= Math.max(...hours); h++) out.push({ hour: h, count: count.get(h) || 0 })
  return out
}

const DAY_MS = 86400000
const istDay = (d) => new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10)

/** Every IST day in [start, end] with its paid revenue, 0 for quiet days. */
function fillDays(rows, start, end) {
  const by = new Map(rows.map((r) => [r._id, r]))
  const out = []
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const day = istDay(new Date(t))
    out.push({ day, revenue: by.get(day)?.revenue || 0, orders: by.get(day)?.orders || 0 })
  }
  return out
}

/**
 * What needs other queries: the same-length period just before (for the
 * comparison), how many paying customers had paid here before, menu items
 * that sold nothing, and the cart's all-time rating with its latest written
 * feedback (few customers rate, so one period rarely has enough).
 */
async function extras(cartId, start, end, result) {
  const id = new mongoose.Types.ObjectId(cartId)
  const length = end.getTime() + 1 - start.getTime()
  const phones = result.phones.map((p) => p._id)
  const sold = result.soldIds.map((r) => r._id).filter((v) => mongoose.isValidObjectId(v))

  const [prev, returning, unsold, rating, feedback] = await Promise.all([
    Order.aggregate([
      { $match: { cartId: id, ...paidOnly, createdAt: { $gte: new Date(start.getTime() - length), $lt: start } } },
      { $group: { _id: null, revenue: { $sum: '$totalPrice' }, orders: { $sum: 1 } } },
    ]),
    phones.length
      ? Order.distinct('phoneNumber', { cartId: id, ...paidOnly, createdAt: { $lt: start }, phoneNumber: { $in: phones } })
      : [],
    MenuItem.find({ cartId: id, _id: { $nin: sold } }).select('name').sort({ name: 1 }).lean(),
    Order.aggregate([
      { $match: { cartId: id, rating: { $gte: 1 } } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
    Order.find({ cartId: id, feedback: { $nin: [null, ''] } })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('feedback rating createdAt')
      .lean(),
  ])
  const p = prev[0] || {}
  return {
    previous: {
      revenue: p.revenue || 0,
      orders: p.orders || 0,
      avgOrderValue: safeDivide(p.revenue || 0, p.orders || 0),
    },
    days: fillDays(result.byDay, start, end),
    customers: phones.length,
    returningCustomers: returning.length,
    unsoldItems: unsold.map((m) => m.name),
    avgRating: rating[0] ? Math.round(rating[0].avg * 10) / 10 : null,
    ratingCount: rating[0]?.count || 0,
    // No phone or name: the vendor sees what was said, not who said it.
    recentFeedback: feedback.map((f) => ({ text: f.feedback, rating: f.rating || null, at: f.createdAt })),
  }
}

exports.getSalesDashboard = asyncHandler(async (req, res) => {
  const cartId = req.params.cartId
  const { startDate, endDate } = req.query

  if (!cartId || !mongoose.isValidObjectId(cartId)) {
    return res.status(400).json({ success: false, message: 'Invalid cartId' })
  }

  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ success: false, message: 'startDate and endDate are required' })
  }

  // Days are IST calendar days. Older app builds send DateTime.toString()
  // ("2026-11-06 00:00:00.000"), so only the date part is used.
  const startDay = String(startDate).slice(0, 10)
  const endDay = String(endDate).slice(0, 10)
  const start = new Date(`${startDay}T00:00:00.000+05:30`)
  const end = new Date(`${endDay}T23:59:59.999+05:30`)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid startDate or endDate' })
  }

  await findOwnedCart(req, res, cartId)

  const [result] = await Order.aggregate(salesPipeline(cartId, start, end))

  res.json({
    success: true,
    data: { ...toSalesReport(result), ...(await extras(cartId, start, end, result)) },
  })
})

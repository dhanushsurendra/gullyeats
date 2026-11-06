const mongoose = require('mongoose')
const asyncHandler = require('../utils/asyncHandler')
const Order = require('../models/Order')
const { findManagedCart } = require('../utils/cartAccess')

// Money the vendor actually received: orders are served only after payment.
const PAID_STATUSES = new Set(['PAID', 'SERVED'])

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

const sum = (values) => values.reduce((total, v) => total + (Number(v) || 0), 0)
const avg = (values) => (values.length ? sum(values) / values.length : null)
const seconds = (from, to) => (new Date(to) - new Date(from)) / 1000

const istParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})

function istDayAndHour(date) {
  const parts = Object.fromEntries(
    istParts.formatToParts(new Date(date)).map((p) => [p.type, p.value]),
  )
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) }
}

/**
 * The sales dashboard numbers for one cart's orders in the chosen period.
 * Revenue, items and order values count only paid orders (PAID or SERVED);
 * order counts and rates count every order, so cancellations show up.
 */
function buildSalesReport(orders) {
  const paid = orders.filter((o) => PAID_STATUSES.has(o.status))
  const notCancelled = orders.filter((o) => o.status !== 'CANCELLED')
  const count = (status) => orders.filter((o) => o.status === status).length

  const totalOrders = orders.length
  const pendingOrders = count('PENDING')
  const paidOrders = count('PAID')
  const servedOrders = count('SERVED')
  const cancelledOrders = count('CANCELLED')

  const revenue = sum(paid.map((o) => o.totalPrice))
  const subtotalRevenue = sum(paid.map((o) => o.subtotal))
  const parcelRevenue = sum(paid.map((o) => o.parcelCharge))
  const platformFeeRevenue = sum(paid.map((o) => o.platformFee))
  const totals = paid.map((o) => Number(o.totalPrice) || 0)

  const qr = paid.filter((o) => o.orderType === 'QR')
  const manual = paid.filter((o) => o.orderType === 'MANUAL')
  const parcel = paid.filter((o) => Number(o.parcelCharge) > 0)

  // Items are grouped by menu item, so a renamed item stays one row (under
  // its latest name). Old lines without an ID fall back to their name.
  const items = new Map()
  const itemsPerOrder = []
  for (const order of paid) {
    let inOrder = 0
    for (const line of order.orderItems || []) {
      const qty = Number(line.quantity) || 0
      const key = line.menuItemId ? String(line.menuItemId) : `name:${line.name}`
      const item = items.get(key) || { name: line.name, revenue: 0, qty: 0 }
      item.name = line.name
      item.revenue += (Number(line.price) || 0) * qty
      item.qty += qty
      items.set(key, item)
      inOrder += qty
    }
    itemsPerOrder.push(inOrder)
  }
  const itemList = [...items.values()]
  const byRevenue = [...itemList].sort((a, b) => b.revenue - a.revenue)
  const byVolume = [...itemList].sort((a, b) => b.qty - a.qty)
  const totalItemsSold = sum(itemsPerOrder)

  const served = paid.filter((o) => o.servedAt)
  const prepTimes = served.map((o) => seconds(o.createdAt, o.servedAt))
  const paidAt = paid.filter((o) => o.paidAt)
  const paymentTimes = paidAt.map((o) => seconds(o.createdAt, o.paidAt))
  const serveAfterPayment = paidAt
    .filter((o) => o.servedAt)
    .map((o) => seconds(o.paidAt, o.servedAt))

  // Busy hours count every order that wasn't cancelled: it is about traffic.
  const hourCounts = new Map()
  for (const order of notCancelled) {
    const { hour } = istDayAndHour(order.createdAt)
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
  }
  const busiest = [...hourCounts]
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => b.count - a.count || a.hour - b.hour)
    .slice(0, 5)
  // The peak is the busiest hour (the earliest, on a tie), taken before the
  // list is put back in time order for the chart.
  const peakHour = busiest.length ? busiest[0].hour : null
  const busyHours = [...busiest].sort((a, b) => a.hour - b.hour)

  // Gaps only within a day: the overnight gap isn't time between orders.
  const gaps = []
  const times = notCancelled
    .map((o) => new Date(o.createdAt))
    .sort((a, b) => a - b)
  for (let i = 1; i < times.length; i++) {
    if (istDayAndHour(times[i]).day === istDayAndHour(times[i - 1]).day) {
      gaps.push(seconds(times[i - 1], times[i]))
    }
  }

  return {
    // revenue
    revenue: Math.round(revenue),
    subtotalRevenue,
    parcelRevenue,
    platformFeeRevenue,
    netRevenue: revenue - platformFeeRevenue,

    // order counts
    totalOrders,
    pendingOrders,
    paidOrders,
    servedOrders,
    cancelledOrders,

    // rates
    completionRate: safeDivide(servedOrders, totalOrders) * 100,
    cancellationRate: safeDivide(cancelledOrders, totalOrders) * 100,
    paymentRate: safeDivide(paid.length, totalOrders) * 100,

    // order value
    avgOrderValue: safeDivide(revenue, paid.length),
    highestOrder: totals.length ? Math.max(...totals) : 0,
    lowestOrder: totals.length ? Math.min(...totals) : 0,
    revenuePerOrder: safeDivide(revenue, totalOrders),

    // items
    totalItemsSold,
    avgItemsPerOrder: safeDivide(totalItemsSold, paid.length),
    highestItemsInOrder: itemsPerOrder.length ? Math.max(...itemsPerOrder) : 0,
    uniqueItemsSold: itemList.length,

    // prep / payment timings
    avgPrepTime: formatDuration(avg(prepTimes)),
    fastestOrder: formatDuration(prepTimes.length ? Math.min(...prepTimes) : null),
    slowestOrder: formatDuration(prepTimes.length ? Math.max(...prepTimes) : null),
    avgPaymentTime: formatDuration(avg(paymentTimes)),
    avgServeAfterPaymentTime: formatDuration(avg(serveAfterPayment)),

    // timing patterns
    peakHour,
    busyHours,
    averageTimeBetweenOrders: formatDuration(avg(gaps)),

    // order type breakdown
    qrOrders: qr.length,
    manualOrders: manual.length,
    qrRevenue: sum(qr.map((o) => o.totalPrice)),
    manualRevenue: sum(manual.map((o) => o.totalPrice)),

    // parcel
    parcelOrders: parcel.length,
    avgParcelCharge: safeDivide(parcelRevenue, parcel.length),

    // top/bottom items
    topRevenueItem: byRevenue[0]?.name ?? null,
    topVolumeItem: byVolume[0]?.name ?? null,
    topItems: byRevenue.slice(0, 5),
    bottomItems: [...itemList].sort((a, b) => a.revenue - b.revenue).slice(0, 5),
  }
}

exports.buildSalesReport = buildSalesReport

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

  await findManagedCart(req, res, cartId)

  // shortcut: loads the period's orders and adds them up in Node, fine for a
  // street-food cart's volume; move the totals back into an aggregation if
  // a cart ever has tens of thousands of orders in a range.
  const orders = await Order.find({
    cartId,
    createdAt: { $gte: start, $lte: end },
  })
    .select(
      'status totalPrice subtotal parcelCharge platformFee orderType orderItems createdAt paidAt servedAt',
    )
    .lean()

  res.json({ success: true, data: buildSalesReport(orders) })
})

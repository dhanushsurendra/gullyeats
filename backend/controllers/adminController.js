// Platform-wide (super admin) queries. Drop into your backend next to cartController.js.
// Uses your existing models. NOTE: cart.location.coordinates is stored as [lat, lng] in your app.
const mongoose = require('mongoose')
const asyncHandler = require('../utils/asyncHandler')
const User = require('../models/User')
const Cart = require('../models/Cart')
const Order = require('../models/Order')
const Payment = require('../models/Payment')

const TZ = 'Asia/Kolkata'
const DAY = 864e5
const LARGE_ORDER = 1000

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
const istDay = (s) => new Date(`${s}T00:00:00+05:30`)
const todayStart = () => istDay(ymd(new Date()))
const monthStart = (back = 0) => {
  const [y, m] = ymd(new Date()).split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 - back, 1))
  return istDay(
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`,
  )
}
const pct = (a, b) => (b ? +(((a - b) / b) * 100).toFixed(1) : null)
const is = (s) => ({ $eq: ['$status', s] })
const notCancelled = { $ne: ['$status', 'CANCELLED'] }
const cnt = (cond) => ({ $sum: { $cond: [cond, 1, 0] } })
const sumIf = (cond, field) => ({ $sum: { $cond: [cond, field, 0] } })
const hasLoc = (c) =>
  Array.isArray(c.location?.coordinates) && c.location.coordinates.length === 2

function rangeFor({ range, startDate, endDate }) {
  const today = todayStart()
  const tomorrow = new Date(+today + DAY)
  if (startDate && endDate)
    return { start: istDay(startDate), end: new Date(+istDay(endDate) + DAY) }
  if (range === '7d')
    return { start: new Date(+today - 6 * DAY), end: tomorrow }
  if (range === '30d')
    return { start: new Date(+today - 29 * DAY), end: tomorrow }
  if (range === 'month') return { start: monthStart(), end: tomorrow }
  return { start: today, end: tomorrow }
}

async function stats(start, end) {
  const [r] = await Order.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        cancelled: cnt(is('CANCELLED')),
        valid: cnt(notCancelled),
        gmv: sumIf(notCancelled, '$totalPrice'),
        fee: sumIf(notCancelled, '$platformFee'),
      },
    },
  ])
  const x = r || { orders: 0, cancelled: 0, valid: 0, gmv: 0, fee: 0 }
  return {
    ...x,
    aov: x.valid ? x.gmv / x.valid : 0,
    cancelRate: x.orders ? (x.cancelled / x.orders) * 100 : 0,
  }
}

async function cartInfo(ids) {
  const carts = await Cart.find({ _id: { $in: [...new Set(ids.map(String))] } })
    .select('cartName cartCity userId')
    .lean()
  const owners = await User.find({ _id: { $in: carts.map((c) => c.userId) } })
    .select('name')
    .lean()
  const oname = new Map(owners.map((o) => [String(o._id), o.name || 'Unnamed']))
  return new Map(
    carts.map((c) => [
      String(c._id),
      {
        name: c.cartName,
        city: c.cartCity,
        owner: oname.get(String(c.userId)) || '—',
      },
    ]),
  )
}

async function paymentStats(start, end) {
  const rows = await Payment.aggregate([
    {
      $match: {
        createdAt: {
          $gte: start,
          $lt: end,
        },
      },
    },
    {
      $group: {
        _id: null,

        // Money GullyEats actually earned
        revenue: {
          $sum: {
            $cond: [{ $eq: ['$status', 'VERIFIED'] }, '$amount', 0],
          },
        },

        // Money still pending
        pendingAmount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'PENDING'] }, '$amount', 0],
          },
        },

        // Money from rejected payments
        rejectedAmount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'REJECTED'] }, '$amount', 0],
          },
        },

        verifiedCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'VERIFIED'] }, 1, 0],
          },
        },

        pendingCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0],
          },
        },

        rejectedCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0],
          },
        },
      },
    },
  ])

  return (
    rows[0] || {
      revenue: 0,
      pendingAmount: 0,
      rejectedAmount: 0,
      verifiedCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
    }
  )
}

async function buildSeries(period) {
  const [unit, n] = {
    '7d': ['day', 7],
    '30d': ['day', 30],
    '3m': ['week', 13],
    '12m': ['month', 12],
  }[period] || ['day', 30]

  const today = todayStart()
  const tomorrow = new Date(+today + DAY)

  const start =
    unit === 'month'
      ? monthStart(11)
      : new Date(+today - (unit === 'week' ? 90 : n - 1) * DAY)

  const format = {
    day: '%Y-%m-%d',
    week: '%G-W%V',
    month: '%Y-%m',
  }[unit]

  // Order operational metrics
  const rows = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: start,
          $lt: tomorrow,
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format,
            date: '$createdAt',
            timezone: TZ,
          },
        },
        orders: { $sum: 1 },
        pending: cnt(is('PENDING')),
        preparing: cnt(is('PAID')),
        served: cnt(is('SERVED')),
        cancelled: cnt(is('CANCELLED')),
      },
    },
    { $sort: { _id: 1 } },
  ])

  // Only successfully paid orders generate GullyEats revenue.
  const paidRows = await Payment.aggregate([
    {
      $match: {
        createdAt: {
          $gte: start,
          $lt: tomorrow,
        },
        status: 'VERIFIED',
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format,
            date: '$createdAt',
            timezone: TZ,
          },
        },

        paidOrders: { $sum: 1 },

        // ₹2 platform fee per successfully paid order
        revenue: {
          $sum: 2,
        },
      },
    },
    { $sort: { _id: 1 } },
  ])

  const byKey = new Map(rows.map((r) => [r._id, r]))

  const paidByKey = new Map(paidRows.map((r) => [r._id, r]))

  let keys = rows.map((r) => r._id)

  if (unit === 'day') {
    keys = Array.from({ length: n }, (_, i) =>
      ymd(new Date(+today - (n - 1 - i) * DAY)),
    )
  }

  if (unit === 'month') {
    keys = Array.from({ length: 12 }, (_, i) =>
      ymd(monthStart(11 - i)).slice(0, 7),
    )
  }

  const label = (k) =>
    unit === 'day'
      ? new Date(`${k}T00:00:00+05:30`).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          timeZone: TZ,
        })
      : unit === 'month'
        ? new Date(`${k}-01T00:00:00+05:30`).toLocaleDateString('en-IN', {
            month: 'short',
            year: '2-digit',
            timeZone: TZ,
          })
        : k.split('-')[1]

  const points = keys.map((k) => {
    const r = byKey.get(k) || {}
    const paid = paidByKey.get(k) || {}

    return {
      label: label(k),

      // Only money that was actually paid
      revenue: paid.revenue || 0,

      // Number of successfully paid orders
      paidOrders: paid.paidOrders || 0,

      // Operational order count
      orders: r.orders || 0,
      pending: r.pending || 0,
      preparing: r.preparing || 0,
      served: r.served || 0,
      cancelled: r.cancelled || 0,
    }
  })

  const len = tomorrow - start

  const [cur, prev] = await Promise.all([
    stats(start, tomorrow),
    stats(new Date(+start - len), start),
  ])

  return {
    points,

    totals: {
      paidOrders: paidRows.reduce((sum, r) => sum + (r.paidOrders || 0), 0),
      totalOrders: cur.orders,
      collectionRate: cur.orders
        ? +(
            (paidRows.reduce((sum, r) => sum + (r.paidOrders || 0), 0) /
              cur.orders) *
            100
          ).toFixed(1)
        : 0,
      aov: cur.aov,
    },
  }
}

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    res.status(400)
    throw new Error('email and password are required')
  }

  const user = await User.findOne({
    email: email.trim().toLowerCase(),
    role: 'admin',
  }).select('+pinHash')

  if (!user) {
    res.status(401)
    throw new Error('Invalid email or password')
  }

  const isMatch = await bcrypt.compare(password, user.pinHash || '')

  if (!isMatch) {
    res.status(401)
    throw new Error('Invalid email or password')
  }

  const token = jwt.sign(
    {
      _id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d',
    },
  )

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })

  res.status(200).json({
    success: true,
    user: {
      id: user._id,
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  })
})

exports.logout = asyncHandler(async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  })
})

exports.series = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await buildSeries(req.query.period) })
})

// ============================================================
// PAYMENT STATS
// ============================================================
//
// Business rule:
//
// GullyEats revenue:
//   Payment.amount WHERE status = VERIFIED
//
// Pending:
//   Payment.amount WHERE status = PENDING
//
// Rejected:
//   Payment.amount WHERE status = REJECTED
//
// Revenue is recognized using verifiedAt because that is when
// the payment was actually verified/collected.
// ============================================================

async function paymentStats(start, end) {
  const [verified, pending, rejected] = await Promise.all([
    // ----------------------------------------------------------
    // VERIFIED PAYMENTS = ACTUAL GULLYEATS REVENUE
    // ----------------------------------------------------------
    Payment.aggregate([
      {
        $match: {
          status: 'VERIFIED',
          verifiedAt: {
            $gte: start,
            $lt: end,
          },
        },
      },
      {
        $group: {
          _id: null,

          revenue: {
            $sum: '$amount',
          },

          count: {
            $sum: 1,
          },
        },
      },
    ]),

    // ----------------------------------------------------------
    // PENDING PAYMENTS
    // ----------------------------------------------------------
    Payment.aggregate([
      {
        $match: {
          status: 'PENDING',
          createdAt: {
            $gte: start,
            $lt: end,
          },
        },
      },
      {
        $group: {
          _id: null,

          amount: {
            $sum: '$amount',
          },

          count: {
            $sum: 1,
          },
        },
      },
    ]),

    // ----------------------------------------------------------
    // REJECTED PAYMENTS
    // ----------------------------------------------------------
    Payment.aggregate([
      {
        $match: {
          status: 'REJECTED',
          createdAt: {
            $gte: start,
            $lt: end,
          },
        },
      },
      {
        $group: {
          _id: null,

          amount: {
            $sum: '$amount',
          },

          count: {
            $sum: 1,
          },
        },
      },
    ]),
  ])

  return {
    revenue: verified[0]?.revenue || 0,
    verifiedCount: verified[0]?.count || 0,

    pendingAmount: pending[0]?.amount || 0,
    pendingCount: pending[0]?.count || 0,

    rejectedAmount: rejected[0]?.amount || 0,
    rejectedCount: rejected[0]?.count || 0,
  }
}

// ============================================================
// REVENUE / OPERATIONS SERIES
// ============================================================
//
// Main graph:
//   revenue = verified Payment.amount
//
// Other information:
//   orders
//   restaurant GMV
//   pending/rejected payment amounts
//   payment counts
//   order status counts
//
// NOTE:
// Order.totalPrice = marketplace/restaurant GMV.
// Payment.amount = GullyEats revenue.
// ============================================================

async function buildSeries(period) {
  const [unit, n] = {
    '7d': ['day', 7],
    '30d': ['day', 30],
    '3m': ['week', 13],
    '12m': ['month', 12],
  }[period] || ['day', 30]

  const today = todayStart()
  const tomorrow = new Date(+today + DAY)

  const start =
    unit === 'month'
      ? monthStart(11)
      : new Date(+today - (unit === 'week' ? 90 : n - 1) * DAY)

  const format = {
    day: '%Y-%m-%d',
    week: '%G-W%V',
    month: '%Y-%m',
  }[unit]

  // ==========================================================
  // 1. ORDER DATA
  // ==========================================================

  const orderRows = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: start,
          $lt: tomorrow,
        },
      },
    },

    {
      $group: {
        _id: {
          $dateToString: {
            format,
            date: '$createdAt',
            timezone: TZ,
          },
        },

        // Total orders
        orders: {
          $sum: 1,
        },

        // Restaurant GMV
        // NOT GullyEats revenue.
        gmv: sumIf(notCancelled, '$totalPrice'),

        pending: cnt(is('PENDING')),

        preparing: cnt(is('PAID')),

        served: cnt(is('SERVED')),

        cancelled: cnt(is('CANCELLED')),
      },
    },

    {
      $sort: {
        _id: 1,
      },
    },
  ])

  // ==========================================================
  // 2. PAYMENT DATA
  // ==========================================================
  //
  // Revenue is based on verifiedAt.
  //
  // This means:
  //
  // Payment
  //    status = VERIFIED
  //    amount = ₹X
  //
  //                    ↓
  //
  // GullyEats Revenue = ₹X
  //
  // ==========================================================

  const paymentRows = await Payment.aggregate([
    {
      $match: {
        $or: [
          {
            status: 'VERIFIED',
            verifiedAt: {
              $gte: start,
              $lt: tomorrow,
            },
          },
          {
            status: {
              $in: ['PENDING', 'REJECTED'],
            },
            createdAt: {
              $gte: start,
              $lt: tomorrow,
            },
          },
        ],
      },
    },

    {
      $group: {
        _id: {
          $dateToString: {
            format,

            // Use verifiedAt for verified payments,
            // createdAt for pending/rejected payments.
            date: {
              $cond: [
                {
                  $eq: ['$status', 'VERIFIED'],
                },
                '$verifiedAt',
                '$createdAt',
              ],
            },

            timezone: TZ,
          },
        },

        // ====================================================
        // GullyEats actual revenue
        // ====================================================

        revenue: {
          $sum: {
            $cond: [
              {
                $eq: ['$status', 'VERIFIED'],
              },
              '$amount',
              0,
            ],
          },
        },

        // ====================================================
        // Pending money
        // ====================================================

        pendingRevenue: {
          $sum: {
            $cond: [
              {
                $eq: ['$status', 'PENDING'],
              },
              '$amount',
              0,
            ],
          },
        },

        // ====================================================
        // Rejected money
        // ====================================================

        rejectedRevenue: {
          $sum: {
            $cond: [
              {
                $eq: ['$status', 'REJECTED'],
              },
              '$amount',
              0,
            ],
          },
        },

        // ====================================================
        // Counts
        // ====================================================

        paidPayments: {
          $sum: {
            $cond: [
              {
                $eq: ['$status', 'VERIFIED'],
              },
              1,
              0,
            ],
          },
        },

        pendingPayments: {
          $sum: {
            $cond: [
              {
                $eq: ['$status', 'PENDING'],
              },
              1,
              0,
            ],
          },
        },

        rejectedPayments: {
          $sum: {
            $cond: [
              {
                $eq: ['$status', 'REJECTED'],
              },
              1,
              0,
            ],
          },
        },
      },
    },

    {
      $sort: {
        _id: 1,
      },
    },
  ])

  const orderByKey = new Map(orderRows.map((r) => [r._id, r]))

  const paymentByKey = new Map(paymentRows.map((r) => [r._id, r]))

  // ==========================================================
  // 3. GENERATE ALL PERIOD KEYS
  // ==========================================================

  let keys = orderRows.map((r) => r._id)

  if (unit === 'day') {
    keys = Array.from({ length: n }, (_, i) =>
      ymd(new Date(+today - (n - 1 - i) * DAY)),
    )
  }

  if (unit === 'month') {
    keys = Array.from({ length: 12 }, (_, i) =>
      ymd(monthStart(11 - i)).slice(0, 7),
    )
  }

  // ==========================================================
  // 4. LABEL
  // ==========================================================

  const label = (key) => {
    if (unit === 'day') {
      return new Date(`${key}T00:00:00+05:30`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        timeZone: TZ,
      })
    }

    if (unit === 'month') {
      return new Date(`${key}-01T00:00:00+05:30`).toLocaleDateString('en-IN', {
        month: 'short',
        year: '2-digit',
        timeZone: TZ,
      })
    }

    return key
  }

  // ==========================================================
  // 5. BUILD GRAPH POINTS
  // ==========================================================

  const points = keys.map((key) => {
    const orders = orderByKey.get(key) || {}

    const payments = paymentByKey.get(key) || {}

    const totalOrders = orders.orders || 0

    const gmv = orders.gmv || 0

    const revenue = payments.revenue || 0

    const pendingRevenue = payments.pendingRevenue || 0

    const rejectedRevenue = payments.rejectedRevenue || 0

    const paidPayments = payments.paidPayments || 0

    return {
      label: label(key),

      // ======================================================
      // GULLYEATS FINANCIALS
      // ======================================================

      // ⭐ MAIN REVENUE GRAPH
      revenue,

      pendingRevenue,

      rejectedRevenue,

      paidPayments,

      pendingPayments: payments.pendingPayments || 0,

      rejectedPayments: payments.rejectedPayments || 0,

      // ======================================================
      // MARKETPLACE METRICS
      // ======================================================

      orders: totalOrders,

      // Restaurant GMV
      gmv,

      aov: totalOrders ? +(gmv / totalOrders).toFixed(2) : 0,

      collectionRate: totalOrders
        ? +((paidPayments / totalOrders) * 100).toFixed(1)
        : 0,

      // ======================================================
      // ORDER OPERATIONS
      // ======================================================

      pending: orders.pending || 0,

      preparing: orders.preparing || 0,

      served: orders.served || 0,

      cancelled: orders.cancelled || 0,

      cancellationRate: totalOrders
        ? +(((orders.cancelled || 0) / totalOrders) * 100).toFixed(1)
        : 0,
    }
  })

  // ==========================================================
  // 6. CURRENT PERIOD TOTALS
  // ==========================================================

  const revenue = points.reduce((sum, p) => sum + p.revenue, 0)

  const pendingRevenue = points.reduce((sum, p) => sum + p.pendingRevenue, 0)

  const rejectedRevenue = points.reduce((sum, p) => sum + p.rejectedRevenue, 0)

  const paidPayments = points.reduce((sum, p) => sum + p.paidPayments, 0)

  const pendingPayments = points.reduce((sum, p) => sum + p.pendingPayments, 0)

  const rejectedPayments = points.reduce(
    (sum, p) => sum + p.rejectedPayments,
    0,
  )

  const totalOrders = points.reduce((sum, p) => sum + p.orders, 0)

  const gmv = points.reduce((sum, p) => sum + p.gmv, 0)

  const cancelled = points.reduce((sum, p) => sum + p.cancelled, 0)

  // ==========================================================
  // 7. PREVIOUS PERIOD REVENUE
  // ==========================================================

  const len = tomorrow - start

  const previousStart = new Date(+start - len)

  const previousRevenueResult = await Payment.aggregate([
    {
      $match: {
        status: 'VERIFIED',
        verifiedAt: {
          $gte: previousStart,
          $lt: start,
        },
      },
    },

    {
      $group: {
        _id: null,

        revenue: {
          $sum: '$amount',
        },
      },
    },
  ])

  const previousRevenue = previousRevenueResult[0]?.revenue || 0

  // ==========================================================
  // 8. RETURN
  // ==========================================================

  return {
    points,

    totals: {
      // GullyEats financials
      revenue,

      previousRevenue,

      revenueGrowth: previousRevenue ? pct(revenue, previousRevenue) : null,

      pendingRevenue,

      rejectedRevenue,

      paidPayments,

      pendingPayments,

      rejectedPayments,

      // Marketplace
      totalOrders,

      // Restaurant GMV
      gmv,

      aov: totalOrders ? +(gmv / totalOrders).toFixed(2) : 0,

      collectionRate: totalOrders
        ? +((paidPayments / totalOrders) * 100).toFixed(1)
        : 0,

      cancellationRate: totalOrders
        ? +((cancelled / totalOrders) * 100).toFixed(1)
        : 0,
    },
  }
}

// ============================================================
// OVERVIEW
// ============================================================
exports.overview = asyncHandler(async (req, res) => {
  console.log('reached')
  const { start, end } = rangeFor(req.query)
  const prevStart = new Date(+start - (end - start))
  const today = todayStart()
  const tomorrow = new Date(+today + DAY)
  const yesterday = new Date(+today - DAY)
  const ms = monthStart()
  const prevMtdEnd = new Date(Math.min(+monthStart(1) + (tomorrow - ms), +ms))
  const week = new Date(+today - 6 * DAY)
  const hasFb = {
    feedback: {
      $exists: true,
      $nin: ['', null],
    },
  } // ========================================================
  // ALL QUERIES
  // ========================================================
  const [
    // Order statistics
    cur,
    prev,
    td,
    yd,
    month,
    prevMonth, // Payment statistics
    curPayments,
    prevPayments,
    todayPayments,
    yesterdayPayments,
    monthPayments,
    prevMonthPayments, // All-time GullyEats revenue
    allTimePayments,

    // Platform
    owners,
    carts,
    liveCarts,
    activeCartIds,
    newOwners,
    newCarts, // Order statuses
    rangeStatus, // Restaurant activity
    active7, // Location
    noLoc, // Feedback
    fbTotal,
    fbRecent, // Total orders
    ordersTotal, // Revenue/operations series
    daily,
  ] = await Promise.all([
    // ======================================================
    // ORDERS
    // ======================================================
    stats(start, end),
    stats(prevStart, start),
    stats(today, tomorrow),
    stats(yesterday, today),
    stats(ms, tomorrow),
    stats(monthStart(1), prevMtdEnd), // ======================================================
    // PAYMENTS
    // ======================================================
    paymentStats(start, end),
    paymentStats(prevStart, start),
    paymentStats(today, tomorrow),
    paymentStats(yesterday, today),
    paymentStats(ms, tomorrow),
    paymentStats(monthStart(1), prevMtdEnd), // All-time verified platform-fee revenue
    Payment.aggregate([
      {
        $match: {
          status: 'VERIFIED',
          verifiedAt: { $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]), // PLATFORM
    // ======================================================
    // ======================================================
    User.countDocuments({
      role: 'vendor',
    }),
    Cart.countDocuments(),
    Cart.countDocuments({
      isOpen: true,
    }),
    Order.distinct('cartId', {
      createdAt: {
        $gte: start,
        $lt: end,
      },
    }),
    User.countDocuments({
      role: 'vendor',
      createdAt: {
        $gte: start,
        $lt: end,
      },
    }),
    Cart.countDocuments({
      createdAt: {
        $gte: start,
        $lt: end,
      },
    }), // ======================================================
    // ORDER STATUS
    // ======================================================
    Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: start,
            $lt: end,
          },
        },
      },
      {
        $group: {
          _id: '$status',
          n: {
            $sum: 1,
          },
        },
      },
    ]), // ======================================================
    // ACTIVE RESTAURANTS
    // ======================================================
    Order.distinct('cartId', {
      createdAt: {
        $gte: week,
      },
    }), // ======================================================
    // MISSING LOCATION
    // ======================================================
    Cart.countDocuments({
      $or: [
        {
          location: {
            $exists: false,
          },
        },
        {
          location: null,
        },
      ],
    }), // ======================================================
    // FEEDBACK
    // ======================================================
    Order.countDocuments(hasFb),
    Order.find(hasFb)
      .sort({
        createdAt: -1,
      })
      .limit(3)
      .select('feedback createdAt cartId')
      .lean(), // ======================================================
    // TOTAL ORDERS
    // ======================================================
    Order.countDocuments(), // ======================================================
    // SERIES
    // ======================================================
    buildSeries('7d'),
  ])
  const totalRevenue = allTimePayments[0]?.revenue || 0
  const totalPaidPayments = allTimePayments[0]?.count || 0 // ACTIVE OWNERS
  // ========================================================
  // ========================================================
  const activeOwners = (
    await Cart.distinct('userId', {
      _id: {
        $in: activeCartIds,
      },
    })
  ).length // ========================================================
  // INACTIVE RESTAURANTS
  // ========================================================
  const inactive = await Cart.countDocuments({
    _id: {
      $nin: active7,
    },
  }) // ========================================================
  // FEEDBACK CART INFO
  // ========================================================
  const info = await cartInfo(fbRecent.map((o) => o.cartId)) // ========================================================
  // ORDER STATUS MAP
  // ========================================================
  const st = Object.fromEntries(rangeStatus.map((s) => [s._id, s.n])) // ========================================================
  // ATTENTION
  // ========================================================
  const attention = [] // --------------------------------------------------------
  // Pending payments
  // --------------------------------------------------------
  if (curPayments.pendingCount) {
    attention.push({
      id: 'pay',
      kind: 'payment',
      severity: 'High',
      title: 'Platform fee pending',
      text: `${curPayments.pendingCount} payment${
        curPayments.pendingCount > 1 ? 's' : ''
      } awaiting collection · ₹${curPayments.pendingAmount}`,
      to: '/payments',
    })
  } // --------------------------------------------------------
  // Rejected payments
  // --------------------------------------------------------
  if (curPayments.rejectedCount) {
    attention.push({
      id: 'rej',
      kind: 'failed',
      severity: 'Medium',
      title: 'Rejected payments',
      text: `${curPayments.rejectedCount} payment${
        curPayments.rejectedCount > 1 ? 's' : ''
      } rejected · ₹${curPayments.rejectedAmount}`,
      to: '/payments',
    })
  } // --------------------------------------------------------
  // Inactive restaurants
  // --------------------------------------------------------
  if (inactive) {
    attention.push({
      id: 'inactive',
      kind: 'inactive',
      severity: 'Medium',
      title: 'Restaurants inactive',
      text: `${inactive} restaurants have had no orders in 7 days`,
      to: '/restaurants',
    })
  } // --------------------------------------------------------
  // Missing location
  // --------------------------------------------------------
  if (noLoc) {
    attention.push({
      id: 'loc',
      kind: 'location',
      severity: 'Low',
      title: 'Missing map location',
      text: `${noLoc} restaurants have no location set`,
      to: '/restaurants',
    })
  } // ========================================================
  // DATABASE HEALTH
  // ========================================================
  const db = mongoose.connection.readyState === 1 // ========================================================
  // RESPONSE
  // ========================================================
  res.json({
    success: true,
    data: {
      // ====================================================
      // KPIs
      // ====================================================
      kpis: {
        // ==================================================
        // GULLYEATS BUSINESS / REVENUE
        // ==================================================

        totalRevenue: {
          value: totalRevenue,
          totalPayments: totalPaidPayments,
        },

        revenueToday: {
          value: todayPayments.revenue,
          change: pct(todayPayments.revenue, yesterdayPayments.revenue),
        },

        revenueMonth: {
          value: monthPayments.revenue,
          change: pct(monthPayments.revenue, prevMonthPayments.revenue),
        },

        revenueRange: {
          value: curPayments.revenue,
          change: pct(curPayments.revenue, prevPayments.revenue),
        },

        // ==================================================
        // ORDERS
        // ==================================================

        totalOrders: ordersTotal,

        ordersToday: {
          value: td.orders,
          change: pct(td.orders, yd.orders),
        },

        ordersRange: {
          value: cur.orders,
          change: pct(cur.orders, prev.orders),
        },

        // ==================================================
        // PLATFORM SCALE
        // ==================================================

        totalOwners: {
          value: owners,
          delta: newOwners,
        },

        activeOwners: {
          value: activeOwners,
          share: owners ? +((activeOwners / owners) * 100).toFixed(1) : 0,
        },

        totalCarts: {
          value: carts,
          delta: newCarts,
        },

        liveCarts: {
          value: liveCarts,
        },

        // ==================================================
        // PAYMENT HEALTH
        // ==================================================

        pendingPayments: {
          amount: curPayments.pendingAmount,
          count: curPayments.pendingCount,
        },

        rejectedPayments: {
          amount: curPayments.rejectedAmount,
          count: curPayments.rejectedCount,
        },

        collectionRate:
          curPayments.revenue + curPayments.pendingAmount
            ? +(
                (curPayments.revenue /
                  (curPayments.revenue + curPayments.pendingAmount)) *
                100
              ).toFixed(1)
            : 0,

        // ==================================================
        // ORDER ECONOMICS
        // ==================================================

        aov: {
          value: cur.aov,
          change: pct(cur.aov, prev.aov),
        },

        cancelRate: {
          value: +cur.cancelRate.toFixed(1),
          change: +(cur.cancelRate - prev.cancelRate).toFixed(1),
        },

        // Marketplace GMV — NOT GullyEats revenue.
        orderGmvRange: cur.gmv,
      },
      // ====================================================
      // LIVE OPERATIONS
      // ====================================================
      live: {
        liveCarts,
        preparing: st.PAID || 0,
        pendingPayment: st.PENDING || 0,
        served: st.SERVED || 0,
        cancelled: st.CANCELLED || 0,
      },
      // ====================================================
      // GRAPH
      // ====================================================
      spark: daily.points,
      // ====================================================
      // ATTENTION
      // ====================================================
      attention,
      // ====================================================
      // FEEDBACK
      // ====================================================
      feedback: {
        total: fbTotal,
        rate: ordersTotal ? +((fbTotal / ordersTotal) * 100).toFixed(1) : 0,
        recent: fbRecent.map((o) => ({
          text: o.feedback,
          cart: info.get(String(o.cartId))?.name,
          at: o.createdAt,
        })),
      },
      // ====================================================
      // HEALTH
      // ====================================================
      health: {
        api: true,
        database: db,
        payments: !!(
          process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
        ),
        orderProcessing: db,
        websocket: !!req.io,
      },
    },
  })
})

exports.owners = asyncHandler(async (req, res) => {
  const today = todayStart()
  const d30 = new Date(+today - 29 * DAY)
  const d60 = new Date(+today - 59 * DAY)
  const [owners, carts, rows] = await Promise.all([
    User.find({ role: 'vendor' })
      .select('name phoneNumber userId createdAt')
      .lean(),
    Cart.find().select('userId isOpen').lean(),
    Order.aggregate([
      {
        $group: {
          _id: '$cartId',
          orders: { $sum: 1 },
          valid: cnt(notCancelled),
          gmv: sumIf(notCancelled, '$totalPrice'),
          g30: sumIf(
            { $and: [notCancelled, { $gte: ['$createdAt', d30] }] },
            '$totalPrice',
          ),
          gPrev: sumIf(
            {
              $and: [
                notCancelled,
                { $gte: ['$createdAt', d60] },
                { $lt: ['$createdAt', d30] },
              ],
            },
            '$totalPrice',
          ),
        },
      },
    ]),
  ])
  const cartOwner = new Map(carts.map((c) => [String(c._id), String(c.userId)]))
  const agg = {}
  rows.forEach((r) => {
    const o = cartOwner.get(String(r._id))
    if (!o) return
    const a = (agg[o] ||= { orders: 0, valid: 0, gmv: 0, g30: 0, gPrev: 0 })
    for (const k in a) a[k] += r[k]
  })
  const data = owners
    .map((o) => {
      const id = String(o._id)
      const a = agg[id] || { orders: 0, valid: 0, gmv: 0, g30: 0, gPrev: 0 }
      const mine = carts.filter((c) => String(c.userId) === id)
      const growth = pct(a.g30, a.gPrev)
      return {
        id,
        name: o.name || 'Unnamed',
        phone: o.phoneNumber,
        userId: o.userId,
        joinedAt: o.createdAt,
        restaurants: mine.length,
        live: mine.filter((c) => c.isOpen).length,
        orders: a.orders,
        gmv: a.gmv,
        aov: a.valid ? a.gmv / a.valid : 0,
        growth,
        status:
          a.g30 > 0
            ? growth !== null && growth < -10
              ? 'Review'
              : 'Active'
            : 'Inactive',
      }
    })
    .sort((x, y) => y.gmv - x.gmv)
  res.json({ success: true, data })
})

exports.carts = asyncHandler(async (req, res) => {
  const today = todayStart()
  const isToday = { $gte: ['$createdAt', today] }
  const [carts, owners, rows, pending] = await Promise.all([
    Cart.find().lean(),
    User.find({ role: 'vendor' }).select('name').lean(),
    Order.aggregate([
      {
        $group: {
          _id: '$cartId',
          last: { $max: '$createdAt' },
          orders: cnt({ $and: [notCancelled, isToday] }),
          gmv: sumIf({ $and: [notCancelled, isToday] }, '$totalPrice'),
          current: cnt({
            $and: [isToday, { $or: [is('PENDING'), is('PAID')] }],
          }),
        },
      },
    ]),
    Payment.distinct('cartId', { status: 'PENDING' }),
  ])
  const oname = new Map(owners.map((o) => [String(o._id), o.name || 'Unnamed']))
  const by = new Map(rows.map((r) => [String(r._id), r]))
  const pend = new Set(pending.map(String))
  const data = carts.map((c) => {
    const r = by.get(String(c._id)) || {}
    const status = pend.has(String(c._id))
      ? 'ATTENTION'
      : c.isOpen
        ? 'LIVE'
        : c.isActive === false
          ? 'PAUSED'
          : 'OFFLINE'
    return {
      id: String(c._id),
      cartId: c.cartId,
      name: c.cartName,
      owner: oname.get(String(c.userId)) || '—',
      city: c.cartCity,
      address: c.address,
      lat: hasLoc(c) ? c.location.coordinates[0] : null,
      lng: hasLoc(c) ? c.location.coordinates[1] : null,
      status,
      ordersToday: r.orders || 0,
      gmvToday: r.gmv || 0,
      current: r.current || 0,
      lastActive: r.last || null,
      createdAt: c.createdAt,
    }
  })
  res.json({ success: true, data })
})

exports.orders = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500)
  const { status, cursor } = req.query

  const filter = status ? { status } : {}

  // Cursor pagination ONLY when cursor exists
  if (cursor) {
    const [createdAt, id] = cursor.split('|')

    filter.$or = [
      {
        createdAt: { $lt: new Date(createdAt) },
      },
      {
        createdAt: new Date(createdAt),
        _id: { $lt: id },
      },
    ]
  }

  const rows = await Order.find(filter)
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .limit(cursor ? limit + 1 : limit)
    .select('orderNumber totalPrice status cartId orderItems createdAt')
    .lean()

  // Normal request — Dashboard
  if (!cursor) {
    const info = await cartInfo(rows.map((o) => o.cartId))

    const data = rows.map((o) => {
      const c = info.get(String(o.cartId)) || {}

      return {
        id: String(o._id),
        number: o.orderNumber,
        cart: c.name || '—',
        owner: c.owner || '—',
        amount: o.totalPrice,
        items: (o.orderItems || []).reduce((s, i) => s + (i.quantity || 1), 0),
        status: o.status,
        payment:
          o.status === 'PENDING'
            ? 'PENDING'
            : o.status === 'CANCELLED'
              ? 'VOID'
              : 'PAID',
        createdAt: o.createdAt,
      }
    })

    return res.json({
      success: true,
      data,
    })
  }

  // Paginated request — Orders page
  const hasMore = rows.length > limit

  if (hasMore) {
    rows.pop()
  }

  const info = await cartInfo(rows.map((o) => o.cartId))

  const data = rows.map((o) => {
    const c = info.get(String(o.cartId)) || {}

    return {
      id: String(o._id),
      number: o.orderNumber,
      cart: c.name || '—',
      owner: c.owner || '—',
      amount: o.totalPrice,
      items: (o.orderItems || []).reduce((s, i) => s + (i.quantity || 1), 0),
      status: o.status,
      payment:
        o.status === 'PENDING'
          ? 'PENDING'
          : o.status === 'CANCELLED'
            ? 'VOID'
            : 'PAID',
      createdAt: o.createdAt,
    }
  })

  const last = rows[rows.length - 1]

  const nextCursor =
    hasMore && last ? `${last.createdAt.toISOString()}|${last._id}` : null

  res.json({
    success: true,
    data,
    pagination: {
      hasMore,
      nextCursor,
    },
  })
})

exports.payments = asyncHandler(async (req, res) => {
  const [rows, sums] = await Promise.all([
    Payment.find().sort({ createdAt: -1 }).limit(200).lean(),
    Payment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
        },
      },
    ]),
  ])
  const info = await cartInfo(rows.map((p) => p.cartId))
  res.json({
    success: true,
    data: {
      summary: Object.fromEntries(
        sums.map((s) => [s._id, { count: s.count, amount: s.amount }]),
      ),
      items: rows.map((p) => ({
        id: String(p._id),
        cart: p.cartName || info.get(String(p.cartId))?.name,
        owner: info.get(String(p.cartId))?.owner,
        orders: p.totalOrders,
        amount: p.amount,
        status: p.status,
        billingDate: p.billingDate,
        verifiedAt: p.verifiedAt,
        source: p.verificationSource,
        createdAt: p.createdAt,
      })),
    },
  })
})

exports.feedback = asyncHandler(async (req, res) => {
  const hasFb = { feedback: { $exists: true, $nin: ['', null] } }
  const [total, rows] = await Promise.all([
    Order.countDocuments(hasFb),
    Order.find(hasFb)
      .sort({ createdAt: -1 })
      .limit(100)
      .select('feedback orderNumber cartId createdAt')
      .lean(),
  ])
  const info = await cartInfo(rows.map((o) => o.cartId))
  res.json({
    success: true,
    data: {
      total,
      items: rows.map((o) => ({
        id: String(o._id),
        text: o.feedback,
        number: o.orderNumber,
        cart: info.get(String(o.cartId))?.name,
        owner: info.get(String(o.cartId))?.owner,
        at: o.createdAt,
      })),
    },
  })
})

exports.activity = asyncHandler(async (req, res) => {
  const [owners, carts, orders, pays] = await Promise.all([
    User.find({ role: 'vendor' })
      .sort({ createdAt: -1 })
      .limit(4)
      .select('name createdAt')
      .lean(),
    Cart.find()
      .sort({ createdAt: -1 })
      .limit(4)
      .select('cartName cartCity createdAt')
      .lean(),
    Order.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .select('_id totalPrice cartId createdAt')
      .lean(),
    Payment.find().sort({ updatedAt: -1 }).limit(4).lean(),
  ])
  const info = await cartInfo([
    ...orders.map((o) => o.cartId),
    ...pays.map((p) => p.cartId),
  ])
  const items = [
    ...owners.map((o) => ({
      type: 'owner',
      title: 'New owner registered',
      text: `"${o.name || 'Unnamed'}" joined GullyEats`,
      at: o.createdAt,
    })),
    ...carts.map((c) => ({
      type: 'cart',
      title: 'Restaurant added',
      text: `"${c.cartName}" · ${c.cartCity}`,
      at: c.createdAt,
    })),
    ...orders.map((o) => ({
      type: o.totalPrice >= LARGE_ORDER ? 'large' : 'order',
      title:
        o.totalPrice >= LARGE_ORDER ? 'Large order received' : 'Order received',
      text: `Order #${String(o._id).slice(-5)} · ₹${o.totalPrice} · ${
        info.get(String(o.cartId))?.name || '—'
      }`,
      at: o.createdAt,
    })),
    ...pays.map((p) => ({
      type: p.status === 'REJECTED' ? 'alert' : 'payment',
      title:
        p.status === 'VERIFIED'
          ? 'Platform fee paid'
          : p.status === 'REJECTED'
            ? 'Payment rejected'
            : 'Platform fee due',
      text: `${p.cartName || info.get(String(p.cartId))?.name} · ₹${p.amount}`,
      at: p.verifiedAt || p.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 12)
  res.json({ success: true, data: items })
})

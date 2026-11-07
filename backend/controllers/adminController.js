// Platform-wide (super admin) queries. Drop into your backend next to cartController.js.
// Uses your existing models. NOTE: cart.location.coordinates is stored as [lat, lng] in your app.
const mongoose = require('mongoose')
const asyncHandler = require('../utils/asyncHandler')
const User = require('../models/User')
const Cart = require('../models/Cart')
const Order = require('../models/Order')
const Payment = require('../models/Payment')
const {
  getCartPaymentStatus,
  createBillPayment,
  BILLING_LOCK_MS,
  getISTMidnight,
} = require('../utils/cartPaymentLock')

const TZ = 'Asia/Kolkata'
const DAY = 864e5
const LARGE_ORDER = 1000

const bcrypt = require('bcrypt')
const generatePin = require('../utils/generatePin')
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
// Money counts only orders the customer paid for (served orders were paid
// first), the same rule as the vendor's sales report and fee billing.
const paid = { $in: ['$status', ['PAID', 'SERVED']] }
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
        valid: cnt(paid),
        gmv: sumIf(paid, '$totalPrice'),
        fee: sumIf(paid, '$platformFee'),
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
    // The dashboard (vercel.app) calls the API (onrender.com) cross-site,
    // so production needs SameSite=None. auth only reads it on GETs.
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
    // The dashboard (vercel.app) calls the API (onrender.com) cross-site,
    // so production needs SameSite=None. auth only reads it on GETs.
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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

  // Weeks start on Monday (IST), so every bucket is a whole week.
  const mondayOffset = (new Date(`${ymd(today)}T00:00:00Z`).getUTCDay() + 6) % 7
  const thisMonday = new Date(+today - mondayOffset * DAY)

  const start =
    unit === 'month'
      ? monthStart(11)
      : unit === 'week'
        ? new Date(+thisMonday - (n - 1) * 7 * DAY)
        : new Date(+today - (n - 1) * DAY)

  // Bucket key: the IST day, the IST Monday of its week, or the month.
  const bucket = (date) => ({
    $dateToString: {
      format: unit === 'month' ? '%Y-%m' : '%Y-%m-%d',
      date:
        unit === 'week'
          ? { $dateTrunc: { date, unit: 'week', startOfWeek: 'monday', timezone: TZ } }
          : date,
      timezone: TZ,
    },
  })

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
        _id: bucket('$createdAt'),

        // Total orders
        orders: {
          $sum: 1,
        },

        // Restaurant GMV
        // NOT GullyEats revenue.
        gmv: sumIf(paid, '$totalPrice'),

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
        // verifiedAt for verified payments, createdAt for pending/rejected.
        _id: bucket({ $cond: [{ $eq: ['$status', 'VERIFIED'] }, '$verifiedAt', '$createdAt'] }),

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

  // Every bucket gets a point, even with no orders or payments.
  const keys = Array.from({ length: n }, (_, i) =>
    unit === 'month'
      ? ymd(monthStart(n - 1 - i)).slice(0, 7)
      : ymd(new Date(+start + i * (unit === 'week' ? 7 : 1) * DAY)),
  )

  // ==========================================================
  // 4. LABEL
  // ==========================================================

  const label = (key) => {
    // A week is labelled by its Monday.
    if (unit === 'day' || unit === 'week') {
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

    // Orders the customer paid for (served orders were paid first).
    const paidOrders = (orders.preparing || 0) + (orders.served || 0)

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

      paidOrders,

      aov: paidOrders ? +(gmv / paidOrders).toFixed(2) : 0,

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

  const paidOrders = points.reduce((sum, p) => sum + p.paidOrders, 0)

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

      paidOrders,

      aov: paidOrders ? +(gmv / paidOrders).toFixed(2) : 0,

      cancellationRate: totalOrders
        ? +((cancelled / totalOrders) * 100).toFixed(1)
        : 0,
    },
  }
}

// Overdue platform fees vendors owe us: the fee on every PAID or SERVED order
// that no verified fee payment has covered, from billing days (the IST day the
// customer paid) whose 26h grace has passed, the same moment the cart locks.
// Orders are only
// cancelled on their own day, before that day is billed, so there are no
// billing credits to subtract.
// A day's bill is overdue BILLING_LOCK_MS after its IST midnight, so every
// billing day before the one containing (now - BILLING_LOCK_MS) is overdue.
const overdueBefore = (now = new Date()) =>
  new Date(+getISTMidnight(new Date(+now - BILLING_LOCK_MS)) + DAY)

async function unpaidFees() {
  // shortcut: loads every billed order id; move to a $lookup on an indexed Payment.orderIds once there are ~100k+ billed orders.
  const billed = await Payment.distinct('orderIds', { status: 'VERIFIED' })
  const [r] = await Order.aggregate([
    {
      $match: {
        status: { $in: ['PAID', 'SERVED'] },
        _id: { $nin: billed },
        $expr: { $lt: [{ $ifNull: ['$paidAt', '$orderDate', '$createdAt'] }, overdueBefore()] },
      },
    },
    {
      $group: {
        _id: null,
        amount: { $sum: '$platformFee' },
        orders: { $sum: 1 },
        carts: { $addToSet: '$cartId' },
      },
    },
  ])
  return { amount: r?.amount || 0, count: r?.orders || 0, carts: r?.carts.length || 0 }
}

// ============================================================
// OVERVIEW
// ============================================================
exports.overdueBefore = overdueBefore // for tests

exports.overview = asyncHandler(async (req, res) => {
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
    todayStatus, // Restaurant activity
    active7, // Location
    noLoc, // Feedback
    fbTotal,
    fbRecent, // Total orders
    ordersTotal, // Revenue/operations series
    daily,
    unpaid,
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
            $gte: today,
            $lt: tomorrow,
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
    unpaidFees(),
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
    createdAt: { $lt: week },
  }) // ========================================================
  // FEEDBACK CART INFO
  // ========================================================
  const info = await cartInfo(fbRecent.map((o) => o.cartId)) // ========================================================
  // ORDER STATUS MAP
  // ========================================================
  const st = Object.fromEntries(todayStatus.map((s) => [s._id, s.n])) // ========================================================
  // ATTENTION
  // ========================================================
  const attention = [] // --------------------------------------------------------
  // Pending payments
  // --------------------------------------------------------
  if (unpaid.count) {
    attention.push({
      id: 'pay',
      kind: 'payment',
      severity: 'High',
      title: 'Platform fee pending',
      text: `₹${unpaid.amount} overdue on ${unpaid.count} order${
        unpaid.count > 1 ? 's' : ''
      } across ${unpaid.carts} cart${unpaid.carts > 1 ? 's' : ''}`,
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

        // All overdue platform fees, whatever the date range.
        pendingPayments: unpaid,

        rejectedPayments: {
          amount: curPayments.rejectedAmount,
          count: curPayments.rejectedCount,
        },

        // Share of all platform fees due so far that has been paid.
        collectionRate:
          totalRevenue + unpaid.amount
            ? +((totalRevenue / (totalRevenue + unpaid.amount)) * 100).toFixed(1)
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

        // Platform fees on paid orders placed in range (earned, paid or not).
        platformFeeRange: cur.fee,
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
          valid: cnt(paid),
          gmv: sumIf(paid, '$totalPrice'),
          g30: sumIf(
            { $and: [paid, { $gte: ['$createdAt', d30] }] },
            '$totalPrice',
          ),
          gPrev: sumIf(
            {
              $and: [
                paid,
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
          gmv: sumIf({ $and: [paid, isToday] }, '$totalPrice'),
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
      ownerId: String(c.userId),
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

// Newest-first paging: a "createdAt|_id" cursor from the previous page's last row.
function afterCursor(res, cursor) {
  if (!cursor) return {}
  const [createdAt, id] = String(cursor).split('|')
  const at = new Date(createdAt)
  if (isNaN(at) || !mongoose.isValidObjectId(id)) {
    res.status(400)
    throw new Error('Invalid cursor')
  }
  return { $or: [{ createdAt: { $lt: at } }, { createdAt: at, _id: { $lt: id } }] }
}
const nextCursor = (rows, hasMore) => {
  const last = rows[rows.length - 1]
  return hasMore && last ? `${last.createdAt.toISOString()}|${last._id}` : null
}

exports.orders = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500)
  const { status, cursor } = req.query

  const filter = {
    ...(status ? { status: String(status) } : {}),
    ...afterCursor(res, cursor),
  }

  // One extra row tells whether there's another page.
  const rows = await Order.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .select('orderNumber totalPrice status cartId orderItems createdAt')
    .lean()

  const hasMore = rows.length > limit
  if (hasMore) rows.pop()

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
        o.status === 'PENDING' ? 'PENDING' : o.status === 'CANCELLED' ? 'VOID' : 'PAID',
      createdAt: o.createdAt,
    }
  })

  res.json({
    success: true,
    data,
    pagination: { hasMore, nextCursor: nextCursor(rows, hasMore) },
  })
})

exports.payments = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 200)
  const [rows, sums] = await Promise.all([
    Payment.find(afterCursor(res, req.query.cursor))
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean(),
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
  const hasMore = rows.length > limit
  if (hasMore) rows.pop()
  const info = await cartInfo(rows.map((p) => p.cartId))
  res.json({
    success: true,
    data: {
      pagination: { hasMore, nextCursor: nextCursor(rows, hasMore) },
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
  const limit = Math.min(Number(req.query.limit) || 30, 200)
  const hasFb = { feedback: { $exists: true, $nin: ['', null] } }
  const [total, rows] = await Promise.all([
    Order.countDocuments(hasFb),
    Order.find({ ...hasFb, ...afterCursor(res, req.query.cursor) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .select('feedback orderNumber cartId createdAt')
      .lean(),
  ])
  const hasMore = rows.length > limit
  if (hasMore) rows.pop()
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
      pagination: { hasMore, nextCursor: nextCursor(rows, hasMore) },
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
      .select('orderNumber totalPrice cartId createdAt')
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
      text: `Order #${o.orderNumber} · ₹${o.totalPrice} · ${
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

/*
 * Marks a cart's platform fee as paid without Razorpay, e.g. paid in cash to
 * the GullyEats team, or to unlock a cart urgently. Confirms the cart's
 * pending payment if there is one; otherwise records the bill that's due as
 * paid. The cart unlocks on its next lock check.
 */
exports.markFeePaid = asyncHandler(async (req, res) => {
  const { cartId } = req.params
  if (!mongoose.isValidObjectId(cartId)) {
    return res.status(400).json({ success: false, message: 'Invalid cartId' })
  }

  const cart = await Cart.findById(cartId).lean()
  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' })
  }

  let payment = await Payment.findOne({ cartId, status: 'PENDING' })
  if (payment) {
    payment.status = 'VERIFIED'
    payment.verificationSource = 'MANUAL'
    payment.verifiedAt = new Date()
    await payment.save()
  } else {
    const status = await getCartPaymentStatus(cartId)
    if (!status.billingDate || !status.canPay || !(status.totalPending > 0)) {
      return res
        .status(400)
        .json({ success: false, message: 'No platform fee is due for this cart' })
    }
    payment = await createBillPayment(cart, status.billingDate, {
      status: 'VERIFIED',
      verificationSource: 'MANUAL',
    })
  }

  res.json({
    success: true,
    data: { id: String(payment._id), amount: payment.amount, billingDate: payment.billingDate },
  })
})

// Admin-issued PIN reset: only the hash is stored, so the new PIN is returned once for the admin to pass on.
exports.resetVendorPin = asyncHandler(async (req, res) => {
  const vendorId = String(req.params.vendorId || '').trim().toUpperCase()
  const user = await User.findOne({ userId: vendorId, role: 'vendor' })
  if (!user) {
    res.status(404)
    throw new Error('Vendor not found')
  }

  const pin = generatePin()
  user.pinHash = await bcrypt.hash(pin, 10)
  await user.save()

  res.json({ success: true, data: { userId: user.userId, name: user.name, pin } })
})

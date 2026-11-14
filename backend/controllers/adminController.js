// Platform-wide (super admin) queries. Drop into your backend next to cartController.js.
// Uses your existing models. NOTE: cart.location.coordinates is stored as [lat, lng] in your app.
const mongoose = require('mongoose')
const asyncHandler = require('../utils/asyncHandler')
const User = require('../models/User')
const Cart = require('../models/Cart')
const Order = require('../models/Order')
const Payment = require('../models/Payment')
const { getCartPaymentStatus, createBillPayment } = require('../utils/cartPaymentLock')
const { overdueByCart } = require('../utils/overdueFees')
const { logAction } = require('../utils/adminLog')
const AdminAction = require('../models/AdminAction')
const { getPlatformFee, setPlatformFee, MAX_FEE } = require('../utils/platformFee')
const { platformHealth } = require('../utils/platformHealth')

const TZ = 'Asia/Kolkata'
const DAY = 864e5
// A refund handed back within this time never shows as an Attention item.
const REFUND_GRACE_MS = 2 * 3600e3
const LARGE_ORDER = 1000

const bcrypt = require('bcrypt')
const generatePin = require('../utils/generatePin')
const jwt = require('jsonwebtoken')

const { ymd, istDay, todayStart, monthStart, rangeFor, hasRange } = require('../utils/dateRange')
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

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
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
  const { start, end } = rangeFor(req.query)
  res.json({ success: true, data: await buildSeries(start, end) })
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

// Points for the range [start, end): by hour for one day, by day up to two
// months, by week up to a year, else by month (IST).
async function buildSeries(start, end) {
  const span = (end - start) / DAY
  const unit = span <= 1 ? 'hour' : span <= 62 ? 'day' : span <= 366 ? 'week' : 'month'
  const tomorrow = end
  const istHour = (t) => new Date(+t + 5.5 * 3600e3).toISOString().slice(0, 13)

  // Bucket key: the IST day, the IST Monday of its week, or the month.
  const bucket = (date) => ({
    $dateToString: {
      format: { hour: '%Y-%m-%dT%H', month: '%Y-%m' }[unit] || '%Y-%m-%d',
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
  const keys = []
  if (unit === 'hour') {
    for (let t = +start; t < +end; t += 3600e3) keys.push(istHour(t))
  } else if (unit === 'day') {
    for (let t = +start; t < +end; t += DAY) keys.push(ymd(new Date(t)))
  } else if (unit === 'week') {
    // Weeks start on Monday (IST), so every bucket is a whole week.
    const offset = (new Date(`${ymd(start)}T00:00:00Z`).getUTCDay() + 6) % 7
    for (let t = +start - offset * DAY; t < +end; t += 7 * DAY) keys.push(ymd(new Date(t)))
  } else {
    let [y, m] = ymd(start).split('-').map(Number)
    for (; istDay(`${y}-${String(m).padStart(2, '0')}-01`) < end; m === 12 ? ((m = 1), y++) : m++) {
      keys.push(`${y}-${String(m).padStart(2, '0')}`)
    }
  }

  // ==========================================================
  // 4. LABEL
  // ==========================================================

  const label = (key) => {
    if (unit === 'hour') return `${key.slice(11)}:00`
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

// Totals of the overdue platform fees vendors owe us (see utils/overdueFees).
async function unpaidFees() {
  const total = (rows) => ({
    amount: rows.reduce((t, r) => t + r.amount, 0),
    count: rows.reduce((t, r) => t + r.orders, 0),
    carts: rows.length,
  })
  const now = new Date()
  const [overdue, all] = await Promise.all([overdueByCart(now), overdueByCart(now, { all: true })])
  // `all` adds fees not due yet: today's orders, and yesterday's before the 2am lock.
  return { ...total(overdue), all: total(all) }
}

// ============================================================
// OVERVIEW
// ============================================================
exports.overview = asyncHandler(async (req, res) => {
  const { start, end } = rangeFor(req.query)
  const prevStart = new Date(+start - (end - start))
  const today = todayStart()
  const tomorrow = new Date(+today + DAY)
  const yesterday = new Date(+today - DAY)
  const ms = monthStart()
  const prevMtdEnd = new Date(Math.min(+monthStart(1) + (tomorrow - ms), +ms))
  const week = new Date(+today - 6 * DAY)
  // ========================================================
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
    noLoc, // Total orders
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
    // TOTAL ORDERS
    // ======================================================
    Order.countDocuments(), // ======================================================
    // SERIES
    // ======================================================
    buildSeries(new Date(+today - 6 * DAY), tomorrow),
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
  // ORDER STATUS MAP
  // ========================================================
  const st = Object.fromEntries(todayStatus.map((s) => [s._id, s.n])) // ========================================================
  // ATTENTION
  // ========================================================
  const failedRefunds = await Payment.countDocuments({ 'refunds.status': 'FAILED' })
  const [refundsOwed, refundsFlagged] = await Promise.all([
    Order.countDocuments({ refunds: { $elemMatch: { refundedAt: null, owedAt: { $lt: new Date(Date.now() - REFUND_GRACE_MS) } } } }),
    Order.countDocuments({ refunds: { $elemMatch: { flaggedAt: { $ne: null }, flagResolvedAt: null } } }),
  ])
  const attention = [] // --------------------------------------------------------
  // Pending payments
  // --------------------------------------------------------
  if (failedRefunds) {
    attention.push({
      id: 'refund',
      kind: 'failed',
      severity: 'High',
      title: 'Refund failed',
      text: `${failedRefunds} duplicate online payment${failedRefunds > 1 ? 's' : ''} couldn't be refunded automatically. Refund in the Razorpay dashboard.`,
      to: '/actions?action=AUTO_REFUND',
    })
  }
  if (refundsFlagged) {
    attention.push({
      id: 'refund-flag',
      kind: 'failed',
      severity: 'High',
      title: 'Customers say they were not refunded',
      text: `${refundsFlagged} order${refundsFlagged > 1 ? 's' : ''} where the cart marked a refund but the customer says they didn't get it`,
      to: '/collections?refunds=flagged',
    })
  }
  if (refundsOwed) {
    attention.push({
      id: 'refund-owed',
      kind: 'payment',
      severity: 'Medium',
      title: 'Refunds not handed back',
      text: `${refundsOwed} cancelled or reduced paid order${refundsOwed > 1 ? 's' : ''} still owe the customer money`,
      to: '/collections?refunds=owed',
    })
  }
  if (unpaid.count) {
    attention.push({
      id: 'pay',
      kind: 'payment',
      severity: 'High',
      title: 'Platform fee pending',
      text: `₹${unpaid.amount} overdue on ${unpaid.count} order${
        unpaid.count > 1 ? 's' : ''
      } across ${unpaid.carts} cart${unpaid.carts > 1 ? 's' : ''}`,
      to: '/collections',
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
  const health = await platformHealth(req.io)
  // For the admin's own view: carts that earned GullyEats a fee today, and
  // carts onboarded this week.
  const [activeToday, newThisWeek] = await Promise.all([
    Order.distinct('cartId', { createdAt: { $gte: today, $lt: tomorrow }, status: { $in: ['PAID', 'SERVED'] } }),
    Cart.countDocuments({ createdAt: { $gte: week } }),
  ])
  const monthDays = new Date(Date.UTC(...ymd(today).split('-').slice(0, 2).map(Number), 0)).getUTCDate()
  const monthElapsed = Math.max(1 / 24, (Date.now() - ms) / DAY) // ========================================================
  // RESPONSE
  // ========================================================
  res.json({
    success: true,
    data: {
      // ====================================================
      // KPIs
      // ====================================================
      kpis: {
        // Platform fees on today's paid orders, and this month's so far with
        // where the month is heading at this pace.
        feesEarnedToday: { value: td.fee, paidOrders: td.valid },
        feesEarnedMonth: { value: month.fee, projected: Math.round((month.fee / monthElapsed) * monthDays) },
        activeCartsToday: activeToday.length,
        newCartsWeek: newThisWeek,
        inactiveCarts: inactive,

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
      // HEALTH
      // ====================================================
      health,
    },
  })
})

exports.owners = asyncHandler(async (req, res) => {
  const today = todayStart()
  const d30 = new Date(+today - 29 * DAY)
  const d60 = new Date(+today - 59 * DAY)
  const [owners, carts, rows] = await Promise.all([
    User.find({ role: 'vendor' })
      .select('name phoneNumber userId createdAt disabledAt')
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
        disabled: Boolean(o.disabledAt),
        status: o.disabledAt
          ? 'Disabled'
          : a.g30 > 0
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
            $and: [isToday, is('PAID')],
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
    const status = c.suspendedAt
      ? 'SUSPENDED'
      : pend.has(String(c._id))
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
      suspendReason: c.suspendReason || null,
      ordersToday: r.orders || 0,
      gmvToday: r.gmv || 0,
      current: r.current || 0,
      isOpen: Boolean(c.isOpen),
      lastActive: r.last || null,
      createdAt: c.createdAt,
    }
  })
  res.json({ success: true, data })
})

// Newest-first paging: a "createdAt|_id" cursor from the previous page's last row.
// Table search (?q=): carts whose name, or whose owner's name, contains it.
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const searchText = (req) => String(req.query.q || '').trim().slice(0, 60)
async function cartsMatching(text) {
  const re = new RegExp(escapeRe(text), 'i')
  const owners = await User.find({ role: 'vendor', name: re }).select('_id').lean()
  const carts = await Cart.find({ $or: [{ cartName: re }, { userId: { $in: owners.map((o) => o._id) } }] })
    .select('_id')
    .lean()
  return carts.map((c) => c._id)
}
// Order number, cart or owner; feedback also searches its text.
async function orderSearch(text, { feedback = false } = {}) {
  if (!text) return {}
  const n = /^#?\d+$/.test(text) ? Number(text.replace('#', '')) : null
  return {
    $or: [
      { cartId: { $in: await cartsMatching(text) } },
      ...(n != null ? [{ orderNumber: n }] : []),
      ...(feedback ? [{ feedback: new RegExp(escapeRe(text), 'i') }] : []),
    ],
  }
}

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

  // $and: the cursor and the search are both $or.
  const { start, end } = rangeFor(req.query)
  const filter = {
    $and: [
      status ? { status: String(status) } : {},
      hasRange(req.query) ? { createdAt: { $gte: start, $lt: end } } : {},
      await orderSearch(searchText(req)),
      afterCursor(res, cursor),
    ],
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

async function paymentSearch(text) {
  if (!text) return {}
  return { $or: [{ cartName: new RegExp(escapeRe(text), 'i') }, { cartId: { $in: await cartsMatching(text) } }] }
}

exports.payments = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 200)
  const [rows, sums] = await Promise.all([
    Payment.find({ $and: [await paymentSearch(searchText(req)), afterCursor(res, req.query.cursor)] })
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
        fromDate: p.fromDate || p.billingDate,
        billingDate: p.billingDate,
        verifiedAt: p.verifiedAt,
        source: p.verificationSource,
        refunds: p.refunds || [],
        createdAt: p.createdAt,
      })),
    },
  })
})

exports.feedback = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 200)
  const hasFb = {
    $or: [{ feedback: { $exists: true, $nin: ['', null] } }, { rating: { $gte: 1 } }],
  }
  const search = await orderSearch(searchText(req), { feedback: true })
  const [total, rows] = await Promise.all([
    Order.countDocuments({ $and: [hasFb, search] }),
    // $and: the cursor is an $or too, so spreading would drop one.
    Order.find({ $and: [hasFb, search, afterCursor(res, req.query.cursor)] })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .select('feedback rating orderNumber cartId createdAt')
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
        rating: o.rating ?? null,
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
    // Payments have no updatedAt (timestamps off).
    Payment.find().sort({ createdAt: -1 }).limit(4).lean(),
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
  let paidOnline = false
  if (payment) {
    // The vendor may already have paid this bill online: record that payment
    // instead, or they'd pay twice. If Razorpay can't be checked, stop.
    // Loaded here: paymentController builds the Razorpay client on load.
    const { findCapturedPayment } = require('./paymentController')
    let captured
    try {
      captured = await findCapturedPayment(payment)
    } catch (e) {
      res.status(502)
      throw new Error("Couldn't check Razorpay for an online payment. Try again in a minute.")
    }
    if (captured) {
      paidOnline = true
      payment.status = 'VERIFIED'
      payment.verifiedAt = new Date()
      payment.razorpayPaymentId = captured.id
      payment.verificationSource = 'RAZORPAY_RECOVERY'
      await payment.save()
    } else {
      // Not paid online: retire the checkout and settle the whole open bill
      // below (it may have grown since checkout opened). An online payment
      // that still arrives for it is refunded automatically.
      payment.status = 'EXPIRED'
      await payment.save()
      payment = null
    }
  }
  if (!payment) {
    const status = await getCartPaymentStatus(cartId)
    if (!status.billingDate || !status.canPay || !(status.totalPending > 0)) {
      return res
        .status(400)
        .json({ success: false, message: 'No platform fee is due for this cart' })
    }
    // The whole open bill: every unpaid finished day.
    payment = await createBillPayment(cart, status.billingDate, {
      status: 'VERIFIED',
      verificationSource: 'MANUAL',
      through: status.throughDate,
    })
  }

  if (!paidOnline) {
    await logAction(req, 'MARK_FEE_PAID', { kind: 'cart', id: cart._id, label: cart.cartName }, {
      amount: payment.amount,
      fromDate: payment.fromDate,
      billingDate: payment.billingDate,
      paymentId: payment._id,
    })
  }

  res.json({
    success: true,
    data: {
      id: String(payment._id),
      amount: payment.amount,
      billingDate: payment.billingDate,
      paidOnline,
      message: paidOnline
        ? `The vendor had already paid ${payment.amount} online, so that payment was recorded instead.`
        : `Marked ₹${payment.amount} as paid.`,
    },
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
  await logAction(req, 'RESET_PIN', { kind: 'vendor', id: user._id, label: `${user.name || 'Unnamed'} (${user.userId})` })

  res.json({ success: true, data: { userId: user.userId, name: user.name, pin } })
})

const reasonOf = (req) => String(req.body?.reason || '').trim().slice(0, 300) || null

async function findCart(req, res) {
  if (!mongoose.isValidObjectId(req.params.cartId)) {
    res.status(400)
    throw new Error('Invalid cartId')
  }
  const cart = await Cart.findById(req.params.cartId)
  if (!cart) {
    res.status(404)
    throw new Error('Cart not found')
  }
  return cart
}

// Stops a cart taking orders (customer or vendor-entered) until resumed.
exports.suspendCart = asyncHandler(async (req, res) => {
  const cart = await findCart(req, res)
  const reason = reasonOf(req)
  cart.suspendedAt = new Date()
  cart.suspendReason = reason
  cart.isOpen = false
  await cart.save()
  await logAction(req, 'SUSPEND_CART', { kind: 'cart', id: cart._id, label: cart.cartName }, { reason })
  res.json({ success: true, data: { id: String(cart._id), suspendedAt: cart.suspendedAt } })
})

exports.resumeCart = asyncHandler(async (req, res) => {
  const cart = await findCart(req, res)
  const owner = await User.findById(cart.userId).select('disabledAt').lean()
  if (owner?.disabledAt) {
    res.status(409)
    throw new Error("This cart's vendor is disabled. Enable the vendor first.")
  }
  cart.suspendedAt = null
  cart.suspendReason = null
  await cart.save()
  await logAction(req, 'RESUME_CART', { kind: 'cart', id: cart._id, label: cart.cartName })
  res.json({ success: true, data: { id: String(cart._id) } })
})

async function findVendor(req, res) {
  if (!mongoose.isValidObjectId(req.params.ownerId)) {
    res.status(400)
    throw new Error('Invalid vendor id')
  }
  const user = await User.findOne({ _id: req.params.ownerId, role: 'vendor' })
  if (!user) {
    res.status(404)
    throw new Error('Vendor not found')
  }
  return user
}

// Disabling a vendor blocks their (and their staff's) logins and sessions
// (middlewares/auth.js) and suspends every cart they own.
exports.disableVendor = asyncHandler(async (req, res) => {
  const user = await findVendor(req, res)
  const reason = reasonOf(req)
  user.disabledAt = new Date()
  await user.save()
  const r = await Cart.updateMany(
    { userId: user._id, suspendedAt: null },
    { $set: { suspendedAt: new Date(), suspendReason: reason || 'Vendor disabled', isOpen: false } },
  )
  await logAction(req, 'DISABLE_VENDOR', { kind: 'vendor', id: user._id, label: `${user.name || 'Unnamed'} (${user.userId})` }, {
    reason,
    cartsSuspended: r.modifiedCount,
  })
  res.json({ success: true, data: { id: String(user._id), cartsSuspended: r.modifiedCount } })
})

// Re-enables logins. Their carts stay suspended until resumed one by one.
exports.enableVendor = asyncHandler(async (req, res) => {
  const user = await findVendor(req, res)
  user.disabledAt = null
  await user.save()
  await logAction(req, 'ENABLE_VENDOR', { kind: 'vendor', id: user._id, label: `${user.name || 'Unnamed'} (${user.userId})` })
  res.json({ success: true, data: { id: String(user._id) } })
})

// The dashboard opens WhatsApp/SMS with the reminder text; this records that it was sent.
exports.logReminder = asyncHandler(async (req, res) => {
  const cart = await findCart(req, res)
  const amount = Number(req.body?.amount) || 0
  const channel = req.body?.channel === 'sms' ? 'sms' : 'whatsapp'
  await logAction(req, 'SEND_REMINDER', { kind: 'cart', id: cart._id, label: cart.cartName }, { amount, channel })
  res.json({ success: true })
})

// The action log, newest first, with the admin's name.
exports.actions = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 200)
  const filter = {
    ...(req.query.action ? { action: String(req.query.action) } : {}),
    ...afterCursor(res, req.query.cursor),
  }
  const rows = await AdminAction.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean()
  const hasMore = rows.length > limit
  if (hasMore) rows.pop()
  const admins = await User.find({ _id: { $in: rows.map((r) => r.adminId).filter(Boolean) } })
    .select('name email')
    .lean()
  const name = new Map(admins.map((a) => [String(a._id), a.name || a.email]))
  res.json({
    success: true,
    data: {
      items: rows.map((r) => ({
        id: String(r._id),
        at: r.createdAt,
        action: r.action,
        by: r.adminId ? name.get(String(r.adminId)) || 'Unknown admin' : 'System',
        target: r.target?.label || '—',
        targetKind: r.target?.kind,
        details: r.details || {},
      })),
      pagination: { hasMore, nextCursor: nextCursor(rows, hasMore) },
    },
  })
})

// Refunds on paid orders that were cancelled or made smaller: ?status=owed
// (not yet handed back) or flagged (the customer says they didn't get it).
exports.refunds = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 200)
  const match = req.query.status === 'flagged'
    ? { flaggedAt: { $ne: null }, flagResolvedAt: null }
    : { refundedAt: null }
  const rows = await Order.find({
    $and: [{ refunds: { $elemMatch: match } }, await orderSearch(searchText(req)), afterCursor(res, req.query.cursor)],
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .select('orderNumber cartId status refunds createdAt')
    .lean()
  const hasMore = rows.length > limit
  if (hasMore) rows.pop()
  const info = await cartInfo(rows.map((o) => o.cartId))
  const people = await User.find({ _id: { $in: rows.flatMap((o) => o.refunds.map((r) => r.refundedBy?._id).filter(Boolean)) } })
    .select('name phoneNumber')
    .lean()
  const who = new Map(people.map((u) => [String(u._id), u.name || u.phoneNumber || 'Unknown']))
  res.json({
    success: true,
    data: {
      items: rows.map((o) => {
        const c = info.get(String(o.cartId)) || {}
        const owed = o.refunds.filter((r) => !r.refundedAt)
        const last = o.refunds.at(-1)
        return {
          id: String(o._id),
          number: o.orderNumber,
          cartId: String(o.cartId),
          cart: c.name || '—',
          owner: c.owner || '—',
          status: o.status,
          owed: owed.reduce((t, r) => t + r.amount, 0),
          owedSince: owed[0]?.owedAt || null,
          refunded: o.refunds.filter((r) => r.refundedAt).reduce((t, r) => t + r.amount, 0),
          refundedAt: last?.refundedAt || null,
          refundedBy: last?.refundedBy ? `${who.get(String(last.refundedBy._id)) || 'Unknown'} (${last.refundedBy.role})` : null,
          flaggedAt: o.refunds.findLast((r) => r.flaggedAt && !r.flagResolvedAt)?.flaggedAt || null,
          reasons: [...new Set(o.refunds.map((r) => r.reason))],
        }
      }),
      pagination: { hasMore, nextCursor: nextCursor(rows, hasMore) },
    },
  })
})

// The admin dealt with a customer's "not refunded" flag (e.g. called the vendor).
exports.resolveRefundFlag = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.orderId)) {
    res.status(400)
    throw new Error('Invalid order id')
  }
  const order = await Order.findById(req.params.orderId)
  const open = order?.refunds.filter((r) => r.flaggedAt && !r.flagResolvedAt) || []
  if (!open.length) {
    res.status(404)
    throw new Error('No open flag on this order')
  }
  const now = new Date()
  for (const r of open) r.flagResolvedAt = now
  await order.save()
  const cart = await Cart.findById(order.cartId).select('cartName').lean()
  await logAction(req, 'RESOLVE_REFUND_FLAG', { kind: 'order', id: order._id, label: `#${order.orderNumber} · ${cart?.cartName || '—'}` }, {
    reason: String(req.body?.reason || '').trim().slice(0, 300) || null,
  })
  res.json({ success: true, data: { id: String(order._id) } })
})

exports.getSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { platformFee: await getPlatformFee(), maxPlatformFee: MAX_FEE } })
})

// Applies to orders placed from now on; placed orders keep the fee they were charged.
exports.updateSettings = asyncHandler(async (req, res) => {
  const fee = req.body?.platformFee
  // Whole rupees only, so totals and bills never pick up float rounding.
  if (!Number.isInteger(fee) || fee < 0 || fee > MAX_FEE) {
    res.status(400)
    throw new Error(`Platform fee must be a whole number of rupees from 0 to ${MAX_FEE}`)
  }
  const from = await getPlatformFee()
  if (fee !== from) {
    await setPlatformFee(fee)
    await logAction(req, 'SET_PLATFORM_FEE', undefined, { from, to: fee })
  }
  res.json({ success: true, data: { platformFee: fee, maxPlatformFee: MAX_FEE } })
})

// Shared with moderationController.
exports.afterCursor = afterCursor
exports.nextCursor = nextCursor
exports.cartInfo = cartInfo

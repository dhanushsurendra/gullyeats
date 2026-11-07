// Business insights for the admin dashboard: collections, fee leakage,
// vendor activation and churn, growth, and customer/operations patterns.
// Money follows the dashboard's rule: only PAID or SERVED orders count.
const asyncHandler = require('../utils/asyncHandler')
const User = require('../models/User')
const Cart = require('../models/Cart')
const Order = require('../models/Order')
const Payment = require('../models/Payment')
const { getISTMidnight } = require('../utils/cartPaymentLock')
const { overdueByCart } = require('../utils/overdueFees')

const TZ = 'Asia/Kolkata'
const DAY = 864e5
const PAID = ['PAID', 'SERVED']
const isPaid = { $in: ['$status', PAID] }
const cnt = (cond) => ({ $sum: { $cond: [cond, 1, 0] } })
const sumIf = (cond, field) => ({ $sum: { $cond: [cond, field, 0] } })
const share = (a, b) => (b ? +((a / b) * 100).toFixed(1) : 0)
const pct = (a, b) => (b ? +(((a - b) / b) * 100).toFixed(1) : null)
const round = (n, d = 0) => +Number(n || 0).toFixed(d)
const sum = (rows, k) => rows.reduce((t, r) => t + (r[k] || 0), 0)
const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
const today = () => getISTMidnight(new Date())
// IST midnight of the Monday of d's week.
const monday = (d) => {
  const day = getISTMidnight(d)
  return new Date(+day - ((new Date(`${ymd(day)}T00:00:00Z`).getUTCDay() + 6) % 7) * DAY)
}
const dayLabel = (d) =>
  d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: TZ })

// Cart, city and owner (with phone, for call lists) by cart id; all carts when ids is omitted.
async function cartsInfo(ids) {
  const carts = await Cart.find(ids ? { _id: { $in: ids } } : {})
    .select('cartName cartCity userId isOpen createdAt')
    .lean()
  const owners = await User.find({ _id: { $in: carts.map((c) => c.userId) } })
    .select('name phoneNumber')
    .lean()
  const byId = new Map(owners.map((u) => [String(u._id), u]))
  return new Map(
    carts.map((c) => {
      const u = byId.get(String(c.userId))
      return [
        String(c._id),
        {
          cartId: String(c._id),
          cart: c.cartName,
          city: c.cartCity,
          owner: u?.name || 'Unnamed',
          phone: u?.phoneNumber || null,
          isOpen: Boolean(c.isOpen),
          createdAt: c.createdAt,
        },
      ]
    }),
  )
}
const withInfo = (info, id) => info.get(String(id)) || { cartId: String(id), cart: '—' }

// ------------------------------------------------------------------
// Collections: who owes us overdue platform fees, and for how long.
// ------------------------------------------------------------------
const AGE_BUCKETS = [
  ['1–2 days', 1, 2],
  ['3–7 days', 3, 7],
  ['8+ days', 8, Infinity],
]

exports.collections = asyncHandler(async (req, res) => {
  const rows = await overdueByCart()
  const info = await cartsInfo(rows.map((r) => r._id))
  const t = today()

  const items = rows
    .map((r) => {
      const oldestDay = getISTMidnight(r.oldest)
      // Days since the oldest unpaid billing day: yesterday's bill = 1.
      const days = Math.max(1, Math.round((t - oldestDay) / DAY))
      return {
        ...withInfo(info, r._id),
        amount: r.amount,
        orders: r.orders,
        oldestDay,
        days,
        bucket: AGE_BUCKETS.find(([, lo, hi]) => days >= lo && days <= hi)[0],
      }
    })
    // Longest-owed first: the order to call vendors in.
    .sort((a, b) => b.days - a.days || b.amount - a.amount)

  res.json({
    success: true,
    data: {
      totals: { amount: sum(items, 'amount'), orders: sum(items, 'orders'), carts: items.length },
      buckets: AGE_BUCKETS.map(([label]) => {
        const b = items.filter((i) => i.bucket === label)
        return { label, carts: b.length, amount: sum(b, 'amount') }
      }),
      items,
    },
  })
})

// ------------------------------------------------------------------
// Fee leakage: carts whose cancelled or never-paid share is far above the
// platform's. A vendor who takes cash and cancels the order, or leaves it
// unpaid, avoids the ₹2 fee.
// ------------------------------------------------------------------
const LEAK_MIN_ORDERS = 10
const LEAK_MIN_RATE = 0.25
const STALE_PENDING_MS = 2 * 3600e3

exports.leakage = asyncHandler(async (req, res) => {
  const since = new Date(+today() - 29 * DAY)
  // Unpaid this long means the customer never paid through the app.
  const stale = new Date(Date.now() - STALE_PENDING_MS)
  const isCancelled = { $eq: ['$status', 'CANCELLED'] }
  const isStale = { $and: [{ $eq: ['$status', 'PENDING'] }, { $lt: ['$createdAt', stale] }] }

  const rows = await Order.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: '$cartId',
        orders: { $sum: 1 },
        cancelled: cnt(isCancelled),
        unpaid: cnt(isStale),
        manual: cnt({ $eq: ['$orderType', 'MANUAL'] }),
        feesAtRisk: sumIf({ $or: [isCancelled, isStale] }, '$platformFee'),
      },
    },
  ])

  const orders = sum(rows, 'orders')
  const lost = sum(rows, 'cancelled') + sum(rows, 'unpaid')
  const platformRate = orders ? lost / orders : 0
  const threshold = Math.max(2 * platformRate, LEAK_MIN_RATE)

  const flagged = rows.filter(
    (r) => r.orders >= LEAK_MIN_ORDERS && (r.cancelled + r.unpaid) / r.orders >= threshold,
  )
  const info = await cartsInfo(flagged.map((r) => r._id))

  res.json({
    success: true,
    data: {
      platform: { orders, rate: share(lost, orders), threshold: round(threshold * 100, 1) },
      minOrders: LEAK_MIN_ORDERS,
      items: flagged
        .map((r) => ({
          ...withInfo(info, r._id),
          orders: r.orders,
          cancelled: r.cancelled,
          unpaid: r.unpaid,
          leakRate: share(r.cancelled + r.unpaid, r.orders),
          manualShare: share(r.manual, r.orders),
          feesAtRisk: r.feesAtRisk,
        }))
        .sort((a, b) => b.leakRate - a.leakRate),
    },
  })
})

// ------------------------------------------------------------------
// Vendors: activation by onboarding week, and carts at risk of churning.
// ------------------------------------------------------------------
const COHORT_WEEKS = 12
const AT_RISK_MIN_ORDERS = 5

exports.vendors = asyncHandler(async (req, res) => {
  const t = today()
  const d7 = new Date(+t - 6 * DAY)
  const d14 = new Date(+t - 13 * DAY)
  const inLast7 = { $gte: ['$createdAt', d7] }
  const inPrev7 = { $and: [{ $gte: ['$createdAt', d14] }, { $lt: ['$createdAt', d7] }] }

  const [info, rows] = await Promise.all([
    cartsInfo(),
    // Activity = orders that weren't cancelled.
    // shortcut: groups every order ever; add a per-cart firstOrderAt/lastOrderAt once orders reach the millions.
    Order.aggregate([
      { $match: { status: { $ne: 'CANCELLED' } } },
      {
        $group: {
          _id: '$cartId',
          first: { $min: '$createdAt' },
          last: { $max: '$createdAt' },
          last7: cnt(inLast7),
          prev7: cnt(inPrev7),
        },
      },
    ]),
  ])
  const act = new Map(rows.map((r) => [String(r._id), r]))
  const carts = [...info.values()].map((c) => ({ ...c, a: act.get(c.cartId) }))

  const isActive = (c) => c.a && c.a.last >= d7
  const isQuiet = (c) => c.a && c.a.last < d14

  const firstWeek = new Date(+monday(t) - (COHORT_WEEKS - 1) * 7 * DAY)
  const cohorts = Array.from({ length: COHORT_WEEKS }, (_, i) => {
    const start = new Date(+firstWeek + i * 7 * DAY)
    const end = new Date(+start + 7 * DAY)
    const group = carts.filter((c) => c.createdAt >= start && c.createdAt < end)
    const firstIn3 = group.filter((c) => c.a && c.a.first - c.createdAt <= 3 * DAY).length
    return {
      week: dayLabel(start),
      onboarded: group.length,
      firstOrderIn3Days: firstIn3,
      activationRate: share(firstIn3, group.length),
      activeNow: group.filter(isActive).length,
      quiet: group.filter(isQuiet).length,
      neverOrdered: group.filter((c) => !c.a).length,
    }
  }).reverse() // newest week first

  const atRisk = carts
    .filter((c) => c.a && c.a.prev7 >= AT_RISK_MIN_ORDERS && c.a.last7 < c.a.prev7 * 0.5)
    .map(({ a, ...c }) => ({
      ...c,
      prev7: a.prev7,
      last7: a.last7,
      drop: share(a.prev7 - a.last7, a.prev7),
      lastOrder: a.last,
    }))
    .sort((x, y) => y.drop - x.drop || y.prev7 - x.prev7)

  res.json({
    success: true,
    data: {
      summary: {
        carts: carts.length,
        everOrdered: carts.filter((c) => c.a).length,
        activeNow: carts.filter(isActive).length,
        quiet: carts.filter(isQuiet).length,
        neverOrdered: carts.filter((c) => !c.a).length,
      },
      cohorts,
      atRisk,
    },
  })
})

// ------------------------------------------------------------------
// Growth: revenue run-rate, unit economics, and city performance.
// ------------------------------------------------------------------
exports.growth = asyncHandler(async (req, res) => {
  const now = new Date()
  const t = today()
  const [y, m] = ymd(t).split('-').map(Number)
  const monthStart = new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00+05:30`)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const elapsedDays = (now - monthStart) / DAY
  const since30 = new Date(+t - 29 * DAY)
  const prev30 = new Date(+since30 - 30 * DAY)
  const inLast30 = { $gte: ['$createdAt', since30] }

  const [[mtd], [collected], byCart, info] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: monthStart }, status: { $in: PAID } } },
      { $group: { _id: null, fees: { $sum: '$platformFee' }, gmv: { $sum: '$totalPrice' } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'VERIFIED', verifiedAt: { $gte: monthStart } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: prev30 }, status: { $in: PAID } } },
      {
        $group: {
          _id: '$cartId',
          orders30: cnt(inLast30),
          gmv30: sumIf(inLast30, '$totalPrice'),
          fees30: sumIf(inLast30, '$platformFee'),
          gmvPrev: sumIf({ $lt: ['$createdAt', since30] }, '$totalPrice'),
        },
      },
    ]),
    cartsInfo(),
  ])

  const active = byCart.filter((r) => r.orders30 > 0)
  const fees30 = sum(byCart, 'fees30')
  const gmv30 = sum(byCart, 'gmv30')
  const orders30 = sum(byCart, 'orders30')

  const cities = new Map()
  for (const c of info.values()) {
    const k = c.city || '—'
    const x = cities.get(k) || { city: k, carts: 0, live: 0, active30: 0, orders30: 0, gmv30: 0, fees30: 0, gmvPrev: 0 }
    x.carts += 1
    if (c.isOpen) x.live += 1
    cities.set(k, x)
  }
  for (const r of byCart) {
    const x = cities.get(withInfo(info, r._id).city || '—')
    if (!x) continue
    if (r.orders30 > 0) x.active30 += 1
    x.orders30 += r.orders30
    x.gmv30 += r.gmv30
    x.fees30 += r.fees30
    x.gmvPrev += r.gmvPrev
  }

  res.json({
    success: true,
    data: {
      runRate: {
        mtdFees: mtd?.fees || 0,
        mtdGmv: mtd?.gmv || 0,
        collectedMtd: collected?.amount || 0,
        // Fees earned so far this month, extended to the whole month at the same pace.
        projectedMonth: elapsedDays > 0 ? round(((mtd?.fees || 0) / elapsedDays) * daysInMonth) : 0,
        elapsedDays: round(elapsedDays, 1),
        daysInMonth,
        last30Fees: fees30,
      },
      unit: {
        activeCarts: active.length,
        feesPerActiveCart: active.length ? round(fees30 / active.length, 1) : 0,
        gmvPerActiveCart: active.length ? round(gmv30 / active.length) : 0,
        ordersPerCartPerDay: active.length ? round(orders30 / active.length / 30, 2) : 0,
        aov: orders30 ? round(gmv30 / orders30, 2) : 0,
      },
      cities: [...cities.values()]
        .map(({ gmvPrev, ...c }) => ({ ...c, growth: pct(c.gmv30, gmvPrev) }))
        .sort((a, b) => b.gmv30 - a.gmv30 || b.carts - a.carts),
    },
  })
})

// ------------------------------------------------------------------
// Customers & operations: busy hours, QR vs manual, parcel share, time
// from payment to served, and repeat customers.
// ------------------------------------------------------------------
const MAX_SERVE_MINS = 180 // longer means the vendor forgot to tap SERVE
const SLOW_MIN_SERVED = 10
const REPEAT_MIN_CUSTOMERS = 10

exports.operations = asyncHandler(async (req, res) => {
  const t = today()
  const since30 = new Date(+t - 29 * DAY)
  const since90 = new Date(+t - 89 * DAY)
  const paid30 = { createdAt: { $gte: since30 }, status: { $in: PAID } }

  const [heat, [ch], service, pairs] = await Promise.all([
    Order.aggregate([
      { $match: paid30 },
      {
        $group: {
          _id: {
            d: { $isoDayOfWeek: { date: '$createdAt', timezone: TZ } },
            h: { $hour: { date: '$createdAt', timezone: TZ } },
          },
          n: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: paid30 },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          qr: cnt({ $eq: ['$orderType', 'QR'] }),
          qrGmv: sumIf({ $eq: ['$orderType', 'QR'] }, '$totalPrice'),
          gmv: { $sum: '$totalPrice' },
          parcel: cnt({ $gt: ['$parcelCharge', 0] }),
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: since30 },
          status: 'SERVED',
          paidAt: { $ne: null },
          servedAt: { $ne: null },
        },
      },
      { $project: { cartId: 1, mins: { $divide: [{ $subtract: ['$servedAt', '$paidAt'] }, 60000] } } },
      { $match: { mins: { $gte: 0, $lte: MAX_SERVE_MINS } } },
      { $group: { _id: '$cartId', avg: { $avg: '$mins' }, n: { $sum: 1 } } },
    ]),
    // One row per (cart, customer phone) over 90 days.
    Order.aggregate([
      { $match: { createdAt: { $gte: since90 }, status: { $in: PAID }, phoneNumber: { $nin: [null, ''] } } },
      { $group: { _id: { c: '$cartId', p: '$phoneNumber' }, n: { $sum: 1 } } },
    ]),
  ])

  // Heatmap: 7 rows (Mon..Sun) × 24 hours, IST.
  const cells = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const r of heat) cells[r._id.d - 1][r._id.h] = r.n

  // Repeat customers, per cart and across the platform.
  const perCart = new Map()
  const perPhone = new Map()
  for (const { _id, n } of pairs) {
    const c = perCart.get(String(_id.c)) || { customers: 0, repeaters: 0 }
    c.customers += 1
    if (n >= 2) c.repeaters += 1
    perCart.set(String(_id.c), c)
    perPhone.set(_id.p, (perPhone.get(_id.p) || 0) + n)
  }
  const repeatCarts = [...perCart.entries()].filter(([, c]) => c.customers >= REPEAT_MIN_CUSTOMERS)

  const slow = service.filter((r) => r.n >= SLOW_MIN_SERVED).sort((a, b) => b.avg - a.avg).slice(0, 10)
  const served = sum(service, 'n')
  const info = await cartsInfo([...slow.map((r) => r._id), ...repeatCarts.map(([id]) => id)])

  const orders = ch?.orders || 0
  const qr = ch?.qr || 0
  const manualGmv = (ch?.gmv || 0) - (ch?.qrGmv || 0)

  res.json({
    success: true,
    data: {
      heatmap: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], cells, max: Math.max(0, ...cells.flat()) },
      channels: {
        orders,
        qr,
        manual: orders - qr,
        qrShare: share(qr, orders),
        qrAov: qr ? round(ch.qrGmv / qr, 2) : 0,
        manualAov: orders - qr ? round(manualGmv / (orders - qr), 2) : 0,
        parcel: ch?.parcel || 0,
        parcelShare: share(ch?.parcel || 0, orders),
      },
      service: {
        served,
        avgMins: served ? round(service.reduce((t, r) => t + r.avg * r.n, 0) / served, 1) : 0,
        slowest: slow.map((r) => ({ ...withInfo(info, r._id), avgMins: round(r.avg, 1), served: r.n })),
      },
      repeat: {
        customers: perPhone.size,
        repeaters: [...perPhone.values()].filter((n) => n >= 2).length,
        rate: share([...perPhone.values()].filter((n) => n >= 2).length, perPhone.size),
        topCarts: repeatCarts
          .map(([id, c]) => ({ ...withInfo(info, id), ...c, rate: share(c.repeaters, c.customers) }))
          .sort((a, b) => b.rate - a.rate || b.customers - a.customers)
          .slice(0, 10),
      },
    },
  })
})

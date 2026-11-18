const mongoose = require('mongoose')
const AreaAlert = require('../models/AreaAlert')
const Cart = require('../models/Cart')
const asyncHandler = require('../utils/asyncHandler')
const { findManagedCart } = require('../utils/cartAccess')
const { distanceKm } = require('../utils/discoverCarts')
const { sendToUsers } = require('../utils/push')
const { rangeFor, hasRange } = require('../utils/dateRange')

/*
 * Area alerts: a vendor warns every GullyEats cart within RADIUS_KM of their
 * cart (eviction drive, blocked road, rain, crowd). Vendors helping each
 * other, never a legality claim. The sending cart is never named to others.
 */

const RADIUS_KM = 1
const ACTIVE_MIN = 60
const COOLDOWN_MIN = 30
const MIN = 60 * 1000

const TITLES = {
  EVICTION: 'Eviction drive reported nearby',
  ROAD_BLOCKED: 'Road blocked nearby',
  RAIN: 'Heavy rain nearby',
  CROWD: 'Big crowd or event nearby',
}

const hasSpot = (c) => Array.isArray(c?.location?.coordinates) && c.location.coordinates.length === 2

// shortcut: distances in JS over every listed cart, like discoverCarts; add a geo index past a few thousand carts.
async function nearbyCarts(cart) {
  const carts = await Cart.find({
    isActive: { $ne: false },
    suspendedAt: null,
    'location.coordinates.1': { $exists: true },
  })
    .select('userId location.coordinates')
    .lean()
  return carts.filter(
    (c) =>
      String(c._id) !== String(cart._id) &&
      distanceKm(cart.location.coordinates, c.location.coordinates) <= RADIUS_KM,
  )
}

const metres = (km) => Math.max(100, Math.round((km * 1000) / 100) * 100)

// POST /api/carts/area-alerts/:cartId  { reason }
exports.createAreaAlert = asyncHandler(async (req, res) => {
  const { reason } = req.body || {}
  if (!TITLES[reason]) {
    res.status(400)
    throw new Error('Pick what is happening')
  }
  const cart = await findManagedCart(req, res, req.params.cartId)
  if (!hasSpot(cart)) {
    res.status(400)
    throw new Error('Set your cart location first')
  }
  const recent = await AreaAlert.findOne({
    cartId: cart._id,
    createdAt: { $gt: new Date(Date.now() - COOLDOWN_MIN * MIN) },
  }).lean()
  if (recent) {
    res.status(429)
    throw new Error('You already sent an alert in the last 30 minutes')
  }

  const alert = await AreaAlert.create({
    cartId: cart._id,
    userId: req.user._id,
    reason,
    coordinates: cart.location.coordinates,
    expiresAt: new Date(Date.now() + ACTIVE_MIN * MIN),
  })

  const near = await nearbyCarts(cart)
  // Other active reports of the same kind: a cart near one of them was already
  // notified, and its app now only counts one more vendor (one push per kind).
  const earlier = await AreaAlert.find({ _id: { $ne: alert._id }, reason, expiresAt: { $gt: new Date() } })
    .select('coordinates')
    .lean()
  let pushed = 0
  for (const c of near) req.io.to(String(c._id)).emit('area_alert')
  // One push per nearby cart, so each says how far that cart is.
  for (const c of near) {
    if (earlier.some((e) => distanceKm(c.location.coordinates, e.coordinates) <= RADIUS_KM)) continue
    pushed++
    sendToUsers(
      { $or: [{ _id: c.userId }, { role: 'staff', cartId: c._id }], _id: { $ne: req.user._id } },
      {
        notification: {
          title: `⚠️ ${TITLES[reason]}`,
          body: `About ${metres(distanceKm(cart.location.coordinates, c.location.coordinates))} m from your cart`,
        },
        channelId: 'area_alerts',
        data: { type: 'area', cartId: String(c._id) },
      },
    )
  }

  res.status(201).json({ success: true, data: { _id: alert._id, notified: near.length, pushed } })
})

// GET /api/carts/area-alerts/:cartId
exports.getAreaAlerts = asyncHandler(async (req, res) => {
  const cart = await findManagedCart(req, res, req.params.cartId)
  if (!hasSpot(cart)) return res.json({ success: true, data: [] })

  const alerts = await AreaAlert.find({ expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .lean()
  const me = String(req.user._id)
  const data = alerts
    .map((a) => ({ a, km: distanceKm(cart.location.coordinates, a.coordinates) }))
    .filter(({ km }) => km <= RADIUS_KM)
    .map(({ a, km }) => ({
      _id: a._id,
      reason: a.reason,
      distanceM: metres(km),
      createdAt: a.createdAt,
      confirmations: a.confirmedBy.length,
      confirmedByMe: a.confirmedBy.some((id) => String(id) === me),
      mine: String(a.cartId) === String(cart._id),
    }))
  res.json({ success: true, data })
})

// POST /api/carts/area-alerts/:cartId/confirm/:alertId
exports.confirmAreaAlert = asyncHandler(async (req, res) => {
  const cart = await findManagedCart(req, res, req.params.cartId)
  const alert = mongoose.isValidObjectId(req.params.alertId)
    ? await AreaAlert.findById(req.params.alertId).lean()
    : null
  if (
    !alert ||
    alert.expiresAt <= new Date() ||
    !hasSpot(cart) ||
    distanceKm(cart.location.coordinates, alert.coordinates) > RADIUS_KM
  ) {
    res.status(404)
    throw new Error('This alert has ended')
  }
  if (String(alert.cartId) === String(cart._id)) {
    res.status(400)
    throw new Error('You sent this alert')
  }
  await AreaAlert.updateOne(
    { _id: alert._id },
    { $addToSet: { confirmedBy: req.user._id }, $set: { expiresAt: new Date(Date.now() + ACTIVE_MIN * MIN) } },
  )
  res.json({ success: true })
})

// Alerts within RADIUS_KM of each other (oldest first) form one hotspot,
// centred on its first alert.
function hotspots(alerts) {
  const spots = []
  for (const a of [...alerts].sort((x, y) => x.createdAt - y.createdAt)) {
    const s = spots.find((h) => distanceKm([h.lat, h.lng], a.coordinates) <= RADIUS_KM)
    if (s) s.items.push(a)
    else spots.push({ lat: a.coordinates[0], lng: a.coordinates[1], items: [a] })
  }
  return spots
}

// GET /api/admin/area-alerts?range=|startDate=&endDate= (none: all 90 kept days)
// Admins see which cart sent each alert; vendors never do.
exports.adminAreaAlerts = asyncHandler(async (req, res) => {
  const filter = {}
  if (hasRange(req.query)) {
    const { start, end } = rangeFor(req.query)
    filter.createdAt = { $gte: start, $lt: end }
  }
  // shortcut: whole window in memory, fine for 90 days of alerts; aggregate if it grows past ~10k rows.
  const rows = await AreaAlert.find(filter).sort({ createdAt: -1 }).lean()
  const carts = await Cart.find({ _id: { $in: [...new Set(rows.map((a) => String(a.cartId)))] } })
    .select('cartName cartCity address')
    .lean()
  const cartOf = new Map(carts.map((c) => [String(c._id), c]))
  const now = new Date()
  const reports = (a) => 1 + a.confirmedBy.length

  const alerts = rows.map((a) => {
    const c = cartOf.get(String(a.cartId))
    return {
      id: a._id,
      reason: a.reason,
      lat: a.coordinates[0],
      lng: a.coordinates[1],
      createdAt: a.createdAt,
      expiresAt: a.expiresAt,
      active: a.expiresAt > now,
      reports: reports(a),
      cart: { id: a.cartId, name: c?.cartName || 'Removed cart', city: c?.cartCity || '', address: c?.address || '' },
    }
  })
  const byReason = Object.fromEntries(Object.keys(TITLES).map((r) => [r, 0]))
  for (const a of rows) byReason[a.reason] += 1

  const spots = hotspots(rows)
    .map((s) => ({
      // Drawn at the middle of its alerts, not the first one.
      lat: s.items.reduce((t, a) => t + a.coordinates[0], 0) / s.items.length,
      lng: s.items.reduce((t, a) => t + a.coordinates[1], 0) / s.items.length,
      alerts: s.items.length,
      reports: s.items.reduce((t, a) => t + reports(a), 0),
      carts: new Set(s.items.map((a) => String(a.cartId))).size,
      reasons: s.items.reduce((m, a) => ({ ...m, [a.reason]: (m[a.reason] || 0) + 1 }), {}),
      last: s.items[s.items.length - 1].createdAt,
      area: cartOf.get(String(s.items[0].cartId))?.address || cartOf.get(String(s.items[0].cartId))?.cartName || '',
    }))
    .sort((a, b) => b.reports - a.reports || b.last - a.last)

  res.json({
    success: true,
    data: {
      radiusKm: RADIUS_KM,
      totals: {
        alerts: rows.length,
        reports: rows.reduce((t, a) => t + reports(a), 0),
        carts: new Set(rows.map((a) => String(a.cartId))).size,
        active: alerts.filter((a) => a.active).length,
      },
      byReason,
      hotspots: spots,
      alerts,
    },
  })
})

exports.RADIUS_KM = RADIUS_KM

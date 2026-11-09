const crypto = require('crypto')
const mongoose = require('mongoose')
const asyncHandler = require('../utils/asyncHandler')
const Order = require('../models/Order')
const ConfessionBan = require('../models/ConfessionBan')

/*
 * Confession callers prove they've ordered by sending
 *   X-Gully-Order: <orderId>.<accessKey>[,<orderId>.<accessKey>...]
 * (the keys createOrder gave the customer's phone; the first is the order
 * acting now). Sets req.poster to
 * { orderId, cartId, authorKey, bannedUntil, orderIds }. authorKey is an HMAC
 * of the phone number given with the order (or the order id when there was
 * none), so one customer's orders count as one person for likes, reports and
 * bans, and nothing stored with a confession says who they are.
 *
 * The phone number is never verified, so it must not reveal posts: "mine"
 * means posted from one of orderIds, the orders whose keys this phone holds.
 */
function authorKeyFor(order) {
  const phone = String(order.phoneNumber || '').replace(/\D/g, '').slice(-10)
  const who = phone ? `p:${phone}` : `o:${order._id}`
  return crypto.createHmac('sha256', process.env.JWT_SECRET || 'dev').update(who).digest('hex')
}

const sameKey = (a, b) =>
  typeof a === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))

const MAX_KEYS = 20

async function findPoster(header) {
  const pairs = String(header || '').split(',').slice(0, MAX_KEYS).map((p) => p.trim().split('.'))
  const [orderId, key] = pairs[0]
  if (!mongoose.isValidObjectId(orderId) || !/^[a-f0-9]{32}$/.test(key || '')) return { error: 401 }
  const wellFormed = pairs.filter(([id, k]) => mongoose.isValidObjectId(id) && /^[a-f0-9]{32}$/.test(k || ''))
  const orders = await Order.find({ _id: { $in: wellFormed.map(([id]) => id) } })
    .select('+accessKey status phoneNumber cartId')
    .lean()
  const byId = new Map(orders.map((o) => [String(o._id), o]))
  const owned = wellFormed.filter(([id, k]) => byId.has(id) && sameKey(byId.get(id).accessKey, k)).map(([id]) => id)
  const order = byId.get(orderId)
  if (!order || !owned.includes(orderId)) return { error: 401 }
  if (order.status === 'CANCELLED') return { error: 403 }
  const authorKey = authorKeyFor(order)
  const ban = await ConfessionBan.findOne({ authorKey, until: { $gt: new Date() } }).select('until').lean()
  return {
    poster: { orderId: order._id, cartId: order.cartId, authorKey, bannedUntil: ban?.until || null, orderIds: owned },
  }
}

const MESSAGES = {
  401: 'Place an order at a GullyEats cart to join GullyPulse.',
  403: 'A cancelled order can’t be used for GullyPulse. Place a new order to join in.',
}

// required: refuse without a valid order. allowBanned: let a suspended poster
// through (reads); otherwise they get a 403.
const confessionPoster = ({ required = true, allowBanned = false } = {}) =>
  asyncHandler(async (req, res, next) => {
    const header = req.headers['x-gully-order']
    if (!header && !required) return next()
    const { poster, error } = await findPoster(header)
    if (error) {
      if (!required) return next()
      res.status(error)
      throw new Error(MESSAGES[error])
    }
    if (poster.bannedUntil && !allowBanned) {
      res.status(403)
      throw new Error('Your GullyPulse posting privileges are suspended.')
    }
    req.poster = poster
    next()
  })

module.exports = { confessionPoster, authorKeyFor }

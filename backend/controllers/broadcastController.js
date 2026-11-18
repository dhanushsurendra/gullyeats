const mongoose = require('mongoose')
const asyncHandler = require('../utils/asyncHandler')
const User = require('../models/User')
const Cart = require('../models/Cart')
const Order = require('../models/Order')
const { sendToUsers } = require('../utils/push')
const { logAction } = require('../utils/adminLog')
const { overdueByCart } = require('../utils/overdueFees')

/*
 * An admin's own message to vendors, sent as a push to the vendor app on the
 * "announcements" channel. The audience is a group the server works out
 * itself (all carts, unpaid fees, no orders in N days) or carts the admin
 * picked by search; the push goes to their owners (and staff if ticked).
 * Disabled owners and suspended carts never get one.
 */
const MAX_TITLE = 65
const MAX_BODY = 240
const MAX_PICKED = 50
const DAY = 864e5
const GROUPS = ['all', 'unpaid', 'inactive']

const yes = (v) => v === true || v === 'true' || v === '1'
const daysOf = (v) => Math.min(365, Math.max(1, parseInt(v, 10) || 30))
const pickedIds = (v) => {
  const list = Array.isArray(v) ? v : String(v || '').split(',')
  return [...new Set(list.map((s) => String(s).trim()).filter(Boolean))]
}
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The carts an audience covers: [{ _id, userId, cartName }].
async function audienceCarts({ audience, days, cartIds }) {
  // Suspended carts and carts of disabled owners never get a message.
  const live = { suspendedAt: null, userId: { $nin: await User.distinct('_id', { disabledAt: { $ne: null } }) } }
  const pick = 'userId cartName'
  if (audience === 'picked') return Cart.find({ ...live, _id: { $in: cartIds } }).select(pick).lean()
  if (audience === 'unpaid') {
    const owed = await overdueByCart()
    return Cart.find({ ...live, _id: { $in: owed.map((o) => o._id) } }).select(pick).lean()
  }
  if (audience === 'inactive') {
    // Uses the createdAt index: only orders since the cut-off are read.
    const since = new Date(Date.now() - days * DAY)
    const active = await Order.distinct('cartId', { createdAt: { $gte: since } })
    return Cart.find({ ...live, _id: { $nin: active }, createdAt: { $lt: since } }).select(pick).lean()
  }
  return Cart.find(live).select(pick).lean()
}

const recipients = (carts, staff) => ({
  disabledAt: null,
  $or: [
    { _id: { $in: carts.map((c) => c.userId) }, role: 'vendor' },
    ...(staff ? [{ role: 'staff', cartId: { $in: carts.map((c) => c._id) } }] : []),
  ],
})

// Reads and checks { audience, days, cartIds } from a query or a body.
function readAudience(src, res) {
  const audience = GROUPS.includes(src.audience) ? src.audience : 'picked'
  const cartIds = audience === 'picked' ? pickedIds(src.cartIds) : []
  if (audience === 'picked' && (!cartIds.length || cartIds.length > MAX_PICKED || !cartIds.every(mongoose.isValidObjectId))) {
    res.status(400)
    throw new Error(`Pick between 1 and ${MAX_PICKED} carts`)
  }
  return { audience, days: daysOf(src.days), cartIds }
}

// GET /api/admin/broadcast?audience=all|unpaid|inactive|picked&days=30&cartIds=a,b&staff=1
// How many carts, people and phones a send would reach. Never lists the carts.
exports.preview = asyncHandler(async (req, res) => {
  const a = readAudience(req.query, res)
  const carts = await audienceCarts(a)
  const users = carts.length ? await User.find(recipients(carts, yes(req.query.staff))).select('+pushIds').lean() : []
  const onApp = users.filter((u) => u.pushIds?.length)
  res.json({
    success: true,
    data: {
      carts: carts.length,
      users: users.length,
      onApp: onApp.length,
      phones: onApp.reduce((t, u) => t + u.pushIds.length, 0),
    },
  })
})

// GET /api/admin/broadcast/search?q=  Up to 8 carts by cart name, city or owner name.
exports.search = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60)
  if (q.length < 2) return res.json({ success: true, data: [] })
  const re = new RegExp(escape(q), 'i')
  const owners = await User.find({ role: 'vendor', disabledAt: null, name: re }).select('_id').limit(50).lean()
  const carts = await Cart.find({
    suspendedAt: null,
    $or: [{ cartName: re }, { cartCity: re }, { userId: { $in: owners.map((o) => o._id) } }],
  })
    .select('cartName cartCity userId')
    .sort({ cartName: 1 })
    .limit(8)
    .lean()
  const people = await User.find({ _id: { $in: carts.map((c) => c.userId) }, disabledAt: null }).select('+pushIds name').lean()
  const of = new Map(people.map((u) => [String(u._id), u]))
  res.json({
    success: true,
    data: carts
      .filter((c) => of.has(String(c.userId)))
      .map((c) => {
        const o = of.get(String(c.userId))
        return { id: c._id, name: c.cartName, city: c.cartCity, owner: o.name || '', onApp: !!o.pushIds?.length }
      }),
  })
})

// POST /api/admin/broadcast { title, body, staff, audience, days, cartIds }
exports.send = asyncHandler(async (req, res) => {
  const title = String(req.body?.title || '').trim()
  const body = String(req.body?.body || '').trim()
  const staff = yes(req.body?.staff)
  if (!title || !body) {
    res.status(400)
    throw new Error('Add a title and a message')
  }
  if (title.length > MAX_TITLE || body.length > MAX_BODY) {
    res.status(400)
    throw new Error(`Keep the title under ${MAX_TITLE} and the message under ${MAX_BODY} characters`)
  }
  const a = readAudience(req.body || {}, res)
  const carts = await audienceCarts(a)
  const filter = recipients(carts, staff)
  const users = carts.length ? await User.countDocuments(filter) : 0
  const { phones, sent } = carts.length
    ? await sendToUsers(filter, {
        notification: { title, body },
        channelId: 'announcements',
        data: { type: 'announcement' },
      })
    : { phones: 0, sent: 0 }

  const target = carts.length === 1 ? { kind: 'cart', id: carts[0]._id, label: carts[0].cartName } : undefined
  await logAction(req, 'SEND_BROADCAST', target, {
    title,
    body,
    staff,
    audience: a.audience,
    ...(a.audience === 'inactive' && { days: a.days }),
    ...(a.audience === 'picked' && { picked: carts.map((c) => c.cartName) }),
    carts: carts.length,
    users,
    phones,
    sent,
  })
  res.json({ success: true, data: { carts: carts.length, users, phones, sent } })
})

exports.MAX_TITLE = MAX_TITLE
exports.MAX_BODY = MAX_BODY
exports.MAX_PICKED = MAX_PICKED

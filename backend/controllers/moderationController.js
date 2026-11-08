const mongoose = require('mongoose')
const asyncHandler = require('../utils/asyncHandler')
const Confession = require('../models/Confession')
const ConfessionComment = require('../models/ConfessionComment')
const ConfessionReport = require('../models/ConfessionReport')
const ConfessionBan = require('../models/ConfessionBan')
const AdminAction = require('../models/AdminAction')
const Order = require('../models/Order')
const User = require('../models/User')
const { logAction } = require('../utils/adminLog')
const { PIPELINE, hotUpdate, bumpCommentCount } = require('../utils/confessionScore')
const { afterCursor, nextCursor, cartInfo } = require('./adminController')

// Admin Moderation Centre for GullyPulse confessions and comments.

const MODELS = { confession: Confession, comment: ConfessionComment }

// Which statuses each action may start from, and where it leads.
const ACTIONS = {
  approve: { from: ['PENDING_REVIEW', 'BLOCKED', 'REJECTED'], to: 'PUBLISHED' },
  restore: { from: ['REPORTED', 'REMOVED'], to: 'PUBLISHED' },
  reject: { from: ['PENDING_REVIEW', 'BLOCKED'], to: 'REJECTED' },
  remove: { from: ['PUBLISHED', 'REPORTED'], to: 'REMOVED' },
}

const fail = (res, code, message) => {
  res.status(code)
  throw new Error(message)
}

function modelFor(res, kind) {
  const Model = MODELS[kind]
  if (!Model) fail(res, 400, 'kind must be confession or comment')
  return Model
}

function readReason(res, body) {
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (!reason) fail(res, 400, 'Give a reason')
  return reason.slice(0, 300)
}

// A short, stable label for a poster; the full key never leaves admin APIs either.
const posterId = (key) => (key ? `P-${key.slice(0, 8).toUpperCase()}` : '—')
const maskPhone = (p) => (p ? `••••••${String(p).slice(-4)}` : null)

async function loadItem(res, kind, id) {
  const Model = modelFor(res, kind)
  if (!mongoose.isValidObjectId(id)) fail(res, 404, 'Not found')
  const item = await Model.findById(id).lean()
  if (!item) fail(res, 404, 'Not found')
  return { Model, item }
}

// Rows for a queue: ?kind=confession|comment&status=A,B&cursor=
exports.queue = asyncHandler(async (req, res) => {
  const kind = req.query.kind || 'confession'
  const Model = modelFor(res, kind)
  const statuses = String(req.query.status || 'PENDING_REVIEW').split(',')
  if (!statuses.every((s) => Confession.STATUSES.includes(s))) fail(res, 400, 'Invalid status')
  const limit = Math.min(Number(req.query.limit) || 30, 100)

  const rows = await Model.find({ status: { $in: statuses }, ...afterCursor(res, req.query.cursor) })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean()
  const hasMore = rows.length > limit
  if (hasMore) rows.pop()

  const [info, orders, parents] = await Promise.all([
    cartInfo(rows.map((r) => r.cartId).filter(Boolean)),
    Order.find({ _id: { $in: rows.map((r) => r.orderId) } }).select('orderNumber').lean(),
    kind === 'comment'
      ? Confession.find({ _id: { $in: rows.map((r) => r.confessionId) } }).select('publicId text').lean()
      : [],
  ])
  const orderNo = new Map(orders.map((o) => [String(o._id), o.orderNumber]))
  const parent = new Map(parents.map((p) => [String(p._id), p]))

  res.json({
    success: true,
    data: {
      items: rows.map((r) => ({
        id: String(r._id),
        kind,
        publicId: r.publicId,
        text: r.text,
        status: r.status,
        at: r.createdAt,
        poster: posterId(r.authorKey),
        orderNumber: orderNo.get(String(r.orderId)) ?? null,
        cart: info.get(String(r.cartId))?.name || null,
        city: info.get(String(r.cartId))?.city || null,
        matches: r.moderation?.matches || [],
        reason: r.moderation?.reason || '',
        reportCount: r.reportCount || 0,
        reportReasons: r.reportReasons || {},
        likes: r.likeCount,
        comments: r.commentCount,
        parent: r.confessionId
          ? { publicId: parent.get(String(r.confessionId))?.publicId, text: parent.get(String(r.confessionId))?.text }
          : null,
      })),
      pagination: { hasMore, nextCursor: nextCursor(rows, hasMore) },
    },
  })
})

// Number of items waiting in each queue, for the tab badges.
exports.counts = asyncHandler(async (req, res) => {
  const n = (Model, status) => Model.countDocuments({ status })
  const [review, reviewComments, reported, reportedComments, blocked, blockedComments] = await Promise.all([
    n(Confession, 'PENDING_REVIEW'),
    n(ConfessionComment, 'PENDING_REVIEW'),
    n(Confession, 'REPORTED'),
    n(ConfessionComment, 'REPORTED'),
    n(Confession, 'BLOCKED'),
    n(ConfessionComment, 'BLOCKED'),
  ])
  res.json({
    success: true,
    data: { review, reviewComments, reported, reportedComments, blocked, blockedComments },
  })
})

// One item with everything an admin needs to decide.
exports.item = asyncHandler(async (req, res) => {
  const { kind, id } = req.params
  const { item } = await loadItem(res, kind, id)

  const [reports, history, order, info, ban, postCounts, commentCounts, parent] = await Promise.all([
    ConfessionReport.find({ targetId: item._id }).sort({ createdAt: -1 }).limit(200).lean(),
    AdminAction.find({ 'target.id': item._id }).sort({ createdAt: -1 }).limit(100).lean(),
    Order.findById(item.orderId).select('orderNumber phoneNumber createdAt').lean(),
    cartInfo(item.cartId ? [item.cartId] : []),
    ConfessionBan.findOne({ authorKey: item.authorKey }).lean(),
    Confession.aggregate([{ $match: { authorKey: item.authorKey } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    ConfessionComment.aggregate([{ $match: { authorKey: item.authorKey } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    item.confessionId ? Confession.findById(item.confessionId).select('publicId text status').lean() : null,
  ])
  const admins = await User.find({ _id: { $in: history.map((h) => h.adminId).filter(Boolean) } }).select('name email').lean()
  const adminName = new Map(admins.map((a) => [String(a._id), a.name || a.email]))
  const tally = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]))
  const cart = info.get(String(item.cartId))

  res.json({
    success: true,
    data: {
      id: String(item._id),
      kind,
      publicId: item.publicId,
      text: item.text,
      status: item.status,
      at: item.createdAt,
      publishedAt: item.publishedAt,
      likes: item.likeCount,
      comments: item.commentCount,
      moderation: item.moderation || {},
      reportCount: item.reportCount || 0,
      reportReasons: item.reportReasons || {},
      parent: parent && { publicId: parent.publicId, text: parent.text, status: parent.status },
      poster: {
        id: posterId(item.authorKey),
        orderId: String(item.orderId),
        orderNumber: order?.orderNumber ?? null,
        orderedAt: order?.createdAt ?? null,
        phone: maskPhone(order?.phoneNumber),
        cart: cart?.name || null,
        city: cart?.city || null,
        suspendedUntil: ban && ban.until > new Date() ? ban.until : null,
        posts: tally(postCounts),
        comments: tally(commentCounts),
      },
      reports: reports.map((r) => ({ reason: r.reason, at: r.createdAt, by: posterId(r.authorKey) })),
      history: history.map((h) => ({
        action: h.action,
        at: h.createdAt,
        by: h.adminId ? adminName.get(String(h.adminId)) || 'Unknown admin' : 'System',
        reason: h.details?.reason || '',
        from: h.details?.from,
        to: h.details?.to,
      })),
    },
  })
})

// approve | reject | remove | restore, with a reason. Logged with the admin and time.
exports.act = asyncHandler(async (req, res) => {
  const { kind, id, action } = req.params
  const rule = ACTIONS[action]
  if (!rule) fail(res, 400, 'Unknown action')
  const reason = readReason(res, req.body)
  const { Model, item } = await loadItem(res, kind, id)
  if (!rule.from.includes(item.status)) fail(res, 409, `Can't ${action} an item that is ${item.status}`)

  const set = { status: rule.to }
  if (rule.to === 'PUBLISHED' && !item.publishedAt) set.publishedAt = new Date()
  // A restored item starts counting reports again; the old ones stay in its history.
  if (action === 'restore') Object.assign(set, { reportCount: 0, reportReasons: {} })

  // Conditional on the status we checked, so two admins can't both act.
  const updated = await Model.findOneAndUpdate({ _id: item._id, status: item.status }, { $set: set }, { returnDocument: 'after' }).lean()
  if (!updated) fail(res, 409, 'Someone else just changed this item. Reload and try again.')

  const wasLive = item.status === 'PUBLISHED'
  const isLive = rule.to === 'PUBLISHED'
  if (kind === 'confession' && isLive) await Confession.updateOne({ _id: item._id }, hotUpdate(), PIPELINE)
  if (kind === 'comment' && wasLive !== isLive) await bumpCommentCount(item.confessionId, isLive ? 1 : -1)

  await logAction(
    req,
    `${action.toUpperCase()}_${kind.toUpperCase()}`,
    { kind, id: item._id, label: item.publicId },
    { reason, from: item.status, to: rule.to, ...(action === 'restore' ? { reportCount: item.reportCount } : {}) },
  )
  res.json({ success: true, data: { id: String(item._id), status: rule.to } })
})

// Suspends (days > 0) or lifts (days = 0) the poster behind an item.
exports.suspend = asyncHandler(async (req, res) => {
  const { kind, id } = req.params
  const reason = readReason(res, req.body)
  const days = Number(req.body?.days)
  if (!Number.isInteger(days) || days < 0 || days > 3650) fail(res, 400, 'days must be 0 to 3650')
  const { item } = await loadItem(res, kind, id)

  if (days === 0) {
    await ConfessionBan.deleteOne({ authorKey: item.authorKey })
  } else {
    const until = new Date(Date.now() + days * 864e5)
    await ConfessionBan.updateOne(
      { authorKey: item.authorKey },
      { $set: { until, reason, adminId: req.user._id } },
      { upsert: true },
    )
  }
  await logAction(
    req,
    days === 0 ? 'UNSUSPEND_POSTER' : 'SUSPEND_POSTER',
    { kind: 'poster', id: item._id, key: item.authorKey, label: posterId(item.authorKey) },
    { reason, days },
  )
  res.json({ success: true, data: { poster: posterId(item.authorKey), days } })
})

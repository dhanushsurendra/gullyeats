const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const asyncHandler = require('../utils/asyncHandler')
const Notification = require('../models/Notification')
const { toClient } = require('../utils/adminNotify')
const { adminSocketSecret } = require('../utils/socketRooms')
const Order = require('../models/Order')
const Confession = require('../models/Confession')
const ConfessionComment = require('../models/ConfessionComment')
const DishCandidate = require('../models/DishCandidate')
const { overdueByCart } = require('../utils/overdueFees')
const { MIN_CARTS } = require('../utils/dishCandidates')

// GET /admin/notifications?before=<iso>: newest 50, and how many are unread.
exports.list = asyncHandler(async (req, res) => {
  const me = req.user._id
  const before = req.query.before ? new Date(req.query.before) : null
  const [rows, unread] = await Promise.all([
    Notification.find(before && !Number.isNaN(+before) ? { createdAt: { $lt: before } } : {})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    Notification.countDocuments({ readBy: { $ne: new mongoose.Types.ObjectId(String(me)) } }),
  ])
  res.json({ success: true, data: { items: rows.map((n) => toClient(n, me)), unread, hasMore: rows.length === 50 } })
})

// POST /admin/notifications/read { ids } marks those read; { all: true } every one.
exports.markRead = asyncHandler(async (req, res) => {
  const { ids, all } = req.body || {}
  if (!all && !(Array.isArray(ids) && ids.length && ids.every((id) => mongoose.isValidObjectId(String(id))))) {
    res.status(400)
    throw new Error('Pass ids or all')
  }
  const me = new mongoose.Types.ObjectId(String(req.user._id))
  await Notification.updateMany(all ? { readBy: { $ne: me } } : { _id: { $in: ids } }, { $addToSet: { readBy: me } })
  res.json({ success: true })
})

// GET /admin/notifications/socket-token: lets the dashboard join the live room.
exports.socketToken = (req, res) =>
  res.json({
    success: true,
    data: { token: jwt.sign({ _id: req.user._id, role: 'admin' }, adminSocketSecret(), { expiresIn: '1m' }) },
  })

// GET /admin/todo: what's waiting in each to-do page, for the sidebar badges.
// Collections: carts with overdue fees + refunds customers flagged.
exports.todo = asyncHandler(async (req, res) => {
  const waiting = { status: { $in: ['PENDING_REVIEW', 'REPORTED'] } }
  const [overdue, flagged, posts, comments, dishes] = await Promise.all([
    overdueByCart(),
    Order.countDocuments({ refunds: { $elemMatch: { flaggedAt: { $ne: null }, flagResolvedAt: null } } }),
    Confession.countDocuments(waiting),
    ConfessionComment.countDocuments(waiting),
    DishCandidate.countDocuments({ status: 'PENDING', [`carts.${MIN_CARTS - 1}`]: { $exists: true } }),
  ])
  res.json({ success: true, data: { collections: overdue.length + flagged, moderation: posts + comments, dishes } })
})

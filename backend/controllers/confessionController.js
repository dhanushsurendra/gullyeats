const crypto = require('crypto')
const mongoose = require('mongoose')
const asyncHandler = require('../utils/asyncHandler')
const Confession = require('../models/Confession')
const ConfessionComment = require('../models/ConfessionComment')
const ConfessionLike = require('../models/ConfessionLike')
const ConfessionReport = require('../models/ConfessionReport')
const { check } = require('../utils/wordFilter')
const { HOT_DIVISOR, PIPELINE, hotUpdate, bumpCommentCount } = require('../utils/confessionScore')

// GullyPulse: anonymous confessions from customers (see middlewares/confessionPoster.js).

const FEED_DAYS = 30
const PAGE = 20
const REPORT_THRESHOLD = 4 // "more than three" unique reporters hides an item
const LIMITS = { confession: [10, 500], comment: [1, 300] }
const DAY = 864e5

const fail = (res, code, message) => {
  res.status(code)
  throw new Error(message)
}

const GUIDELINES = 'This doesn’t follow GullyPulse community guidelines, so it wasn’t posted.'

// Random, unguessable public id like "K7QX2MPA".
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function publicId() {
  return [...crypto.randomBytes(8)].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}

// Same text with different spacing or case counts as a duplicate.
const textHash = (text) =>
  crypto.createHash('sha256').update(text.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex')

function readText(res, body, kind) {
  const text = typeof body?.text === 'string' ? body.text.replace(/\s+\n/g, '\n').trim() : ''
  const [min, max] = LIMITS[kind]
  if (text.length < min) fail(res, 400, kind === 'comment' ? 'Write a comment first' : `Write at least ${min} characters`)
  if (text.length > max) fail(res, 400, `Keep it under ${max} characters`)
  return text
}

/*
 * The only shapes that leave the server. Never add authorKey, orderId,
 * cartId or _id here: they could tie a post to a person.
 */
const toPublic = (c, poster, liked = false) => ({
  id: c.publicId,
  text: c.text,
  likes: c.likeCount || 0,
  comments: c.commentCount || 0,
  createdAt: c.publishedAt || c.createdAt,
  liked: Boolean(liked),
  mine: Boolean(poster && poster.authorKey === c.authorKey),
})
const commentToPublic = (c, poster) => ({
  id: c.publicId,
  text: c.text,
  createdAt: c.createdAt,
  byAuthor: Boolean(c.byAuthor),
  mine: Boolean(poster && poster.authorKey === c.authorKey),
})

async function findPublished(res, id) {
  if (typeof id !== 'string' || !/^[A-Z0-9]{6,12}$/.test(id)) fail(res, 404, 'Confession not found')
  const c = await Confession.findOne({ publicId: id, status: 'PUBLISHED' }).lean()
  if (!c) fail(res, 404, 'Confession not found')
  return c
}

// Whether the poster can use GullyPulse, and if they're suspended.
exports.me = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { eligible: true, suspendedUntil: req.poster.bannedUntil },
  })
})

/*
 * Published confessions from the last FEED_DAYS days, most popular first.
 * hot = log10(1 + likes + 2·comments) + publishedAt/45000s, so popularity
 * counts but every 12.5 hours of age costs a factor of 10 in engagement and
 * new posts start near the top. cursor = "<hot>|<_id>".
 */
exports.feed = asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - FEED_DAYS * DAY)
  const filter = {
    status: 'PUBLISHED',
    publishedAt: { $gte: since },
    // No post older than `since` can score below this, so the index scan stops here.
    hot: { $gte: since.getTime() / HOT_DIVISOR },
  }
  if (req.query.cursor) {
    const [h, id] = String(req.query.cursor).split('|')
    const hot = Number(h)
    if (!Number.isFinite(hot) || !mongoose.isValidObjectId(id)) fail(res, 400, 'Invalid cursor')
    filter.$or = [{ hot: { $lt: hot } }, { hot, _id: { $lt: new mongoose.Types.ObjectId(id) } }]
  }
  const rows = await Confession.find(filter).sort({ hot: -1, _id: -1 }).limit(PAGE + 1).lean()
  const hasMore = rows.length > PAGE
  if (hasMore) rows.pop()

  const liked = req.poster
    ? new Set(
        (
          await ConfessionLike.find({ authorKey: req.poster.authorKey, confessionId: { $in: rows.map((r) => r._id) } })
            .select('confessionId')
            .lean()
        ).map((l) => String(l.confessionId)),
      )
    : new Set()

  const last = rows[rows.length - 1]
  res.json({
    success: true,
    data: {
      items: rows.map((r) => toPublic(r, req.poster, liked.has(String(r._id)))),
      nextCursor: hasMore && last ? `${last.hot}|${last._id}` : null,
    },
  })
})

// The poster's own confessions with their status, so a post in review or
// taken down doesn't just vanish.
exports.mine = asyncHandler(async (req, res) => {
  const rows = await Confession.find({ authorKey: req.poster.authorKey, status: { $ne: 'BLOCKED' } })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean()
  res.json({
    success: true,
    data: rows.map((r) => ({
      ...toPublic(r, req.poster),
      status: { PUBLISHED: 'published', PENDING_REVIEW: 'in_review', REPORTED: 'in_review' }[r.status] || 'removed',
    })),
  })
})

exports.create = asyncHandler(async (req, res) => {
  const text = readText(res, req.body, 'confession')
  const { authorKey, orderId, cartId } = req.poster
  const hash = textHash(text)
  if (await Confession.exists({ authorKey, textHash: hash, createdAt: { $gte: new Date(Date.now() - DAY) } })) {
    fail(res, 409, 'You already posted this.')
  }

  const result = check(text)
  const status = { BLOCK: 'BLOCKED', REVIEW: 'PENDING_REVIEW', ALLOW: 'PUBLISHED' }[result.verdict]
  const now = new Date()
  const doc = await Confession.create({
    publicId: publicId(),
    text,
    status,
    authorKey,
    orderId,
    cartId,
    textHash: hash,
    moderation: result,
    publishedAt: status === 'PUBLISHED' ? now : null,
    hot: status === 'PUBLISHED' ? now.getTime() / HOT_DIVISOR : 0,
  })

  if (status === 'BLOCKED') {
    return res.status(422).json({ success: false, code: 'BLOCKED', message: GUIDELINES })
  }
  res.status(status === 'PUBLISHED' ? 201 : 202).json({
    success: true,
    data: {
      status: status === 'PUBLISHED' ? 'published' : 'in_review',
      confession: toPublic(doc, req.poster),
    },
  })
})

exports.get = asyncHandler(async (req, res) => {
  const c = await findPublished(res, req.params.publicId)
  const liked = req.poster && (await ConfessionLike.exists({ confessionId: c._id, authorKey: req.poster.authorKey }))
  res.json({ success: true, data: toPublic(c, req.poster, liked) })
})

// Published comments, oldest first. cursor = "<createdAt ISO>|<_id>".
exports.comments = asyncHandler(async (req, res) => {
  const c = await findPublished(res, req.params.publicId)
  const filter = { confessionId: c._id, status: 'PUBLISHED' }
  if (req.query.cursor) {
    const [at, id] = String(req.query.cursor).split('|')
    const date = new Date(at)
    if (isNaN(date) || !mongoose.isValidObjectId(id)) fail(res, 400, 'Invalid cursor')
    filter.$or = [{ createdAt: { $gt: date } }, { createdAt: date, _id: { $gt: new mongoose.Types.ObjectId(id) } }]
  }
  const rows = await ConfessionComment.find(filter).sort({ createdAt: 1, _id: 1 }).limit(PAGE + 1).lean()
  const hasMore = rows.length > PAGE
  if (hasMore) rows.pop()
  const last = rows[rows.length - 1]
  res.json({
    success: true,
    data: {
      items: rows.map((r) => commentToPublic(r, req.poster)),
      nextCursor: hasMore && last ? `${new Date(last.createdAt).toISOString()}|${last._id}` : null,
    },
  })
})

exports.addComment = asyncHandler(async (req, res) => {
  const text = readText(res, req.body, 'comment')
  const c = await findPublished(res, req.params.publicId)
  const { authorKey, orderId, cartId } = req.poster
  const hash = textHash(text)
  if (await ConfessionComment.exists({ confessionId: c._id, authorKey, textHash: hash })) {
    fail(res, 409, 'You already said that.')
  }

  const result = check(text)
  const status = { BLOCK: 'BLOCKED', REVIEW: 'PENDING_REVIEW', ALLOW: 'PUBLISHED' }[result.verdict]
  const doc = await ConfessionComment.create({
    publicId: publicId(),
    confessionId: c._id,
    byAuthor: c.authorKey === authorKey,
    text,
    status,
    authorKey,
    orderId,
    cartId,
    textHash: hash,
    moderation: result,
    publishedAt: status === 'PUBLISHED' ? new Date() : null,
  })

  if (status === 'BLOCKED') {
    return res.status(422).json({ success: false, code: 'BLOCKED', message: GUIDELINES })
  }
  if (status === 'PUBLISHED') await bumpCommentCount(c._id, 1)
  res.status(status === 'PUBLISHED' ? 201 : 202).json({
    success: true,
    data: { status: status === 'PUBLISHED' ? 'published' : 'in_review', comment: commentToPublic(doc, req.poster) },
  })
})

async function setLike(req, res, on) {
  const c = await findPublished(res, req.params.publicId)
  const key = { confessionId: c._id, authorKey: req.poster.authorKey }
  let changed
  if (on) {
    // The unique index makes a second like a no-op, even when two arrive at once.
    try {
      changed = (await ConfessionLike.updateOne(key, { $setOnInsert: key }, { upsert: true })).upsertedCount === 1
    } catch (e) {
      if (e.code !== 11000) throw e // two upserts raced; the other one counted
      changed = false
    }
  } else {
    changed = (await ConfessionLike.deleteOne(key)).deletedCount === 1
  }
  let likes = c.likeCount || 0
  if (changed) {
    const updated = await Confession.findOneAndUpdate({ _id: c._id }, hotUpdate({ likeCount: on ? 1 : -1 }), {
      ...PIPELINE,
      returnDocument: 'after',
      projection: { likeCount: 1 },
    }).lean()
    likes = updated?.likeCount ?? likes + (on ? 1 : -1)
  }
  res.json({ success: true, data: { liked: on, likes: Math.max(0, likes) } })
}
exports.like = asyncHandler((req, res) => setLike(req, res, true))
exports.unlike = asyncHandler((req, res) => setLike(req, res, false))

/*
 * One report per poster per item. At REPORT_THRESHOLD unique reports a
 * published item is hidden (REPORTED) until an admin decides.
 */
async function report(req, res, kind, Model, item) {
  const reason = req.body?.reason
  if (!Confession.REPORT_REASONS.includes(reason)) fail(res, 400, 'Pick a reason')
  try {
    await ConfessionReport.create({ kind, targetId: item._id, authorKey: req.poster.authorKey, reason })
  } catch (e) {
    if (e.code === 11000) fail(res, 409, 'You already reported this.')
    throw e
  }
  const updated = await Model.findOneAndUpdate(
    { _id: item._id },
    { $inc: { reportCount: 1, [`reportReasons.${reason}`]: 1 } },
    { returnDocument: 'after', projection: { reportCount: 1, status: 1, confessionId: 1 } },
  ).lean()

  let hidden = false
  if (updated && updated.reportCount >= REPORT_THRESHOLD && updated.status === 'PUBLISHED') {
    // Conditional on PUBLISHED, so only one request makes the switch.
    const flipped = await Model.findOneAndUpdate(
      { _id: item._id, status: 'PUBLISHED' },
      { $set: { status: 'REPORTED' } },
      { projection: { _id: 1 } },
    ).lean()
    hidden = Boolean(flipped)
    if (flipped && kind === 'comment') await bumpCommentCount(updated.confessionId, -1)
  }
  res.status(201).json({ success: true, data: { reported: true, hidden } })
}

exports.report = asyncHandler(async (req, res) => {
  const c = await findPublished(res, req.params.publicId)
  await report(req, res, 'confession', Confession, c)
})

exports.reportComment = asyncHandler(async (req, res) => {
  const id = req.params.commentId
  if (typeof id !== 'string' || !/^[A-Z0-9]{6,12}$/.test(id)) fail(res, 404, 'Comment not found')
  const comment = await ConfessionComment.findOne({ publicId: id, status: 'PUBLISHED' }).lean()
  if (!comment) fail(res, 404, 'Comment not found')
  await report(req, res, 'comment', ConfessionComment, comment)
})

exports.REPORT_THRESHOLD = REPORT_THRESHOLD
exports.toPublic = toPublic

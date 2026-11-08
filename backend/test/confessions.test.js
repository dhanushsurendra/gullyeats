// GullyPulse end to end: real routes, middleware and a throwaway MongoDB.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert')
const express = require('express')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

const Order = require('../models/Order')
const Cart = require('../models/Cart')
const User = require('../models/User')
const Confession = require('../models/Confession')
const ConfessionComment = require('../models/ConfessionComment')
const ConfessionLike = require('../models/ConfessionLike')
const ConfessionReport = require('../models/ConfessionReport')
const ConfessionBan = require('../models/ConfessionBan')
const AdminAction = require('../models/AdminAction')
const errorHandler = require('../middlewares/errorHandler')
const { HOT_DIVISOR } = require('../utils/confessionScore')

let mongo, server, base
before(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
  await Promise.all([Confession, ConfessionComment, ConfessionLike, ConfessionReport, ConfessionBan].map((m) => m.syncIndexes()))
  const app = express()
  app.use(express.json({ limit: '10kb' }))
  app.use((req, res, next) => {
    req.io = { to: () => ({ emit() {} }) }
    next()
  })
  app.use('/api/confessions', require('../routes/confessionRoutes'))
  app.use('/api/admin', require('../routes/adminRoutes'))
  app.use(errorHandler)
  server = app.listen(0)
  base = `http://127.0.0.1:${server.address().port}/api`
})
after(async () => {
  server.close()
  await mongoose.disconnect()
  await mongo.stop()
})

const cartId = new mongoose.Types.ObjectId()
const adminId = new mongoose.Types.ObjectId()
const adminToken = jwt.sign({ _id: String(adminId), role: 'admin' }, process.env.JWT_SECRET)

beforeEach(async () => {
  for (const m of [Order, Cart, User, Confession, ConfessionComment, ConfessionLike, ConfessionReport, ConfessionBan, AdminAction]) {
    await m.collection.deleteMany({})
  }
  await Cart.collection.insertOne({ _id: cartId, userId: adminId, cartName: 'Raju Chaat', cartCity: 'Bengaluru' })
  await User.collection.insertOne({ _id: adminId, name: 'Asha Admin', role: 'admin' })
})

// A customer: an order with its key. Each one counts as a different person.
let n = 0
async function customer({ status = 'PENDING', phone = null } = {}) {
  const key = require('crypto').randomBytes(16).toString('hex')
  const _id = new mongoose.Types.ObjectId()
  await Order.collection.insertOne({
    _id, cartId, orderNumber: ++n, status, subtotal: 10, totalPrice: 12, platformFee: 2, phoneNumber: phone, accessKey: key,
    orderItems: [{ menuItemId: new mongoose.Types.ObjectId(), name: 'Tea', price: 10, quantity: 1 }],
  })
  return { header: `${_id}.${key}`, orderId: String(_id), phone }
}

async function api(method, path, { who, body, admin } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (who) headers['x-gully-order'] = who.header
  if (admin) headers.authorization = `Bearer ${adminToken}`
  const r = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) })
  const text = await r.text()
  return { status: r.status, body: text ? JSON.parse(text) : null, raw: text }
}
const post = (who, text) => api('POST', '/confessions', { who, body: { text } })
const feed = (who, cursor) => api('GET', `/confessions/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { who })

// ---- Eligibility ------------------------------------------------------------

test('only someone holding an order and its key can post', async () => {
  const real = await customer()
  assert.strictEqual((await api('POST', '/confessions', { body: { text: 'no order at all here' } })).status, 401)
  const wrongKey = { header: `${real.orderId}.${'0'.repeat(32)}` }
  assert.strictEqual((await post(wrongKey, 'guessed the order id')).status, 401)
  const guessed = { header: `${new mongoose.Types.ObjectId()}.${'a'.repeat(32)}` }
  assert.strictEqual((await post(guessed, 'made up an order')).status, 401)
  const noKeyOrder = new mongoose.Types.ObjectId()
  await Order.collection.insertOne({ _id: noKeyOrder, cartId, orderNumber: 999, status: 'PAID' }) // vendor or old order
  assert.strictEqual((await post({ header: `${noKeyOrder}.${'a'.repeat(32)}` }, 'old order without key')).status, 401)
  assert.strictEqual((await post(real, 'I placed an order so I can post')).status, 201)
})

test('pending, paid and served orders count; a cancelled one does not', async () => {
  for (const status of ['PENDING', 'PAID', 'SERVED']) {
    assert.strictEqual((await post(await customer({ status }), `posting with a ${status} order`)).status, 201)
  }
  const r = await post(await customer({ status: 'CANCELLED' }), 'posting with a cancelled order')
  assert.strictEqual(r.status, 403)
})

test('the feed is readable without an order, but writing is not', async () => {
  await post(await customer(), 'the momos at the corner are the best')
  const r = await feed()
  assert.strictEqual(r.status, 200)
  assert.strictEqual(r.body.data.items.length, 1)
  const id = r.body.data.items[0].id
  assert.strictEqual((await api('POST', `/confessions/${id}/like`)).status, 401)
  assert.strictEqual((await api('POST', `/confessions/${id}/comments`, { body: { text: 'hi' } })).status, 401)
  assert.strictEqual((await api('POST', `/confessions/${id}/report`, { body: { reason: 'spam' } })).status, 401)
})

// ---- Anonymity --------------------------------------------------------------

function assertNoIdentity(payload, who) {
  const s = JSON.stringify(payload)
  for (const bad of ['authorKey', 'orderId', 'cartId', '_id', 'phone', 'moderation', 'textHash', who.orderId, 'Raju Chaat']) {
    assert.ok(!s.includes(bad), `public response leaks ${bad}: ${s}`)
  }
  if (who.phone) assert.ok(!s.includes(who.phone), 'leaks phone number')
}

test('public responses never contain anything that identifies the poster', async () => {
  const alice = await customer({ phone: '9876543210' })
  const bob = await customer()
  const created = await post(alice, 'I secretly love pineapple on dosa')
  assertNoIdentity(created.body, alice)
  const id = created.body.data.confession.id
  await api('POST', `/confessions/${id}/comments`, { who: bob, body: { text: 'same here honestly' } })
  await api('POST', `/confessions/${id}/comments`, { who: alice, body: { text: 'glad I am not alone' } })

  for (const r of [await feed(), await feed(bob), await api('GET', `/confessions/${id}`, { who: bob }), await api('GET', `/confessions/${id}/comments`)]) {
    assert.strictEqual(r.status, 200)
    assertNoIdentity(r.body, alice)
    assertNoIdentity(r.body, bob)
  }
  const comments = (await api('GET', `/confessions/${id}/comments`, { who: bob })).body.data.items
  assert.deepStrictEqual(comments.map((c) => [c.byAuthor, c.mine]), [[false, true], [true, false]])
})

test('the same phone on two orders is one person; the stored key is not the phone', async () => {
  const a1 = await customer({ phone: '9876543210' })
  const a2 = await customer({ phone: '9876543210' })
  const id = (await post(await customer(), 'a confession to like')).body.data.confession.id
  await api('POST', `/confessions/${id}/like`, { who: a1 })
  const r = await api('POST', `/confessions/${id}/like`, { who: a2 })
  assert.strictEqual(r.body.data.likes, 1)
  const like = await ConfessionLike.findOne().lean()
  assert.ok(!like.authorKey.includes('9876543210'))
  assert.strictEqual(like.authorKey.length, 64)
})

// ---- Word filter in the flow ------------------------------------------------

test('clean posts publish, borderline posts wait for review, abusive posts are blocked and kept for admins', async () => {
  const who = await customer()
  const ok = await post(who, 'I eat pani puri every single day')
  assert.strictEqual(ok.status, 201)
  assert.strictEqual(ok.body.data.status, 'published')

  const review = await post(who, 'that vendor is a total bastard lol')
  assert.strictEqual(review.status, 202)
  assert.strictEqual(review.body.data.status, 'in_review')

  const blocked = await post(who, 'you are a f.u.c.k.i.n.g b1tch')
  assert.strictEqual(blocked.status, 422)
  assert.strictEqual(blocked.body.code, 'BLOCKED')
  assert.match(blocked.body.message, /community guidelines/)

  const items = (await feed()).body.data.items
  assert.deepStrictEqual(items.map((i) => i.text), ['I eat pani puri every single day'])
  const stored = await Confession.findOne({ status: 'BLOCKED' }).lean()
  assert.ok(stored.moderation.matches.some((m) => m.term === 'bitch'))
})

test('comments go through the same filter', async () => {
  const id = (await post(await customer(), 'confession for comment tests')).body.data.confession.id
  const who = await customer()
  assert.strictEqual((await api('POST', `/confessions/${id}/comments`, { who, body: { text: 'chutiya' } })).status, 422)
  assert.strictEqual((await api('POST', `/confessions/${id}/comments`, { who, body: { text: 'holy shit same' } })).status, 202)
  assert.strictEqual((await api('POST', `/confessions/${id}/comments`, { who, body: { text: 'same!' } })).status, 201)
  const c = (await api('GET', `/confessions/${id}/comments`)).body.data.items
  assert.deepStrictEqual(c.map((x) => x.text), ['same!'])
  assert.strictEqual((await api('GET', `/confessions/${id}`)).body.data.comments, 1)
})

test('length limits, empty text and duplicate posts are refused', async () => {
  const who = await customer()
  assert.strictEqual((await post(who, 'short')).status, 400)
  assert.strictEqual((await post(who, 'x'.repeat(501))).status, 400)
  assert.strictEqual((await post(who, { evil: true })).status, 400)
  assert.strictEqual((await post(who, 'my first ever confession')).status, 201)
  assert.strictEqual((await post(who, '  My first   ever confession ')).status, 409)
  const id = (await feed()).body.data.items[0].id
  assert.strictEqual((await api('POST', `/confessions/${id}/comments`, { who, body: { text: '   ' } })).status, 400)
  assert.strictEqual((await api('POST', `/confessions/${id}/comments`, { who, body: { text: 'y'.repeat(301) } })).status, 400)
})

test('posting is rate limited per person', async () => {
  const who = await customer()
  for (let i = 0; i < 3; i++) assert.strictEqual((await post(who, `rate limit confession number ${i}`)).status, 201)
  assert.strictEqual((await post(who, 'rate limit confession number 4')).status, 429)
  // Another person is not affected.
  assert.strictEqual((await post(await customer(), 'someone else posting now')).status, 201)
})

// ---- Likes ------------------------------------------------------------------

test('like, unlike, and no double likes, even at the same time', async () => {
  const id = (await post(await customer(), 'like me please')).body.data.confession.id
  const who = await customer()
  const results = await Promise.all([1, 2, 3].map(() => api('POST', `/confessions/${id}/like`, { who })))
  assert.ok(results.every((r) => r.status === 200))
  let c = (await api('GET', `/confessions/${id}`, { who })).body.data
  assert.strictEqual(c.likes, 1)
  assert.strictEqual(c.liked, true)
  assert.strictEqual((await api('DELETE', `/confessions/${id}/like`, { who })).body.data.likes, 0)
  assert.strictEqual((await api('DELETE', `/confessions/${id}/like`, { who })).body.data.likes, 0)
  c = (await api('GET', `/confessions/${id}`, { who })).body.data
  assert.strictEqual(c.likes, 0)
  assert.strictEqual(c.liked, false)
  assert.strictEqual((await api('POST', '/confessions/NOPE1234/like', { who })).status, 404)
})

// ---- Ranking ----------------------------------------------------------------

test('feed ranks by engagement and recency, pages, and drops posts older than 30 days', async () => {
  const author = await customer()
  const old = await post(author, 'yesterday post with many likes')
  const fresh = await post(author, 'brand new post with no likes')
  const hits = await post(author, 'fresh post that people like')
  // Make the first one a day old.
  const day = new Date(Date.now() - 864e5)
  await Confession.updateOne({ publicId: old.body.data.confession.id }, { $set: { publishedAt: day, hot: day.getTime() / HOT_DIVISOR } })
  for (let i = 0; i < 5; i++) await api('POST', `/confessions/${old.body.data.confession.id}/like`, { who: await customer() })
  for (let i = 0; i < 3; i++) await api('POST', `/confessions/${hits.body.data.confession.id}/like`, { who: await customer() })

  const order = (await feed()).body.data.items.map((i) => i.text)
  // 5 likes don't beat a day of age; 3 likes beat 0 at the same age.
  assert.deepStrictEqual(order, ['fresh post that people like', 'brand new post with no likes', 'yesterday post with many likes'])

  // A 31-day-old post is out of the feed even with lots of engagement.
  const ancient = new Date(Date.now() - 31 * 864e5)
  await Confession.updateOne({ publicId: fresh.body.data.confession.id }, { $set: { publishedAt: ancient, likeCount: 1e6, hot: 99e9 } })
  assert.ok(!(await feed()).body.data.items.some((i) => i.text === 'brand new post with no likes'))
})

test('feed pages with a cursor without repeats', async () => {
  const docs = Array.from({ length: 45 }, (_, i) => ({
    publicId: `PAGE${String(i).padStart(4, '0')}`, text: `post ${i}`, status: 'PUBLISHED', authorKey: 'k', orderId: new mongoose.Types.ObjectId(),
    publishedAt: new Date(), hot: Date.now() / HOT_DIVISOR + (i % 3), likeCount: 0, commentCount: 0,
  }))
  await Confession.insertMany(docs)
  const seen = []
  let cursor = null
  do {
    const r = (await feed(null, cursor)).body.data
    seen.push(...r.items.map((i) => i.id))
    cursor = r.nextCursor
  } while (cursor)
  assert.strictEqual(seen.length, 45)
  assert.strictEqual(new Set(seen).size, 45)
  assert.strictEqual((await feed(null, 'garbage')).status, 400)
})

// ---- Reports ----------------------------------------------------------------

test('three reports keep a post up; the fourth unique reporter hides it for admin review', async () => {
  const id = (await post(await customer(), 'controversial chaat opinion')).body.data.confession.id
  const reporters = []
  for (let i = 0; i < 4; i++) reporters.push(await customer())

  for (let i = 0; i < 3; i++) {
    const r = await api('POST', `/confessions/${id}/report`, { who: reporters[i], body: { reason: i ? 'abusive' : 'spam' } })
    assert.strictEqual(r.status, 201)
    assert.strictEqual(r.body.data.hidden, false)
  }
  // The same person again doesn't count.
  assert.strictEqual((await api('POST', `/confessions/${id}/report`, { who: reporters[0], body: { reason: 'spam' } })).status, 409)
  assert.strictEqual((await feed()).body.data.items.length, 1)

  const r = await api('POST', `/confessions/${id}/report`, { who: reporters[3], body: { reason: 'hate' } })
  assert.strictEqual(r.body.data.hidden, true)
  assert.strictEqual((await feed()).body.data.items.length, 0)
  assert.strictEqual((await api('GET', `/confessions/${id}`)).status, 404)

  const q = await api('GET', '/admin/moderation/queue?kind=confession&status=REPORTED', { admin: true })
  assert.strictEqual(q.body.data.items.length, 1)
  assert.strictEqual(q.body.data.items[0].reportCount, 4)
  assert.deepStrictEqual(q.body.data.items[0].reportReasons, { spam: 1, abusive: 2, hate: 1 })
})

test('reports need a valid reason', async () => {
  const id = (await post(await customer(), 'report reason test post')).body.data.confession.id
  const who = await customer()
  assert.strictEqual((await api('POST', `/confessions/${id}/report`, { who, body: { reason: 'because' } })).status, 400)
  assert.strictEqual((await api('POST', `/confessions/${id}/report`, { who, body: {} })).status, 400)
})

test('comments are reported separately and hidden at four reports', async () => {
  const id = (await post(await customer(), 'post with a nasty comment')).body.data.confession.id
  const c = await api('POST', `/confessions/${id}/comments`, { who: await customer(), body: { text: 'this comment annoys people' } })
  const cid = c.body.data.comment.id
  for (let i = 0; i < 4; i++) {
    assert.strictEqual((await api('POST', `/confessions/comments/${cid}/report`, { who: await customer(), body: { reason: 'harassment' } })).status, 201)
  }
  assert.strictEqual((await api('GET', `/confessions/${id}/comments`)).body.data.items.length, 0)
  assert.strictEqual((await api('GET', `/confessions/${id}`)).body.data.comments, 0)
  // The confession itself is untouched.
  assert.strictEqual((await feed()).body.data.items.length, 1)
  const q = await api('GET', '/admin/moderation/queue?kind=comment&status=REPORTED', { admin: true })
  assert.strictEqual(q.body.data.items[0].parent.publicId, id)
})

// ---- Admin ------------------------------------------------------------------

test('moderation APIs are admins only', async () => {
  const vendor = jwt.sign({ _id: String(new mongoose.Types.ObjectId()), role: 'vendor' }, process.env.JWT_SECRET)
  const r = await fetch(`${base}/admin/moderation/queue`, { headers: { authorization: `Bearer ${vendor}` } })
  assert.strictEqual(r.status, 403)
  assert.strictEqual((await fetch(`${base}/admin/moderation/queue`)).status, 401)
})

test('approve publishes a reviewed post, reject keeps it out, and both are logged with the admin and reason', async () => {
  const who = await customer({ phone: '9123456789' })
  await post(who, 'my boss is a bastard honestly')
  await post(who, 'that guy is a harami')
  const q = (await api('GET', '/admin/moderation/queue?kind=confession&status=PENDING_REVIEW', { admin: true })).body.data.items
  assert.strictEqual(q.length, 2)
  const [second, first] = q
  assert.ok(first.matches.some((m) => m.term === 'bastard'))
  assert.match(first.reason, /bastard/)
  assert.strictEqual(first.cart, 'Raju Chaat')
  assert.match(first.poster, /^P-/)

  assert.strictEqual((await api('POST', `/admin/moderation/confession/${first.id}/approve`, { admin: true, body: {} })).status, 400)
  assert.strictEqual((await api('POST', `/admin/moderation/confession/${first.id}/approve`, { admin: true, body: { reason: 'venting, not abuse' } })).status, 200)
  assert.strictEqual((await api('POST', `/admin/moderation/confession/${second.id}/reject`, { admin: true, body: { reason: 'insult' } })).status, 200)
  // Can't reject twice.
  assert.strictEqual((await api('POST', `/admin/moderation/confession/${second.id}/reject`, { admin: true, body: { reason: 'again' } })).status, 409)

  assert.deepStrictEqual((await feed()).body.data.items.map((i) => i.text), ['my boss is a bastard honestly'])

  const detail = (await api('GET', `/admin/moderation/confession/${first.id}`, { admin: true })).body.data
  assert.strictEqual(detail.history[0].action, 'APPROVE_CONFESSION')
  assert.strictEqual(detail.history[0].by, 'Asha Admin')
  assert.strictEqual(detail.history[0].reason, 'venting, not abuse')
  assert.strictEqual(detail.poster.phone, '••••••6789')
  assert.deepStrictEqual(detail.poster.posts, { PUBLISHED: 1, REJECTED: 1 })
  const log = await AdminAction.findOne({ action: 'REJECT_CONFESSION' }).lean()
  assert.strictEqual(String(log.adminId), String(adminId))
  assert.ok(log.createdAt instanceof Date)
})

test('remove takes a post out of the feed; restore brings it back with a fresh report count', async () => {
  const id = (await post(await customer(), 'a post an admin removes')).body.data.confession.id
  const doc = await Confession.findOne({ publicId: id }).lean()
  assert.strictEqual((await api('POST', `/admin/moderation/confession/${doc._id}/remove`, { admin: true, body: { reason: 'off topic' } })).status, 200)
  assert.strictEqual((await feed()).body.data.items.length, 0)
  assert.strictEqual((await api('GET', `/confessions/${id}`)).status, 404)

  const removed = await api('GET', '/admin/moderation/queue?kind=confession&status=REMOVED,REJECTED', { admin: true })
  assert.strictEqual(removed.body.data.items.length, 1)

  await Confession.updateOne({ _id: doc._id }, { $set: { reportCount: 4 } })
  assert.strictEqual((await api('POST', `/admin/moderation/confession/${doc._id}/restore`, { admin: true, body: { reason: 'mistake' } })).status, 200)
  assert.strictEqual((await feed()).body.data.items.length, 1)
  assert.strictEqual((await Confession.findById(doc._id).lean()).reportCount, 0)
})

test('a wrongly blocked post can be approved', async () => {
  await post(await customer(), 'you are a b1tch')
  const blocked = (await api('GET', '/admin/moderation/queue?kind=confession&status=BLOCKED', { admin: true })).body.data.items
  assert.strictEqual(blocked.length, 1)
  assert.strictEqual((await api('POST', `/admin/moderation/confession/${blocked[0].id}/approve`, { admin: true, body: { reason: 'test' } })).status, 200)
  assert.strictEqual((await feed()).body.data.items.length, 1)
})

test('removing and restoring a comment keeps the comment count right', async () => {
  const id = (await post(await customer(), 'post for comment moderation')).body.data.confession.id
  await api('POST', `/confessions/${id}/comments`, { who: await customer(), body: { text: 'a fine comment' } })
  const c = await ConfessionComment.findOne().lean()
  await api('POST', `/admin/moderation/comment/${c._id}/remove`, { admin: true, body: { reason: 'r' } })
  assert.strictEqual((await api('GET', `/confessions/${id}`)).body.data.comments, 0)
  await api('POST', `/admin/moderation/comment/${c._id}/restore`, { admin: true, body: { reason: 'r' } })
  assert.strictEqual((await api('GET', `/confessions/${id}`)).body.data.comments, 1)
})

test('a suspended poster cannot post, comment, like or report until lifted; others with that phone are suspended too', async () => {
  const who = await customer({ phone: '9000000001' })
  await post(who, 'my first post before the ban')
  const doc = await Confession.findOne().lean()
  assert.strictEqual((await api('POST', `/admin/moderation/confession/${doc._id}/suspend`, { admin: true, body: { days: 7 } })).status, 400)
  assert.strictEqual((await api('POST', `/admin/moderation/confession/${doc._id}/suspend`, { admin: true, body: { days: 7, reason: 'repeat offender' } })).status, 200)

  const sameNumber = await customer({ phone: '9000000001' })
  for (const w of [who, sameNumber]) {
    assert.strictEqual((await post(w, 'trying to post while banned')).status, 403)
    assert.strictEqual((await api('POST', `/confessions/${doc.publicId}/like`, { who: w })).status, 403)
  }
  const me = await api('GET', '/confessions/me', { who })
  assert.strictEqual(me.status, 200)
  assert.ok(me.body.data.suspendedUntil)
  // Reading still works.
  assert.strictEqual((await feed(who)).status, 200)

  const detail = (await api('GET', `/admin/moderation/confession/${doc._id}`, { admin: true })).body.data
  assert.ok(detail.poster.suspendedUntil)
  assert.strictEqual(detail.history[0].action, 'SUSPEND_POSTER')

  await api('POST', `/admin/moderation/confession/${doc._id}/suspend`, { admin: true, body: { days: 0, reason: 'appeal accepted' } })
  assert.strictEqual((await post(who, 'back after the ban was lifted')).status, 201)
})

test('a poster sees their own posts with status, including ones in review', async () => {
  const who = await customer()
  await post(who, 'a nice clean confession here')
  await post(who, 'he is such a bastard')
  await post(who, 'f u c k this')
  const mine = (await api('GET', '/confessions/mine', { who })).body.data
  assert.deepStrictEqual(mine.map((m) => m.status).sort(), ['in_review', 'published'])
  assertNoIdentity(mine, who)
})

test('queue counts for the tab badges', async () => {
  const who = await customer()
  await post(who, 'he is such a bastard')
  await post(who, 'you are a b1tch')
  const r = await api('GET', '/admin/moderation/counts', { admin: true })
  assert.deepStrictEqual(r.body.data, { review: 1, reviewComments: 0, reported: 0, reportedComments: 0, blocked: 1, blockedComments: 0 })
})

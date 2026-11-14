// Admin GullyPlay / GullyPulse insights, against a throwaway MongoDB.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
const { test, before, after } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

const Cart = require('../models/Cart')
const User = require('../models/User')
const Order = require('../models/Order')
const GameScore = require('../models/GameScore')
const Confession = require('../models/Confession')
const ConfessionComment = require('../models/ConfessionComment')
const ConfessionLike = require('../models/ConfessionLike')
const ConfessionReport = require('../models/ConfessionReport')
const AdminAction = require('../models/AdminAction')
const insights = require('../controllers/insightsController')
const { authorKeyFor } = require('../middlewares/confessionPoster')
const { istDay } = require('../controllers/gameController')
const { call } = require('./helpers')

const id = () => new mongoose.Types.ObjectId()
const hoursAgo = (h) => new Date(Date.now() - h * 36e5)
const cart = id()
const owner = id()
// Three QR customers at one cart: two with a phone, one without.
const orders = [
  { _id: id(), phoneNumber: '9000000001' },
  { _id: id(), phoneNumber: '' },
  { _id: id(), phoneNumber: '9000000002' },
]
const [k1, k2] = orders.map(authorKeyFor)
const stranger = 'k-from-an-older-order'

let mongo
before(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
  await User.collection.insertOne({ _id: owner, userId: 'VEN-E', role: 'vendor', name: 'Esha', phoneNumber: '444' })
  await Cart.collection.insertOne({ _id: cart, cartName: 'E', cartCity: 'Pune', userId: owner, createdAt: hoursAgo(500) })
  let n = 0
  await Order.collection.insertMany(
    orders.map((o) => ({
      ...o, cartId: cart, status: 'SERVED', orderNumber: ++n, totalPrice: 50, platformFee: 2,
      orderType: 'QR', orderItems: [], createdAt: hoursAgo(1),
    })),
  )
  const today = istDay()
  const yesterday = istDay(Date.now() - 864e5)
  await GameScore.collection.insertMany([
    { game: 'nebula', day: today, authorKey: k1, alias: 'a', score: 100, rounds: 3 },
    { game: 'reflex', day: yesterday, authorKey: k1, alias: 'a', score: 50 }, // from before rounds were counted
    { game: 'nebula', day: today, authorKey: k2, alias: 'b', score: 300, rounds: 2 },
    { game: 'synapse', day: '2020-01-01', authorKey: stranger, alias: 'c', score: 40, rounds: 1 },
  ])

  const post = { cartId: cart, orderId: orders[0]._id }
  const [liked, held] = [id(), id()]
  await Confession.collection.insertMany([
    { _id: liked, ...post, publicId: 'p1', text: 'Best momos', status: 'PUBLISHED', authorKey: k1,
      likeCount: 4, commentCount: 1, reportCount: 0, moderation: { verdict: 'ALLOW' }, createdAt: hoursAgo(5) },
    { _id: held, ...post, publicId: 'p2', text: 'hmm', status: 'PUBLISHED', authorKey: stranger,
      likeCount: 0, commentCount: 0, reportCount: 1, moderation: { verdict: 'REVIEW' }, createdAt: hoursAgo(3) },
  ])
  await ConfessionComment.collection.insertOne({
    ...post, confessionId: liked, publicId: 'c1', text: 'agree', status: 'PUBLISHED', authorKey: k1,
    reportCount: 0, moderation: { verdict: 'ALLOW' }, createdAt: hoursAgo(4),
  })
  await ConfessionLike.collection.insertOne({ confessionId: liked, authorKey: k2, createdAt: hoursAgo(2) })
  await ConfessionReport.collection.insertOne({ kind: 'confession', targetId: held, authorKey: k2, reason: 'spam', createdAt: hoursAgo(2) })
  await AdminAction.collection.insertOne({ action: 'APPROVE_CONFESSION', target: { kind: 'confession', id: held }, createdAt: new Date() })
})
after(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})

test('play: players, rounds, reach among QR customers, per game and per cart', async () => {
  const { body } = await call(insights.play, { query: { range: '7d' } })
  const d = body.data
  assert.strictEqual(d.days, 7)
  assert.deepStrictEqual(d.summary, {
    players: 2, rounds: 6, customers: 3, playedShare: 66.7, withPhone: 1, returning: 1, multiCart: 0,
  })
  const nebula = d.perGame.find((g) => g.game === 'nebula')
  assert.deepStrictEqual(
    [nebula.players, nebula.rounds, nebula.perPlayer, nebula.top],
    [2, 5, 2.5, 300],
  )
  assert.strictEqual(d.daily.length, 7)
  assert.strictEqual(d.daily.at(-1).nebula, 2)
  assert.deepStrictEqual(d.carts.map((c) => [c.cart, c.customers, c.active, c.rate]), [['E', 3, 2, 66.7]])
  // Anonymous: no key or phone leaves the server.
  const raw = JSON.stringify(body)
  for (const secret of [k1, k2, '9000000001']) assert.ok(!raw.includes(secret))
})

test('pulse: activity, engagement, moderation health and per cart', async () => {
  const { body } = await call(insights.pulse, { query: {} })
  const d = body.data
  assert.strictEqual(d.days, 30)
  assert.deepStrictEqual(d.summary, {
    posts: 2, comments: 1, likes: 1, posters: 2, customers: 3, postedShare: 33.3, repeatPosters: 1,
  })
  assert.strictEqual(d.engagement.top[0].likes, 4)
  assert.strictEqual(d.engagement.likesPerPost, 2)
  const h = d.health
  assert.deepStrictEqual([h.items, h.held, h.reported, h.reports, h.decisions], [3, 1, 1, 1, 1])
  assert.ok(Math.abs(h.avgMinsToDecide - 180) <= 2)
  assert.deepStrictEqual(d.carts.map((c) => [c.active, c.rate]), [[1, 33.3]])
  const raw = JSON.stringify(body)
  for (const secret of [k1, k2, '9000000001']) assert.ok(!raw.includes(secret))
})

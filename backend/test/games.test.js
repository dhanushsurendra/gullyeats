// GullyPlay scores end to end: real routes and middleware, throwaway MongoDB.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const express = require('express')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

const Order = require('../models/Order')
const GameScore = require('../models/GameScore')
const errorHandler = require('../middlewares/errorHandler')
const { GAMES, istDay } = require('../controllers/gameController')

let mongo, server, base
before(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
  await GameScore.syncIndexes()
  const app = express()
  app.use(express.json({ limit: '10kb' }))
  app.use('/api/games', require('../routes/gameRoutes'))
  app.use(errorHandler)
  server = app.listen(0)
  base = `http://127.0.0.1:${server.address().port}/api/games`
})
after(async () => {
  server.close()
  await mongoose.disconnect()
  await mongo.stop()
})
beforeEach(async () => {
  await Order.collection.deleteMany({})
  await GameScore.collection.deleteMany({})
})

const cartId = new mongoose.Types.ObjectId()
let n = 0
async function player(phone = null) {
  const key = require('crypto').randomBytes(16).toString('hex')
  const _id = new mongoose.Types.ObjectId()
  await Order.collection.insertOne({ _id, cartId, orderNumber: ++n, status: 'PAID', phoneNumber: phone, accessKey: key })
  return { header: `${_id}.${key}`, orderId: String(_id), phone }
}

async function api(method, p, { who, body } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (who) headers['x-gully-order'] = who.header
  const r = await fetch(base + p, { method, headers, body: body && JSON.stringify(body) })
  const text = await r.text()
  return { status: r.status, body: text ? JSON.parse(text).data : null, raw: text }
}
// A believable round: score made of kills and energy.
const round = (score, extra = {}) => ({
  score,
  durationMs: 55000,
  day: istDay(),
  stats: { kills: Math.ceil(score / 20), drones: 0, energy: 0, near: 0, hits: 0, boss: 0, bossHits: 0 },
  ...extra,
})
const submit = (who, score, extra) => api('POST', '/nebula/scores', { who, body: round(score, extra) })

test('only someone with an order and its key can submit', async () => {
  assert.strictEqual((await api('POST', '/nebula/scores', { body: round(100) })).status, 401)
  const p = await player()
  assert.strictEqual((await submit({ header: `${p.orderId}.${'0'.repeat(32)}` }, 100)).status, 401)
  assert.strictEqual((await submit(p, 100)).status, 200)
  assert.strictEqual((await api('POST', '/tetris/scores', { who: p, body: round(100) })).status, 404)
})

test('a better round raises the day’s best, a worse one does not', async () => {
  const p = await player('9876543210')
  assert.strictEqual((await submit(p, 300)).body.best, 300)
  assert.strictEqual((await submit(p, 120)).body.best, 300)
  assert.strictEqual((await submit(p, 900)).body.best, 900)
  assert.strictEqual(await GameScore.countDocuments(), 1)
  // Another order from the same phone is the same player.
  const again = await player('+91 98765 43210')
  assert.strictEqual((await submit(again, 500)).body.best, 900)
  assert.strictEqual(await GameScore.countDocuments(), 1)
  // Every accepted round is counted, best or not (admin Insights).
  assert.strictEqual((await GameScore.findOne()).rounds, 4)
})

test('a Mothership kill counts', async () => {
  const p = await player()
  const r = await submit(p, 2600, { stats: { kills: 10, drones: 0, energy: 0, near: 0, hits: 1, boss: 1, bossHits: 100 } })
  assert.strictEqual(r.status, 200)
  assert.strictEqual(r.body.best, 2600)
})

test('impossible rounds are refused', async () => {
  const p = await player()
  const bad = [
    round(GAMES.nebula.limits.maxScore + 20, { stats: { kills: 2000, drones: 0, energy: 0, near: 0, hits: 0, boss: 0, bossHits: 0 } }),
    round(500, { durationMs: 120000 }),
    round(500, { durationMs: 10 }),
    round(500, { stats: { kills: 1, drones: 0, energy: 0, near: 0, hits: 0, boss: 0, bossHits: 0 } }), // more points than the kills can give
    round(500, { stats: { kills: 25, drones: 0, energy: 0, near: 0, hits: 4, boss: 0, bossHits: 0 } }),
    round(500, { stats: { kills: 25, drones: 9, energy: 0, near: 0, hits: 0, boss: 0, bossHits: 0 } }), // more drones than ever fly
    round(500, { stats: { kills: 0, drones: 0, energy: 0, near: 0, hits: 0, boss: 2, bossHits: 0 } }), // only one Mothership
    round(500, { stats: { kills: 0, drones: 0, energy: 0, near: 0, hits: 0, boss: 0, bossHits: 121 } }), // more hits than it has hull
    round(500, { stats: { kills: 25, drones: 0, energy: 0, near: 0, hits: 0 } }), // a v3 round, without boss stats
    round(500, { day: '2020-01-01' }),
    round(-5),
    round(12.5),
    { score: 100 },
  ]
  for (const body of bad) assert.strictEqual((await api('POST', '/nebula/scores', { who: p, body })).status, 400, JSON.stringify(body))
  assert.strictEqual(await GameScore.countDocuments(), 0)
})

test('the board is sorted, ranks are right, and only alias and score leave the server', async () => {
  const [a, b, c] = [await player('9000000001'), await player('9000000002'), await player()]
  await submit(a, 400)
  await submit(b, 1200)
  const third = await submit(c, 800)
  assert.strictEqual(third.body.rank, 2)

  const board = await api('GET', '/nebula/leaderboard', { who: a })
  assert.deepStrictEqual(board.body.top.map((r) => r.score), [1200, 800, 400])
  assert.deepStrictEqual(board.body.top.map((r) => r.rank), [1, 2, 3])
  assert.deepStrictEqual(board.body.top.map((r) => r.me), [false, false, true])
  assert.deepStrictEqual(board.body.me, { best: 400, rank: 3, alias: board.body.top[2].alias })
  for (const row of board.body.top) assert.deepStrictEqual(Object.keys(row).sort(), ['alias', 'me', 'rank', 'score'])
  for (const secret of [a.orderId, '9000000001', (await GameScore.findOne()).authorKey]) assert.ok(!board.raw.includes(secret))
  assert.match(board.body.top[0].alias, /^\w+ \w+ \d{2}$/)

  // Reading needs no order; then there is no "me".
  const open = await api('GET', '/nebula/leaderboard')
  assert.strictEqual(open.body.top.length, 3)
  assert.strictEqual(open.body.me, null)
})

test('adding a number later keeps your scores and joins your other orders', async () => {
  const anon = await player() // ordered without a number
  await submit(anon, 700)
  const other = await player('9123456780') // an earlier order with the number
  await submit(other, 400)
  const link = (who, phone) => api('POST', '/phone', { who, body: { phone } })

  assert.strictEqual((await link(anon, '12345')).status, 400)
  assert.strictEqual((await api('POST', '/phone', { body: { phone: '9123456780' } })).status, 401)
  const ok = await link(anon, '9123456780')
  assert.strictEqual(ok.status, 200)
  // One player now, with the better of the two scores, seen from either order.
  assert.strictEqual(await GameScore.countDocuments(), 1)
  const board = await api('GET', '/nebula/leaderboard', { who: other })
  assert.deepStrictEqual(board.body.top.map((r) => [r.score, r.me]), [[700, true]])
  assert.strictEqual(board.body.top[0].alias, ok.body.aliases.nebula)
  assert.strictEqual((await Order.findById(anon.orderId).lean()).phoneNumber, '9123456780')
  // An order's number can't be swapped for another.
  assert.strictEqual((await link(anon, '9000000009')).status, 409)
  assert.strictEqual((await link(other, '9000000009')).status, 409)
})

test('a moved score never replaces a better one', async () => {
  const anon = await player()
  await submit(anon, 200)
  const other = await player('9123456781')
  await submit(other, 900)
  assert.strictEqual((await api('POST', '/phone', { who: anon, body: { phone: '9123456781' } })).status, 200)
  const board = await api('GET', '/nebula/leaderboard', { who: anon })
  assert.deepStrictEqual(board.body.top.map((r) => r.score), [900])
})

test('ties go to whoever got there first', async () => {
  const [a, b] = [await player(), await player()]
  await submit(a, 600)
  await submit(b, 600)
  await submit(a, 600) // equal again: must not lose the earlier time
  const board = await api('GET', '/nebula/leaderboard', { who: b })
  assert.strictEqual(board.body.me.rank, 2)
})

test('each day has its own board', async () => {
  const p = await player()
  const yesterday = istDay(Date.now() - 864e5)
  await submit(p, 700, { day: yesterday })
  await submit(p, 200)
  assert.deepStrictEqual((await api('GET', `/nebula/leaderboard?day=${yesterday}`)).body.top.map((r) => r.score), [700])
  assert.deepStrictEqual((await api('GET', '/nebula/leaderboard')).body.top.map((r) => r.score), [200])
})

test('server ceilings match each game’s own', () => {
  for (const [game, rules] of Object.entries(GAMES)) {
    const file = path.join(__dirname, `../../customer-app/src/game/${game}.js`)
    if (!fs.existsSync(file)) continue // backend checked out on its own
    const m = fs.readFileSync(file, 'utf8').match(/export const LIMITS = (\{[^}]*\})/)
    assert.ok(m, `LIMITS not found in ${game}.js`)
    assert.deepStrictEqual(new Function(`return ${m[1]}`)(), rules.limits, game)
  }
})

// A believable Zero Reflex round.
const reflex = (score, stats = {}) => ({
  score,
  durationMs: 30000,
  day: istDay(),
  stats: { hits: 20, wrong: 1, missed: 2, holds: 1, golds: 2, avgMs: 420, bestMs: 260, ...stats },
})

test('Zero Reflex has its own board and refuses superhuman reflexes', async () => {
  const p = await player()
  const send = (body) => api('POST', '/reflex/scores', { who: p, body })
  assert.strictEqual((await send(reflex(2400))).status, 200)
  assert.strictEqual((await send(reflex(2400, { avgMs: 90, bestMs: 60 }))).status, 400)
  assert.strictEqual((await send(reflex(2400, { bestMs: 500 }))).status, 400) // best slower than average
  assert.strictEqual((await send(reflex(99999))).status, 400)
  assert.strictEqual((await send({ ...reflex(2400), durationMs: 45000 })).status, 400)
  assert.strictEqual((await send(reflex(2400, { golds: 11 }))).status, 400)
  assert.strictEqual((await send(reflex(2400, { golds: undefined }))).status, 400) // a v1 round
  assert.strictEqual((await send(reflex(20 * 900 + 200 + 2 * 400 + 1))).status, 400) // more than the taps could earn
  assert.strictEqual((await send({ ...reflex(2400), stats: { kills: 3 } })).status, 400) // another game's stats
  assert.deepStrictEqual((await api('GET', '/reflex/leaderboard')).body.top.map((r) => r.score), [2400])
  assert.deepStrictEqual((await api('GET', '/nebula/leaderboard')).body.top, [])
})

test('adding a number keeps a GullyPulse ban', async () => {
  const ConfessionBan = require('../models/ConfessionBan')
  const { authorKeyFor } = require('../middlewares/confessionPoster')
  const anon = await player()
  const until = new Date(Date.now() + 864e5)
  await ConfessionBan.collection.insertOne({ authorKey: authorKeyFor({ _id: anon.orderId }), until, reason: 'abuse' })
  assert.strictEqual((await api('POST', '/phone', { who: anon, body: { phone: '9123456782' } })).status, 200)
  const moved = await ConfessionBan.findOne({ authorKey: authorKeyFor({ phoneNumber: '9123456782' }) }).lean()
  assert.strictEqual(moved?.until.getTime(), until.getTime())
  await ConfessionBan.collection.deleteMany({})
})

// A believable Synapse round: chains of 3 to 9, two of them reversed.
const synapse = (score, stats = {}) => ({
  score,
  durationMs: 45000,
  day: istDay(),
  stats: { links: 45, chains: 7, longest: 9, misses: 1, reverses: 2, saves: 1, fastMs: 310, ...stats },
})

test('Synapse has its own board and refuses chains that don’t add up', async () => {
  const p = await player()
  const send = (body) => api('POST', '/synapse/scores', { who: p, body })
  assert.strictEqual((await send(synapse(4360))).status, 200)
  assert.strictEqual((await send(synapse(4360, { longest: 12 }))).status, 400) // 7 chains end at 9
  assert.strictEqual((await send(synapse(4360, { links: 20 }))).status, 400) // too few taps for 7 chains
  assert.strictEqual((await send(synapse(4360, { reverses: 8 }))).status, 400)
  assert.strictEqual((await send(synapse(4360, { misses: 4 }))).status, 400)
  assert.strictEqual((await send(synapse(4360, { saves: 3 }))).status, 400) // one shield per 3 chains
  assert.strictEqual((await send(synapse(4360, { fastMs: 40 }))).status, 400) // superhuman tapping
  assert.strictEqual((await send(synapse(4360, { saves: undefined }))).status, 400) // a v1 round
  assert.strictEqual((await send(synapse(149000))).status, 400) // more than the taps could earn
  assert.deepStrictEqual((await api('GET', '/synapse/leaderboard')).body.top.map((r) => r.score), [4360])
})

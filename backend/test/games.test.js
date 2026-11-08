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
  durationMs: 45000,
  day: istDay(),
  stats: { kills: Math.ceil(score / 20), energy: 0, hits: 0 },
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
})

test('impossible rounds are refused', async () => {
  const p = await player()
  const bad = [
    round(GAMES.nebula.maxScore + 20, { stats: { kills: 2000, energy: 0, hits: 0 } }),
    round(500, { durationMs: 120000 }),
    round(500, { durationMs: 10 }),
    round(500, { stats: { kills: 1, energy: 0, hits: 0 } }), // more points than the kills can give
    round(500, { stats: { kills: 25, energy: 0, hits: 4 } }),
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

test('server ceilings match the game’s own', () => {
  const file = path.join(__dirname, '../../customer-app/src/game/nebula.js')
  if (!fs.existsSync(file)) return // backend checked out on its own
  const src = fs.readFileSync(file, 'utf8')
  const m = src.match(/LIMITS = \{ maxScore: (\d+), maxKills: (\d+), maxEnergy: (\d+), killPoints: (\d+)/)
  assert.ok(m, 'LIMITS line not found in nebula.js')
  const { maxScore, maxKills, maxEnergy, killPoints } = GAMES.nebula
  assert.deepStrictEqual(m.slice(1).map(Number), [maxScore, maxKills, maxEnergy, killPoints])
  assert.ok(/MAX_COMBO = 5\b/.test(src) && /ENERGY_POINTS = 25\b/.test(src) && GAMES.nebula.energyPoints === 125)
})

// Area alerts against a real, throwaway MongoDB.
const { test, before, after, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

const { call, stub, restoreAll } = require('./helpers')
const AreaAlert = require('../models/AreaAlert')
const Cart = require('../models/Cart')
const push = require('../utils/push')
const c = require('../controllers/areaAlertController')

let mongo
before(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
})
after(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})

const id = () => new mongoose.Types.ObjectId()
const [ownerA, ownerB, ownerFar] = [id(), id(), id()]
const [cartA, cartB, cartFar] = [id(), id(), id()]
const userA = { _id: String(ownerA), role: 'vendor' }
const userB = { _id: String(ownerB), role: 'vendor' }

let pushes
beforeEach(async () => {
  for (const m of [AreaAlert, Cart]) await m.collection.deleteMany({})
  const cart = (_id, userId, lat, lng) => ({ _id, userId, cartName: `Cart ${_id}`, cartCity: 'Bengaluru', location: { type: 'Point', coordinates: [lat, lng] } })
  await Cart.collection.insertMany([
    cart(cartA, ownerA, 12.9716, 77.5946),
    cart(cartB, ownerB, 12.9760, 77.5946), // ~490 m north
    cart(cartFar, ownerFar, 12.9900, 77.5946), // ~2 km north
  ])
  pushes = []
  push._setMessaging({ sendEachForMulticast: async (m) => { pushes.push(m); return { responses: m.fids.map(() => ({})) } } })
})
afterEach(() => { restoreAll(); push._setMessaging(undefined) })

const send = (user, cartId, reason = 'EVICTION') =>
  call(c.createAreaAlert, { user, params: { cartId: String(cartId) }, body: { reason } })
const list = (user, cartId) => call(c.getAreaAlerts, { user, params: { cartId: String(cartId) } })

test('an alert reaches carts within 1 km only, never naming the sender', async () => {
  const User = require('../models/User')
  let filters = []
  stub(User, 'find', (f) => { filters.push(f); const r = Promise.resolve([{ pushIds: ['b'] }]); r.select = () => ({ lean: () => r }); return r })

  const res = await send(userA, cartA)
  assert.strictEqual(res.status, 201)
  assert.strictEqual(res.body.data.notified, 1)
  assert.deepStrictEqual(res.emits.map((e) => [e.room, e.event]), [[String(cartB), 'area_alert']])
  await new Promise((r) => setImmediate(r))
  assert.strictEqual(filters.length, 1)
  assert.deepStrictEqual(filters[0].$or[0], { _id: ownerB })
  assert.match(pushes[0].notification.title, /Eviction drive/)
  assert.strictEqual(pushes[0].notification.body, 'About 500 m from your cart')

  const b = await list(userB, cartB)
  assert.strictEqual(b.body.data.length, 1)
  assert.deepStrictEqual(Object.keys(b.body.data[0]).sort(), ['_id', 'confirmations', 'confirmedByMe', 'createdAt', 'distanceM', 'mine', 'reason'])
  assert.strictEqual(b.body.data[0].mine, false)
  assert.strictEqual((await list(userA, cartA)).body.data[0].mine, true)
  assert.strictEqual((await list({ _id: String(ownerFar), role: 'vendor' }, cartFar)).body.data.length, 0)
})

test('bad reason, cooldown and someone else\'s cart are refused', async () => {
  assert.strictEqual((await send(userA, cartA, 'POLICE')).status, 400)
  assert.strictEqual((await send(userA, cartA)).status, 201)
  assert.strictEqual((await send(userA, cartA, 'RAIN')).status, 429)
  assert.strictEqual((await send(userB, cartA)).status, 403)
})

test('confirming restarts the hour, counts once, and refuses your own alert', async () => {
  const { body } = await send(userA, cartA)
  const alertId = String(body.data._id)
  await AreaAlert.updateOne({ _id: alertId }, { expiresAt: new Date(Date.now() + 5 * 60e3) })

  const confirm = (user, cartId) => call(c.confirmAreaAlert, { user, params: { cartId: String(cartId), alertId } })
  assert.strictEqual((await confirm(userA, cartA)).status, 400)
  assert.strictEqual((await confirm(userB, cartB)).status, 200)
  assert.strictEqual((await confirm(userB, cartB)).status, 200)
  assert.strictEqual((await confirm({ _id: String(ownerFar), role: 'vendor' }, cartFar)).status, 404)

  const saved = await AreaAlert.findById(alertId).lean()
  assert.strictEqual(saved.confirmedBy.length, 1)
  assert.ok(saved.expiresAt > new Date(Date.now() + 55 * 60e3))
  const row = (await list(userB, cartB)).body.data[0]
  assert.strictEqual(row.confirmations, 1)
  assert.strictEqual(row.confirmedByMe, true)
})

test('a second report of the same kind nearby is not pushed again; another kind is', async () => {
  const userFar = { _id: String(ownerFar), role: 'vendor' }
  assert.strictEqual((await send(userA, cartA, 'EVICTION')).body.data.pushed, 1) // B is told
  const again = await send(userB, cartB, 'EVICTION')
  assert.strictEqual(again.body.data.notified, 1) // A's room still refreshes...
  assert.strictEqual(again.body.data.pushed, 0) // ...but A already knows
  assert.strictEqual((await send(userFar, cartFar, 'EVICTION')).body.data.notified, 0)
  await AreaAlert.deleteMany({ reason: 'EVICTION', cartId: cartB }) // lift B's 30-minute limit
  assert.strictEqual((await send(userB, cartB, 'RAIN')).body.data.pushed, 1)
})

test('expired alerts are not shown', async () => {
  await send(userA, cartA)
  await AreaAlert.updateMany({}, { expiresAt: new Date(Date.now() - 1000) })
  assert.strictEqual((await list(userB, cartB)).body.data.length, 0)
})

test('admin view: counts reports, names the sender, groups nearby alerts into hotspots', async () => {
  const at = (cartId, coordinates, reason, confirmedBy = [], ago = 0) => ({
    cartId, userId: ownerA, reason, coordinates, confirmedBy,
    createdAt: new Date(Date.now() - ago * 60000), expiresAt: new Date(Date.now() + (60 - ago) * 60000),
  })
  await AreaAlert.collection.insertMany([
    at(cartA, [12.9716, 77.5946], 'EVICTION', [ownerB], 120), // ended
    at(cartB, [12.9760, 77.5946], 'EVICTION'), // ~490 m away: same hotspot
    at(cartFar, [12.9900, 77.5946], 'RAIN'), // ~2 km: its own hotspot
  ])
  const res = await call(c.adminAreaAlerts, { user: { role: 'admin' }, query: {} })
  const d = res.body.data
  assert.deepStrictEqual(d.totals, { alerts: 3, reports: 4, carts: 3, active: 2 })
  assert.strictEqual(d.byReason.EVICTION, 2)
  assert.deepStrictEqual(d.hotspots.map((h) => [h.alerts, h.reports, h.carts]), [[2, 3, 2], [1, 1, 1]])
  assert.strictEqual(d.alerts.find((a) => a.reason === 'RAIN').cart.name, `Cart ${cartFar}`)
})

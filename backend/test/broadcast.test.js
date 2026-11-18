// Admin messages to vendors, against a real, throwaway MongoDB.
const { test, before, after, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

const { call } = require('./helpers')
const User = require('../models/User')
const Cart = require('../models/Cart')
const Order = require('../models/Order')
const AdminAction = require('../models/AdminAction')
const push = require('../utils/push')
const c = require('../controllers/broadcastController')

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
const DAY = 864e5
const admin = { _id: String(id()), role: 'admin' }
const [busy, unpaid, idle, gone] = [id(), id(), id(), id()] // carts
const [oBusy, oUnpaid, oIdle, oGone] = [id(), id(), id(), id()] // their owners
let batches
beforeEach(async () => {
  for (const m of [User, Cart, Order, AdminAction]) await m.collection.deleteMany({})
  const many = Array.from({ length: 501 }, (_, i) => `v${i}`)
  let n = 0
  const u = (doc) => ({ userId: `T${n++}`, disabledAt: null, ...doc })
  await User.collection.insertMany([
    u({ _id: oBusy, role: 'vendor', name: 'Busy', pushIds: many }), // 501 phones: two Firebase batches
    u({ _id: oUnpaid, role: 'vendor', pushIds: ['p-unpaid'] }),
    u({ _id: oIdle, role: 'vendor', pushIds: ['p-idle'] }),
    u({ _id: oGone, role: 'vendor', disabledAt: new Date(), pushIds: ['p-off'] }), // disabled: never
    u({ role: 'staff', cartId: unpaid, pushIds: ['s-unpaid'] }),
  ])
  const old = new Date(Date.now() - 60 * DAY)
  const cart = (_id, userId, name) => ({ _id, userId, cartName: name, cartCity: 'Bengaluru', suspendedAt: null, createdAt: old })
  await Cart.collection.insertMany([cart(busy, oBusy, 'Busy'), cart(unpaid, oUnpaid, 'Unpaid'), cart(idle, oIdle, 'Idle'), cart(gone, oGone, 'Gone')])
  const order = (cartId, ago) => {
    const at = new Date(Date.now() - ago * DAY)
    return { cartId, status: 'SERVED', platformFee: 2, paidAt: at, orderDate: at, createdAt: at, totalPrice: 50, orderItems: [] }
  }
  await Order.collection.insertMany([order(busy, 0), order(unpaid, 3), order(idle, 40)])
  batches = []
  push._setMessaging({ sendEachForMulticast: async (m) => { batches.push(m); return { responses: m.fids.map(() => ({})) } } })
})
afterEach(() => push._setMessaging(undefined))


const preview = async (query) => (await call(c.preview, { user: admin, query })).body.data
const send = (body) => call(c.send, { user: admin, body: { title: 'Hi', body: 'There', ...body } })

test('preview gives counts only: all, unpaid, no orders in N days; disabled owners never', async () => {
  assert.deepStrictEqual(await preview({ audience: 'all' }), { carts: 3, users: 3, onApp: 3, phones: 503 })
  // Today's fee isn't due yet; Unpaid's (3 days) and Idle's (40 days) are overdue.
  assert.deepStrictEqual(await preview({ audience: 'unpaid', staff: '1' }), { carts: 2, users: 3, onApp: 3, phones: 3 })
  assert.strictEqual((await preview({ audience: 'inactive', days: '30' })).carts, 1) // Idle
  assert.strictEqual((await preview({ audience: 'inactive', days: '2' })).carts, 2) // Idle, Unpaid
  assert.strictEqual((await preview({ audience: 'picked', cartIds: `${busy},${gone}` })).carts, 1)
  assert.strictEqual((await preview({ audience: 'picked', cartIds: `${busy},${gone}` })).users, 1) // Gone's owner is disabled
})

test('search finds carts by name, city or owner, never disabled owners', async () => {
  const find = async (q) => (await call(c.search, { user: admin, query: { q } })).body.data.map((r) => r.name).sort()
  assert.deepStrictEqual(await find('idl'), ['Idle'])
  assert.deepStrictEqual(await find('busy'), ['Busy'])
  assert.deepStrictEqual(await find('gone'), [])
  assert.deepStrictEqual(await find('b'), []) // too short
  assert.deepStrictEqual(await find('.*'), []) // not a regex
})

test('a picked send reaches those carts (staff when ticked) and logs it', async () => {
  const res = await send({ audience: 'picked', cartIds: [String(unpaid)], staff: true })
  assert.deepStrictEqual(res.body.data, { carts: 1, users: 2, phones: 2, sent: 2 })
  assert.deepStrictEqual(batches[0].fids.sort(), ['p-unpaid', 's-unpaid'])
  assert.strictEqual(batches[0].android.notification.channelId, 'announcements')
  const log = await AdminAction.findOne().lean()
  assert.strictEqual(log.action, 'SEND_BROADCAST')
  assert.strictEqual(log.target.label, 'Unpaid')
  assert.deepStrictEqual(log.details.picked, ['Unpaid'])
})

test('a group send is worked out on the server and goes in batches of 500', async () => {
  const res = await send({ audience: 'all' })
  assert.deepStrictEqual(res.body.data, { carts: 3, users: 3, phones: 503, sent: 503 })
  assert.deepStrictEqual(batches.map((b) => b.fids.length), [500, 3])
  assert.ok(!batches.flatMap((b) => b.fids).includes('p-off'))
  batches = []
  await send({ audience: 'inactive', days: 30 })
  assert.deepStrictEqual(batches[0].fids, ['p-idle'])
})

test('no carts, bad ids, an empty or too long message are refused and nothing is sent', async () => {
  assert.strictEqual((await send({ audience: 'picked', cartIds: [] })).status, 400)
  assert.strictEqual((await send({ cartIds: ['nope'] })).status, 400)
  assert.strictEqual((await send({ audience: 'picked', cartIds: Array.from({ length: 51 }, id).map(String) })).status, 400)
  assert.strictEqual((await send({ audience: 'all', title: ' ' })).status, 400)
  assert.strictEqual((await send({ audience: 'all', body: 'y'.repeat(c.MAX_BODY + 1) })).status, 400)
  assert.strictEqual(batches.length, 0)
})

// Admin notifications: saved, pushed live to the admins room, deduplicated,
// read per admin, and raised by the timed checks.
const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const { MongoMemoryServer } = require('mongodb-memory-server')

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'

const { call } = require('./helpers')
const Notification = require('../models/Notification')
const Order = require('../models/Order')
const Cart = require('../models/Cart')
const Payment = require('../models/Payment')
const DishCandidate = require('../models/DishCandidate')
const notify = require('../utils/adminNotify')
const { joinAdmin } = require('../utils/socketRooms')
const { trackDishes } = require('../utils/dishCandidates')
const c = require('../controllers/notificationController')

let mongo
const sent = []
before(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
  await Notification.init()
  notify.init({ to: (room) => ({ emit: (event, data) => sent.push({ room, event, data }) }) })
})
after(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})
beforeEach(async () => {
  sent.length = 0
  for (const m of [Notification, Order, Cart, Payment, DishCandidate]) await m.collection.deleteMany({})
})

// notifyAdmins doesn't wait; give it a moment to land.
async function settle(count) {
  for (let i = 0; i < 50; i++) {
    if ((await Notification.countDocuments()) >= count) break
    await new Promise((r) => setTimeout(r, 20))
  }
  await new Promise((r) => setTimeout(r, 30))
}

const adminA = { _id: new mongoose.Types.ObjectId(), role: 'admin' }
const adminB = { _id: new mongoose.Types.ObjectId(), role: 'admin' }

test('a notification is saved, sent to the admins room, and a repeated key is skipped', async () => {
  const n = { type: 'dish', title: 'New dish', to: '/dishes', key: 'dish:x' }
  notify.notifyAdmins(n)
  await settle(1)
  notify.notifyAdmins(n)
  await settle(2)
  assert.equal(await Notification.countDocuments(), 1)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].room, 'admins')
  assert.equal(sent[0].event, 'admin_notification')
  assert.equal(sent[0].data.to, '/dishes')
})

test('each admin has their own unread count', async () => {
  notify.notifyAdmins({ type: 'a', title: 'One', to: '/' })
  notify.notifyAdmins({ type: 'a', title: 'Two', to: '/' })
  await settle(2)
  let r = await call(c.list, { user: adminA })
  assert.equal(r.body.data.unread, 2)
  const one = r.body.data.items[0].id

  await call(c.markRead, { user: adminA, body: { ids: [one] } })
  r = await call(c.list, { user: adminA })
  assert.equal(r.body.data.unread, 1)
  assert.equal(r.body.data.items.find((i) => i.id === one).read, true)
  assert.equal((await call(c.list, { user: adminB })).body.data.unread, 2)

  await call(c.markRead, { user: adminB, body: { all: true } })
  assert.equal((await call(c.list, { user: adminB })).body.data.unread, 0)
  assert.equal((await call(c.markRead, { user: adminB, body: { ids: ['nope'] } })).status, 400)
})

test('only the socket token joins the admins room, not a login token', async () => {
  const socket = (adminToken) => {
    const rooms = []
    return { rooms, handshake: { auth: { adminToken } }, join: (r) => rooms.push(r) }
  }
  const token = (await call(c.socketToken, { user: adminA })).body.data.token
  const ok = socket(token)
  assert.equal(joinAdmin(ok), true)
  assert.deepEqual(ok.rooms, ['admins'])

  const login = jwt.sign({ _id: adminA._id, role: 'admin' }, process.env.JWT_SECRET)
  assert.equal(joinAdmin(socket(login)), false)
  assert.equal(joinAdmin(socket(undefined)), false)
})

test('a refund not handed back after 2 hours is announced once', async () => {
  const cartId = new mongoose.Types.ObjectId()
  await Cart.collection.insertOne({ _id: cartId, cartName: 'Raju Momos' })
  const now = new Date()
  await Order.collection.insertMany([
    { cartId, orderNumber: 7, status: 'CANCELLED', refunds: [{ amount: 50, reason: 'CANCELLED', owedAt: new Date(+now - 3 * 3600e3), refundedAt: null }] },
    { cartId, orderNumber: 8, status: 'CANCELLED', refunds: [{ amount: 40, reason: 'CANCELLED', owedAt: new Date(+now - 3600e3), refundedAt: null }] },
  ])
  await notify.checkAttention(now)
  await settle(1)
  await notify.checkAttention(now)
  await settle(2)
  const all = await Notification.find().lean()
  assert.equal(all.length, 1)
  assert.match(all[0].title, /Raju Momos/)
  assert.match(all[0].text, /#7/)
})

test('a dish is announced when its third cart uses it, once', async () => {
  const carts = [1, 2, 3, 4].map(() => new mongoose.Types.ObjectId())
  await trackDishes(carts[0], [{ name: 'Kulhad Chai' }])
  await trackDishes(carts[1], [{ name: 'Kulhad Chai' }])
  await settle(0)
  assert.equal(await Notification.countDocuments(), 0)
  await trackDishes(carts[2], [{ name: 'Kulhad Chai' }])
  await trackDishes(carts[3], [{ name: 'Kulhad Chai' }])
  await settle(2)
  const all = await Notification.find().lean()
  assert.equal(all.length, 1)
  assert.equal(all[0].to, '/dishes')
})

test('a cart the fee-leakage tab flags is announced once a week', async () => {
  const leaky = new mongoose.Types.ObjectId()
  const fine = new mongoose.Types.ObjectId()
  await Cart.collection.insertMany([{ _id: leaky, cartName: 'Leaky' }, { _id: fine, cartName: 'Fine' }])
  // 10am IST today: past the 9am morning check.
  const ist = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10)
  const now = new Date(`${ist}T10:00:00+05:30`)
  const at = new Date(+now - 3 * 86400e3)
  let n = 0
  const order = (cartId, status) => ({ cartId, orderNumber: ++n, status, platformFee: 2, createdAt: at, paidAt: status === 'SERVED' ? at : null })
  await Order.collection.insertMany([
    ...Array.from({ length: 8 }, () => order(leaky, 'CANCELLED')),
    ...Array.from({ length: 2 }, () => order(leaky, 'SERVED')),
    ...Array.from({ length: 40 }, () => order(fine, 'SERVED')),
  ])
  await notify.checkAttention(now)
  await notify.checkAttention(now)
  await settle(2)
  const leaks = await Notification.find({ type: 'leakage' }).lean()
  assert.equal(leaks.length, 1)
  assert.match(leaks[0].title, /Leaky/)
  assert.equal(leaks[0].to, '/insights?tab=leakage')
})

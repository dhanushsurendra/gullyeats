// Live-update rooms and the admin cookie, against a throwaway MongoDB.
const { test, before, after } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const { MongoMemoryServer } = require('mongodb-memory-server')

process.env.JWT_SECRET = 'test-secret'
process.env.FRONTEND_URL_ADMIN = 'https://admin.gullyeats.test'

const Cart = require('../models/Cart')
const User = require('../models/User')
const { joinVendor, joinOrder } = require('../utils/socketRooms')
const auth = require('../middlewares/auth')

let mongo
const ownerId = new mongoose.Types.ObjectId()
const staffId = new mongoose.Types.ObjectId()
const strangerId = new mongoose.Types.ObjectId()
const cartId = new mongoose.Types.ObjectId()

before(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
  await Cart.collection.insertOne({ _id: cartId, userId: ownerId, cartName: 'Test' })
  await User.collection.insertOne({ _id: staffId, role: 'staff', cartId })
})
after(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})

const token = (_id, role) => jwt.sign({ _id, role }, process.env.JWT_SECRET)

// Records which rooms a socket joined and what it was told.
function fakeSocket(authToken) {
  return {
    handshake: { auth: authToken ? { token: authToken } : {} },
    rooms: [],
    emitted: [],
    join(room) { this.rooms.push(room) },
    emit(event, data) { this.emitted.push(event) },
  }
}

test("the cart's owner and staff can join its live orders", async () => {
  for (const [id, role] of [[ownerId, 'vendor'], [staffId, 'staff']]) {
    const socket = fakeSocket(token(id, role))
    assert.equal(await joinVendor(socket, String(cartId)), true)
    assert.deepEqual(socket.rooms, [String(cartId)])
  }
})

test("anyone else is refused a cart's live orders", async () => {
  for (const socket of [
    fakeSocket(), // no login
    fakeSocket('not-a-token'),
    fakeSocket(token(strangerId, 'vendor')), // another vendor
    fakeSocket(jwt.sign({ _id: ownerId, role: 'vendor' }, 'wrong-secret')),
  ]) {
    assert.equal(await joinVendor(socket, String(cartId)), false)
    assert.deepEqual(socket.rooms, [])
    assert.deepEqual(socket.emitted, ['join_error'])
  }
})

test('a customer can follow their own order by its ID, but not by junk', () => {
  const socket = fakeSocket()
  const orderId = String(new mongoose.Types.ObjectId())
  assert.equal(joinOrder(socket, orderId), true)
  assert.equal(joinOrder(socket, '1'), false)
  assert.deepEqual(socket.rooms, [`order:${orderId}`])
})

test("the admin cookie works for writes only from the dashboard's origin", () => {
  const cookie = token(new mongoose.Types.ObjectId(), 'admin')
  const run = (method, origin) => {
    let status = 200
    const req = { method, headers: origin ? { origin } : {}, cookies: { token: cookie } }
    const res = { status(code) { status = code; return this }, json() { return this } }
    auth(req, res, () => {})
    return status
  }
  assert.equal(run('GET'), 200)
  assert.equal(run('POST', 'https://admin.gullyeats.test'), 200)
  assert.equal(run('POST', 'https://evil.example'), 401)
  assert.equal(run('POST'), 401)
})

test('admin GMV, fees and average order count only paid and served orders', async () => {
  const Order = require('../models/Order')
  const admin = require('../controllers/adminController')
  const { call } = require('./helpers')
  const now = new Date()
  const o = (status, totalPrice) => ({
    cartId, orderNumber: Math.random(), status, totalPrice, subtotal: totalPrice - 2,
    platformFee: 2, orderItems: [], createdAt: now, orderDate: now,
  })
  await Order.collection.insertMany([
    o('PAID', 62), o('SERVED', 102), o('PENDING', 500), o('CANCELLED', 900),
  ])
  const r = await call(admin.overview, { query: { range: 'today' }, user: { role: 'admin' } })
  assert.equal(r.status, 200)
  const find = (obj, key) =>
    obj && typeof obj === 'object'
      ? key in obj ? obj[key] : Object.values(obj).map((v) => find(v, key)).find((v) => v !== undefined)
      : undefined
  assert.equal(find(r.body, 'orderGmvRange'), 164)
  assert.equal(find(find(r.body, 'aov'), 'value'), 82)
})

// Collections' overdue totals follow the billing rules, against a throwaway MongoDB.
const { test, before, after } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const Order = require('../models/Order')
const Payment = require('../models/Payment')
const { overdueByCart } = require('../utils/overdueFees')

let mongo
before(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
})
after(async () => {
  await mongoose.disconnect()
  await mongo.stop()
})

test('overdue counts orders paid then edited back to PENDING, minus credits', async () => {
  const cartId = new mongoose.Types.ObjectId()
  const old = new Date(Date.now() - 5 * 864e5)
  let n = 0
  const o = (status, extra = {}) => ({ orderNumber: ++n,
    _id: new mongoose.Types.ObjectId(), cartId, status, platformFee: 2, paidAt: old, createdAt: old, ...extra,
  })
  const billedThenCancelled = o('CANCELLED')
  await Order.collection.insertMany([
    o('SERVED'),
    o('PENDING'), // paid, then an item was added: still billed
    o('PENDING', { paidAt: null }), // never paid
    billedThenCancelled,
  ])
  await Payment.collection.insertOne({ cartId, status: 'VERIFIED', orderIds: [billedThenCancelled._id] })

  const [row] = await overdueByCart()
  assert.strictEqual(row.orders, 2)
  assert.strictEqual(row.amount, 2) // 2 orders x ₹2, minus the ₹2 credit
})

test("tonight's served orders aren't overdue yet, but count with { all: true }", async () => {
  const cartId = new mongoose.Types.ObjectId()
  const now = new Date()
  await Order.collection.insertOne({
    _id: new mongoose.Types.ObjectId(), orderNumber: 1, cartId, status: 'SERVED', platformFee: 3, paidAt: now, createdAt: now,
  })
  const mine = (rows) => rows.find((r) => String(r._id) === String(cartId))
  assert.strictEqual(mine(await overdueByCart(new Date(+now + 1000))), undefined)
  assert.strictEqual(mine(await overdueByCart(new Date(+now + 1000), { all: true })).amount, 3)
})

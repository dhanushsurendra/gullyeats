const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const { stub, restoreAll, q } = require('./helpers')
const Cart = require('../models/Cart')
const Order = require('../models/Order')
const Payment = require('../models/Payment')
const feeReminders = require('../utils/feeReminders')
const { platformHealth } = require('../utils/platformHealth')

afterEach(restoreAll)

const now = new Date('2026-11-14T20:00:00+05:30')
const minsAgo = (m) => new Date(+now - m * 60e3)
const byKey = (rows) => Object.fromEntries(rows.map((r) => [r.key, r]))

function setup({ open = [], lastOrder, lastPayment, ran, env = {} }) {
  stub(mongoose.connection, 'readyState', 1)
  stub(Cart, 'find', () => q(open.map((_id) => ({ _id }))))
  stub(Order, 'findOne', () => q(lastOrder && { createdAt: lastOrder }))
  stub(Payment, 'findOne', () => q(lastPayment && { verifiedAt: lastPayment }))
  stub(feeReminders, 'lastRun', () => ran)
  for (const k of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'FIREBASE_SERVICE_ACCOUNT', 'WEBPUSH_PUBLIC_KEY', 'WEBPUSH_PRIVATE_KEY']) {
    stub(process.env, k, env[k])
    if (env[k] === undefined) delete process.env[k]
  }
}

test('a healthy evening: everything ok, with times', async () => {
  setup({
    open: ['a', 'b'],
    lastOrder: minsAgo(4),
    lastPayment: minsAgo(180),
    ran: minsAgo(6),
    env: { RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's', FIREBASE_SERVICE_ACCOUNT: '{}', WEBPUSH_PUBLIC_KEY: 'p', WEBPUSH_PRIVATE_KEY: 'q' },
  })
  const io = { sockets: { adapter: { rooms: new Map([['a', new Set([1])], ['b', new Set([2])]]) } } }
  const h = byKey(await platformHealth(io, now))
  assert.ok(Object.values(h).every((r) => r.state === 'ok'), JSON.stringify(h))
  assert.strictEqual(h.orders.detail, 'Last order 4 min ago')
  assert.strictEqual(h.vendorApps.detail, 'All 2 open carts connected')
  assert.strictEqual(h.payments.detail, 'Last fee payment 3h ago')
})

test('quiet carts, unconnected apps, missing keys and a stalled timer are flagged', async () => {
  setup({ open: ['a', 'b', 'c'], lastOrder: minsAgo(5 * 60), ran: minsAgo(120), env: { FIREBASE_SERVICE_ACCOUNT: '{}' } })
  const io = { sockets: { adapter: { rooms: new Map([['a', new Set([1])]]) } } }
  const h = byKey(await platformHealth(io, now))
  assert.strictEqual(h.orders.state, 'warn')
  assert.strictEqual(h.orders.detail, 'Last order 5h ago while 3 carts are open')
  assert.strictEqual(h.vendorApps.state, 'warn')
  assert.match(h.vendorApps.detail, /^2 of 3 open carts/)
  assert.strictEqual(h.payments.state, 'bad')
  assert.strictEqual(h.push.state, 'bad')
  assert.match(h.push.detail, /customer \(WEBPUSH_\*\)/)
  assert.strictEqual(h.feeReminders.state, 'warn')
})

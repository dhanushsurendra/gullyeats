const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const { stub, restoreAll, q } = require('./helpers')
const User = require('../models/User')
const push = require('../utils/push')

afterEach(() => { restoreAll(); push._setMessaging(undefined) })

const cart = { _id: 'c1', userId: 'u1', cartName: 'Raju Chaats' }
const order = { orderNumber: 12, totalPrice: 90, orderItems: [{ quantity: 2, name: 'Pani Puri' }] }

test('pushes a new order to owner and staff and drops dead ids', async () => {
  let filter, sent, pulled
  stub(User, 'find', (f) => { filter = f; return q([{ pushIds: ['a', 'b'] }, { pushIds: ['c'] }]) })
  stub(User, 'updateMany', async (f, u) => { pulled = { f, u } })
  push._setMessaging({
    sendEachForMulticast: async (m) => {
      sent = m
      return { responses: [{}, { error: { code: 'messaging/installation-id-not-registered' } }, { error: { code: 'messaging/internal-error' } }] }
    },
  })

  await push.notifyNewOrder(cart, order)

  assert.deepStrictEqual(filter.$or, [{ _id: 'u1' }, { role: 'staff', cartId: 'c1' }])
  assert.deepStrictEqual(sent.fids, ['a', 'b', 'c'])
  assert.strictEqual(sent.notification.title, 'New order #12 · Raju Chaats')
  assert.strictEqual(sent.notification.body, '₹90 · 2× Pani Puri')
  assert.deepStrictEqual(pulled.f, { pushIds: { $in: ['b'] } })
})

test('a failed push never throws, and no Firebase key means no push', async () => {
  stub(User, 'find', () => { throw new Error('db down') })
  push._setMessaging({ sendEachForMulticast: async () => assert.fail() })
  await push.notifyNewOrder(cart, order)

  push._setMessaging(null)
  await push.notifyNewOrder(cart, order)
})

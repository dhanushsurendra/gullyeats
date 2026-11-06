const test = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const { call, stub, restoreAll } = require('./helpers')
const paymentLock = require('../utils/cartPaymentLock')
const blockLockedCart = require('../middlewares/cartPaymentLock')

test.afterEach(restoreAll)

const cartId = new mongoose.Types.ObjectId().toString()

test('a locked cart refuses new orders without revealing its billing', async () => {
  stub(paymentLock, 'getCartPaymentStatus', async () => ({
    isLocked: true, totalPending: 120, billingDate: new Date(),
  }))
  const r = await call(blockLockedCart, { body: { cartId } })
  assert.equal(r.status, 403)
  assert.deepEqual(Object.keys(r.body).sort(), ['message', 'success'])
})

test('an unlocked cart takes orders', async () => {
  stub(paymentLock, 'getCartPaymentStatus', async () => ({ isLocked: false }))
  const r = await call(blockLockedCart, { body: { cartId } })
  assert.equal(r.next, true)
})

test('a missing cartId is left to the order handler', async () => {
  stub(paymentLock, 'getCartPaymentStatus', async () => { throw new Error('should not be called') })
  const r = await call(blockLockedCart, { body: {} })
  assert.equal(r.next, true)
})

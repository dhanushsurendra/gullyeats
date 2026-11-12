const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const { stub, restoreAll, q } = require('./helpers')
const Cart = require('../models/Cart')
const User = require('../models/User')
const paymentLock = require('../utils/cartPaymentLock')
const push = require('../utils/push')

afterEach(restoreAll)

// 00:30 IST on 13 Nov (19:00 UTC on 12 Nov), and 10:00 IST the same day.
const MIDNIGHT = new Date('2026-11-12T19:00:00Z')
const MORNING = new Date('2026-11-13T04:30:00Z')

function setup(statusFor, claimed = 1) {
  const sent = []
  const claims = []
  stub(User, 'find', () => q([{ _id: 'u1' }]))
  stub(Cart, 'find', () => q([{ _id: 'c1', userId: 'u1', cartName: 'Raju Chaats' }, { _id: 'c2', userId: 'u1', cartName: 'Paid Cart' }]))
  stub(Cart, 'updateOne', async (f, u) => { claims.push(u.$set.feeReminder); return { modifiedCount: claimed } })
  stub(paymentLock, 'getCartPaymentStatus', async (id) => statusFor[id])
  stub(push, 'sendToUsers', async (filter, msg) => sent.push({ filter, msg }))
  // feeReminders destructures getCartPaymentStatus, so load it after stubbing.
  delete require.cache[require.resolve('../utils/feeReminders')]
  return { sent, claims, ...require('../utils/feeReminders') }
}

test('after midnight, a payable fee is due before the 2am lock; paid carts get nothing', async () => {
  const dueAt = new Date('2026-11-12T20:30:00Z') // 2:00 AM IST
  const { sent, claims, sendFeeReminders } = setup({
    c1: { isLocked: false, canPay: true, totalPending: 26, dueAt },
    c2: { isLocked: false, totalPending: 0 },
  })
  assert.strictEqual(await sendFeeReminders(MIDNIGHT), 1)
  assert.deepStrictEqual(claims, ['2026-11-13:due', '2026-11-13:due'])
  assert.deepStrictEqual(sent[0].filter, { _id: 'u1' })
  assert.strictEqual(sent[0].msg.notification.title, 'Platform fee due: ₹26 · Raju Chaats')
  assert.match(sent[0].msg.notification.body, /^Pay before 2:00 am to keep taking orders\.$/i)
  assert.deepStrictEqual(sent[0].msg.data, { type: 'fee', cartId: 'c1' })
  assert.strictEqual(sent[0].msg.channelId, 'fees')
})

test('in the morning a locked cart is reminded; a cart another server claimed is skipped', async () => {
  let r = setup({ c1: { isLocked: true, totalPending: 40 }, c2: { isLocked: true, totalPending: 40 } })
  assert.strictEqual(await r.sendFeeReminders(MORNING), 2)
  assert.strictEqual(r.sent[0].msg.notification.title, 'Cart locked · Raju Chaats')
  assert.strictEqual(r.sent[0].msg.notification.body, 'Pay the ₹40 platform fee to take orders again.')
  restoreAll()

  r = setup({ c1: { isLocked: true, totalPending: 40 } }, 0)
  assert.strictEqual(await r.sendFeeReminders(MORNING), 0)
})

test('nothing is sent outside the reminder hours', async () => {
  const { sendFeeReminders } = setup({})
  assert.strictEqual(await sendFeeReminders(new Date('2026-11-12T22:30:00Z')), 0) // 4am IST
  assert.strictEqual(await sendFeeReminders(new Date('2026-11-13T16:30:00Z')), 0) // 10pm IST
})

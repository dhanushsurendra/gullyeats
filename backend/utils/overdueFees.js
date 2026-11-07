const Order = require('../models/Order')
const Payment = require('../models/Payment')
const { BILLING_LOCK_MS, getISTMidnight } = require('./cartPaymentLock')

const DAY = 864e5

// A day's bill is overdue BILLING_LOCK_MS after its IST midnight (when the
// cart locks), so every billing day before the one containing
// (now - BILLING_LOCK_MS) is overdue.
const overdueBefore = (now = new Date()) =>
  new Date(+getISTMidnight(new Date(+now - BILLING_LOCK_MS)) + DAY)

/*
 * Overdue platform fees per cart, largest first: the fee on every PAID or
 * SERVED order that no verified fee payment has covered, from billing days
 * (the IST day the customer paid, as in cartPaymentLock) whose grace has
 * passed. Orders are only cancelled on their own day, before that day is
 * billed, so there are no billing credits to subtract.
 * Rows: { _id: cartId, amount, orders, oldest } (oldest = earliest unpaid order's billing time).
 */
async function overdueByCart(now = new Date()) {
  // shortcut: loads every billed order id; move to a $lookup on an indexed Payment.orderIds once there are ~100k+ billed orders.
  const billed = await Payment.distinct('orderIds', { status: 'VERIFIED' })
  return Order.aggregate([
    { $match: { status: { $in: ['PAID', 'SERVED'] }, _id: { $nin: billed } } },
    { $addFields: { billedAt: { $ifNull: ['$paidAt', '$orderDate', '$createdAt'] } } },
    { $match: { billedAt: { $lt: overdueBefore(now) } } },
    {
      $group: {
        _id: '$cartId',
        amount: { $sum: '$platformFee' },
        orders: { $sum: 1 },
        oldest: { $min: '$billedAt' },
      },
    },
    { $sort: { amount: -1, _id: 1 } },
  ])
}

module.exports = { overdueBefore, overdueByCart }

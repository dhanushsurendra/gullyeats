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
 * Overdue platform fees per cart, largest first, by the same rules as
 * cartPaymentLock's bills: the fee on every billable order (paid, or edited
 * back to PENDING after being paid) that no verified fee payment has covered,
 * or that was credited and then restored, from billing days whose grace has
 * passed; minus credits (billed orders cancelled since, not yet credited).
 * Rows: { _id: cartId, amount, orders, oldest } (oldest = earliest unpaid order's billing time).
 */
// With { all: true }, fees not due yet (today's, or yesterday's before the lock) count too.
async function overdueByCart(now = new Date(), { all = false } = {}) {
  // shortcut: loads every billed order id; move to a $lookup on an indexed Payment.orderIds once there are ~100k+ billed orders.
  const billed = await Payment.distinct('orderIds', { status: 'VERIFIED' })
  const [owed, credits] = await Promise.all([
    owedByCart(billed, all ? now : overdueBefore(now)),
    Order.aggregate([
      { $match: { status: 'CANCELLED', feeCredited: { $ne: true }, _id: { $in: billed } } },
      { $group: { _id: '$cartId', amount: { $sum: '$platformFee' } } },
    ]),
  ])
  const credit = new Map(credits.map((c) => [String(c._id), c.amount]))
  return owed
    .map((row) => ({ ...row, amount: Math.max(0, row.amount - (credit.get(String(row._id)) || 0)) }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount || String(a._id).localeCompare(String(b._id)))
}

function owedByCart(billed, before) {
  return Order.aggregate([
    {
      $match: {
        status: { $ne: 'CANCELLED' },
        $and: [
          { $or: [{ paidAt: { $ne: null } }, { status: { $in: ['PAID', 'SERVED'] } }] },
          { $or: [{ _id: { $nin: billed } }, { feeCredited: true }] },
        ],
      },
    },
    { $addFields: { billedAt: { $ifNull: ['$paidAt', '$orderDate', '$createdAt'] } } },
    { $match: { billedAt: { $lt: before } } },
    {
      $group: {
        _id: '$cartId',
        amount: { $sum: '$platformFee' },
        orders: { $sum: 1 },
        oldest: { $min: '$billedAt' },
      },
    },
  ])
}

module.exports = { overdueBefore, overdueByCart }

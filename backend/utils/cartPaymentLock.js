const crypto = require('crypto')
const mongoose = require('mongoose')
const Payment = require('../models/Payment')
const Order = require('../models/Order')
const Cart = require('../models/Cart')

/*
 * The ₹2 fee is charged on orders the customer paid for, on the IST day they
 * first paid (paidAt), not the day the order was created. A day's bill can
 * only be paid after that day ends, so no payment can land in a day that is
 * already billed: an order created at 11:40pm and paid at 12:20am is in the
 * next day's bill instead of being missed.
 *
 * An order edited so the customer owes more goes back to PENDING but keeps
 * its first paidAt, so it is billed once. Marking an order unpaid clears
 * paidAt, and cancelled orders are never billed. Older orders that were paid
 * before paidAt was recorded count on their order day.
 */
function billableOrders(cartId) {
  return [
    {
      $match: {
        cartId: new mongoose.Types.ObjectId(String(cartId)),
        status: { $ne: 'CANCELLED' },
        $or: [{ paidAt: { $ne: null } }, { status: { $in: ['PAID', 'SERVED'] } }],
      },
    },
    { $addFields: { billedAt: { $ifNull: ['$paidAt', '$orderDate', '$createdAt'] } } },
  ]
}

/** The IST day of the first billable order paid at or after [from]. */
async function firstBillingDay(cartId, from) {
  const [first] = await Order.aggregate([
    ...billableOrders(cartId),
    ...(from ? [{ $match: { billedAt: { $gte: from } } }] : []),
    { $sort: { billedAt: 1 } },
    { $limit: 1 },
    { $project: { billedAt: 1 } },
  ])
  return first ? getISTMidnight(first.billedAt) : null
}

const BILLING_LOCK_HOURS = 26
const BILLING_LOCK_MS =
  BILLING_LOCK_HOURS * 60 * 60 * 1000

/**
 * Get midnight of the given calendar day in IST.
 *
 * Example:
 * 2026-09-17 15:30 IST
 *        ↓
 * 2026-09-17 00:00 IST
 *
 * Returned Date represents:
 * 2026-09-16T18:30:00.000Z
 */
function getISTMidnight(date = new Date()) {
  if (!date) {
    throw new Error('Date is required')
  }

  const inputDate = new Date(date)

  if (Number.isNaN(inputDate.getTime())) {
    throw new Error('Invalid date')
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(inputDate)

  const year = parts.find((part) => part.type === 'year')?.value

  const month = parts.find((part) => part.type === 'month')?.value

  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) {
    throw new Error('Unable to determine IST calendar date')
  }

  return new Date(`${year}-${month}-${day}T00:00:00.000+05:30`)
}

/**
 * Get the next calendar day at midnight IST.
 *
 * Billing dates are always stored as IST midnight.
 */
function getNextISTMidnight(billingDate) {
  if (!billingDate) {
    throw new Error('billingDate is required')
  }

  const date = new Date(billingDate)

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid billingDate')
  }

  return new Date(date.getTime() + 24 * 60 * 60 * 1000)
}

/**
 * The bill for ONE billing day: the fee of every order first paid that day,
 * adjusted for earlier bills.
 *
 * - Credit: an order an earlier bill charged, cancelled since, gives its fee
 *   back (once: it's marked feeCredited when this bill is verified).
 * - Recharge: a credited order whose cancellation was undone is charged
 *   again (and unmarked when this bill is verified).
 *
 * Credits never take the bill below zero; any left over wait for the next.
 */
async function getBillingFee(cartId, billingDate) {
  if (!cartId) {
    throw new Error('cartId is required')
  }

  if (!billingDate) {
    throw new Error('billingDate is required')
  }

  const start = new Date(billingDate)

  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid billingDate')
  }

  const billingEnd = getNextISTMidnight(start)
  const cart = new mongoose.Types.ObjectId(String(cartId))
  const fee = (order) => Number(order.platformFee || 0)

  // Cancelled orders a bill may have charged: paid ones (paidAt is kept on
  // cancel) and legacy ones from before paidAmount. Unpaid cancellations,
  // most of them, can't have been billed, so the list stays short.
  const [orders, cancelled, recharges] = await Promise.all([
    Order.aggregate([
      ...billableOrders(cartId),
      { $match: { billedAt: { $gte: start, $lt: billingEnd } } },
      { $project: { platformFee: 1 } },
    ]),
    Order.find({
      cartId: cart,
      status: 'CANCELLED',
      feeCredited: { $ne: true },
      $or: [{ paidAt: { $ne: null } }, { paidAmount: { $exists: false } }],
    })
      .select('platformFee')
      .sort({ updatedAt: 1 })
      .lean(),
    Order.find({ cartId: cart, status: { $ne: 'CANCELLED' }, feeCredited: true })
      .select('platformFee')
      .lean(),
  ])
  const billed = cancelled.length
    ? new Set(
        (
          await Payment.distinct('orderIds', {
            cartId: cart,
            status: 'VERIFIED',
            orderIds: { $in: cancelled.map((o) => o._id) },
          })
        ).map(String),
      )
    : new Set()
  const cancelledSinceBilled = cancelled.filter((o) => billed.has(String(o._id)))

  const charged = orders.reduce((t, o) => t + fee(o), 0) + recharges.reduce((t, o) => t + fee(o), 0)
  const credits = []
  let creditTotal = 0
  for (const order of cancelledSinceBilled) {
    if (creditTotal + fee(order) > charged) break
    credits.push(order)
    creditTotal += fee(order)
  }

  return {
    totalOrders: orders.length,
    totalPlatformFee: charged - creditTotal,
    orderIds: orders.map((o) => o._id),
    creditOrderIds: credits.map((o) => o._id),
    rechargeOrderIds: recharges.map((o) => o._id),
  }
}

/**
 * Creates the Payment for [cart]'s bill on [billingDate] with [status]
 * (PENDING to pay through Razorpay; VERIFIED for an admin's manual payment
 * or a bill credits fully cover). The bill records which orders it charged,
 * credited and recharged.
 */
async function createBillPayment(cart, billingDate, { status, verificationSource = null }) {
  const bill = await getBillingFee(cart._id, billingDate)
  return Payment.create({
    cartId: cart._id,
    userId: cart.userId,
    cartName: cart.cartName,
    totalOrders: bill.totalOrders,
    amount: bill.totalPlatformFee,
    status,
    verificationSource,
    verifiedAt: status === 'VERIFIED' ? new Date() : null,
    paymentReference: `GUL-${crypto.randomUUID()}`,
    billingDate,
    orderIds: bill.orderIds,
    creditOrderIds: bill.creditOrderIds,
    rechargeOrderIds: bill.rechargeOrderIds,
  })
}

/**
 * The billing date of the first order the customer paid for.
 */
async function getFirstBillingDate(cartId) {
  return firstBillingDay(cartId)
}

/**
 * The next day to bill, found from the orders rather than by stepping
 * through calendar days: the day of the first paid order, or, after a
 * payment, of the first order paid after the last paid day. Days without
 * paid orders are skipped (Thursday paid, nothing until Monday -> Monday).
 */
async function getBillingDate(cartId) {
  const lastVerifiedPayment = await Payment.findOne({
    cartId,
    status: 'VERIFIED',
  })
    .sort({
      billingDate: -1,
    })
    .lean()

  /**
   * No previous payment.
   *
   * Start from the first order.
   */
  if (!lastVerifiedPayment) {
    return getFirstBillingDate(cartId)
  }

  if (!lastVerifiedPayment.billingDate) {
    throw new Error(
      `Verified payment ${lastVerifiedPayment._id} is missing billingDate`,
    )
  }

  const lastBillingDate = getISTMidnight(lastVerifiedPayment.billingDate)
  // The next bill starts the day AFTER the paid one. Searching from the
  // paid day's midnight found that day's own orders, so the paid day was
  // billed again, the "already paid" check unlocked it, and no later day
  // was ever billed.
  const nextDayStart = getNextISTMidnight(lastBillingDate)

  // The day of the first order paid after the last paid billing day.
  return firstBillingDay(cartId, nextDayStart)
}

/**
 * Determine the current payment state of a cart.
 *
 * Billing is order-driven:
 *
 *   First order
 *       ↓
 *   billing date
 *       ↓
 *   payment
 *       ↓
 *   find NEXT order
 *       ↓
 *   next billing date
 *
 * There is NO calendar-day scanning.
 */
async function getCartPaymentStatus(cartId) {
  const cart = await Cart.findById(cartId).lean()

  if (!cart) {
    return {
      isLocked: false,
      message: 'Cart not found.',
      billingDate: null,
      totalOrders: 0,
      totalPending: 0,
      cartName: '',
      address: '',
    }
  }

  /**
   * ---------------------------------------------------------
   * 1. EXISTING PENDING PAYMENT
   * ---------------------------------------------------------
   */
  const pendingPayment = await Payment.findOne({
    cartId,
    status: 'PENDING',
  }).lean()

  // A started payment (checkout opened, maybe closed again) locks only once
  // its bill is due, like an unstarted one.
  if (pendingPayment) {
    const dueAt = pendingPayment.billingDate
      ? new Date(new Date(pendingPayment.billingDate).getTime() + BILLING_LOCK_MS)
      : null
    return {
      isLocked: !dueAt || new Date() >= dueAt,
      message: 'Payment verification is pending.',
      payment: pendingPayment,
      dueAt,
      canPay: true,
      billingDate: pendingPayment.billingDate || null,
      totalOrders: pendingPayment.totalOrders || 0,
      totalPending: Number(pendingPayment.amount || 0),
      cartName: cart.cartName,
      address: cart.address,
    }
  }

  /**
   * ---------------------------------------------------------
   * 2. DETERMINE NEXT BILLING DATE
   * ---------------------------------------------------------
   * A finished day that credits bring to ₹0 is settled here (there is
   * nothing to pay), then the next day is looked at.
   */
  let billingDate = await getBillingDate(cartId)
  let bill = billingDate ? await getBillingFee(cartId, billingDate) : null
  for (
    let settled = 0;
    bill && bill.totalPlatformFee <= 0 && new Date() >= getNextISTMidnight(billingDate) && settled < 30;
    settled++
  ) {
    await createBillPayment(cart, billingDate, {
      status: 'VERIFIED',
      verificationSource: 'CREDIT',
    })
    billingDate = await getBillingDate(cartId)
    bill = billingDate ? await getBillingFee(cartId, billingDate) : null
  }

  /**
   * No unpaid orders.
   */
  if (!billingDate) {
    return {
      isLocked: false,
      billingDate: null,
      totalOrders: 0,
      totalPending: 0,
      cartName: cart.cartName,
      address: cart.address,
    }
  }

  /**
   * ---------------------------------------------------------
   * 3. CALCULATE FEE FOR THIS EXACT DAY
   * ---------------------------------------------------------
   */
  const { totalOrders, totalPlatformFee } = bill

  /**
   * This should normally not happen because
   * getBillingDate() is derived from an order.
   *
   * But if all orders on that day have zero fee,
   * don't lock the cart.
   */
  if (totalPlatformFee <= 0) {
    return {
      isLocked: false,
      billingDate,
      totalOrders,
      totalPending: 0,
      cartName: cart.cartName,
      address: cart.address,
    }
  }

  /**
   * ---------------------------------------------------------
   * 4. HAS THE 26-HOUR BILLING WINDOW PASSED?
   * ---------------------------------------------------------
   */
  const now = new Date()

  const billingDue = now.getTime() - billingDate.getTime() >= BILLING_LOCK_MS

  // When the cart locks, and whether the bill can be paid yet: a day's bill
  // is final, and payable, once that IST day has ended.
  const dueAt = new Date(billingDate.getTime() + BILLING_LOCK_MS)
  const canPay = now >= getNextISTMidnight(billingDate)

  /**
   * Billing exists but isn't due yet.
   */
  if (!billingDue) {
    return {
      isLocked: false,
      billingDate,
      dueAt,
      canPay,
      totalOrders,
      totalPending: totalPlatformFee,
      cartName: cart.cartName,
      address: cart.address,
    }
  }

  /**
   * ---------------------------------------------------------
   * 5. SAFETY CHECK
   * ---------------------------------------------------------
   */
  const verifiedPayment = await Payment.findOne({
    cartId,
    status: 'VERIFIED',
    billingDate,
  }).lean()

  if (verifiedPayment) {
    return {
      isLocked: false,
      billingDate,
      totalOrders,
      totalPending: 0,
      payment: verifiedPayment,
      cartName: cart.cartName,
      address: cart.address,
    }
  }

  /**
   * ---------------------------------------------------------
   * 6. PAYMENT REQUIRED
   * ---------------------------------------------------------
   */
  return {
    isLocked: true,
    message: 'Payment is required to continue using this cart.',
    billingDate,
    dueAt,
    canPay: true,
    totalOrders,
    totalPending: totalPlatformFee,
    cartName: cart.cartName,
    address: cart.address,
  }
}

module.exports = {
  BILLING_LOCK_MS,
  createBillPayment,
  getCartPaymentStatus,
  getBillingDate,
  getBillingFee,
  getFirstBillingDate,
  getISTMidnight,
  getNextISTMidnight,
}

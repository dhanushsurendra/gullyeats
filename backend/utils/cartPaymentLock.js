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
 * The bill for the billing days from [billingDate] up to [end] (exclusive;
 * by default the one day): the fee of every order first paid in them,
 * adjusted for earlier bills.
 *
 * - Credit: an order an earlier bill charged, cancelled since, gives its fee
 *   back (once: it's marked feeCredited when this bill is verified).
 * - Recharge: a credited order whose cancellation was undone is charged
 *   again (and unmarked when this bill is verified).
 *
 * Credits never take the bill below zero; any left over wait for the next.
 */
async function getBillingFee(cartId, billingDate, end = null) {
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

  const billingEnd = end ? new Date(end) : getNextISTMidnight(start)
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
 * Creates the Payment for [cart]'s bill from [fromDate] through [through]
 * (both IST midnights; one day by default) with [status] (PENDING to pay
 * through Razorpay; VERIFIED for an admin's manual payment or a bill credits
 * fully cover). The bill records which orders it charged, credited and
 * recharged. Payment.billingDate is the LAST day covered, so the next bill
 * starts the day after it.
 */
async function createBillPayment(cart, fromDate, { status, verificationSource = null, through = fromDate }) {
  const bill = await getBillingFee(cart._id, fromDate, getNextISTMidnight(through))
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
    fromDate,
    billingDate: through,
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
 * The bill the vendor would pay right now: every unpaid finished day, from
 * the oldest one through yesterday, in ONE bill. A vendor who pays late
 * after selling past midnight owes two days; paying one and getting locked
 * again for the next was confusing. While the oldest unpaid day is today,
 * it's just today (shown as upcoming, not payable yet).
 *
 * Returns null when nothing is billable, else { from, through, finished, bill }.
 */
async function getOpenBill(cartId, now = new Date()) {
  const from = await getBillingDate(cartId)
  if (!from) return null
  const today = getISTMidnight(now)
  const finished = from < today
  const through = finished ? new Date(today.getTime() - 24 * 60 * 60 * 1000) : from
  const bill = await getBillingFee(cartId, from, getNextISTMidnight(through))
  return { from, through, finished, bill }
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

  const base = { cartName: cart.cartName, address: cart.address }

  /*
   * The open bill, from the orders. A started checkout doesn't change it:
   * if the bill has grown since, checkout replaces that payment.
   *
   * A finished bill that credits bring to ₹0 is settled here (there is
   * nothing to pay), then billing moves on.
   */
  let open = await getOpenBill(cartId)
  for (let settled = 0; open && open.finished && open.bill.totalPlatformFee <= 0 && settled < 3; settled++) {
    await createBillPayment(cart, open.from, {
      status: 'VERIFIED',
      verificationSource: 'CREDIT',
      through: open.through,
    }).catch((e) => {
      // Another request settled it first.
      if (e.code !== 11000) throw e
    })
    open = await getOpenBill(cartId)
  }

  if (!open || open.bill.totalPlatformFee <= 0) {
    return {
      isLocked: false,
      billingDate: open?.from || null,
      totalOrders: open?.bill.totalOrders || 0,
      totalPending: 0,
      ...base,
    }
  }

  /*
   * The cart locks BILLING_LOCK_HOURS (26h) after the oldest unpaid day
   * began, i.e. at 2am the night after it. The bill is payable once that
   * day has ended, and then covers every finished day up to yesterday.
   */
  const now = new Date()
  const dueAt = new Date(open.from.getTime() + BILLING_LOCK_MS)
  const isLocked = now >= dueAt

  return {
    isLocked,
    ...(isLocked ? { message: 'Payment is required to continue using this cart.' } : {}),
    // The first and last days the bill covers.
    billingDate: open.from,
    throughDate: open.through,
    dueAt,
    canPay: open.finished,
    totalOrders: open.bill.totalOrders,
    totalPending: open.bill.totalPlatformFee,
    ...base,
  }
}

module.exports = {
  BILLING_LOCK_MS,
  createBillPayment,
  getCartPaymentStatus,
  getBillingDate,
  getBillingFee,
  getOpenBill,
  getFirstBillingDate,
  getISTMidnight,
  getNextISTMidnight,
}

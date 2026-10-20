const Payment = require('../models/Payment')
const Order = require('../models/Order')
const Cart = require('../models/Cart')

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
 * Calculate fees for exactly ONE billing day.
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

  const orders = await Order.find({
    cartId,

    status: {
      $ne: 'CANCELLED',
    },

    orderDate: {
      $gte: start,
      $lt: billingEnd,
    },
  }).lean()

  const totalPlatformFee = orders.reduce(
    (total, order) => total + Number(order.platformFee || 0),
    0,
  )

  return {
    totalOrders: orders.length,
    totalPlatformFee,
  }
}

/**
 * Get the billing date of the first non-cancelled order.
 */
async function getFirstBillingDate(cartId) {
  const firstOrder = await Order.findOne({
    cartId,

    status: {
      $ne: 'CANCELLED',
    },
  })
    .sort({
      orderDate: 1,
      createdAt: 1,
    })
    .lean()

  if (!firstOrder) {
    return null
  }

  const firstOrderDate = firstOrder.orderDate || firstOrder.createdAt

  if (!firstOrderDate) {
    throw new Error(
      `Order ${firstOrder._id} does not have orderDate or createdAt`,
    )
  }

  return getISTMidnight(firstOrderDate)
}

/**
 * Get the next billing date based on the NEXT ORDER,
 * not by scanning calendar days.
 *
 * Logic:
 *
 * First billing:
 *   first order → that order's IST date
 *
 * After payment:
 *   latest paid billingDate
 *          ↓
 *   find first order AFTER that billing date
 *          ↓
 *   that order's IST date = next billing date
 *
 * Example:
 *
 * Thursday order → paid Friday
 *
 * latest paid billingDate = Thursday
 *
 * Friday order exists
 *        ↓
 * next billingDate = Friday
 *
 * If Friday/Saturday/Sunday have no orders
 * and Monday has an order:
 *
 * latest paid billingDate = Thursday
 *        ↓
 * first order after Thursday = Monday
 *        ↓
 * next billingDate = Monday
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

  /**
   * Find the first order after the last
   * paid billing day.
   *
   * We deliberately query the orders collection
   * instead of incrementing dates one by one.
   */
  const nextOrder = await Order.findOne({
    cartId,

    status: {
      $ne: 'CANCELLED',
    },

    orderDate: {
      $gt: lastBillingDate,
    },
  })
    .sort({
      orderDate: 1,
      createdAt: 1,
    })
    .lean()

  /**
   * No orders after the last paid billing date.
   */
  if (!nextOrder) {
    return null
  }

  const nextOrderDate = nextOrder.orderDate || nextOrder.createdAt

  if (!nextOrderDate) {
    throw new Error(
      `Order ${nextOrder._id} does not have orderDate or createdAt`,
    )
  }

  /**
   * The next order's IST calendar day is
   * the next billing date.
   */
  return getISTMidnight(nextOrderDate)
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

  if (pendingPayment) {
    return {
      isLocked: true,
      message: 'Payment verification is pending.',
      payment: pendingPayment,
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
   */
  const billingDate = await getBillingDate(cartId)

  console.log(billingDate)

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
  const { totalOrders, totalPlatformFee } = await getBillingFee(
    cartId,
    billingDate,
  )

  /**
   * This should normally not happen because
   * getBillingDate() is derived from an order.
   *
   * But if all orders on that day have zero fee,
   * don't lock the cart.
   */
  if (totalOrders === 0 || totalPlatformFee <= 0) {
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

  console.log(billingDue)

  /**
   * Billing exists but isn't due yet.
   */
  if (!billingDue) {
    return {
      isLocked: false,
      billingDate,
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
    totalOrders,
    totalPending: totalPlatformFee,
    cartName: cart.cartName,
    address: cart.address,
  }
}

module.exports = {
  getCartPaymentStatus,
  getBillingDate,
  getBillingFee,
  getFirstBillingDate,
  getISTMidnight,
  getNextISTMidnight,
}

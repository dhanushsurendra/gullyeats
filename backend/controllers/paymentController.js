const crypto = require('crypto')
const Razorpay = require('razorpay')
const asyncHandler = require('../utils/asyncHandler')
const Payment = require('../models/Payment')
const Order = require('../models/Order')
const Cart = require('../models/Cart')
const {
  getCartPaymentStatus,
  getBillingDate,
  getBillingFee,
  getNextISTMidnight,
} = require('../utils/cartPaymentLock')

/*
 * --------------------------------------------------------------------------
 * RAZORPAY CLIENT
 * --------------------------------------------------------------------------
 * key_secret NEVER leaves this file. The Flutter app only ever receives
 * RAZORPAY_KEY_ID (that one is meant to be public — it's what identifies
 * your account to the checkout SDK).
 */
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn(
    'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set. Payment endpoints will fail.',
  )
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

const PAYMENT_MERCHANT_NAME = process.env.PAYMENT_MERCHANT_NAME || 'GullyEats'

/*
 * Get the current IST date.
 *
 * We don't actually need to change the Date object to IST.
 * We only need the correct calendar date.
 */
/*
 * Generate a unique internal payment reference.
 * Used as the Razorpay order `receipt`.
 *
 * Example:
 * GUL-8e4c8f...
 */
function generatePaymentReference() {
  return `GUL-${crypto.randomUUID()}`
}

function getAuthenticatedUserId(req) {
  return req.user?._id
}

async function getOwnedCart(cartId, userId) {
  const cart = await Cart.findOne({
    _id: cartId,
    userId,
  })

  return cart
}

/*
 * --------------------------------------------------------------------------
 * RAZORPAY HELPERS
 * --------------------------------------------------------------------------
 */

/*
 * Creates a Razorpay Order for a given rupee amount. Razorpay wants the
 * amount in the smallest currency unit (paise), so amount * 100.
 *
 * `receipt` is our own paymentReference — lets us cross-reference a
 * Razorpay order back to our Payment doc from the Razorpay dashboard too.
 */
async function createRazorpayOrder({
  amount,
  paymentReference,
  cartId,
  totalOrders,
}) {
  return razorpay.orders.create({
    amount: Math.round(Number(amount) * 100),
    currency: 'INR',
    receipt: paymentReference,
    notes: {
      cartId: String(cartId),
      totalOrders: String(totalOrders),
      paymentReference,
    },
  })
}

/*
 * Returns the checkout payload the Flutter app needs to open Razorpay
 * Checkout for an existing (already-created) order. Never re-creates the
 * order — that would desync amount and orderId.
 */
function buildCheckoutPayload(payment) {
  return {
    keyId: process.env.RAZORPAY_KEY_ID,
    razorpayOrderId: payment.razorpayOrderId,
    amount: payment.amount,
    currency: 'INR',
    name: PAYMENT_MERCHANT_NAME,
    description: `Platform fee · ${payment.totalOrders} orders`,
  }
}

const RAZORPAY_ORDER_CREATION_PREFIX = 'RP_CREATING:'
const RAZORPAY_ORDER_CREATION_LOCK_MS = 30 * 1000

function isRealRazorpayOrderId(value) {
  return typeof value === 'string' && value.startsWith('order_')
}

function createRazorpayOrderCreationLock() {
  return `${RAZORPAY_ORDER_CREATION_PREFIX}${Date.now()}:${crypto.randomUUID()}`
}

function parseRazorpayOrderCreationLock(value) {
  if (
    typeof value !== 'string' ||
    !value.startsWith(RAZORPAY_ORDER_CREATION_PREFIX)
  ) {
    return null
  }

  const timestamp = Number(
    value.slice(RAZORPAY_ORDER_CREATION_PREFIX.length).split(':')[0],
  )

  return Number.isFinite(timestamp) ? timestamp : null
}

function isRazorpayOrderCreationLockStale(value) {
  const timestamp = parseRazorpayOrderCreationLock(value)

  if (!timestamp) {
    return true
  }

  return Date.now() - timestamp >= RAZORPAY_ORDER_CREATION_LOCK_MS
}

/*
 * If the server crashes after Razorpay creates the order but before MongoDB
 * stores razorpayOrderId, the next request can recover the Razorpay order
 * using our unique receipt/paymentReference.
 */
async function findExistingRazorpayOrder(paymentReference) {
  const result = await razorpay.orders.all({
    receipt: paymentReference,
    count: 10,
  })

  const orders = Array.isArray(result?.items) ? result.items : []

  if (orders.length === 0) {
    return null
  }

  /*
   * paymentReference is generated uniquely for one internal Payment.
   * Still validate the receipt before using the result.
   */
  const matchingOrder = orders.find(
    (order) => order.receipt === paymentReference,
  )

  return matchingOrder || null
}

/*
 * Recover a payment that already has a Razorpay order, or detect whether
 * Razorpay captured a payment while the server was unavailable.
 */
async function recoverRazorpayOrder(payment) {
  const razorpayOrder = await findExistingRazorpayOrder(
    payment.paymentReference,
  )

  if (!razorpayOrder) {
    return {
      payment,
      razorpayOrder: null,
      recovered: false,
    }
  }

  const expectedAmountPaise = Math.round(Number(payment.amount) * 100)

  if (
    Number(razorpayOrder.amount) !== expectedAmountPaise ||
    razorpayOrder.currency !== 'INR'
  ) {
    throw new Error(
      `Razorpay order ${razorpayOrder.id} does not match payment ${payment._id}`,
    )
  }

  payment.razorpayOrderId = razorpayOrder.id

  /*
   * If money was already captured while our server was down, reconcile it
   * immediately instead of asking the customer to pay again.
   */
  const paymentsResponse = await razorpay.orders.fetchPayments(razorpayOrder.id)
  const capturedPayment = paymentsResponse?.items?.find(
    (item) =>
      item.status === 'captured' &&
      Number(item.amount) === expectedAmountPaise &&
      item.currency === 'INR',
  )

  if (capturedPayment) {
    payment.status = 'VERIFIED'
    payment.razorpayPaymentId = capturedPayment.id
    payment.verificationSource = 'RAZORPAY_RECOVERY'
    payment.verifiedAt = new Date()
  }

  await payment.save()

  return {
    payment,
    razorpayOrder,
    recovered: true,
  }
}

/*
 * Atomically claim Razorpay-order creation for a Payment.
 *
 * Only the request that successfully changes razorpayOrderId from null/missing
 * to the temporary lock is allowed to call Razorpay's create API.
 *
 * The lock is stored in the existing razorpayOrderId field so no additional
 * schema field is required.
 */
async function claimRazorpayOrderCreation(paymentId) {
  const lock = createRazorpayOrderCreationLock()

  /*
   * Fast path: claim a Payment that has no Razorpay order or has a null ID.
   */
  const claimedPayment = await Payment.findOneAndUpdate(
    {
      _id: paymentId,
      status: 'PENDING',
      $or: [{ razorpayOrderId: { $exists: false } }, { razorpayOrderId: null }],
    },
    {
      $set: {
        razorpayOrderId: lock,
      },
    },
    {
      new: true,
    },
  )

  if (claimedPayment) {
    return claimedPayment
  }

  /*
   * There is either a real Razorpay order or another request currently owns
   * the creation lock.
   */
  const currentPayment = await Payment.findById(paymentId)

  if (!currentPayment || currentPayment.status !== 'PENDING') {
    return null
  }

  if (isRealRazorpayOrderId(currentPayment.razorpayOrderId)) {
    return null
  }

  if (!isRazorpayOrderCreationLockStale(currentPayment.razorpayOrderId)) {
    return null
  }

  /*
   * The previous process has held the creation lock for long enough that it
   * is considered stale. Atomically replace that exact stale lock.
   */
  return Payment.findOneAndUpdate(
    {
      _id: paymentId,
      status: 'PENDING',
      razorpayOrderId: currentPayment.razorpayOrderId,
    },
    {
      $set: {
        razorpayOrderId: lock,
      },
    },
    {
      new: true,
    },
  )
}

/*
 * Ensure the internal Payment has exactly one usable Razorpay order.
 *
 * This handles:
 *   1. Existing Razorpay order -> reuse it.
 *   2. Server crash after Razorpay creation -> recover by receipt.
 *   3. Concurrent requests -> only one request creates the order.
 */
async function ensureRazorpayOrder(payment) {
  if (isRealRazorpayOrderId(payment.razorpayOrderId)) {
    return {
      payment,
      razorpayOrderId: payment.razorpayOrderId,
      paymentVerified: payment.status === 'VERIFIED',
    }
  }

  /*
   * First try recovery. This is especially important after a server crash
   * between Razorpay order creation and MongoDB save.
   */
  if (
    !payment.razorpayOrderId ||
    isRazorpayOrderCreationLockStale(payment.razorpayOrderId)
  ) {
    const recovered = await recoverRazorpayOrder(payment)

    if (recovered.recovered) {
      return {
        payment: recovered.payment,
        razorpayOrderId: recovered.payment.razorpayOrderId,
        paymentVerified: recovered.payment.status === 'VERIFIED',
      }
    }
  }

  const claimedPayment = await claimRazorpayOrderCreation(payment._id)

  if (!claimedPayment) {
    /*
     * Another request may currently be creating the order.
     * Re-check Razorpay once before telling the caller to retry.
     */
    const recovered = await recoverRazorpayOrder(payment)

    if (recovered.recovered) {
      return {
        payment: recovered.payment,
        razorpayOrderId: recovered.payment.razorpayOrderId,
        paymentVerified: recovered.payment.status === 'VERIFIED',
      }
    }

    throw new Error(
      'Razorpay order creation is already in progress. Please retry shortly.',
    )
  }

  try {
    const razorpayOrder = await createRazorpayOrder({
      amount: claimedPayment.amount,
      paymentReference: claimedPayment.paymentReference,
      cartId: claimedPayment.cartId,
      totalOrders: claimedPayment.totalOrders,
    })

    const savedPayment = await Payment.findOneAndUpdate(
      {
        _id: claimedPayment._id,
        status: 'PENDING',
        razorpayOrderId: claimedPayment.razorpayOrderId,
      },
      {
        $set: {
          razorpayOrderId: razorpayOrder.id,
        },
      },
      {
        new: true,
      },
    )

    if (!savedPayment) {
      /*
       * Another process should not normally be able to change this Payment,
       * but recover the Razorpay order if it did.
       */
      const latestPayment = await Payment.findById(claimedPayment._id)

      if (
        latestPayment &&
        isRealRazorpayOrderId(latestPayment.razorpayOrderId)
      ) {
        return {
          payment: latestPayment,
          razorpayOrderId: latestPayment.razorpayOrderId,
          paymentVerified: latestPayment.status === 'VERIFIED',
        }
      }

      throw new Error(
        `Could not save Razorpay order ${razorpayOrder.id} to payment ${claimedPayment._id}`,
      )
    }

    return {
      payment: savedPayment,
      razorpayOrderId: razorpayOrder.id,
      paymentVerified: false,
    }
  } catch (error) {
    /*
     * Do not overwrite a real Razorpay order ID. If Razorpay succeeded but
     * MongoDB/network failed afterwards, the next request can recover the
     * order using paymentReference.
     */
    try {
      const latestPayment = await Payment.findById(claimedPayment._id)

      if (latestPayment) {
        const recovered = await recoverRazorpayOrder(latestPayment)

        if (recovered.recovered) {
          return {
            payment: recovered.payment,
            razorpayOrderId: recovered.payment.razorpayOrderId,
            paymentVerified: recovered.payment.status === 'VERIFIED',
          }
        }
      }
    } catch (recoveryError) {
      console.error('Razorpay order recovery failed:', recoveryError)
    }

    throw error
  }
}

/*
 * Verifies a checkout-callback signature.
 *
 * Razorpay's documented formula:
 *   expected = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 */
function isValidCheckoutSignature({ orderId, paymentId, signature }) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  // Constant-time compare to avoid timing attacks.
  const expectedBuffer = Buffer.from(expected)
  const givenBuffer = Buffer.from(String(signature || ''))

  if (expectedBuffer.length !== givenBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(expectedBuffer, givenBuffer)
}

/*
GET PAYMENT STATUS
We check if the cart is locked
*/
exports.getPaymentStatus = asyncHandler(async (req, res) => {
  const { cartId } = req.params

  const userId = getAuthenticatedUserId(req)

  if (!userId) {
    res.status(401)
    throw new Error('Authenticated user not found')
  }

  if (!cartId) {
    res.status(400)
    throw new Error('cartId is required')
  }

  const cart = await getOwnedCart(cartId, userId)

  if (!cart) {
    res.status(404)
    throw new Error('Cart not found')
  }

  const status = await getCartPaymentStatus(cartId)

  return res.status(200).json({
    success: true,
    ...status,
  })
})

/*
 * --------------------------------------------------------------------------
 * GET PAYMENT STATUS / OVERVIEW
 * --------------------------------------------------------------------------
 *
 * This is the endpoint Flutter can call when opening the cart.
 *
 * It determines whether the cart should currently be locked using the
 * shared order-driven billing logic from cartPaymentLock.
 */
exports.getPaymentOverview = asyncHandler(async (req, res) => {
  const { cartId } = req.params
  const userId = getAuthenticatedUserId(req)

  if (!userId) {
    res.status(401)
    throw new Error('Authenticated user not found')
  }

  if (!cartId) {
    res.status(400)
    throw new Error('cartId is required')
  }

  const cart = await getOwnedCart(cartId, userId)

  if (!cart) {
    res.status(404)
    throw new Error('Cart not found')
  }

  // Existing pending payment always takes priority.
  const currentPayment = await Payment.findOne({
    cartId,
    userId,
    status: 'PENDING',
  }).sort({ createdAt: -1 })

  if (currentPayment) {
    return res.status(200).json({
      success: true,
      isLocked: true,
      currentPayment,
      checkout: isRealRazorpayOrderId(
        currentPayment.razorpayOrderId,
      )
        ? buildCheckoutPayload(currentPayment)
        : null,
    })
  }

  /**
   * Billing date is determined from:
   *
   * 1. First order, if nothing has been paid yet.
   * 2. First order AFTER the latest verified billing date.
   *
   * No day-by-day scanning.
   */
  const billingDate = await getBillingDate(cartId)

  if (!billingDate) {
    return res.status(200).json({
      success: true,
      isLocked: false,
      currentPayment: null,
      message: 'No orders yet',
    })
  }

  /**
   * Calculate the fee for this exact billing date.
   */
  const {
    totalOrders,
    totalPlatformFee,
  } = await getBillingFee(
    cartId,
    billingDate,
  )

  /**
   * No bill for this date.
   *
   * This can happen if the order data changed after
   * the billing date was calculated.
   */
  if (
    totalOrders === 0 ||
    totalPlatformFee <= 0
  ) {
    return res.status(200).json({
      success: true,
      isLocked: false,
      currentPayment: null,
      message: 'No pending platform fee',
    })
  }

  /**
   * Payment becomes due 26 hours after the
   * billing day's IST midnight.
   */
  const paymentAllowedAt = new Date(
    billingDate.getTime() +
      26 * 60 * 60 * 1000,
  )

  const now = new Date()

  if (now < paymentAllowedAt) {
    return res.status(200).json({
      success: true,
      isLocked: false,
      currentPayment: null,
      billingPeriod: {
        start: billingDate,
        end: getNextISTMidnight(billingDate),
      },
      totalOrders,
      totalPlatformFee,
      paymentAllowedAt,
    })
  }

  return res.status(200).json({
    success: true,
    isLocked: true,
    currentPayment: null,
    billingPeriod: {
      start: billingDate,
      end: getNextISTMidnight(billingDate),
    },
    totalOrders,
    totalPlatformFee,
    paymentAllowedAt,
  })
})

/*
 * --------------------------------------------------------------------------
 * CREATE RAZORPAY ORDER
 * --------------------------------------------------------------------------
 * Replaces the old createUpiPayment.
 *
 * Billing-period selection is handled by the shared order-driven helpers:
 * getBillingDate() determines which order date is being billed and
 * getBillingFee() calculates the fee for that exact billing date.
 *
 * The Payment.billingDate is the billing date, not the payment creation date.
 * Razorpay is then used to create/reuse the checkout order.
 */
exports.createRazorpayOrder = asyncHandler(async (req, res) => {
  const { cartId } = req.params
  const userId = getAuthenticatedUserId(req)

  if (!userId) {
    res.status(401)
    throw new Error('Authenticated user not found')
  }

  if (!cartId) {
    res.status(400)
    throw new Error('cartId is required')
  }

  const cart = await getOwnedCart(cartId, userId)

  if (!cart) {
    res.status(404)
    throw new Error('Cart not found')
  }

  /*
   * If another request already created a pending internal payment,
   * reuse it.
   */
  const existingPendingPayment = await Payment.findOne({
    cartId,
    userId,
    status: 'PENDING',
  }).sort({ createdAt: -1 })

  if (existingPendingPayment) {
    const ensured = await ensureRazorpayOrder(
      existingPendingPayment,
    )

    if (ensured.payment.status === 'VERIFIED') {
      return res.status(200).json({
        success: true,
        payment: ensured.payment,
        checkout: null,
        isLocked: false,
        existingPayment: true,
      })
    }

    return res.status(200).json({
      success: true,
      payment: ensured.payment,
      checkout: buildCheckoutPayload(
        ensured.payment,
      ),
      isLocked: true,
      existingPayment: true,
    })
  }

  /*
   * ---------------------------------------------------------
   * DETERMINE BILLING DATE
   * ---------------------------------------------------------
   *
   * getBillingDate() is order-driven:
   *
   * - No previous payment:
   *     first order's IST date
   *
   * - Previous payment:
   *     first order after the latest VERIFIED
   *     billing date
   *
   * No calendar-day scanning.
   */
  const billingDate = await getBillingDate(cartId)

  if (!billingDate) {
    res.status(400)
    throw new Error('There are no orders to bill')
  }

  /*
   * ---------------------------------------------------------
   * CALCULATE FEE FOR THIS EXACT BILLING DATE
   * ---------------------------------------------------------
   */
  const {
    totalOrders,
    totalPlatformFee,
  } = await getBillingFee(
    cartId,
    billingDate,
  )

  if (
    totalOrders === 0 ||
    totalPlatformFee <= 0
  ) {
    res.status(400)
    throw new Error(
      'There is no pending platform fee',
    )
  }

  /*
   * ---------------------------------------------------------
   * 26-HOUR BILLING WINDOW
   * ---------------------------------------------------------
   *
   * Example:
   *
   * Thursday 00:00 IST
   *        ↓
   * Friday 02:00 IST
   *        ↓
   * Payment becomes due
   */
  const paymentAllowedAt = new Date(
    billingDate.getTime() +
      26 * 60 * 60 * 1000,
  )

  if (new Date() < paymentAllowedAt) {
    res.status(400)
    throw new Error('Payment is not due yet')
  }

  const amount = Number(totalPlatformFee)
  const paymentReference =
    generatePaymentReference()

  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400)
    throw new Error(
      'Invalid platform fee amount',
    )
  }

  let payment

  try {
    /*
     * billingDate is the exact calendar day being billed.
     *
     * IMPORTANT:
     * If Thursday's bill is paid on Friday,
     * billingDate remains Thursday.
     */
    payment = await Payment.create({
      cartId: cart._id,
      userId: cart.userId,
      cartName: cart.cartName,
      totalOrders,
      amount,
      status: 'PENDING',
      paymentReference,
      billingDate,
    })
  } catch (error) {
    /*
     * Concurrent requests can calculate the same
     * billing day. The unique partial PENDING index
     * allows only one pending payment.
     */
    if (error.code === 11000) {
      const existingPayment =
        await Payment.findOne({
          cartId,
          userId,
          status: 'PENDING',
        }).sort({ createdAt: -1 })

      if (existingPayment) {
        const ensured =
          await ensureRazorpayOrder(
            existingPayment,
          )

        if (
          ensured.payment.status ===
          'VERIFIED'
        ) {
          return res.status(200).json({
            success: true,
            payment: ensured.payment,
            checkout: null,
            isLocked: false,
            existingPayment: true,
          })
        }

        return res.status(200).json({
          success: true,
          payment: ensured.payment,
          checkout:
            buildCheckoutPayload(
              ensured.payment,
            ),
          isLocked: true,
          existingPayment: true,
        })
      }
    }

    throw error
  }

  /*
   * Create/recover the Razorpay order.
   */
  const ensured =
    await ensureRazorpayOrder(payment)

  /*
   * It is possible that recovery discovers that
   * Razorpay already captured the payment.
   */
  if (
    ensured.payment.status ===
    'VERIFIED'
  ) {
    return res.status(200).json({
      success: true,
      payment: ensured.payment,
      checkout: null,
      isLocked: false,
      existingPayment: false,
    })
  }

  return res.status(201).json({
    success: true,
    payment: ensured.payment,
    checkout:
      buildCheckoutPayload(
        ensured.payment,
      ),
    isLocked: true,
    existingPayment: false,
  })
})

/*
 * --------------------------------------------------------------------------
 * VERIFY PAYMENT (checkout callback)
 * --------------------------------------------------------------------------
 * Called by the Flutter app immediately after Razorpay Checkout reports
 * EVENT_PAYMENT_SUCCESS. This is a convenience path for instant UI
 * feedback — it is NOT the only source of truth. The webhook handler below
 * verifies independently and will mark the payment VERIFIED even if the
 * app never calls this endpoint (e.g. user backgrounds/kills the app right
 * after paying).
 *
 * Idempotent: calling this twice, or racing with the webhook, is safe.
 */
exports.verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.params
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
    req.body

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    res.status(400)
    throw new Error(
      'razorpay_payment_id, razorpay_order_id and razorpay_signature are required',
    )
  }

  const userId = getAuthenticatedUserId(req)

  if (!userId) {
    res.status(401)
    throw new Error('Authenticated user not found')
  }

  const payment = await Payment.findOne({
    _id: paymentId,
    userId,
  })

  if (!payment) {
    res.status(404)
    throw new Error('Payment not found')
  }

  if (payment.status === 'VERIFIED') {
    return res.status(200).json({
      success: true,
      message: 'Payment already verified',
      payment,
    })
  }

  if (payment.status !== 'PENDING') {
    res.status(400)
    throw new Error(
      `Payment cannot be verified because its status is ${payment.status}`,
    )
  }

  if (payment.razorpayOrderId !== razorpay_order_id) {
    res.status(400)
    throw new Error('Order id does not match this payment')
  }

  const validSignature = isValidCheckoutSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  })

  if (!validSignature) {
    /*
     * Do NOT mark verified. Leave status as PENDING — the webhook is
     * still free to verify this independently if Razorpay's own records
     * show the payment actually succeeded. A bad/forged signature here
     * most likely means client tampering, not a real payment.
     */
    res.status(400)
    throw new Error('Payment signature verification failed')
  }

  /*
   * The checkout signature proves the callback belongs to this Razorpay
   * order/payment pair. Fetch the payment from Razorpay as an additional
   * server-side validation before marking our internal Payment VERIFIED.
   */
  const razorpayPayment = await razorpay.payments.fetch(
    razorpay_payment_id,
  )

  const expectedAmountPaise = Math.round(
    Number(payment.amount) * 100,
  )

  if (
    razorpayPayment.order_id !== payment.razorpayOrderId ||
    razorpayPayment.status !== 'captured' ||
    Number(razorpayPayment.amount) !== expectedAmountPaise ||
    razorpayPayment.currency !== 'INR'
  ) {
    res.status(400)
    throw new Error('Razorpay payment validation failed')
  }

  payment.status = 'VERIFIED'
  payment.razorpayPaymentId = razorpay_payment_id
  payment.razorpaySignature = razorpay_signature
  payment.verificationSource = 'CHECKOUT_CALLBACK'
  payment.verifiedAt = new Date()

  await payment.save()

  return res.status(200).json({
    success: true,
    message: 'Payment verified successfully',
    payment,
  })
})

/*
 * --------------------------------------------------------------------------
 * RAZORPAY WEBHOOK  —  server-to-server source of truth
 * --------------------------------------------------------------------------
 * Configure this URL in the Razorpay Dashboard → Settings → Webhooks,
 * subscribed to at least `payment.captured`. Mounted with express.raw()
 * (see routes file) because the signature is computed over the exact raw
 * request body — parsing it to JSON first and re-stringifying would break
 * verification.
 */
exports.razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature']

  if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) {
    res.status(400)
    throw new Error('Missing webhook signature or secret not configured')
  }

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(req.body) // raw Buffer, see express.raw() in routes
    .digest('hex')

  const expectedBuffer = Buffer.from(expected)
  const givenBuffer = Buffer.from(String(signature))

  if (
    expectedBuffer.length !== givenBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, givenBuffer)
  ) {
    res.status(400)
    throw new Error('Invalid webhook signature')
  }

  let event

  try {
    event = JSON.parse(req.body.toString('utf8'))
  } catch (error) {
    res.status(400)
    throw new Error('Invalid webhook payload')
  }

  if (event.event === 'payment.captured') {
    const paymentEntity = event.payload?.payment?.entity

    if (paymentEntity?.order_id) {
      const payment = await Payment.findOne({
        razorpayOrderId: paymentEntity.order_id,
      })

      /*
       * Idempotent — if the checkout callback already verified this
       * payment, there's nothing left to do.
       */
      if (payment && payment.status === 'PENDING') {
        const expectedAmountPaise = Math.round(
          Number(payment.amount) * 100,
        )

        const isValidCapturedPayment =
          paymentEntity.status === 'captured' &&
          Number(paymentEntity.amount) === expectedAmountPaise &&
          paymentEntity.currency === 'INR' &&
          paymentEntity.order_id === payment.razorpayOrderId

        if (isValidCapturedPayment) {
          payment.status = 'VERIFIED'
          payment.razorpayPaymentId = paymentEntity.id
          payment.verificationSource = 'WEBHOOK'
          payment.verifiedAt = new Date()
          await payment.save()
        } else {
          console.error(
            `Ignoring invalid Razorpay webhook payment ${paymentEntity.id} ` +
              `for internal payment ${payment._id}`,
          )
        }
      }
    }
  }

  /*
   * payment.failed events are informational only — we never auto-reject.
   * The pending payment (and its Razorpay order) stays open so the user
   * can simply retry the same order from the lock screen.
   */

  return res.status(200).json({ status: 'ok' })
})

/*
 * --------------------------------------------------------------------------
 * REJECT PAYMENT  —  admin/manual fallback, UNCHANGED
 * --------------------------------------------------------------------------
 */
exports.rejectPayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.params

  const userId = getAuthenticatedUserId(req)

  if (!userId) {
    res.status(401)
    throw new Error('Authenticated user not found')
  }

  /*
   * This endpoint is a manual fallback. Do not allow an arbitrary
   * authenticated user to reject another user's payment.
   *
   * If you have a separate admin-role middleware, keep that middleware too.
   */
  const payment = await Payment.findOne({
    _id: paymentId,
    userId,
  })

  if (!payment) {
    res.status(404)
    throw new Error('Payment not found')
  }

  if (payment.status !== 'PENDING') {
    res.status(400)
    throw new Error('Only pending payments can be rejected')
  }

  payment.status = 'REJECTED'

  await payment.save()

  return res.status(200).json({
    success: true,
    message: 'Payment rejected',
    payment,
  })
})

/*
 * --------------------------------------------------------------------------
 * PAYMENT HISTORY  —  UNCHANGED
 * --------------------------------------------------------------------------
 */
exports.getPaymentHistory = asyncHandler(async (req, res) => {
  const { cartId } = req.params
  const { startDate, endDate } = req.query

  console.log(startDate, endDate)

  const userId = getAuthenticatedUserId(req)

  if (!userId) {
    res.status(401)
    throw new Error('Authenticated user not found')
  }

  const cart = await getOwnedCart(cartId, userId)

  if (!cart) {
    res.status(404)
    throw new Error('Cart not found')
  }

  const filter = {
    cartId,
  }

  /*
   * Filter payment history by the payment's
   * creation date.
   */
  if (startDate || endDate) {
    filter.createdAt = {}

    if (startDate) {
      filter.createdAt.$gte = new Date(`${startDate}T00:00:00.000+05:30`)
    }

    if (endDate) {
      const end = new Date(`${endDate}T00:00:00.000+05:30`)

      end.setUTCDate(end.getUTCDate() + 1)

      filter.createdAt.$lt = end
    }
  }

  const payments = await Payment.find(filter)
    .sort({
      createdAt: -1,
    })
    .lean()

  return res.status(200).json({
    success: true,
    count: payments.length,
    payments,
    history: payments,
  })
})

/*
 * --------------------------------------------------------------------------
 * GET SINGLE PAYMENT  —  UNCHANGED
 * --------------------------------------------------------------------------
 */
exports.getPayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.params

  const userId = getAuthenticatedUserId(req)

  if (!userId) {
    res.status(401)
    throw new Error('Authenticated user not found')
  }

  const payment = await Payment.findOne({
    _id: paymentId,
    userId,
  })

  if (!payment) {
    res.status(404)
    throw new Error('Payment not found')
  }

  return res.status(200).json({
    success: true,
    payment,
  })
})

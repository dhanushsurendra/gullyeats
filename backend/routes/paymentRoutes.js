const express = require('express')
const router = express.Router()

const {
  getPaymentOverview,
  getPaymentStatus,
  createRazorpayOrder,
  verifyRazorpayPayment,
  rejectPayment,
  getPaymentHistory,
  getPayment,
} = require('../controllers/paymentController')

// Swap in your real auth middleware here.
const authMiddleware = require('../middlewares/auth')
const cartPaymentLockMiddleware = require('../middlewares/cartPaymentLock')

/*
 * NOTE: the Razorpay webhook route is NOT defined here. It's mounted
 * directly on `app` in app.js, BEFORE the global express.json() call,
 * using express.raw(). That's required so razorpayWebhook sees the exact
 * raw bytes Razorpay sent (needed for signature verification) instead of
 * an already-parsed/re-serialized body. See app.js.
 */

router.get(
  '/payments-overview/:cartId',
  authMiddleware,
  getPaymentOverview,
)

router.get(
  '/payment-status/:cartId',
  authMiddleware,
  getPaymentStatus,
)

router.get(
  '/payment-history/:cartId',
  authMiddleware,
  getPaymentHistory,
)

router.post(
  '/create-razorpay-order/:cartId',
  authMiddleware,
  createRazorpayOrder,
)

router.post(
  '/verify/:paymentId',
  authMiddleware,
  verifyRazorpayPayment,
)

router.post(
  '/:paymentId/reject',
  authMiddleware,
  rejectPayment,
)
router.get('/:paymentId', authMiddleware, getPayment)

module.exports = router

const express = require('express')
const { rateLimit } = require('express-rate-limit')
const router = express.Router()
const auth = require('../middlewares/auth')
const {
  sendOtp,
  verifyOtp,
  vendorLogin,
  changePin,
  resetPin,
} = require('../controllers/vendorController')

// PINs are 4 digits and OTPs 6, so guesses are limited per account (not per
// IP, so many devices can't share one budget). An attacker can lock an
// account for 15 minutes at worst.
const limitBy = (limit, key, skipSuccessfulRequests = true) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    keyGenerator: (req) => String(key(req) || 'none'),
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
    message: {
      success: false,
      message: 'Too many attempts. Please try again in 15 minutes.',
    },
  })

const phoneKey = (req) => String(req.body?.phoneNumber || '').replace(/\D/g, '')

router.post('/send-otp', limitBy(10, phoneKey, false), sendOtp)

router.post('/verify-otp', limitBy(5, phoneKey), verifyOtp)

router.post(
  '/login',
  limitBy(10, (req) => String(req.body?.vendorIdentifier || '').trim()),
  vendorLogin,
)

router.post(
  '/change-pin',
  auth,
  limitBy(5, (req) => req.user._id),
  changePin,
)

// Issues a new PIN for the logged-in user (see resetPin).
router.post('/reset-pin', auth, resetPin)

module.exports = router

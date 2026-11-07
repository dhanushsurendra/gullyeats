const express = require('express')
const { rateLimit } = require('express-rate-limit')
const router = express.Router()

// Failed admin logins per email, like vendor PIN logins.
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => String(req.body?.email || '').trim().toLowerCase() || 'none',
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
})
const c = require('../controllers/adminController')
const auth = require('../middlewares/auth')

const adminOnly = [
  auth,
  (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admins only' })
    }
    next()
  },
]

router.get('/overview', adminOnly, c.overview)
router.get('/series', adminOnly, c.series)
router.get('/owners', adminOnly, c.owners)
router.get('/carts', adminOnly, c.carts)
router.get('/orders', adminOnly, c.orders)
router.get('/payments', adminOnly, c.payments)
router.post('/carts/:cartId/mark-fee-paid', adminOnly, c.markFeePaid)
router.post('/vendors/:vendorId/reset-pin', adminOnly, c.resetVendorPin)
router.get('/feedback', adminOnly, c.feedback)
router.get('/activity', adminOnly, c.activity)
router.post('/login', loginLimit, c.login)
router.post('/logout', c.logout)

module.exports = router

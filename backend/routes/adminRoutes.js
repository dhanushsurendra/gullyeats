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
const insights = require('../controllers/insightsController')
const moderation = require('../controllers/moderationController')
const dishes = require('../controllers/dishController')
const notifications = require('../controllers/notificationController')
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
router.post('/carts/:cartId/suspend', adminOnly, c.suspendCart)
router.post('/carts/:cartId/resume', adminOnly, c.resumeCart)
router.post('/carts/:cartId/reminder', adminOnly, c.logReminder)
router.post('/owners/:ownerId/disable', adminOnly, c.disableVendor)
router.post('/owners/:ownerId/enable', adminOnly, c.enableVendor)
router.get('/actions', adminOnly, c.actions)
router.get('/feedback', adminOnly, c.feedback)
router.get('/activity', adminOnly, c.activity)
router.get('/insights/collections', adminOnly, insights.collections)
router.get('/insights/leakage', adminOnly, insights.leakage)
router.get('/insights/vendors', adminOnly, insights.vendors)
router.get('/insights/growth', adminOnly, insights.growth)
router.get('/insights/operations', adminOnly, insights.operations)
router.get('/insights/play', adminOnly, insights.play)
router.get('/insights/pulse', adminOnly, insights.pulse)
// New dish names from vendors, reviewed into the common list (Dishes page).
router.get('/dishes', adminOnly, dishes.list)
router.get('/dishes/:id/images', adminOnly, dishes.images)
router.post('/dishes/:id/approve', adminOnly, dishes.approve)
router.post('/dishes/:id/merge', adminOnly, dishes.merge)
router.post('/dishes/:id/reject', adminOnly, dishes.reject)
router.get('/moderation/counts', adminOnly, moderation.counts)
router.get('/moderation/queue', adminOnly, moderation.queue)
router.get('/moderation/:kind/:id', adminOnly, moderation.item)
router.post('/moderation/:kind/:id/suspend', adminOnly, moderation.suspend)
router.post('/moderation/:kind/:id/:action', adminOnly, moderation.act)
router.get('/refunds', adminOnly, c.refunds)
router.post('/refunds/:orderId/resolve', adminOnly, c.resolveRefundFlag)
// Things that need an admin's attention, also pushed live (Notifications page).
router.get('/notifications', adminOnly, notifications.list)
router.post('/notifications/read', adminOnly, notifications.markRead)
router.get('/notifications/socket-token', adminOnly, notifications.socketToken)
router.get('/todo', adminOnly, notifications.todo)
router.get('/settings', adminOnly, c.getSettings)
router.post('/settings', adminOnly, c.updateSettings)
router.post('/login', loginLimit, c.login)
router.post('/logout', c.logout)

module.exports = router

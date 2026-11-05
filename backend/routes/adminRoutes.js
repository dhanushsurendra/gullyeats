const express = require('express')
const router = express.Router()
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
router.get('/feedback', adminOnly, c.feedback)
router.get('/activity', adminOnly, c.activity)
router.post('/login', c.login)
router.post('/logout', c.logout)

module.exports = router

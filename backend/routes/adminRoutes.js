const express = require('express')
const router = express.Router()
const c = require('../controllers/adminController')

router.get('/overview', c.overview)
router.get('/series', c.series)
router.get('/owners', c.owners)
router.get('/carts', c.carts)
router.get('/orders', c.orders)
router.get('/payments', c.payments)
router.get('/feedback', c.feedback)
router.get('/activity', c.activity)
router.post('/login', c.login)
router.post('/logout', c.logout)

module.exports = router

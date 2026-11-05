const express = require('express')
const router = express.Router()
const auth = require('../middlewares/auth')
const {
  sendOtp,
  verifyOtp,
  vendorLogin,
  changePin,
  resetPin,
} = require('../controllers/vendorController')

router.post('/send-otp', sendOtp)

router.post('/verify-otp', verifyOtp)

router.post('/login', vendorLogin)

router.post('/change-pin', changePin)

// Issues a new PIN for the logged-in user (see resetPin).
router.post('/reset-pin', auth, resetPin)

module.exports = router

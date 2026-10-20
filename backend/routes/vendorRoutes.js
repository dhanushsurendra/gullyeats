const express = require('express')
const router = express.Router()
const { sendOtp, verifyOtp, vendorLogin, changePin } = require('../controllers/vendorController')

router.post('/send-otp', sendOtp)

router.post('/verify-otp', verifyOtp)

router.post('/login', vendorLogin)

router.post('/change-pin', changePin)

module.exports = router

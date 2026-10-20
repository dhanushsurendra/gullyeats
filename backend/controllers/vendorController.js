const User = require('../models/User')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const asyncHandler = require('../utils/asyncHandler')
const { validatePhone, validateRole } = require('../utils/validators')
const generatePin = require('../utils/generatePin')

exports.sendOtp = asyncHandler(async (req, res) => {
  let { phoneNumber, role } = req.body

  if (!phoneNumber || !role) {
    res.status(400)
    throw new Error('Phone number and role are required')
  }

  phoneNumber = validatePhone(phoneNumber)
  validateRole(role)

  let user = await User.findOne({ phoneNumber })

  if (!user) {
    user = await User.create({ phoneNumber, role })
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const hash = await bcrypt.hash(otp, 10)

  user.otpHash = hash
  user.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await user.save()

  res.json({
    success: true,
    message: 'OTP sent',
    otp,
  })
})

exports.verifyOtp = asyncHandler(async (req, res) => {
  let { phoneNumber, otp } = req.body

  if (!phoneNumber || !otp) {
    res.status(400)
    throw new Error('phoneNumber and otp are required')
  }

  phoneNumber = validatePhone(phoneNumber)

  if (!/^\d{6}$/.test(otp)) {
    res.status(400)
    throw new Error('Invalid OTP format')
  }

  const user = await User.findOne({ phoneNumber })

  if (!user) {
    res.status(404)
    throw new Error('User not found')
  }

  if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    res.status(400)
    throw new Error('OTP expired')
  }

  const isMatch = await bcrypt.compare(otp, user.otpHash || '')

  if (!isMatch) {
    res.status(400)
    throw new Error('Invalid OTP')
  }

  user.isVerified = true
  user.otpHash = undefined
  user.otpExpiresAt = undefined

  let plainPin
  if (!user.pinHash) {
    plainPin = generatePin()
    const pinHash = await bcrypt.hash(plainPin, 10)
    user.pinHash = pinHash
  }

  await user.save()

  const userResponse = user.toObject()
  delete userResponse.otpHash
  delete userResponse.otpExpiresAt
  delete userResponse.pinHash
  delete userResponse.__v

  const token = jwt.sign(
    { _id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  )

  res.json({
    success: true,
    token,
    pin: plainPin,
    user: userResponse,
  })
})

exports.vendorLogin = asyncHandler(async (req, res) => {
  const { vendorIdentifier, pin } = req.body

  console.log(vendorIdentifier, pin)

  if (!vendorIdentifier || !pin) {
    return res.status(400).json({
      success: false,
      message: 'Please provide Vendor ID/Phone and PIN',
    })
  }

  const user = await User.findOne({
    $or: [{ phoneNumber: vendorIdentifier }, { userId: vendorIdentifier }],
  }).select('+pinHash')

  if (!user) {
    return res
      .status(401)
      .json({ success: false, message: 'Invalid credentials' })
  }

  const isMatch = await bcrypt.compare(pin, user.pinHash)

  if (!isMatch) {
    return res
      .status(401)
      .json({ success: false, message: 'Invalid credentials' })
  }

  const token = jwt.sign(
    { _id: user._id, role: user.role },
    process.env.JWT_SECRET,
  )

  res.status(200).json({
    success: true,
    token,
    user: {
      id: user._id,
      userId: user.userId,
      name: user.name,
      phoneNumber: user.phoneNumber,
    },
  })
})

exports.changePin = asyncHandler(async (req, res) => {
  const { currentPin, newPin, id } = req.body

  if (!currentPin || !newPin) {
    return res
      .status(400)
      .json({ success: false, message: 'All fields are required' })
  }

  if (newPin.length !== 4) {
    return res
      .status(400)
      .json({ success: false, message: 'PIN must be exactly 4 digits' })
  }

  const user = await User.findById(id).select('+pinHash')

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' })
  }

  const isMatch = await bcrypt.compare(currentPin, user.pinHash)
  if (!isMatch) {
    return res
      .status(401)
      .json({ success: false, message: 'Incorrect current PIN' })
  }

  const salt = await bcrypt.genSalt(10)
  user.pinHash = await bcrypt.hash(newPin, salt)

  await user.save()

  res.status(200).json({
    success: true,
    message: 'PIN updated successfully',
  })
})

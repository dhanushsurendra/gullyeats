const User = require('../models/User')
const Cart = require('../models/Cart')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const asyncHandler = require('../utils/asyncHandler')
const { validatePhone, validateRole } = require('../utils/validators')
const generatePin = require('../utils/generatePin')

// The OTP comes back in the send-otp response, so it only works while a
// vendor is being onboarded. Once one of their outlets is finished (QR poster
// made) they have been sent a PIN, and staff log in with that instead.
async function refuseIfOnboarded(res, user) {
  const finished = await Cart.exists({
    userId: user._id,
    qrImageUrl: { $nin: [null, ''] },
  })
  if (finished) {
    res.status(409)
    throw new Error(
      'This vendor is already onboarded. Log in with their Vendor ID or phone number and PIN.',
    )
  }
}

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

  // The OTP comes back in this response (see onboarding-app notes), so it
  // must never log anyone into a staff or admin account.
  if (user.role !== 'vendor') {
    res.status(403)
    throw new Error('This number belongs to a staff or admin account')
  }

  await refuseIfOnboarded(res, user)

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

  if (!user || user.role !== 'vendor') {
    res.status(404)
    throw new Error('User not found')
  }

  await refuseIfOnboarded(res, user)

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

  const isMatch =
    Boolean(user.pinHash) && (await bcrypt.compare(String(pin), user.pinHash))

  if (!isMatch) {
    return res
      .status(401)
      .json({ success: false, message: 'Invalid credentials' })
  }

  const token = jwt.sign(
    { _id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' },
  )

  res.status(200).json({
    success: true,
    token,
    user: {
      id: user._id,
      userId: user.userId,
      role: user.role,
      name: user.name,
      phoneNumber: user.phoneNumber,
    },
  })
})

exports.changePin = asyncHandler(async (req, res) => {
  const { currentPin, newPin } = req.body

  if (!currentPin || !newPin) {
    return res
      .status(400)
      .json({ success: false, message: 'All fields are required' })
  }

  if (!/^\d{4}$/.test(String(newPin))) {
    return res
      .status(400)
      .json({ success: false, message: 'PIN must be exactly 4 digits' })
  }

  const user = await User.findById(req.user._id).select('+pinHash')

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' })
  }

  const isMatch =
    Boolean(user.pinHash) &&
    (await bcrypt.compare(String(currentPin), user.pinHash))
  // 400, not 401: the app treats 401 as "session expired" and logs out.
  if (!isMatch) {
    return res
      .status(400)
      .json({ success: false, message: 'Incorrect current PIN' })
  }

  const salt = await bcrypt.genSalt(10)
  user.pinHash = await bcrypt.hash(String(newPin), salt)

  await user.save()

  res.status(200).json({
    success: true,
    message: 'PIN updated successfully',
  })
})

// Only the PIN's hash is stored, so onboarding staff can't re-send an
// existing PIN. "Send Credentials" issues a new one instead: the old PIN
// stops working and the new one is returned once, to be texted to the vendor.
exports.resetPin = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)

  if (!user) {
    res.status(404)
    throw new Error('User not found')
  }

  const pin = generatePin()
  user.pinHash = await bcrypt.hash(pin, 10)
  await user.save()

  res.json({ success: true, userId: user.userId, pin })
})

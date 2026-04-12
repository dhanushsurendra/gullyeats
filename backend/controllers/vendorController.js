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

  await user.save();

  const userResponse = user.toObject();
  delete userResponse.otpHash;
  delete userResponse.otpExpiresAt;
  delete userResponse.pinHash; 
  delete userResponse.__v;     

  const token = jwt.sign(
    { _id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );

  res.json({
    success: true,
    token,
    pin: plainPin,
    user: userResponse
  });
})

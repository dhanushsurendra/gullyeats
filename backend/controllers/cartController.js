const Cart = require('../models/Cart')
const MenuItem = require('../models/Menu')
const User = require('../models/User')
const QRCode = require('qrcode')
const asyncHandler = require('../utils/asyncHandler')
const bcrypt = require('bcrypt')
const generateUserId = require('../utils/generateUserId')
const { PutObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { s3Client } = require('../utils/s3Client')
const generatePin = require('../utils/generatePin')

exports.createBasicCart = asyncHandler(async (req, res) => {
  let { cartName, cartCity } = req.body

  if (!cartName || !cartCity) {
    res.status(400)
    throw new Error('Cart name and cart city are required')
  }

  cartName = cartName.trim()
  cartCity = cartCity.trim()

  if (cartName.length < 2) {
    res.status(400)
    throw new Error('Cart name too short')
  }

  if (cartCity.length < 2) {
    res.status(400)
    throw new Error('Cart city too short')
  }

  const { _id } = req.user
  const cartId = generateUserId('cart')

  const cart = await Cart.create({
    cartName,
    cartCity,
    cartId,
    userId: _id,
  })

  res.status(201).json({
    success: true,
    cart,
  })
})

exports.updateCartLocation = asyncHandler(async (req, res) => {
  const { cartId } = req.params
  let { address, lat, lng } = req.body

  if (!address || lat === undefined || lng === undefined) {
    res.status(400)
    throw new Error('Address, lat and lng are required')
  }

  address = address.trim()
  lat = Number(lat)
  lng = Number(lng)

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400)
    throw new Error('Invalid coordinates')
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400)
    throw new Error('Coordinates out of range')
  }

  const userId = req.user._id

  const cart = await Cart.findById(cartId)

  if (!cart) {
    res.status(404)
    throw new Error('Cart not found')
  }

  if (cart.userId.toString() !== userId.toString()) {
    res.status(403)
    throw new Error('You are not allowed to update this cart')
  }

  cart.address = address
  cart.location = {
    type: 'Point',
    coordinates: [lat, lng],
  }
  await cart.save()

  res.json({
    success: true,
    data: cart,
  })
})

exports.createMenuItems = asyncHandler(async (req, res) => {
  const cartId = req.params.cartId
  const { items } = req.body
  console.log(cartId);

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400)
    throw new Error('Menu items should not be empty')
  }

  if (!cartId) {
    res.status(400)
    throw new Error('cartId is required')
  }

  const { _id } = req.user

  const cart = await Cart.findById(cartId)

  if (!cart) {
    res.status(404)
    throw new Error('Cart not found')
  }

  if (cart.userId.toString() !== _id.toString()) {
    res.status(403)
    throw new Error('Not allowed to modify this cart')
  }

  const processedItems = items.map((item) => {
    console.log(item)
    if (!item.name || item.price === undefined || !item.isVeg) {
      throw new Error('Each item must have name, price and isVeg')
    }

    const name = item.name.trim()
    const price = Number(item.price)
    const isVeg = item.isVeg

    if (name.length < 2) {
      throw new Error(`Invalid item name: ${name}`)
    }

    if (isNaN(price) || price < 0) {
      throw new Error(`Invalid price for item: ${name}`)
    }

    return {
      name,
      price,
      isVeg,
      cartId,
    }
  })

  const createdItems = await MenuItem.insertMany(processedItems)

  res.status(201).json({
    success: true,
    count: createdItems.length,
    data: createdItems,
  })
})

exports.generateAndUploadQR = asyncHandler(async (req, res) => {
  const { cartId } = req.params
  const cart = await Cart.findById(cartId)

  if (!cart) {
    res.status(404)
    throw new Error('Cart not found')
  }

  const url = `https://xhamster.com/`
  const qrBinary = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    quality: 0.95,
    margin: 2,
    scale: 10,
    width: 1024,
    color: {
      light: '#FFFFFF',
    },
  })
  const bucketName = process.env.BUCKET_NAME
  const s3Key = `qrs/${cartId}.png`

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: qrBinary,
      ContentType: 'image/png',
    })

    await s3Client.send(command)

    const qrImageUrl = `https://${bucketName}.s3.amazonaws.com/${s3Key}`
    cart.qrImageUrl = qrImageUrl
    console.log('QR Code uploaded to S3 at:', qrImageUrl)
    await cart.save()

    res.json({ success: true, qrImageUrl })
  } catch (s3Error) {
    console.error('S3 Upload Error:', s3Error)

    res.status(502).json({
      success: false,
      message:
        'QR Code generated but could not be saved to storage. Please try again.',
      error: s3Error.message,
    })
  }
})

exports.addStaff = asyncHandler(async (req, res) => {
  const cartId = req.params.cartId
  let { name, phoneNumber } = req.body

  if (!name || !phoneNumber || !cartId) {
    res.status(400)
    throw new Error('name, phoneNumber, cartId are required')
  }

  name = name.trim()
  phoneNumber = phoneNumber.replace(/\D/g, '')

  if (name.length < 2) {
    res.status(400)
    throw new Error('Invalid name')
  }

  const cart = await Cart.findById(cartId)

  if (!cart) {
    res.status(404)
    throw new Error('Cart not found')
  }

  let user = await User.findOne({ phoneNumber })

  if (user) {
    res.status(401)
    throw new Error('User with this phone number already exists')
  }

  const pin = generatePin()
  const userId = generateUserId('staff')
  const pinHash = await bcrypt.hash(pin, 10)
  const role = 'staff'

  const staff = await User.create({
    userId,
    phoneNumber,
    name,
    role,
    cartId,
    pinHash,
    vendorId: cart.userId,
  })

  res.status(201).json({
    success: true,
    data: {
      id: staff._id,
      userId: staff.userId,
      name: staff.name,
      phoneNumber: staff.phoneNumber,
      role: staff.role,
      cartId: staff.cartId,
      pinHash: pin,
    },
  })
})

exports.getPresignedUploadUrl = asyncHandler(async (req, res) => {
  const { fileType } = req.body
  const cartId = req.params.cartId
  const bucketName = process.env.BUCKET_NAME

  const extension = fileType.split('/')[1] || 'jpg'

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: `uploads/${cartId}.${extension}`,
    ContentType: fileType,
  })

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 })

  const s3Key = `uploads/${cartId}.${fileType.split('/')[1]}`
  const fileUrl = `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${s3Key}`

  res.status(200).json({
    success: true,
    uploadUrl,
    fileUrl,
  })
})

exports.updateCartImage = asyncHandler(async (req, res) => {
  const { cartId } = req.params
  const { imageUrl } = req.body

  const updatedCart = await Cart.findByIdAndUpdate(
    cartId,
    { cartImageUrl: imageUrl },
    { new: true },
  )

  res.status(200).json({
    success: true,
    data: updatedCart,
  })
})

exports.getAllCarts = asyncHandler(async (req, res) => {
  const userId = req.user._id

  if (!userId) {
    res.status(400)
    throw new Error('User Id is required')
  }

  const user = await User.findOne({ _id: userId })

  if (!user) {
    res.status(404)
    throw new Error('User not found')
  }

  const carts = await Cart.find({ userId: user._id })

  res.status(200).json({
    success: true,
    count: carts.length,
    carts: carts,
  })
})

exports.getAllStaff = asyncHandler(async (req, res) => {
  const cartId = req.params.cartId

  const cart = await Cart.findById(cartId)

  if (!cart) {
    res.status(404)
    throw new Error('Cart not found')
  }

  const staff = await User.find({
    role: 'staff',
    cartId: cart._id,
  }).select('-pinHash -otpHash -otpExpiresAt')

  const formattedStaff = staff.map((s) => ({
    id: s._id,
    userId: s.userId,
    name: s.name,
    phoneNumber: s.phoneNumber,
    role: s.role,
    isVerified: s.isVerified,
  }))

  res.status(200).json({
    success: true,
    staff: formattedStaff,
  })
})

exports.deleteStaff = asyncHandler(async (req, res) => {
  const staffId = req.params.staffId

  const staff = await User.findById({ _id: staffId })

  console.log(staff)

  if (!staff) {
    res.status(404)
    throw new Error('Staff member not found')
  }

  await staff.deleteOne()

  res.status(200).json({
    success: true,
    message: 'Staff member deleted successfully',
    data: {
      userId: staff.userId,
      name: staff.name,
    },
  })
})

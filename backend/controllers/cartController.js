const Cart = require('../models/Cart')
const MenuItem = require('../models/Menu')
const User = require('../models/User')
const QRCode = require('qrcode')
const asyncHandler = require('../utils/asyncHandler')
const bcrypt = require('bcrypt')
const generateUserId = require('../utils/generateUserId')
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { s3Client } = require('../utils/s3Client')
const generatePin = require('../utils/generatePin')
const Menu = require('../models/Menu')

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

exports.updateCart = asyncHandler(async (req, res) => {
  const { cartId } = req.params;

  const {
    cartName,
    cartCity,
    address,
    cartImageUrl,
    location,
    isActive,
    isOpen,
  } = req.body;

  const cart = await Cart.findById(cartId);

  if (!cart) {
    return res.status(404).json({
      success: false,
      message: 'Cart not found',
    });
  }

  if (cartName !== undefined) {
    cart.cartName = cartName;
  }

  if (cartCity !== undefined) {
    cart.cartCity = cartCity;
  }

  if (address !== undefined) {
    cart.address = address;
  }

  if (cartImageUrl !== undefined) {
    cart.cartImageUrl = cartImageUrl;
  }

  if (location !== undefined) {
    cart.location = location;
  }

  if (isActive !== undefined) {
    cart.isActive = isActive;
  }

  if (isOpen !== undefined) {
    cart.isOpen = isOpen;
  }

  const updatedCart = await cart.save();

  res.status(200).json({
    success: true,
    message: 'Cart updated successfully',
    cart: updatedCart,
  });
});

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
    if (!item.name || item.price === undefined || item.isVeg === undefined) {
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

exports.getMenuItems = asyncHandler(async (req, res) => {
  const cartId = req.params.cartId

  if (!cartId) {
    res.status(400)
    throw new Error('cartId is required')
  }

  const items = await MenuItem.find({ cartId })

  res.status(200).json({
    success: true,
    count: items.length,
    data: items,
  })
})

exports.deleteMenuItem = asyncHandler(async (req, res) => {
  const itemId = req.params.itemId
  const cartId = req.params.cartId

  const item = await MenuItem.findOne({
    _id: itemId,
    cartId,
  })

  if (!item) {
    res.status(404)
    throw new Error('Menu item not found')
  }

  // Keep the image URL before deleting the document
  const oldImageUrl = item.imageUrl

  // Delete image from S3 if it exists
  if (oldImageUrl) {
    try {
      const bucketName = process.env.BUCKET_NAME

      const url = new URL(oldImageUrl)
      const s3Key = decodeURIComponent(url.pathname.substring(1))

      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
        }),
      )

      console.log('Old menu image deleted:', s3Key)
    } catch (error) {
      // Don't fail the entire deletion if S3 cleanup fails
      console.error('Failed to delete menu image from S3:', error)
    }
  }

  // Delete menu item from MongoDB
  await item.deleteOne()

  res.status(200).json({
    success: true,
    message: 'Menu item deleted successfully',
  })
})

exports.updateMenuItem = asyncHandler(async (req, res) => {
  const { id, oldImageUrl, ...item } = req.body

  const { cartId } = req.params

  const updatedItem = await MenuItem.findOneAndUpdate(
    {
      _id: id,
      cartId: cartId,
    },
    {
      $set: item,
    },
    {
      new: true,
      runValidators: true,
    },
  )

  if (!updatedItem) {
    res.status(404)
    throw new Error('Menu item not found')
  }

  // --------------------------------------------------
  // Delete old image from S3
  // --------------------------------------------------

  if (oldImageUrl && oldImageUrl !== updatedItem.imageUrl) {
    try {
      const bucketName = process.env.BUCKET_NAME

      const url = new URL(oldImageUrl)
      const s3Key = decodeURIComponent(url.pathname.substring(1))

      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
        }),
      )

      console.log('Old menu image deleted:', s3Key)
    } catch (error) {
      // Don't fail the entire update if image deletion fails
      console.error('Failed to delete old menu image:', error)
    }
  }

  res.status(201).json({
    success: true,
    message: 'Menu item updated successfully',
    data: updatedItem,
  })
})

exports.updateMenuItemStock = asyncHandler(async (req, res) => {
  const menuItem = await MenuItem.findByIdAndUpdate(
    req.params.itemId,
    {
      isInStock: req.body.isInStock,
    },
    {
      new: true,
      runValidators: true,
    },
  )

  if (!menuItem) {
    res.status(404)
    throw new Error('Menu item not found')
  }

  res.status(200).json({
    success: true,
    data: menuItem,
  })
})

exports.addMenuItem = asyncHandler(async (req, res) => {
  const { name, isVeg, price, isInStock, imageUrl } = req.body
  const { cartId } = req.params

  if (!name || !price) {
    res.status(400)
    throw new Error('Item name and price are required')
  }

  const menuItem = await MenuItem.create({
    cartId,
    name: name.trim(),
    price: Number(price),
    isVeg,
    imageUrl,
  })

  res.status(201).json({
    success: true,
    data: menuItem,
  })
})

exports.getPresignedUploadUrlForMenuItem = asyncHandler(async (req, res) => {
  const { fileType, menuItemId } = req.body
  const { cartId } = req.params

  if (!fileType) {
    res.status(400)
    throw new Error('File type is required')
  }

  const bucketName = process.env.BUCKET_NAME

  const extension = fileType.split('/')[1] || 'jpg'

  // Generate a unique ID for this menu image
  const imageId = crypto.randomUUID()

  const s3Key = `uploads/${cartId}/menu/${imageId}.${extension}`

  let oldImageUrl = null

  // menuItemId exists only when updating an existing menu item
  if (menuItemId) {
    const menuItem = await MenuItem.findOne({
      _id: menuItemId,
      cartId,
    })

    if (!menuItem) {
      res.status(404)
      throw new Error('Menu item not found')
    }

    oldImageUrl = menuItem.imageUrl || null
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    ContentType: fileType,
  })

  const uploadUrl = await getSignedUrl(
    s3Client,
    command,
    { expiresIn: 60 }
  )

  const fileUrl = `https://${bucketName}.s3.amazonaws.com/${s3Key}`

  res.status(200).json({
    success: true,
    uploadUrl,
    fileUrl,
    imageId,
    oldImageUrl,
  })
})

exports.getPresignedUploadUrlForExistingMenuItem = asyncHandler(
  async (req, res) => {
    const { fileType } = req.body
    const { cartId, menuItemId } = req.params

    const menuItem = await MenuItem.findOne({
      _id: menuItemId,
      cartId,
    })

    if (!menuItem) {
      res.status(404)
      throw new Error('Menu item not found')
    }

    const bucketName = process.env.BUCKET_NAME
    const extension = fileType.split('/')[1] || 'jpg'

    const imageId = crypto.randomUUID()

    const s3Key = `uploads/${cartId}/menu/${imageId}.${extension}`

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      ContentType: fileType,
    })

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 })

    const fileUrl = `https://${bucketName}.s3.amazonaws.com/${s3Key}`

    res.status(200).json({
      success: true,
      uploadUrl,
      fileUrl,
      imageId,
      s3Key,
      oldImageUrl: menuItem.imageUrl || null,
    })
  },
)

exports.generateAndUploadQR = asyncHandler(async (req, res) => {
  const { cartId } = req.params
  const cart = await Cart.findById(cartId)

  if (!cart) {
    res.status(404)
    throw new Error('Cart not found')
  }

  const url = `${process.env.FRONTEND_URL}/c/${cartId}`
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
    await cart.save()

    res.json({ success: true, qrImageUrl })
  } catch (s3Error) {
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
      _id: staff._id,
      userId: staff.userId,
      name: staff.name,
      phoneNumber: staff.phoneNumber,
      role: staff.role,
      cartId: staff.cartId,
      pinHash: pin,
    },
  })
})

exports.switchStaffCart = asyncHandler(async (req, res) => {
  const { staffId } = req.params
  const { cartId } = req.body

  const updatedStaff = await User.findByIdAndUpdate(
    staffId,
    { cartId },
    { new: true },
  )

  if (!updatedStaff) {
    return res.status(404).json({
      success: false,
      message: 'Staff member not found',
    })
  }

  res.status(200).json({
    success: true,
    data: updatedStaff,
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

exports.getCart = asyncHandler(async (req, res) => {
  const cartId = req.params.cartId

  const cart = await Cart.findById(cartId)

  if (!cart) {
    res.status(404)
    throw new Error('Cart not found')
  }

  res.status(200).json({
    success: true,
    data: cart,
  })
})


exports.getAllCarts = asyncHandler(async (req, res) => {
  // const userId = req.user._id
  const userId = req.params.userId

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

  console.log('Fetching staff for cartId:', cartId)

  const cart = await Cart.findById(cartId)

  if (!cart) {
    res.status(404)
    throw new Error('Cart not found')
  }

  const staffs = await User.find({
    role: 'staff',
    cartId: cart._id,
  }).select('-pinHash -otpHash -otpExpiresAt')

  res.status(200).json({
    success: true,
    staff: staffs,
  })
})

exports.deleteStaff = asyncHandler(async (req, res) => {
  const staffId = req.params.staffId

  const staff = await User.findById({ _id: staffId })

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

exports.getQRDetails = asyncHandler(async (req, res) => {
  const cartId = req.params.cartId
  const cart = await Cart.findById(cartId)

  if (!cart) {
    res.status(404)
    throw new Error('Cart not found')
  }

  res.status(200).json({
    success: true,
    data: {
      qrImageUrl: cart.qrImageUrl,
      cartName: cart.cartName,
      cartId: cart.cartId,
    },
  })
})

exports.toggleCartStatus = asyncHandler(async (req, res) => {
  const cartId = req.params.cartId
  const cart = await Cart.findById(cartId)

  if (!cart) {
    res.status(404)
    throw new Error('Cart not found')
  }

  cart.isOpen = !cart.isOpen
  await cart.save()

  res.status(200).json({
    success: true,
    message: 'Cart status toggled successfully',
    data: cart,
  })
})

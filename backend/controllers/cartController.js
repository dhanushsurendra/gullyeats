const Cart = require('../models/Cart')
const MenuItem = require('../models/Menu')
const User = require('../models/User')
const Order = require('../models/Order')
const { findManagedCart, findOwnedCart } = require('../utils/cartAccess')
const crypto = require('crypto')
const asyncHandler = require('../utils/asyncHandler')
const bcrypt = require('bcrypt')
const generateUserId = require('../utils/generateUserId')
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { s3Client } = require('../utils/s3Client')
const { uploadCartQr } = require('../utils/cartQr')
const generatePin = require('../utils/generatePin')
const { validatePhone } = require('../utils/validators')
const Menu = require('../models/Menu')
const translit = require('../utils/transliterate')
// Not awaited: new dish names are noted for review without slowing the save.
const { trackDishes, defaultImages } = require('../utils/dishCandidates')
const FoodName = require('../models/FoodName')
const { getPlatformFee } = require('../utils/platformFee')

// The only uploads allowed: the bucket is public, so anything else (an HTML
// page, say) would be served from our address.
// The vendor app sends "image/jpg" for .jpg files, so that is allowed too.
const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

// The cart photo getPresignedUploadUrl hands out: uploads/<cartId>.<ext>?v=<n>.
function isCartImage(cartId, url) {
  const prefix = `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/uploads/${cartId}.`
  return typeof url === 'string' && url.startsWith(prefix) && /^(jpeg|jpg|png|webp)(\?v=\d+)?$/.test(url.slice(prefix.length))
}

// { type: 'Point', coordinates: [lat, lng] } (lat first, see CLAUDE.md), or null if invalid.
function locationPoint(location) {
  const coords = location?.coordinates
  if (!Array.isArray(coords) || coords.length !== 2) return null
  const [lat, lng] = coords.map((n) => (typeof n === 'number' ? n : NaN))
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return null
  return { type: 'Point', coordinates: [lat, lng] }
}

// A cart suspended by GullyEats can't be reopened from the vendor app.
function refuseIfSuspended(res, cart, opening) {
  if (opening && cart.suspendedAt) {
    res.status(403)
    throw new Error('This cart is paused by GullyEats. Please contact GullyEats support.')
  }
}

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
    parcelCharge,
  } = req.body;

  const cart = await findOwnedCart(req, res, cartId);

  const bad = (message) => {
    res.status(400);
    throw new Error(message);
  };
  for (const [key, value] of Object.entries({ cartName, cartCity, address })) {
    if (value !== undefined && (typeof value !== 'string' || !value.trim())) bad(`${key} must be text`);
  }
  for (const [key, value] of Object.entries({ isActive, isOpen })) {
    if (value !== undefined && typeof value !== 'boolean') bad(`${key} must be true or false`);
  }
  // Only this cart's own photo (or the one it already has, or none).
  if (
    cartImageUrl !== undefined &&
    cartImageUrl &&
    cartImageUrl !== cart.cartImageUrl &&
    !isCartImage(cartId, cartImageUrl)
  ) {
    bad('Invalid image URL');
  }
  const point = location === undefined ? undefined : locationPoint(location);
  if (point === null) bad('Invalid location');

  if (parcelCharge !== undefined) {
    const value = Number(parcelCharge);
    if (parcelCharge === null || !Number.isFinite(value) || value < 0) {
      res.status(400);
      throw new Error('Parcel charge must be a number of 0 or more');
    }
    cart.parcelCharge = value;
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
    cart.cartImageUrl = cartImageUrl || null;
  }

  if (point) {
    cart.location = point;
  }

  if (isActive !== undefined) {
    cart.isActive = isActive;
  }

  if (isOpen !== undefined) {
    refuseIfSuspended(res, cart, isOpen);
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
    if (typeof item?.name !== 'string' || item.price === undefined || typeof item.isVeg !== 'boolean') {
      res.status(400)
      throw new Error('Each item must have name, price and isVeg')
    }

    const name = item.name.trim()
    const price = Number(item.price)
    const isVeg = item.isVeg

    if (name.length < 2) {
      res.status(400)
      throw new Error(`Invalid item name: ${name}`)
    }

    if (item.price === null || item.price === '' || !Number.isFinite(price) || price < 0) {
      res.status(400)
      throw new Error(`Invalid price for item: ${name}`)
    }

    return {
      name,
      price,
      isVeg,
      cartId,
    }
  })

  // Onboarding sends the whole menu each time it is saved, so replace the
  // cart's items instead of appending (going back and saving again used to
  // duplicate them). Once orders exist they reference these items, so leave
  // a live menu alone.
  if (await Order.exists({ cartId })) {
    res.status(409)
    throw new Error(
      'This cart already has orders. Edit its menu from the ordering app.',
    )
  }

  const names = await translit.transliterate(processedItems.map((item) => item.name))
  processedItems.forEach((item, i) => (item.names = names[i]))

  await MenuItem.deleteMany({ cartId })
  const createdItems = await MenuItem.insertMany(processedItems)
  trackDishes(cartId, processedItems.map((item) => ({ name: item.name }))) // names here are automatic, not typed

  res.status(201).json({
    success: true,
    count: createdItems.length,
    data: createdItems,
  })
})

// Common item names with their spelling in each script, most common first.
// The apps fetch it once and suggest from it as the vendor types.
exports.getFoodNames = asyncHandler(async (req, res) => {
  const names = await FoodName.find({}, { _id: 0, name: 1, hi: 1, kn: 1, ta: 1 })
    .sort({ popularity: -1, name: 1 })
    .lean()
  res.set('Cache-Control', 'private, max-age=86400')
  res.status(200).json({ success: true, data: names })
})

// GET /carts/photo-credits: who took the default dish photos (CC BY/BY-SA need the credit shown).
// shortcut: read once at startup; photos added by fill-dish-images.js show after a restart or deploy.
const photoCredits = Object.entries(require('../data/dish_image_credits.json'))
  .map(([dish, c]) => ({ dish, creator: c.creator || null, source: c.source, license: c.license, page: c.page }))
  .sort((a, b) => a.dish.localeCompare(b.dish))
exports.getPhotoCredits = (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400')
  res.json({ success: true, data: photoCredits })
}

exports.getMenuItems = asyncHandler(async (req, res) => {
  const cartId = req.params.cartId

  if (!cartId) {
    res.status(400)
    throw new Error('cartId is required')
  }

  const items = await MenuItem.find({ cartId }).lean()
  // Items without their own photo get the dish's default one, if it has one.
  const imageFor = await defaultImages()
  for (const item of items) if (!item.imageUrl) item.defaultImage = imageFor(item.name)

  res.status(200).json({
    success: true,
    count: items.length,
    data: items,
    // The fee a new order pays now, for the apps' totals (the server sets the real one).
    platformFee: await getPlatformFee(),
  })
})

// Menu photos live under uploads/<cart _id>/menu/ (see the presigned URL
// handlers below). Anything else is not ours to delete or to point at.
function menuImagePrefix(cartId) {
  return `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/uploads/${cartId}/menu/`
}

// One file directly in that folder (<uuid>.<ext>): no "..", "%2F" or
// subfolders, which S3 or new URL() could resolve to another cart's file.
function isMenuImage(cartId, imageUrl) {
  const prefix = menuImagePrefix(cartId)
  return (
    typeof imageUrl === 'string' &&
    imageUrl.startsWith(prefix) &&
    /^[\w-]+\.\w+$/.test(imageUrl.slice(prefix.length))
  )
}

async function deleteMenuImage(cartId, imageUrl) {
  if (!isMenuImage(cartId, imageUrl)) return

  try {
    const s3Key = decodeURIComponent(new URL(imageUrl).pathname.substring(1))

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: s3Key,
      }),
    )
  } catch (error) {
    // Don't fail the request if S3 cleanup fails
    console.error('Failed to delete menu image from S3:', error)
  }
}

// Validates the editable menu item fields present in the body. Anything
// else (cartId, _id, ...) is ignored.
// Plain { hi, kn, ta } from a stored item's names.
function pickNames(names) {
  return Object.fromEntries(translit.LANGS.filter((l) => names?.[l]).map((l) => [l, names[l]]))
}

function menuItemFields(req, res, { requireAll }) {
  const { name, price, isVeg, isInStock, imageUrl, names } = req.body
  const fields = {}

  if (name !== undefined || requireAll) {
    if (typeof name !== 'string' || name.trim().length < 2) {
      res.status(400)
      throw new Error('Item name must be at least 2 characters')
    }
    fields.name = name.trim()
  }

  if (price !== undefined || requireAll) {
    const value = Number(price)
    if (price === null || price === '' || !Number.isFinite(value) || value < 0) {
      res.status(400)
      throw new Error('Price must be a number of 0 or more')
    }
    fields.price = value
  }

  for (const [key, value] of Object.entries({ isVeg, isInStock })) {
    if (value === undefined) continue
    if (typeof value !== 'boolean') {
      res.status(400)
      throw new Error(`${key} must be true or false`)
    }
    fields[key] = value
  }

  // The vendor's own spelling in their language; '' falls back to English.
  if (names !== undefined) {
    const entries = names && typeof names === 'object' && !Array.isArray(names) ? Object.entries(names) : null
    if (!entries || entries.some(([lang, v]) => !translit.LANGS.includes(lang) || typeof v !== 'string' || v.trim().length > 100)) {
      res.status(400)
      throw new Error('Invalid item name in your language')
    }
    fields.names = Object.fromEntries(entries.map(([lang, v]) => [lang, v.trim()]))
  }

  if (imageUrl !== undefined) {
    if (
      imageUrl !== null &&
      imageUrl !== '' &&
      !isMenuImage(req.params.cartId, imageUrl)
    ) {
      res.status(400)
      throw new Error('Invalid image URL')
    }
    fields.imageUrl = imageUrl || null
  }

  return fields
}

exports.deleteMenuItem = asyncHandler(async (req, res) => {
  const { cartId, itemId } = req.params

  await findOwnedCart(req, res, cartId)

  const item = await MenuItem.findOne({ _id: itemId, cartId })

  if (!item) {
    res.status(404)
    throw new Error('Menu item not found')
  }

  await item.deleteOne()
  await deleteMenuImage(cartId, item.imageUrl)

  res.status(200).json({
    success: true,
    message: 'Menu item deleted successfully',
  })
})

exports.updateMenuItem = asyncHandler(async (req, res) => {
  const { cartId } = req.params

  await findOwnedCart(req, res, cartId)

  const item = await MenuItem.findOne({ _id: req.body.id, cartId })

  if (!item) {
    res.status(404)
    throw new Error('Menu item not found')
  }

  // Only the image stored before this update may be deleted, never a URL
  // the client names.
  const previousImageUrl = item.imageUrl

  const { names, ...fields } = menuItemFields(req, res, { requireAll: false })
  const renamed = fields.name !== undefined && fields.name !== item.name
  Object.assign(item, fields)
  if (renamed) item.names = (await translit.transliterate([item.name]))[0]
  if (names) item.names = { ...pickNames(item.names), ...names }
  await item.save()
  if (renamed || names) trackDishes(cartId, [{ name: item.name, names }])

  if (previousImageUrl !== item.imageUrl) {
    await deleteMenuImage(cartId, previousImageUrl)
  }

  res.status(201).json({
    success: true,
    message: 'Menu item updated successfully',
    data: item,
  })
})

exports.updateMenuItemStock = asyncHandler(async (req, res) => {
  const { cartId, itemId } = req.params

  await findManagedCart(req, res, cartId)

  if (typeof req.body.isInStock !== 'boolean') {
    res.status(400)
    throw new Error('isInStock must be true or false')
  }

  const menuItem = await MenuItem.findOneAndUpdate(
    { _id: itemId, cartId },
    { isInStock: req.body.isInStock },
    { new: true, runValidators: true },
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
  const { cartId } = req.params

  await findOwnedCart(req, res, cartId)

  const fields = menuItemFields(req, res, { requireAll: true })
  const [names] = await translit.transliterate([fields.name])
  const menuItem = await MenuItem.create({
    ...fields,
    names: { ...names, ...fields.names },
    cartId,
  })
  trackDishes(cartId, [{ name: fields.name, names: fields.names }])

  res.status(201).json({
    success: true,
    data: menuItem,
  })
})

exports.getPresignedUploadUrlForMenuItem = asyncHandler(async (req, res) => {
  const { fileType, menuItemId } = req.body
  const { cartId } = req.params

  await findOwnedCart(req, res, cartId)

  if (!IMAGE_TYPES.includes(fileType)) {
    res.status(400)
    throw new Error('Upload a JPEG, PNG or WebP image')
  }

  const bucketName = process.env.BUCKET_NAME

  const extension = fileType.split('/')[1]

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

    await findOwnedCart(req, res, cartId)

    if (!IMAGE_TYPES.includes(fileType)) {
      res.status(400)
      throw new Error('Upload a JPEG, PNG or WebP image')
    }

    const menuItem = await MenuItem.findOne({
      _id: menuItemId,
      cartId,
    })

    if (!menuItem) {
      res.status(404)
      throw new Error('Menu item not found')
    }

    const bucketName = process.env.BUCKET_NAME
    const extension = fileType.split('/')[1]

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
  const cart = await findManagedCart(req, res, cartId)

  // FRONTEND_URL_CUSTOMER may list several origins (it also feeds CORS);
  // the first is the customer app the QR should open.
  const customerAppUrl = (
    process.env.FRONTEND_URL || process.env.FRONTEND_URL_CUSTOMER || ''
  )
    .split(',')[0]
    .trim()
    .replace(/\/+$/, '')

  if (!customerAppUrl) {
    res.status(500)
    throw new Error('Customer app URL is not configured')
  }

  try {
    const qrImageUrl = await uploadCartQr(cartId, customerAppUrl)
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

  if (typeof name !== 'string' || !name || !phoneNumber || !cartId) {
    res.status(400)
    throw new Error('name, phoneNumber, cartId are required')
  }

  name = name.trim()
  phoneNumber = validatePhone(phoneNumber)

  if (name.length < 2) {
    res.status(400)
    throw new Error('Invalid name')
  }

  const cart = await findOwnedCart(req, res, cartId)

  let user = await User.findOne({ phoneNumber })

  if (user) {
    res.status(409)
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

  const staff = await User.findById(staffId)

  if (!staff || staff.role !== 'staff') {
    res.status(404)
    throw new Error('Staff member not found')
  }

  // The caller must manage both the staff member's cart and the new one,
  // otherwise anyone could move any account onto any cart.
  await findOwnedCart(req, res, staff.cartId)
  const cart = await findOwnedCart(req, res, cartId)

  staff.cartId = cart._id
  await staff.save()

  res.status(200).json({
    success: true,
    data: {
      _id: staff._id,
      userId: staff.userId,
      name: staff.name,
      phoneNumber: staff.phoneNumber,
      role: staff.role,
      cartId: staff.cartId,
    },
  })
})

exports.getPresignedUploadUrl = asyncHandler(async (req, res) => {
  const { fileType } = req.body
  const cartId = req.params.cartId

  await findOwnedCart(req, res, cartId)
  if (!IMAGE_TYPES.includes(fileType)) {
    res.status(400)
    throw new Error('Upload a JPEG, PNG or WebP image')
  }
  const bucketName = process.env.BUCKET_NAME

  const extension = fileType.split('/')[1]

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: `uploads/${cartId}.${extension}`,
    ContentType: fileType,
  })

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 })

  const s3Key = `uploads/${cartId}.${extension}`
  // The key never changes, so ?v= makes phones and CDNs fetch the new photo.
  const fileUrl = `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${s3Key}?v=${Date.now()}`

  res.status(200).json({
    success: true,
    uploadUrl,
    fileUrl,
  })
})

exports.updateCartImage = asyncHandler(async (req, res) => {
  const { cartId } = req.params
  const { imageUrl } = req.body

  await findOwnedCart(req, res, cartId)
  if (imageUrl && !isCartImage(cartId, imageUrl)) {
    res.status(400)
    throw new Error('Invalid image URL')
  }

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

  // Customers' star ratings of this cart's orders: shown on its welcome page.
  const [stars] = await Order.aggregate([
    { $match: { cartId: cart._id, rating: { $gte: 1 } } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ])

  // Public (customers): not the owner's account id or GullyEats' notes.
  const { userId, suspendReason, ...publicCart } = cart.toObject()

  res.status(200).json({
    success: true,
    data: {
      ...publicCart,
      platformFee: await getPlatformFee(),
      rating: stars
        ? { average: Math.round(stars.average * 10) / 10, count: stars.count }
        : { average: null, count: 0 },
    },
  })
})


exports.getAllCarts = asyncHandler(async (req, res) => {
  const userId = req.params.userId

  if (!userId) {
    res.status(400)
    throw new Error('User Id is required')
  }

  // Users may list only their own carts (both apps pass their own id).
  if (String(userId) !== String(req.user._id) && req.user.role !== 'admin') {
    res.status(403)
    throw new Error('Not allowed to view these carts')
  }

  const user = await User.findOne({ _id: userId })

  if (!user) {
    res.status(404)
    throw new Error('User not found')
  }

  // Staff work on the one cart they are assigned to.
  const carts =
    user.role === 'staff'
      ? await Cart.find({ _id: user.cartId })
      : await Cart.find({ userId: user._id })

  res.status(200).json({
    success: true,
    count: carts.length,
    carts: carts,
  })
})

exports.getAllStaff = asyncHandler(async (req, res) => {
  const cartId = req.params.cartId

  // Staff may see their cart's staff list too (names and phones, never PINs): by design.
  const cart = await findManagedCart(req, res, cartId)

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

  // Only staff accounts can be removed here, and only by someone who
  // manages their cart (this used to delete any user, vendors included).
  if (!staff || staff.role !== 'staff') {
    res.status(404)
    throw new Error('Staff member not found')
  }

  await findOwnedCart(req, res, staff.cartId)

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
  const cart = await findManagedCart(req, res, req.params.cartId)

  // Set the state the app asks for; older clients send no isOpen and get
  // the old flip.
  const { isOpen } = req.body || {}
  if (isOpen !== undefined && typeof isOpen !== 'boolean') {
    res.status(400)
    throw new Error('isOpen must be true or false')
  }

  const next = isOpen === undefined ? !cart.isOpen : isOpen
  refuseIfSuspended(res, cart, next)
  cart.isOpen = next
  await cart.save()

  res.status(200).json({
    success: true,
    message: 'Cart status updated successfully',
    data: cart,
  })
})

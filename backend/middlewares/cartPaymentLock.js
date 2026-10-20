const asyncHandler = require('../utils/asyncHandler')
const Cart = require('../models/Cart')
const {
  getCartPaymentStatus,
} = require('../utils/cartPaymentLock')

const cartPaymentLockMiddleware = asyncHandler(async (req, res, next) => {
  const cartId =
    req.params.cartId ||
    req.body.cartId

  if (!cartId) {
    res.status(400)
    throw new Error('cartId is required')
  }

  // User must be authenticated
  if (!req.user?._id) {
    res.status(401)
    throw new Error('Not authorized')
  }

  // Verify that this cart belongs to the logged-in user
  const cart = await Cart.findOne({
    _id: cartId,
    userId: req.user._id,
  }).lean()

  if (!cart) {
    res.status(404)
    throw new Error('Cart not found')
  }

  const status = await getCartPaymentStatus(cartId)

  if (status.isLocked) {
    return res.status(403).json({
      success: false,
      ...status,
    })
  }

  next()
})

module.exports = cartPaymentLockMiddleware
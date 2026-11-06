const mongoose = require('mongoose')
const asyncHandler = require('../utils/asyncHandler')
const paymentLock = require('../utils/cartPaymentLock')

// A cart with GullyEats fees unpaid past the grace period can't take new
// orders. Customers call this too, so only a reason goes back, never the
// vendor's billing details. A missing or bad cartId is left to the handler.
const cartPaymentLockMiddleware = asyncHandler(async (req, res, next) => {
  const cartId = req.params.cartId || req.body?.cartId

  if (cartId && mongoose.isValidObjectId(cartId)) {
    const status = await paymentLock.getCartPaymentStatus(cartId)
    if (status.isLocked) {
      res.status(403)
      throw new Error('This cart is not taking orders right now.')
    }
  }

  next()
})

module.exports = cartPaymentLockMiddleware

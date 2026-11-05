const Cart = require('../models/Cart')
const User = require('../models/User')

/**
 * Loads the cart and checks that the logged-in user may manage it: its
 * owner (vendor), an admin, or a staff member assigned to it. Throws 404 or
 * 403 (through asyncHandler/errorHandler) otherwise.
 */
async function findManagedCart(req, res, cartId) {
  const cart = await Cart.findById(cartId)

  if (!cart) {
    res.status(404)
    throw new Error('Cart not found')
  }

  const userId = String(req.user._id)

  if (String(cart.userId) === userId || req.user.role === 'admin') {
    return cart
  }

  if (req.user.role === 'staff') {
    const staff = await User.findById(userId).select('cartId').lean()
    if (staff && String(staff.cartId) === String(cart._id)) return cart
  }

  res.status(403)
  throw new Error('Not allowed to manage this cart')
}

module.exports = { findManagedCart }

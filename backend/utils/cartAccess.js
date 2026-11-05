const Cart = require('../models/Cart')
const User = require('../models/User')
const Order = require('../models/Order')

/** Whether user ({ _id, role }) may manage cart: owner, admin or its staff. */
async function canManageCart(user, cart) {
  if (!user) return false
  if (String(cart.userId) === String(user._id) || user.role === 'admin') {
    return true
  }
  if (user.role !== 'staff') return false
  const staff = await User.findById(user._id).select('cartId').lean()
  return Boolean(staff && String(staff.cartId) === String(cart._id))
}

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

  if (await canManageCart(req.user, cart)) return cart

  res.status(403)
  throw new Error('Not allowed to manage this cart')
}

/** Loads the order and checks the user may manage its cart (see above). */
async function findManagedOrder(req, res, orderId) {
  const order = await Order.findById(orderId)

  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  await findManagedCart(req, res, order.cartId)
  return order
}

module.exports = { canManageCart, findManagedCart, findManagedOrder }

const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const Cart = require('../models/Cart')
const { canManageCart } = require('./cartAccess')

/*
 * Who may listen to which live updates.
 *
 * - A cart room (`<cartId>`) carries every order of that cart, so joining
 *   it needs the vendor app's login token (sent as `auth: { token }` when
 *   connecting) from someone who manages the cart: its owner, staff or an
 *   admin.
 * - An order room (`order:<orderId>`) carries one order. The customer's
 *   order page joins it without logging in; the order's ID is random and
 *   only the customer has it.
 */
async function joinVendor(socket, cartId) {
  try {
    const decoded = jwt.verify(socket.handshake?.auth?.token, process.env.JWT_SECRET)
    const cart = mongoose.isValidObjectId(String(cartId))
      ? await Cart.findById(cartId)
      : null
    if (cart && (await canManageCart({ _id: decoded._id, role: decoded.role }, cart))) {
      socket.join(String(cartId))
      return true
    }
  } catch {
    // Missing, expired or forged token: fall through to the refusal.
  }
  socket.emit('join_error', 'Not allowed to receive this cart\'s orders')
  return false
}

function joinOrder(socket, orderId) {
  if (!mongoose.isValidObjectId(String(orderId))) return false
  socket.join(`order:${orderId}`)
  return true
}

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('join_order', (orderId) => joinOrder(socket, orderId))
    socket.on('join_vendor', (cartId) => joinVendor(socket, cartId))
  })
}

module.exports = { joinVendor, joinOrder, registerSocketHandlers }

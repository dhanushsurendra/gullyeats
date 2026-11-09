const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const Cart = require('../models/Cart')
const { canManageCart } = require('./cartAccess')
const { holdsOrderKey } = require('./orderKey')

/*
 * Who may listen to which live updates.
 *
 * - A cart room (`<cartId>`) carries every order of that cart, so joining
 *   it needs the vendor app's login token (sent as `auth: { token }` when
 *   connecting) from someone who manages the cart: its owner, staff or an
 *   admin.
 * - An order room (`order:<orderId>`) carries one order. The customer's
 *   order page joins it without logging in, sending "<orderId>.<accessKey>"
 *   (the key only their phone got; ids alone are guessable).
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

async function joinOrder(socket, orderKey) {
  const orderId = String(orderKey).split('.')[0]
  if (!mongoose.isValidObjectId(orderId)) return false
  try {
    if (!(await holdsOrderKey(orderId, orderKey))) return false
  } catch {
    return false
  }
  socket.join(`order:${orderId}`)
  return true
}

// The queue room only ever carries "queue_changed", with no order details,
// so anyone at the cart (customers, without logging in) may join it.
function joinQueue(socket, cartId) {
  if (!mongoose.isValidObjectId(String(cartId))) return false
  socket.join(`queue:${cartId}`)
  return true
}

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('join_order', (orderId) => joinOrder(socket, orderId))
    // The vendor app waits for the ack, then refetches what it missed.
    socket.on('join_vendor', async (cartId, ack) => {
      const joined = await joinVendor(socket, cartId)
      if (typeof ack === 'function') ack(joined)
    })
    socket.on('join_queue', (cartId) => joinQueue(socket, cartId))
  })
}

module.exports = { joinVendor, joinOrder, joinQueue, registerSocketHandlers }

const path = require('path')
const User = require('../models/User')

// FIREBASE_SERVICE_ACCOUNT is the service account key: either the JSON itself
// (for hosts that only take env vars) or a path to the downloaded file.
// Without it pushes are skipped, so local runs and tests need no Firebase.
let messaging
function getMessaging() {
  if (messaging !== undefined) return messaging
  const key = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!key) return (messaging = null)
  const { initializeApp, cert } = require('firebase-admin/app')
  const account = key.trim().startsWith('{') ? JSON.parse(key) : require(path.resolve(key))
  initializeApp({ credential: cert(account) })
  return (messaging = require('firebase-admin/messaging').getMessaging())
}

// Ids Firebase says will never work again.
const DEAD = ['messaging/installation-id-not-registered']

/**
 * Pushes a new QR order to the cart's owner and staff, so phones with the
 * app in the background or closed still hear it (the socket only reaches an
 * open app). Never throws: a failed push must not fail the order.
 */
async function notifyNewOrder(cart, order) {
  try {
    const fcm = getMessaging()
    if (!fcm) return
    const users = await User.find({
      $or: [{ _id: cart.userId }, { role: 'staff', cartId: cart._id }],
    }).select('+pushIds').lean()
    const ids = users.flatMap((u) => u.pushIds || [])
    if (!ids.length) return

    // shortcut: English only (the server doesn't know each phone's language); send per-language text if vendors ask.
    const items = order.orderItems.map((i) => `${i.quantity}× ${i.name}`).join(', ')
    const result = await fcm.sendEachForMulticast({
      fids: ids,
      notification: {
        title: `New order #${order.orderNumber} · ${cart.cartName}`,
        body: `₹${order.totalPrice} · ${items}`,
      },
      // The app creates the "new_orders" channel (loud, heads-up). High
      // priority wakes a phone that's dozing.
      android: { priority: 'high', notification: { channelId: 'new_orders', sound: 'paid' } },
    })

    const dead = ids.filter((_, i) => DEAD.includes(result.responses[i].error?.code))
    if (dead.length) await User.updateMany({ pushIds: { $in: dead } }, { $pull: { pushIds: { $in: dead } } })
  } catch (e) {
    console.error('Push failed:', e.message)
  }
}

/**
 * Saves a phone's Firebase Installation ID for [userId]. A phone belongs to
 * one login at a time.
 */
async function savePushId(userId, id) {
  await User.updateMany({ pushIds: id }, { $pull: { pushIds: id } })
  // Keep the newest 10, so phones that were reset without logging out age out.
  await User.updateOne({ _id: userId }, { $push: { pushIds: { $each: [id], $slice: -10 } } })
}

module.exports = { notifyNewOrder, savePushId, _setMessaging: (m) => (messaging = m) }

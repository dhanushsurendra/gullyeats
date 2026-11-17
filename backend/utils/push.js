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
 * Pushes [notification] to every phone logged in as a user matching
 * [userFilter]. [channelId] is an Android channel the app creates
 * (MainActivity.kt); [data] reaches the app when the push is tapped.
 * Never throws: a failed push must not fail what triggered it.
 */
async function sendToUsers(userFilter, { notification, channelId, data }) {
  try {
    const fcm = getMessaging()
    if (!fcm) return
    const users = await User.find(userFilter).select('+pushIds').lean()
    const ids = users.flatMap((u) => u.pushIds || [])
    if (!ids.length) return

    const result = await fcm.sendEachForMulticast({
      fids: ids,
      notification,
      data,
      // High priority wakes a phone that's dozing.
      android: { priority: 'high', notification: { channelId } },
    })

    const dead = ids.filter((_, i) => DEAD.includes(result.responses[i].error?.code))
    if (dead.length) await User.updateMany({ pushIds: { $in: dead } }, { $pull: { pushIds: { $in: dead } } })
  } catch (e) {
    console.error('Push failed:', e.message)
  }
}

// shortcut: pushes are English only (the server doesn't know each phone's language); send per-language text if vendors ask.

/**
 * Pushes a new QR order to the cart's owner and staff, so phones with the
 * app in the background or closed still hear it (the socket only reaches an
 * open app).
 */
function notifyNewOrder(cart, order) {
  const items = order.orderItems.map((i) => `${i.quantity}× ${i.name}`).join(', ')
  return sendToUsers(
    { $or: [{ _id: cart.userId }, { role: 'staff', cartId: cart._id }] },
    {
      notification: {
        title: `New order #${order.orderNumber} · ${cart.cartName}`,
        body: `₹${order.totalPrice} · ${items}`,
      },
      // v2: plays as a notification, so silent / vibrate mode applies (the
      // old channel rang as an alarm). Older app builds lack it and show
      // the push on Android's default channel with the default sound.
      channelId: 'new_orders_v2',
    },
  )
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

module.exports = { notifyNewOrder, sendToUsers, savePushId, _setMessaging: (m) => (messaging = m) }

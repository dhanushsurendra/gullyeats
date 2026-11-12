const webpush = require('web-push')
const Order = require('../models/Order')
const Cart = require('../models/Cart')

// Customer browser pushes (standard Web Push, VAPID). Without the keys in
// .env (WEBPUSH_PUBLIC_KEY / WEBPUSH_PRIVATE_KEY, made once with
// `npx web-push generate-vapid-keys`) pushes are skipped.
let ready
function setup() {
  if (ready !== undefined) return ready
  const { WEBPUSH_PUBLIC_KEY: pub, WEBPUSH_PRIVATE_KEY: priv, WEBPUSH_SUBJECT: subject } = process.env
  if (!pub || !priv) return (ready = false)
  webpush.setVapidDetails(subject || 'mailto:support@gullyeats.app', pub, priv)
  return (ready = true)
}

const publicKey = () => (setup() ? process.env.WEBPUSH_PUBLIC_KEY : null)

/** A browser PushSubscription as JSON, or null when it doesn't look like one. */
function cleanSubscription(sub) {
  const { endpoint, keys } = sub || {}
  if (typeof endpoint !== 'string' || endpoint.length > 1000 || !/^https:\/\//.test(endpoint)) return null
  if (typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') return null
  if (keys.p256dh.length > 200 || keys.auth.length > 100) return null
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }
}

const MESSAGES = {
  SERVED: (o, cart) => ({ title: 'Your food is ready!', body: `Token #${o.orderNumber} · collect it at ${cart}`, page: '/served' }),
  CANCELLED: (o, cart) => ({ title: `Order #${o.orderNumber} was cancelled`, body: `${cart} cancelled your order.`, page: '/cancelled' }),
}

/**
 * Tells the customer's phone that their order was served or cancelled by
 * the vendor, if they turned notifications on for it. Never throws.
 */
async function notifyCustomer(order) {
  try {
    const message = MESSAGES[order.status]
    if (!message || !setup()) return
    const saved = await Order.findById(order._id).select('+pushSubscription').lean()
    if (!saved?.pushSubscription) return
    const cart = await Cart.findById(order.cartId).select('cartName').lean()
    const { page, ...text } = message(order, cart?.cartName || 'the cart')
    const payload = { ...text, tag: String(order._id), url: `/c/${order.cartId}/order/${order._id}${page}` }
    try {
      await webpush.sendNotification(saved.pushSubscription, JSON.stringify(payload), { TTL: 60 * 60 })
    } catch (e) {
      // 404/410: the browser dropped the subscription.
      if (e.statusCode === 404 || e.statusCode === 410) {
        await Order.updateOne({ _id: order._id }, { $unset: { pushSubscription: 1 } })
      } else throw e
    }
  } catch (e) {
    console.error('Customer push failed:', e.message)
  }
}

module.exports = { publicKey, cleanSubscription, notifyCustomer, _webpush: webpush, _reset: () => (ready = undefined) }

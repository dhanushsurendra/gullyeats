const crypto = require('crypto')
const Order = require('../models/Order')

/*
 * Customers (no login) prove an order is theirs with
 *   X-Gully-Order: <orderId>.<accessKey>
 * the secret createOrder returned only to their phone. Order ids alone are
 * guessable (timestamp + counter), so they are never enough.
 */
async function holdsOrderKey(orderId, header) {
  const [id, key] = String(header || '').split('.')
  if (id !== String(orderId) || !/^[a-f0-9]{32}$/.test(key || '')) return false
  const order = await Order.findById(orderId).select('+accessKey').lean()
  const saved = order?.accessKey
  return typeof saved === 'string' && saved.length === key.length &&
    crypto.timingSafeEqual(Buffer.from(saved), Buffer.from(key))
}

module.exports = { holdsOrderKey }

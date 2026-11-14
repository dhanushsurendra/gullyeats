const mongoose = require('mongoose')
const Notification = require('../models/Notification')
const Order = require('../models/Order')
const Cart = require('../models/Cart')
const { overdueByCart } = require('./overdueFees')
const { leakReport } = require('../controllers/insightsController')

/*
 * Admin notifications: saved for the dashboard's Notifications page and sent
 * live to every signed-in admin (Socket.IO room `admins`, see socketRooms).
 */
let io = null
const init = (server) => (io = server)

const toClient = (n, adminId) => ({
  id: String(n._id),
  type: n.type,
  title: n.title,
  text: n.text,
  to: n.to,
  at: n.createdAt,
  read: Boolean(adminId && n.readBy?.some((id) => String(id) === String(adminId))),
})

/**
 * Saves and announces { type, title, text, to, key? }, or what an async
 * function returns (to look things up after the request has answered). A
 * notification whose key was used before is skipped. Never throws and never
 * waits on the caller: it must not fail or slow a customer's or vendor's request.
 */
function notifyAdmins(n) {
  // Not connected (tests with stubbed models): nothing to save to.
  if (mongoose.connection.readyState !== 1) return
  Promise.resolve()
    .then(() => (typeof n === 'function' ? n() : n))
    .then((doc) => doc && Notification.create(doc))
    .then((doc) => doc && io?.to('admins').emit('admin_notification', toClient(doc)))
    .catch((e) => {
      if (e.code !== 11000) console.error('Admin notification failed:', e.message)
    })
}

const REFUND_GRACE_MS = 2 * 3600e3
const cartName = async (id) => (await Cart.findById(id).select('cartName').lean())?.cartName || 'a cart'
// The Monday (YYYY-MM-DD) of an IST day's week.
const weekOf = (day) => {
  const d = new Date(`${day}T00:00:00Z`)
  return new Date(+d - ((d.getUTCDay() + 6) % 7) * 86400e3).toISOString().slice(0, 10)
}
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const istParts = (now) => {
  const ist = new Date(now.getTime() + 5.5 * 3600e3)
  return { day: ist.toISOString().slice(0, 10), hour: ist.getUTCHours() }
}

/*
 * Things that need attention because time passed, not because of a request:
 * - a refund the cart hasn't handed back REFUND_GRACE_MS after it was owed
 *   (once per refund; only recent ones, so old ones aren't announced again
 *   after a long outage);
 * - overdue platform fees, as one morning summary per IST day;
 * - fee leakage: each cart the Business > Fee leakage tab flags, once per
 *   IST week while it stays flagged.
 */
async function checkAttention(now = new Date()) {
  const late = new Date(+now - REFUND_GRACE_MS)
  const owed = await Order.find({
    refunds: { $elemMatch: { refundedAt: null, owedAt: { $lt: late, $gte: new Date(+late - 86400e3) } } },
  })
    .select('orderNumber cartId refunds')
    .lean()
  const names = new Map(
    (await Cart.find({ _id: { $in: owed.map((o) => o.cartId) } }).select('cartName').lean()).map((c) => [
      String(c._id),
      c.cartName,
    ]),
  )
  for (const o of owed) {
    const r = o.refunds.findLast((x) => !x.refundedAt)
    notifyAdmins({
      type: 'refund-owed',
      title: `Refund not handed back · ${names.get(String(o.cartId)) || 'a cart'}`,
      text: `₹${r.amount} owed to the customer of order #${o.orderNumber} for over 2 hours`,
      to: '/collections?refunds=owed',
      key: `refund-owed:${o._id}:${+r.owedAt}`,
    })
  }

  const { day, hour } = istParts(now)
  if (hour >= 9) {
    const rows = await overdueByCart(now)
    if (rows.length) {
      const amount = rows.reduce((t, r) => t + r.amount, 0)
      notifyAdmins({
        type: 'fees-overdue',
        title: `Platform fees overdue · ₹${amount}`,
        text: `${plural(rows.length, 'cart')} locked until they pay`,
        to: '/collections',
        key: `fees-overdue:${day}`,
      })
    }

    const leaks = await leakReport()
    const week = weekOf(day)
    for (const c of leaks.items) {
      notifyAdmins({
        type: 'leakage',
        title: `Possible fee leakage · ${c.cart}`,
        text: `${c.leakRate}% of ${c.orders} orders in 30 days cancelled or never paid (platform ${leaks.platform.rate}%) · ₹${c.feesAtRisk} in fees`,
        to: '/insights?tab=leakage',
        key: `leakage:${c.cartId}:${week}`,
      })
    }
  }
}

// shortcut: an in-process timer like feeReminders, so a sleeping host skips checks; fine on one always-on server.
function startAttentionChecks() {
  const run = () => checkAttention().catch((e) => console.error('Attention check failed:', e.message))
  setInterval(run, 10 * 60 * 1000).unref()
  run()
}

module.exports = { init, notifyAdmins, cartName, toClient, checkAttention, startAttentionChecks }

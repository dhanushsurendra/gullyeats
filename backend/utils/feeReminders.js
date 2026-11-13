const Cart = require('../models/Cart')
const User = require('../models/User')
const { getCartPaymentStatus } = require('./cartPaymentLock')
const push = require('./push')

const istParts = (now) => {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  return { day: ist.toISOString().slice(0, 10), hour: ist.getUTCHours() }
}
const istTime = (date) =>
  date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })

/**
 * Reminds cart owners about unpaid platform fees (see cartPaymentLock):
 * - "due": from midnight IST, when yesterday's fee can be paid, until the
 *   cart locks at 2am;
 * - "locked": from 9am to 9pm IST, while a locked cart is still unpaid.
 * Each kind reaches a cart at most once per IST day, even with several
 * servers (the cart's feeReminder claims it). Only owners get them, since
 * staff can't pay. Tapping one opens the app's payment screen.
 */
async function sendFeeReminders(now = new Date()) {
  const { day, hour } = istParts(now)
  const kind = hour < 2 ? 'due' : hour >= 9 && hour < 21 ? 'locked' : null
  if (!kind) return 0
  const key = `${day}:${kind}`

  // Only owners who can get a push at all.
  const owners = await User.find({ role: 'vendor', pushIds: { $exists: true, $ne: [] } }).select('_id').lean()
  if (!owners.length) return 0
  const carts = await Cart.find({ userId: { $in: owners.map((o) => o._id) }, feeReminder: { $ne: key } })
    .select('_id userId cartName')
    .lean()

  let sent = 0
  for (const cart of carts) {
    const claimed = await Cart.updateOne({ _id: cart._id, feeReminder: { $ne: key } }, { $set: { feeReminder: key } })
    if (claimed.modifiedCount !== 1) continue

    const status = await getCartPaymentStatus(cart._id)
    const fee = status.totalPending
    let notification
    if (kind === 'due' && !status.isLocked && status.canPay && fee > 0) {
      notification = {
        title: `Platform fee due: ₹${fee} · ${cart.cartName}`,
        body: `Pay before ${istTime(status.dueAt)} to keep taking orders.`,
      }
    } else if (kind === 'locked' && status.isLocked && fee > 0) {
      notification = {
        title: `Cart locked · ${cart.cartName}`,
        body: `Pay the ₹${fee} platform fee to take orders again.`,
      }
    }
    if (!notification) continue

    await push.sendToUsers(
      { _id: cart.userId },
      { notification, channelId: 'fees', data: { type: 'fee', cartId: String(cart._id) } },
    )
    sent++
  }
  return sent
}

// shortcut: an in-process timer, so a sleeping host (Render free tier) skips reminders while asleep; use a cron job pinging an endpoint if that matters.
let lastRun = null // shown on the admin Platform Health
function startFeeReminders() {
  const run = () =>
    sendFeeReminders()
      .then(() => (lastRun = new Date()))
      .catch((e) => console.error('Fee reminders failed:', e.message))
  setInterval(run, 10 * 60 * 1000).unref()
  run()
}

module.exports = { sendFeeReminders, startFeeReminders, lastRun: () => lastRun }

const mongoose = require('mongoose')
const Cart = require('../models/Cart')
const Order = require('../models/Order')
const Payment = require('../models/Payment')
const feeReminders = require('./feeReminders')

// The admin dashboard's Platform Health rows: real signals, each
// { key, label, state: 'ok' | 'warn' | 'bad', detail }. "Is the server up at
// all" can't be answered from inside it; an outside uptime monitor does that.

const MIN = 60e3
// Open carts this long without an order look quiet enough to check on.
const QUIET_HOURS = 3

function ago(date, now) {
  if (!date) return 'never'
  const mins = Math.round((now - date) / MIN)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)} days ago`
}

async function platformHealth(io, now = new Date()) {
  const db = mongoose.connection.readyState === 1
  const [openCarts, lastOrder, lastPayment] = db
    ? await Promise.all([
        Cart.find({ isOpen: true }).select('_id').lean(),
        Order.findOne().sort({ createdAt: -1 }).select('createdAt').lean(),
        Payment.findOne({ status: 'VERIFIED' }).sort({ verifiedAt: -1 }).select('verifiedAt').lean(),
      ])
    : [[], null, null]

  // Vendor apps join a room named after their cart (utils/socketRooms.js).
  const rooms = io?.sockets?.adapter?.rooms
  const unheard = openCarts.filter((c) => !rooms?.get(String(c._id))?.size).length

  const quiet = openCarts.length > 0 && (!lastOrder || now - lastOrder.createdAt > QUIET_HOURS * 60 * MIN)
  const razorpay = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  const fcm = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT)
  const webPush = Boolean(process.env.WEBPUSH_PUBLIC_KEY && process.env.WEBPUSH_PRIVATE_KEY)
  const reminded = feeReminders.lastRun()

  return [
    { key: 'database', label: 'Database', state: db ? 'ok' : 'bad', detail: db ? 'Connected' : 'Not connected' },
    {
      key: 'orders',
      label: 'Orders',
      state: quiet ? 'warn' : 'ok',
      detail:
        `Last order ${ago(lastOrder?.createdAt, now)}` +
        (quiet ? ` while ${openCarts.length} cart${openCarts.length > 1 ? 's are' : ' is'} open` : ''),
    },
    {
      key: 'vendorApps',
      label: 'Vendor apps',
      state: unheard ? 'warn' : 'ok',
      detail: !openCarts.length
        ? 'No carts open'
        : unheard
          ? `${unheard} of ${openCarts.length} open carts have no app connected (push still reaches them)`
          : `All ${openCarts.length} open carts connected`,
    },
    {
      key: 'payments',
      label: 'Payments',
      state: razorpay ? 'ok' : 'bad',
      detail: razorpay ? `Last fee payment ${ago(lastPayment?.verifiedAt, now)}` : 'Razorpay keys missing',
    },
    {
      key: 'push',
      label: 'Push notifications',
      state: fcm && webPush ? 'ok' : 'bad',
      detail:
        fcm && webPush
          ? 'Vendor and customer pushes on'
          : `Off: ${[!fcm && 'vendor app (FIREBASE_SERVICE_ACCOUNT)', !webPush && 'customer (WEBPUSH_*)'].filter(Boolean).join(', ')}`,
    },
    {
      key: 'feeReminders',
      label: 'Fee reminders',
      // The timer runs every 10 minutes while the server is awake.
      state: reminded && now - reminded < 25 * MIN ? 'ok' : 'warn',
      detail: reminded ? `Last run ${ago(reminded, now)}` : 'Not run since the server started',
    },
  ]
}

module.exports = { platformHealth, ago }

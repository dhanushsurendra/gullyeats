const Cart = require('../models/Cart')
const push = require('./push')
const weather = require('./weather')

const IST_MS = 5.5 * 60 * 60 * 1000
const istDay = (now) => new Date(now.getTime() + IST_MS).toISOString().slice(0, 10)
const istHour = (now) => new Date(now.getTime() + IST_MS).getUTCHours()
const istTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })

/**
 * The one weather push vendors get (GullyWeather lives on Profile): heavy
 * rain or a storm forecast at an open cart within the next 3 hours
 * (weather.heavyRainAt). At most once per cart per IST day (claimed in
 * Cart.weatherAlert, so several servers don't double up), 6am to 10pm IST
 * only, to the owner and the cart's staff. A forecast, never an official
 * warning, and the text says so.
 */
async function sendRainAlerts(now = new Date()) {
  const hour = istHour(now)
  if (hour < 6 || hour >= 22) return 0
  const day = istDay(now)

  const carts = await Cart.find({ isOpen: true, weatherAlert: { $ne: day } })
    .select('_id userId cartName location')
    .lean()

  let sent = 0
  for (const cart of carts) {
    const [lat, lng] = cart.location?.coordinates || []
    if (typeof lat !== 'number' || typeof lng !== 'number') continue
    const w = await weather.weatherNear(lat, lng, now)
    if (!w?.heavyRainAt) continue

    const claimed = await Cart.updateOne({ _id: cart._id, weatherAlert: { $ne: day } }, { $set: { weatherAlert: day } })
    if (claimed.modifiedCount !== 1) continue

    const storm = w.hourly.find((h) => h.at === w.heavyRainAt)?.condition === 'storm'
    await push.sendToUsers(
      { $or: [{ _id: cart.userId }, { role: 'staff', cartId: cart._id }] },
      {
        notification: {
          title: `${storm ? '⛈️ Thunderstorm' : '🌧️ Heavy rain'} likely around ${istTime(w.heavyRainAt)}`,
          body: `Forecast near ${cart.cartName}: cover your stall in time.`,
        },
        channelId: 'weather',
        data: { type: 'weather', cartId: String(cart._id) },
      },
    )
    sent++
  }
  return sent
}

// shortcut: an in-process timer like feeReminders; a sleeping host skips alerts while asleep.
function startRainAlerts() {
  const run = () => sendRainAlerts().catch((e) => console.error('Rain alerts failed:', e.message))
  setInterval(run, 10 * 60 * 1000).unref()
}

module.exports = { sendRainAlerts, startRainAlerts }

const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const { stub, restoreAll, q } = require('./helpers')
const Cart = require('../models/Cart')
const push = require('../utils/push')
const weather = require('../utils/weather')
const { sendRainAlerts } = require('../utils/rainAlerts')

afterEach(restoreAll)

// 2:00 PM IST on 17 Nov.
const AFTERNOON = new Date('2026-11-17T08:30:00Z')
const at = (local) => new Date(`${local}:00+05:30`).toISOString()

function setup({ heavyAt = at('2026-11-17T16:30'), condition = 'heavy_rain', claimed = 1 } = {}) {
  const sent = []
  const claims = []
  stub(Cart, 'find', () =>
    q([
      { _id: 'c1', userId: 'u1', cartName: 'Raju Chaats', location: { coordinates: [12.97, 77.6] } },
      { _id: 'c2', userId: 'u2', cartName: 'No Spot', location: {} },
    ]),
  )
  stub(Cart, 'updateOne', async (f, u) => {
    claims.push(u.$set.weatherAlert)
    return { modifiedCount: claimed }
  })
  stub(weather, 'weatherNear', async () => ({
    heavyRainAt: heavyAt,
    hourly: heavyAt ? [{ at: heavyAt, condition }] : [],
  }))
  stub(push, 'sendToUsers', async (filter, msg) => sent.push({ filter, msg }))
  return { sent, claims }
}

test('heavy rain soon: one push to the owner and staff, claimed for the day', async () => {
  const { sent, claims } = setup()
  assert.strictEqual(await sendRainAlerts(AFTERNOON), 1)
  assert.deepStrictEqual(claims, ['2026-11-17'])
  assert.deepStrictEqual(sent[0].filter, { $or: [{ _id: 'u1' }, { role: 'staff', cartId: 'c1' }] })
  assert.match(sent[0].msg.notification.title, /^🌧️ Heavy rain likely around 4:30 pm$/i)
  assert.strictEqual(sent[0].msg.notification.body, 'Forecast near Raju Chaats: cover your stall in time.')
  assert.strictEqual(sent[0].msg.channelId, 'weather')
  assert.deepStrictEqual(sent[0].msg.data, { type: 'weather', cartId: 'c1' })
})

test('a storm says thunderstorm', async () => {
  const { sent } = setup({ condition: 'storm' })
  await sendRainAlerts(AFTERNOON)
  assert.match(sent[0].msg.notification.title, /^⛈️ Thunderstorm likely/)
})

test('no heavy rain coming, a cart already told today, or night: nothing', async () => {
  let r = setup({ heavyAt: null })
  assert.strictEqual(await sendRainAlerts(AFTERNOON), 0)
  restoreAll()

  r = setup({ claimed: 0 }) // another server claimed it
  assert.strictEqual(await sendRainAlerts(AFTERNOON), 0)
  assert.strictEqual(r.sent.length, 0)
  restoreAll()

  r = setup()
  assert.strictEqual(await sendRainAlerts(new Date('2026-11-17T17:00:00Z')), 0) // 10:30 PM IST
  assert.strictEqual(await sendRainAlerts(new Date('2026-11-16T23:30:00Z')), 0) // 5 AM IST
})

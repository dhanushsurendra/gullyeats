const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const { stub, restoreAll, q } = require('./helpers')
const Cart = require('../models/Cart')
const { discoverCarts, distanceKm } = require('../utils/discoverCarts')

afterEach(restoreAll)

// Bengaluru: MG Road, Indiranagar (~4 km), Whitefield (~16 km).
const MG = [12.9756, 77.6066]
const carts = [
  { _id: 'a', cartName: 'Indiranagar Chaat', cartCity: 'Bengaluru', isOpen: false, location: { coordinates: [12.9784, 77.6408] } },
  { _id: 'b', cartName: 'MG Road Dosa', cartCity: 'Bengaluru', isOpen: true, location: { coordinates: [12.9759, 77.6070] } },
  { _id: 'c', cartName: 'Whitefield Momos', cartCity: 'Bengaluru', isOpen: true, location: { coordinates: [12.9698, 77.7500] } },
  { _id: 'd', cartName: 'Indiranagar Tea', cartCity: 'Bengaluru', isOpen: true, location: { coordinates: [12.9790, 77.6400] } },
]

let lastFilter
function setup() {
  stub(Cart, 'find', (filter) => {
    lastFilter = filter
    const re = filter.$or?.[0].cartName
    return q(carts.filter((c) => !re || re.test(c.cartName) || re.test(c.cartCity)))
  })
}

test('distance between two Bengaluru points is about right', () => {
  const d = distanceKm(MG, [12.9784, 77.6408])
  assert.ok(d > 3.5 && d < 4, String(d))
})

test('nearby: within 10 km, open carts first, then nearest; far ones left out', async () => {
  setup()
  const rows = await discoverCarts({ here: MG })
  assert.deepStrictEqual(rows.map((r) => r._id), ['b', 'd', 'a'])
  assert.strictEqual(rows[0].distanceKm, 0.1)
  assert.ok(!('location' in rows[0]) && !('userId' in rows[0]))
  // Only listed carts: active, not suspended, with a location.
  assert.deepStrictEqual(lastFilter.isActive, { $ne: false })
  assert.strictEqual(lastFilter.suspendedAt, null)
})

test('search ignores the radius and escapes regex characters', async () => {
  setup()
  const rows = await discoverCarts({ here: MG, q: 'momos' })
  assert.deepStrictEqual(rows.map((r) => r._id), ['c'])
  await discoverCarts({ here: null, q: 'a.*(' })
  assert.strictEqual(lastFilter.$or[0].cartName.source, 'a\\.\\*\\(')
})

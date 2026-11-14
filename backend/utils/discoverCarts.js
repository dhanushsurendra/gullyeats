const Cart = require('../models/Cart')

// The customer app's home page: carts near the customer and/or matching a
// search. Only public details go out; the customer's position is used to
// sort and is never stored.

const RADIUS_KM = 10
const LIMIT = 20

// Great-circle distance in km between two [lat, lng] points.
function distanceKm([lat1, lng1], [lat2, lng2]) {
  const rad = (d) => (d * Math.PI) / 180
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * [here] is [lat, lng] or null; [q] a search over name, city and address.
 * With a position and no search: carts within RADIUS_KM. Open carts first,
 * then nearest; search results without a position: open first, then by name.
 */
async function discoverCarts({ here, q }) {
  const filter = {
    isActive: { $ne: false },
    suspendedAt: null,
    'location.coordinates.1': { $exists: true },
  }
  const words = String(q || '').trim().slice(0, 60)
  if (words) {
    const re = new RegExp(escape(words), 'i')
    filter.$or = [{ cartName: re }, { cartCity: re }, { address: re }]
  }
  // shortcut: distances are worked out in JS over every listed cart (coordinates are [lat, lng], so no 2dsphere index); add a [lng, lat] field with an index past a few thousand carts.
  const carts = await Cart.find(filter)
    .select('cartName cartCity address cartImageUrl isOpen location.coordinates')
    .lean()

  const rows = carts.map((c) => ({
    _id: c._id,
    cartName: c.cartName,
    cartCity: c.cartCity,
    address: c.address || '',
    cartImageUrl: c.cartImageUrl || null,
    isOpen: Boolean(c.isOpen),
    distanceKm: here ? Math.round(distanceKm(here, c.location.coordinates) * 10) / 10 : null,
  }))

  return rows
    .filter((r) => words || !here || r.distanceKm <= RADIUS_KM)
    .sort(
      (a, b) =>
        b.isOpen - a.isOpen ||
        (here ? a.distanceKm - b.distanceKm : a.cartName.localeCompare(b.cartName)),
    )
    .slice(0, LIMIT)
}

module.exports = { discoverCarts, distanceKm, RADIUS_KM }

/*
 * Inserts 2,000 users, carts, menu items and orders, plus the counters and
 * platform-fee payments those orders imply, into the database in .env.
 * Truth lines are left alone. Remove everything again with unseed.js.
 *
 *   node scripts/seed.js
 *
 * Counters and payments can't be exactly 2,000: there is one counter per
 * cart per day that had orders, and one payment per cart per paid day.
 * Inventing extra ones would make the data inconsistent.
 *
 * Fake vendors have phone numbers starting with 00 (no real Indian mobile
 * does) and no PIN, so nobody can log in as them.
 */
const mongoose = require('mongoose')
const { SEED_TAG, DAY, FEE, istDate, istMidnight } = require('./seedCommon')
const User = require('../models/User')
const Cart = require('../models/Cart')
const MenuItem = require('../models/Menu')
const Order = require('../models/Order')
const Counter = require('../models/Counter')
const Payment = require('../models/Payment')

const N = 2000
const BUSY_CARTS = 200 // carts with a menu and orders; the rest are newly onboarded
const ITEMS_PER_CART = N / BUSY_CARTS
const DAYS = 21

// Deterministic randomness, so a re-seed produces the same data.
let s = 20261106
const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296)
const int = (a, b) => a + Math.floor(rand() * (b - a + 1))
const pick = (list) => list[Math.floor(rand() * list.length)]
const chance = (p) => rand() < p
const id = () => new mongoose.Types.ObjectId()

const FIRST = ['Raju', 'Lakshmi', 'Imran', 'Priya', 'Suresh', 'Kavya', 'Arjun', 'Fatima', 'Venkat', 'Meena', 'Ravi', 'Anjali', 'Sandeep', 'Divya', 'Kiran']
const LAST = ['Reddy', 'Sharma', 'Khan', 'Naidu', 'Iyer', 'Patel', 'Rao', 'Gupta', 'Das', 'Singh']
const CART_WORD = ['Chaat Corner', 'Tiffins', 'Dosa Point', 'Biryani Cart', 'Momos', 'Juice Stall', 'Rolls', 'Pav Bhaji', 'Chai Adda', 'Fast Food']
const CITIES = [
  { city: 'Hyderabad', lat: 17.385, lng: 78.4867, areas: ['Ameerpet', 'Kukatpally', 'Madhapur', 'Dilsukhnagar'] },
  { city: 'Bengaluru', lat: 12.9716, lng: 77.5946, areas: ['Indiranagar', 'Jayanagar', 'Koramangala', 'Malleshwaram'] },
  { city: 'Chennai', lat: 13.0827, lng: 80.2707, areas: ['T Nagar', 'Adyar', 'Mylapore', 'Velachery'] },
  { city: 'Mumbai', lat: 19.076, lng: 72.8777, areas: ['Dadar', 'Andheri', 'Bandra', 'Ghatkopar'] },
]
const DISHES = [
  ['Pani Puri', 40, true], ['Masala Dosa', 70, true], ['Idli Vada', 50, true], ['Veg Biryani', 120, true],
  ['Chicken Biryani', 180, false], ['Egg Roll', 60, false], ['Chicken Momos', 100, false], ['Veg Momos', 80, true],
  ['Pav Bhaji', 90, true], ['Vada Pav', 25, true], ['Masala Chai', 15, true], ['Sweet Lassi', 40, true],
  ['Chicken 65', 150, false], ['Mutton Kheema Pav', 160, false], ['Gobi Manchurian', 90, true], ['Samosa', 20, true],
]
const FEEDBACK = ['Tasty food 😋', 'Quick service ⚡', 'Good value 💰', 'Wait felt long ⏳', "I'll be back 🔁"]

// Casts and applies schema defaults, fails on anything the schema rejects,
// then tags the document.
async function doc(Model, data) {
  const m = new Model(data)
  await m.validate().catch((err) => {
    throw new Error(`${Model.modelName}: ${err.message}`)
  })
  return { ...m.toObject({ depopulate: true }), seed: SEED_TAG }
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI)
  if (await Cart.collection.countDocuments({ seed: SEED_TAG })) {
    throw new Error('Seed data is already there. Run scripts/unseed.js first.')
  }

  const now = new Date()
  const today = istMidnight(now)
  const created = (t) => ({ createdAt: t, updatedAt: t })

  // ---- users: 1,800 vendors, 200 staff (one per busy cart) ----
  const users = []
  for (let i = 0; i < N; i++) {
    const role = i < N - BUSY_CARTS ? 'vendor' : 'staff'
    users.push({
      _id: id(),
      userId: `${role === 'vendor' ? 'VEN' : 'STF'}-Z${i.toString(36).toUpperCase().padStart(5, '0')}`,
      phoneNumber: `00${String(i).padStart(8, '0')}`,
      name: `${pick(FIRST)} ${pick(LAST)}`,
      role,
      isVerified: true,
      ...created(new Date(+today - int(25, 90) * DAY)),
    })
  }
  const vendors = users.filter((u) => u.role === 'vendor')
  const staff = users.filter((u) => u.role === 'staff')

  // ---- carts: every vendor owns one; the first 200 vendors own a second ----
  const carts = []
  for (let i = 0; i < N; i++) {
    const owner = vendors[i % vendors.length]
    const c = pick(CITIES)
    const lat = +(c.lat + (rand() - 0.5) * 0.2).toFixed(6)
    const lng = +(c.lng + (rand() - 0.5) * 0.2).toFixed(6)
    const busy = i < BUSY_CARTS
    carts.push({
      _id: id(),
      cartName: `${pick(FIRST)}'s ${pick(CART_WORD)}`,
      cartCity: c.city,
      cartId: `CRT-Z${i.toString(36).toUpperCase().padStart(5, '0')}`,
      address: `${int(1, 300)}, ${int(1, 12)}th Cross, ${pick(c.areas)}, ${c.city}, ${int(500001, 600099)}`,
      // Stored [lat, lng], like the onboarding app does (see CLAUDE.md).
      location: { type: 'Point', coordinates: [lat, lng] },
      userId: owner._id,
      parcelCharge: pick([0, 5, 10, 15]),
      isActive: busy ? true : chance(0.9),
      isOpen: busy ? chance(0.5) : chance(0.2),
      ...created(new Date(Math.max(+owner.createdAt, +today - int(22, 60) * DAY))),
    })
  }
  const busyCarts = carts.slice(0, BUSY_CARTS)
  staff.forEach((u, i) => (u.cartId = busyCarts[i]._id))

  // ---- menu: 10 dishes for each busy cart ----
  const menu = []
  const menuByCart = new Map()
  for (const cart of busyCarts) {
    const dishes = [...DISHES].sort(() => rand() - 0.5).slice(0, ITEMS_PER_CART)
    const items = dishes.map(([name, price, isVeg]) => ({
      _id: id(),
      name,
      price: price + pick([0, 0, 5, 10]),
      isVeg,
      cartId: cart._id,
      isInStock: chance(0.9),
      ...created(cart.createdAt),
    }))
    menu.push(...items)
    menuByCart.set(String(cart._id), items)
  }

  // ---- orders over the last 21 IST days, today included ----
  const orders = []
  for (let k = 0; k < N; k++) {
    const cart = busyCarts[k % BUSY_CARTS]
    const daysAgo = int(0, DAYS - 1)
    const dayStart = new Date(+today - daysAgo * DAY)
    // Mostly 11am to midnight; today only up to now.
    const placed =
      daysAgo === 0
        ? new Date(+dayStart + rand() * (now - dayStart))
        : new Date(+dayStart + (11 + rand() * 13) * 60 * 60 * 1000)

    const items = [...menuByCart.get(String(cart._id))]
      .sort(() => rand() - 0.5)
      .slice(0, int(1, 4))
      .map((m) => ({ menuItemId: m._id, name: m.name, price: m.price, quantity: int(1, 3) }))
    const orderType = chance(0.6) ? 'QR' : 'MANUAL'
    // Customers can't add a parcel charge; the vendor adds it on manual orders.
    const parcelCharge = orderType === 'MANUAL' && chance(0.3) ? cart.parcelCharge : 0
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const totalPrice = subtotal + parcelCharge + FEE

    let status = daysAgo === 0
      ? pick(['PENDING', 'PENDING', 'PAID', 'SERVED', 'SERVED', 'SERVED', 'CANCELLED'])
      : chance(0.75) ? 'SERVED' : chance(0.6) ? 'CANCELLED' : chance(0.8) ? 'PENDING' : 'PAID'
    let paidAt = null
    let servedAt
    let paymentAdjustment = null
    const cancelledAfterPaying = status === 'CANCELLED' && chance(0.5)
    if (['PAID', 'SERVED'].includes(status) || cancelledAfterPaying) {
      paidAt = new Date(+placed + int(1, 10) * 60 * 1000)
      if (paidAt > now) [status, paidAt] = ['PENDING', null]
    }
    if (status === 'SERVED') {
      servedAt = new Date(+paidAt + int(4, 25) * 60 * 1000)
      if (servedAt > now) [status, servedAt] = ['PAID', undefined]
    }
    if (status === 'CANCELLED' && paidAt) {
      paymentAdjustment = { oldTotal: totalPrice, newTotal: 0, difference: -totalPrice, action: 'RETURN', amount: totalPrice }
    }
    const updated = servedAt || paidAt || placed

    orders.push({
      _id: id(),
      cartId: cart._id,
      orderItems: items,
      subtotal,
      parcelCharge,
      platformFee: FEE,
      totalPrice,
      status,
      orderType,
      paymentAdjustment,
      phoneNumber: orderType === 'QR' && chance(0.5) ? `00${int(10000000, 99999999)}` : null,
      paidAt,
      servedAt,
      paidAmount: paidAt ? totalPrice : 0,
      feedback: status === 'SERVED' && chance(0.2) ? FEEDBACK.filter(() => chance(0.4)).join(' · ') || pick(FEEDBACK) : null,
      orderDate: placed,
      createdAt: placed,
      updatedAt: updated,
    })
  }

  // Token numbers count up per cart per IST day; counters hold the last one.
  orders.sort((a, b) => a.createdAt - b.createdAt)
  const counters = new Map()
  for (const o of orders) {
    const key = `cart-${o.cartId}-${istDate(o.createdAt)}`
    const c = counters.get(key) || { _id: key, cartId: o.cartId, seq: 0 }
    o.orderNumber = ++c.seq
    counters.set(key, c)
  }

  // ---- platform-fee payments, one per cart per finished paid day ----
  // Billable = not cancelled and paid, billed on the IST day it was paid
  // (utils/cartPaymentLock.js billableOrders).
  const payments = []
  for (const cart of busyCarts) {
    const byDay = new Map()
    for (const o of orders) {
      if (String(o.cartId) !== String(cart._id) || o.status === 'CANCELLED' || !o.paidAt) continue
      const day = +istMidnight(o.paidAt)
      if (day >= +today) continue // today's bill isn't final yet
      if (!byDay.has(day)) byDay.set(day, [])
      byDay.get(day).push(o)
    }
    const days = [...byDay.keys()].sort((a, b) => a - b)
    // Most vendors are paid up; some are behind, some have a payment stuck pending.
    const habit = rand()
    const unpaid = habit < 0.7 ? 0 : Math.min(days.length, int(1, 3))
    const paidDays = days.slice(0, days.length - unpaid)
    const pendingDay = habit >= 0.85 && unpaid ? days[paidDays.length] : null
    const owner = cart.userId

    for (const day of [...paidDays, ...(pendingDay ? [pendingDay] : [])]) {
      const dayOrders = byDay.get(day)
      const verified = day !== pendingDay
      const verifiedAt = new Date(day + DAY + int(30, 115) * 60 * 1000) // 12:30–1:55am next day
      const ref = `SEED-${String(cart._id).slice(-8)}-${istDate(new Date(day))}`
      payments.push({
        _id: id(),
        cartId: cart._id,
        userId: owner,
        cartName: cart.cartName,
        totalOrders: dayOrders.length,
        amount: dayOrders.length * FEE,
        status: verified ? 'VERIFIED' : 'PENDING',
        paymentReference: ref,
        razorpayOrderId: verified ? `order_${ref}` : null,
        razorpayPaymentId: verified ? `pay_${ref}` : null,
        verificationSource: verified ? pick(['CHECKOUT_CALLBACK', 'WEBHOOK']) : null,
        verifiedAt: verified ? verifiedAt : null,
        billingDate: new Date(day),
        orderIds: dayOrders.map((o) => o._id),
        createdAt: new Date(+verifiedAt - 60 * 1000),
      })
    }
  }

  const batches = [
    [User, users],
    [Cart, carts],
    [MenuItem, menu],
    [Order, orders],
    [Counter, [...counters.values()]],
    [Payment, payments],
  ]
  for (const [Model, rows] of batches) {
    const docs = await Promise.all(rows.map((r) => doc(Model, r)))
    await Model.collection.insertMany(docs, { ordered: true })
    console.log(`${Model.collection.name}: inserted ${docs.length}`)
  }
  await mongoose.disconnect()
}

main().catch(async (e) => {
  console.error('Seeding failed:', e.message)
  console.error('Anything already inserted is tagged; run scripts/unseed.js to remove it.')
  await mongoose.disconnect()
  process.exit(1)
})

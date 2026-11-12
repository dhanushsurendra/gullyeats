/*
 * Checks the seeded data (scripts/seed.js) is correct, then checks the
 * backend's own reports agree with totals worked out here from the raw rows:
 * the vendor sales report, the cart payment lock and the admin overview.
 *
 *   node scripts/verify.js
 */
const mongoose = require('mongoose')
const { SEED_TAG, DAY, FEE, istDate, istMidnight } = require('./seedCommon')
const User = require('../models/User')
const Cart = require('../models/Cart')
const MenuItem = require('../models/Menu')
const Order = require('../models/Order')
const Counter = require('../models/Counter')
const Payment = require('../models/Payment')
const { getCartPaymentStatus } = require('../utils/cartPaymentLock')
const { getSalesDashboard } = require('../controllers/salesController')
const admin = require('../controllers/adminController')
const { call } = require('../test/helpers')

const failures = []
let checks = 0
function expect(ok, what) {
  checks++
  if (!ok && failures.length < 50) failures.push(what)
  if (!ok && failures.length === 50) failures.push('…more failures not shown')
}
const sum = (list, f) => list.reduce((a, x) => a + f(x), 0)
const groupBy = (list, f) => list.reduce((m, x) => m.set(f(x), [...(m.get(f(x)) || []), x]), new Map())
const isPaid = (o) => ['PAID', 'SERVED'].includes(o.status)
const billable = (o) => o.status !== 'CANCELLED' && (o.paidAt || isPaid(o))

async function main() {
  await mongoose.connect(process.env.MONGO_URI)
  const tagged = { seed: SEED_TAG }
  const [users, carts, menu, orders, counters, payments] = await Promise.all(
    [User, Cart, MenuItem, Order, Counter, Payment].map((M) => M.collection.find(tagged).toArray()),
  )
  console.log({ users: users.length, carts: carts.length, menuitems: menu.length, orders: orders.length, counters: counters.length, payments: payments.length })

  // 1. Every row passes its schema.
  for (const [M, rows] of [[User, users], [Cart, carts], [MenuItem, menu], [Order, orders], [Counter, counters], [Payment, payments]]) {
    for (const r of rows) {
      const err = await new M(r).validate().then(() => null, (e) => e)
      expect(!err, `${M.modelName} ${r._id} fails schema: ${err?.message}`)
    }
  }

  // 2. References point at real rows of the right kind.
  const userById = new Map(users.map((u) => [String(u._id), u]))
  const cartById = new Map(carts.map((c) => [String(c._id), c]))
  const menuById = new Map(menu.map((m) => [String(m._id), m]))
  const orderById = new Map(orders.map((o) => [String(o._id), o]))
  for (const c of carts) expect(userById.get(String(c.userId))?.role === 'vendor', `cart ${c._id} owner isn't a seeded vendor`)
  for (const u of users.filter((x) => x.role === 'staff')) expect(cartById.has(String(u.cartId)), `staff ${u._id} has no cart`)
  for (const m of menu) expect(cartById.has(String(m.cartId)), `menu item ${m._id} has no cart`)
  expect(new Set(users.map((u) => u.phoneNumber)).size === users.length, 'duplicate phone numbers')
  expect(users.every((u) => /^00\d{8}$/.test(u.phoneNumber)), 'a seeded phone number could be a real mobile')
  expect(users.every((u) => !u.pinHash), 'a seeded user has a PIN, so it could be logged into')

  // 3. Each order adds up and its status, times and money agree.
  const now = new Date()
  for (const o of orders) {
    const where = `order ${o._id}`
    expect(cartById.has(String(o.cartId)), `${where} has no cart`)
    for (const i of o.orderItems) {
      const m = menuById.get(String(i.menuItemId))
      expect(m && String(m.cartId) === String(o.cartId), `${where} has an item from another cart`)
      expect(m && m.name === i.name && m.price === i.price, `${where} item name/price differs from the menu`)
    }
    const subtotal = sum(o.orderItems, (i) => i.price * i.quantity)
    expect(o.subtotal === subtotal, `${where} subtotal ${o.subtotal} ≠ ${subtotal}`)
    expect(o.platformFee === FEE, `${where} platform fee ${o.platformFee}`)
    expect(o.totalPrice === subtotal + o.parcelCharge + FEE, `${where} total doesn't add up`)
    expect(o.orderType === 'MANUAL' || o.parcelCharge === 0, `${where} QR order has a parcel charge`)
    expect(o.parcelCharge === 0 || o.parcelCharge === cartById.get(String(o.cartId)).parcelCharge, `${where} parcel charge isn't the cart's`)
    expect(+o.createdAt <= +now && +o.createdAt === +o.orderDate, `${where} placed in the future or orderDate ≠ createdAt`)
    expect(isPaid(o) ? !!o.paidAt : true, `${where} is ${o.status} without paidAt`)
    expect(o.status === 'PENDING' ? !o.paidAt : true, `${where} is PENDING but has paidAt`)
    expect((o.status === 'SERVED') === !!o.servedAt, `${where} servedAt doesn't match status`)
    expect(!o.paidAt || (o.paidAt > o.createdAt && o.paidAt <= now), `${where} paid before it was placed or in the future`)
    expect(!o.servedAt || (o.servedAt > o.paidAt && o.servedAt <= now), `${where} served before paid or in the future`)
    expect(o.paidAmount === (o.paidAt ? o.totalPrice : 0), `${where} paidAmount wrong`)
    const refund = o.status === 'CANCELLED' && o.paidAt
    expect(refund ? o.paymentAdjustment?.action === 'RETURN' && o.paymentAdjustment.amount === o.totalPrice : !o.paymentAdjustment,
      `${where} refund (paymentAdjustment) wrong`)
    expect(!o.feedback || o.status === 'SERVED', `${where} has feedback but wasn't served`)
  }

  // 4. Tokens run 1, 2, 3… per cart per IST day, and the counter holds the last.
  const counterById = new Map(counters.map((c) => [c._id, c]))
  const byCartDay = groupBy(orders, (o) => `cart-${o.cartId}-${istDate(o.createdAt)}`)
  expect(byCartDay.size === counters.length, `${byCartDay.size} cart-days with orders but ${counters.length} counters`)
  for (const [key, list] of byCartDay) {
    const numbers = list.sort((a, b) => a.createdAt - b.createdAt).map((o) => o.orderNumber)
    expect(numbers.every((n, i) => n === i + 1), `${key} token numbers aren't 1..${list.length} in time order`)
    expect(counterById.get(key)?.seq === list.length, `${key} counter ≠ ${list.length}`)
  }

  // 5. Each payment bills exactly the billable orders of the days it covers
  // (fromDate through billingDate; older payments: billingDate only) at ₹2 each.
  const today = istMidnight(now)
  for (const p of payments) {
    const where = `payment ${p.paymentReference}`
    const cart = cartById.get(String(p.cartId))
    expect(cart && String(cart.userId) === String(p.userId) && cart.cartName === p.cartName, `${where} cart/owner/name mismatch`)
    expect(+p.billingDate === +istMidnight(p.billingDate) && p.billingDate < today, `${where} billingDate isn't a finished IST midnight`)
    const first = +(p.fromDate || p.billingDate)
    const expected = orders.filter((o) => String(o.cartId) === String(p.cartId) && billable(o) &&
      +istMidnight(o.paidAt) >= first && +istMidnight(o.paidAt) <= +p.billingDate)
    const billed = p.orderIds.map(String).sort()
    expect(JSON.stringify(billed) === JSON.stringify(expected.map((o) => String(o._id)).sort()), `${where} orderIds ≠ its days' billable orders`)
    expect(p.totalOrders === expected.length && p.amount === expected.length * FEE, `${where} amount ${p.amount} ≠ ${expected.length * FEE}`)
    expect(p.orderIds.every((x) => orderById.has(String(x))), `${where} references a missing order`)
    expect(p.status === 'VERIFIED' ? p.verifiedAt >= +p.billingDate + DAY : !p.verifiedAt, `${where} verified before its day ended`)
  }
  for (const [cartId, list] of groupBy(payments, (p) => String(p.cartId))) {
    expect(list.filter((p) => p.status === 'PENDING').length <= 1, `cart ${cartId} has more than one PENDING payment`)
  }

  // 6. The lock the vendor app would see, worked out independently: one bill
  // from the oldest unpaid day through yesterday (or just today), locked 26h
  // after that oldest day began. A started checkout doesn't change it.
  const activeCarts = [...new Set(orders.map((o) => String(o.cartId)))]
  let locked = 0
  for (const cartId of activeCarts) {
    const mine = payments.filter((p) => String(p.cartId) === cartId)
    const lastPaid = Math.max(-Infinity, ...mine.filter((p) => p.status === 'VERIFIED').map((p) => +p.billingDate))
    const open = orders.filter((o) => String(o.cartId) === cartId && billable(o) && +istMidnight(o.paidAt) >= lastPaid + DAY)
    const nextDay = open.length ? Math.min(...open.map((o) => +istMidnight(o.paidAt))) : null
    const through = nextDay !== null && nextDay < +today ? +today - DAY : nextDay
    const want = nextDay === null
      ? { isLocked: false, totalPending: 0 }
      : {
          isLocked: now - nextDay >= 26 * 60 * 60 * 1000,
          totalPending: FEE * open.filter((o) => +istMidnight(o.paidAt) >= nextDay && +istMidnight(o.paidAt) <= through).length,
        }
    const got = await getCartPaymentStatus(cartId)
    if (got.isLocked) locked++
    expect(got.isLocked === want.isLocked && got.totalPending === want.totalPending,
      `cart ${cartId} lock: backend ${JSON.stringify({ isLocked: got.isLocked, totalPending: got.totalPending })}, expected ${JSON.stringify(want)}`)
  }

  // 7. The vendor sales report over the whole seeded period.
  const startDate = istDate(new Date(+today - 20 * DAY))
  const endDate = istDate(now)
  const fields = ['revenue', 'subtotalRevenue', 'parcelRevenue', 'platformFeeRevenue', 'totalOrders', 'pendingOrders', 'paidOrders',
    'servedOrders', 'cancelledOrders', 'highestOrder', 'lowestOrder', 'totalItemsSold', 'highestItemsInOrder', 'uniqueItemsSold',
    'qrOrders', 'manualOrders', 'qrRevenue', 'manualRevenue', 'parcelOrders']
  for (const cartId of activeCarts) {
    const mine = orders.filter((o) => String(o.cartId) === cartId)
    const paid = mine.filter(isPaid)
    const items = (o) => sum(o.orderItems, (i) => i.quantity)
    const count = (s) => mine.filter((o) => o.status === s).length
    const want = {
      revenue: sum(paid, (o) => o.totalPrice), subtotalRevenue: sum(paid, (o) => o.subtotal),
      parcelRevenue: sum(paid, (o) => o.parcelCharge), platformFeeRevenue: sum(paid, (o) => o.platformFee),
      totalOrders: mine.length, pendingOrders: count('PENDING'), paidOrders: count('PAID'), servedOrders: count('SERVED'),
      cancelledOrders: count('CANCELLED'),
      highestOrder: paid.length ? Math.max(...paid.map((o) => o.totalPrice)) : 0,
      lowestOrder: paid.length ? Math.min(...paid.map((o) => o.totalPrice)) : 0,
      totalItemsSold: sum(paid, items), highestItemsInOrder: paid.length ? Math.max(...paid.map(items)) : 0,
      uniqueItemsSold: new Set(paid.flatMap((o) => o.orderItems.map((i) => String(i.menuItemId)))).size,
      qrOrders: paid.filter((o) => o.orderType === 'QR').length, manualOrders: paid.filter((o) => o.orderType === 'MANUAL').length,
      qrRevenue: sum(paid.filter((o) => o.orderType === 'QR'), (o) => o.totalPrice),
      manualRevenue: sum(paid.filter((o) => o.orderType === 'MANUAL'), (o) => o.totalPrice),
      parcelOrders: paid.filter((o) => o.parcelCharge > 0).length,
    }
    const r = await call(getSalesDashboard, { params: { cartId }, query: { startDate, endDate }, user: { _id: new mongoose.Types.ObjectId(), role: 'admin' } })
    expect(r.status === 200, `sales report for ${cartId} failed: ${r.body?.message}`)
    for (const f of fields) {
      expect(r.body?.data?.[f] === want[f], `sales report ${cartId} ${f}: backend ${r.body?.data?.[f]}, expected ${want[f]}`)
    }
  }

  // 8. Admin overview, last 30 days. Counts every order in the database,
  // so the expectation does too.
  const since = new Date(+today - 29 * DAY)
  const all = await Order.collection.find({ createdAt: { $gte: since } }).toArray()
  const r = await call(admin.overview, { query: { range: '30d' }, user: { role: 'admin' } })
  const find = (obj, key) =>
    obj && typeof obj === 'object'
      ? key in obj ? obj[key] : Object.values(obj).map((v) => find(v, key)).find((v) => v !== undefined)
      : undefined
  const gmv = sum(all.filter(isPaid), (o) => o.totalPrice)
  expect(find(r.body, 'orderGmvRange') === gmv, `admin GMV (30d): backend ${find(r.body, 'orderGmvRange')}, expected ${gmv}`)

  console.log(`\nCarts locked for unpaid fees: ${locked} of ${activeCarts.length} carts with orders`)
  console.log(`Paid orders: ${orders.filter(isPaid).length}, GMV ₹${sum(orders.filter(isPaid), (o) => o.totalPrice)}, cancelled ${orders.filter((o) => o.status === 'CANCELLED').length}, pending ${orders.filter((o) => o.status === 'PENDING').length}`)
  console.log(failures.length ? `\n${failures.length} problem(s) in ${checks} checks:\n- ${failures.join('\n- ')}` : `\nAll ${checks} checks passed.`)
  await mongoose.disconnect()
  process.exit(failures.length ? 1 : 0)
}

main().catch(async (e) => {
  console.error(e)
  await mongoose.disconnect()
  process.exit(1)
})

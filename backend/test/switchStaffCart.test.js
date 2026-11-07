const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const { call, stub, restoreAll, q } = require('./helpers')
const Cart = require('../models/Cart')
const User = require('../models/User')
const MenuItem = require('../models/Menu')
const cartCtl = require('../controllers/cartController')
const { switchStaffCart, addStaff, deleteStaff, getPresignedUploadUrlForMenuItem } = cartCtl
const { getSalesDashboard } = require('../controllers/salesController')
process.env.RAZORPAY_KEY_ID ||= 'rzp_test_dummy'
process.env.RAZORPAY_KEY_SECRET ||= 'dummy_secret'
const pay = require('../controllers/paymentController')

afterEach(restoreAll)

const carts = {
  a: { _id: 'a', userId: 'owner1' },
  b: { _id: 'b', userId: 'owner1' },
  x: { _id: 'x', userId: 'owner2' },
}

function setup(staffDoc) {
  stub(Cart, 'findById', (id) => q(carts[id] || null))
  stub(User, 'findById', (id) => {
    if (id === 'staff1') return q(staffDoc)
    if (id === 'staffCaller') return q({ cartId: 'a' })
    return q(null)
  })
}

test('owner can move their staff between their carts', async () => {
  const staff = { _id: 'staff1', role: 'staff', cartId: 'a', save: async () => {} }
  setup(staff)
  const r = await call(switchStaffCart, {
    params: { staffId: 'staff1' }, body: { cartId: 'b' }, user: { _id: 'owner1', role: 'vendor' },
  })
  assert.strictEqual(r.status, 200)
  assert.strictEqual(staff.cartId, 'b')
})

test('another vendor cannot move staff onto their own cart', async () => {
  const staff = { _id: 'staff1', role: 'staff', cartId: 'a', save: async () => {} }
  setup(staff)
  const r = await call(switchStaffCart, {
    params: { staffId: 'staff1' }, body: { cartId: 'x' }, user: { _id: 'owner2', role: 'vendor' },
  })
  assert.strictEqual(r.status, 403)
  assert.strictEqual(staff.cartId, 'a')
})

test('vendor accounts cannot be switched', async () => {
  setup({ _id: 'staff1', role: 'vendor', cartId: 'a' })
  const r = await call(switchStaffCart, {
    params: { staffId: 'staff1' }, body: { cartId: 'a' }, user: { _id: 'owner1', role: 'vendor' },
  })
  assert.strictEqual(r.status, 404)
})

test('staff of cart a cannot move a colleague to cart b', async () => {
  const staff = { _id: 'staff1', role: 'staff', cartId: 'a', save: async () => {} }
  setup(staff)
  const r = await call(switchStaffCart, {
    params: { staffId: 'staff1' }, body: { cartId: 'b' }, user: { _id: 'staffCaller', role: 'staff' },
  })
  assert.strictEqual(r.status, 403)
})

test('staff cannot add, remove or move staff', async () => {
  const staff = { _id: 'staff1', role: 'staff', cartId: 'a', save: async () => {}, deleteOne: async () => {} }
  setup(staff)
  // deleteStaff looks the member up as findById({ _id }).
  const byId = User.findById
  stub(User, 'findById', (id) => byId(id?._id ?? id))
  const user = { _id: 'staffCaller', role: 'staff' }
  let r = await call(addStaff, { params: { cartId: 'a' }, body: { name: 'New', phoneNumber: '9876543210' }, user })
  assert.strictEqual(r.status, 403)
  r = await call(deleteStaff, { params: { staffId: 'staff1' }, user })
  assert.strictEqual(r.status, 403)
  r = await call(switchStaffCart, { params: { staffId: 'staff1' }, body: { cartId: 'b' }, user })
  assert.strictEqual(r.status, 403)
})

test('uploads must be images', async () => {
  setup(null)
  const user = { _id: 'owner1', role: 'vendor' }
  for (const fileType of ['text/html', undefined]) {
    const r = await call(getPresignedUploadUrlForMenuItem, { params: { cartId: 'a' }, body: { fileType }, user })
    assert.strictEqual(r.status, 400)
  }
})

test("staff can't edit the menu or cart, or see sales and fee bills, but can mark stock", async () => {
  setup(null)
  const user = { _id: 'staffCaller', role: 'staff' }
  const params = { cartId: 'a', itemId: 'm1' }
  for (const handler of [
    cartCtl.addMenuItem,
    cartCtl.updateMenuItem,
    cartCtl.deleteMenuItem,
    cartCtl.updateCart,
    cartCtl.updateCartImage,
    pay.getPaymentHistory,
    pay.getPaymentOverview,
  ]) {
    const query = { startDate: '2026-11-01', endDate: '2026-11-07' }
    const r = await call(handler, { params, query, body: { name: 'Tea', price: 10 }, user })
    assert.strictEqual(r.status, 403, handler.name)
  }

  // Sales checks the id's format first, so it gets a real ObjectId for cart a.
  stub(Cart, 'findById', () => q(carts.a))
  const sales = await call(getSalesDashboard, {
    params: { cartId: '507f1f77bcf86cd799439011' },
    query: { startDate: '2026-11-01', endDate: '2026-11-07' },
    user,
  })
  assert.strictEqual(sales.status, 403)

  stub(MenuItem, 'findOneAndUpdate', async () => ({ _id: 'm1', isInStock: false }))
  const r = await call(cartCtl.updateMenuItemStock, { params, body: { isInStock: false }, user })
  assert.strictEqual(r.status, 200)
})

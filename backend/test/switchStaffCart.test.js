const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const { call, stub, restoreAll, q } = require('./helpers')
const Cart = require('../models/Cart')
const User = require('../models/User')
const { switchStaffCart } = require('../controllers/cartController')

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

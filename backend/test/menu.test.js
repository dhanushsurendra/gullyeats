const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const { call, stub, restoreAll, q } = require('./helpers')
const Cart = require('../models/Cart')
const User = require('../models/User')
const MenuItem = require('../models/Menu')
const { s3Client } = require('../utils/s3Client')
const translit = require('../utils/transliterate')
const c = require('../controllers/cartController')

afterEach(restoreAll)
process.env.BUCKET_NAME = 'bucket'

const owner = { _id: 'owner1', role: 'vendor' }
const prefix = 'https://bucket.s3.amazonaws.com/uploads/cart1/menu/'

function setup(item) {
  stub(Cart, 'findById', () => q({ _id: 'cart1', userId: 'owner1' }))
  stub(User, 'findById', () => q(null))
  stub(MenuItem, 'findOne', () => q(item))
  const deleted = []
  stub(s3Client, 'send', async (cmd) => deleted.push(cmd.input.Key))
  stub(translit, 'transliterate', async (names) => names.map((n) => ({ hi: `hi:${n}`, kn: `kn:${n}` })))
  return deleted
}

test('update ignores cartId and the client oldImageUrl, deletes only the stored image', async () => {
  const item = { name: 'Dosa', price: 40, cartId: 'cart1', imageUrl: `${prefix}old.jpg`, save: async () => {} }
  const deleted = setup(item)
  const r = await call(c.updateMenuItem, {
    user: owner,
    params: { cartId: 'cart1' },
    body: { id: 'i1', cartId: 'other', price: 50, imageUrl: `${prefix}new.jpg`, oldImageUrl: 'https://bucket.s3.amazonaws.com/qrs/x.png' },
  })
  assert.strictEqual(r.status, 201)
  assert.strictEqual(item.cartId, 'cart1')
  assert.strictEqual(item.price, 50)
  assert.deepStrictEqual(deleted, ['uploads/cart1/menu/old.jpg'])
})

test('update rejects bad prices and foreign image URLs', async () => {
  const item = { name: 'Dosa', price: 40, save: async () => {} }
  setup(item)
  let r = await call(c.updateMenuItem, { user: owner, params: { cartId: 'cart1' }, body: { id: 'i1', price: -1 } })
  assert.strictEqual(r.status, 400)
  r = await call(c.updateMenuItem, { user: owner, params: { cartId: 'cart1' }, body: { id: 'i1', imageUrl: 'https://bucket.s3.amazonaws.com/qrs/x.png' } })
  assert.strictEqual(r.status, 400)
  assert.strictEqual(item.price, 40)
})

test('menu writes need someone who manages the cart', async () => {
  setup({ save: async () => {} })
  const r = await call(c.addMenuItem, {
    user: { _id: 'someone', role: 'vendor' },
    params: { cartId: 'cart1' },
    body: { name: 'Tea', price: 10 },
  })
  assert.strictEqual(r.status, 403)
})

test('add keeps the in-stock flag and trims the name', async () => {
  setup(null)
  stub(MenuItem, 'create', async (doc) => doc)
  const r = await call(c.addMenuItem, {
    user: owner,
    params: { cartId: 'cart1' },
    body: { name: '  Tea ', price: '10', isInStock: false, isVeg: true },
  })
  assert.strictEqual(r.status, 201)
  assert.deepStrictEqual(r.body.data, {
    name: 'Tea', price: 10, isInStock: false, isVeg: true, cartId: 'cart1', names: { hi: 'hi:Tea', kn: 'kn:Tea' },
  })
  const bad = await call(c.addMenuItem, { user: owner, params: { cartId: 'cart1' }, body: { name: '   ', price: 10 } })
  assert.strictEqual(bad.status, 400)
})

test('staff see the cart they are assigned to', async () => {
  stub(User, 'findOne', () => q({ _id: 'staff1', role: 'staff', cartId: 'cart1' }))
  let filter
  stub(Cart, 'find', (f) => { filter = f; return q([{ _id: 'cart1' }]) })
  const r = await call(c.getAllCarts, { user: { _id: 'staff1', role: 'staff' }, params: { userId: 'staff1' } })
  assert.strictEqual(r.status, 200)
  assert.deepStrictEqual(filter, { _id: 'cart1' })
})

test('toggle-cart-status sets the requested state', async () => {
  const cart = { _id: 'cart1', userId: 'owner1', isOpen: true, save: async () => {} }
  stub(Cart, 'findById', () => q(cart))
  await call(c.toggleCartStatus, { user: owner, params: { cartId: 'cart1' }, body: { isOpen: true } })
  assert.strictEqual(cart.isOpen, true)
  await call(c.toggleCartStatus, { user: owner, params: { cartId: 'cart1' }, body: { isOpen: false } })
  assert.strictEqual(cart.isOpen, false)
})

test('renaming an item rewrites its names; the vendor spelling wins', async () => {
  const item = { name: 'Dosa', names: { hi: 'old', kn: 'old', ta: 'old' }, save: async () => {} }
  setup(item)
  let r = await call(c.updateMenuItem, { user: owner, params: { cartId: 'cart1' }, body: { id: 'i1', price: 30 } })
  assert.strictEqual(r.status, 201)
  assert.strictEqual(item.names.hi, 'old')

  r = await call(c.updateMenuItem, {
    user: owner,
    params: { cartId: 'cart1' },
    body: { id: 'i1', name: 'Masala Dosa', names: { kn: ' ಮಸಾಲೆ ದೋಸೆ ' } },
  })
  assert.strictEqual(r.status, 201)
  assert.deepStrictEqual(item.names, { hi: 'hi:Masala Dosa', kn: 'ಮಸಾಲೆ ದೋಸೆ' })

  for (const names of [{ fr: 'x' }, { hi: 5 }, ['x'], { ta: 'x'.repeat(101) }]) {
    r = await call(c.updateMenuItem, { user: owner, params: { cartId: 'cart1' }, body: { id: 'i1', names } })
    assert.strictEqual(r.status, 400)
  }
})

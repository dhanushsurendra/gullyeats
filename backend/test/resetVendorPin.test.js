const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const bcrypt = require('bcrypt')
const User = require('../models/User')
const { resetVendorPin } = require('../controllers/adminController')
const { call, stub, restoreAll } = require('./helpers')

afterEach(restoreAll)

test('admin reset sets a new hashed 4-digit PIN for the vendor', async () => {
  const user = { userId: 'VEN-AB12CD', role: 'vendor', save: async () => {} }
  let query
  stub(User, 'findOne', async (q) => { query = q; return user })

  const res = await call(resetVendorPin, { params: { vendorId: ' ven-ab12cd ' } })

  assert.equal(res.status, 200)
  assert.deepEqual(query, { userId: 'VEN-AB12CD', role: 'vendor' })
  assert.match(res.body.data.pin, /^\d{4}$/)
  assert.ok(await bcrypt.compare(res.body.data.pin, user.pinHash))
})

test('unknown vendor ID is a 404', async () => {
  stub(User, 'findOne', async () => null)
  const res = await call(resetVendorPin, { params: { vendorId: 'VEN-NOPE' } })
  assert.equal(res.status, 404)
})

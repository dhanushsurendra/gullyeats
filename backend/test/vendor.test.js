const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const express = require('express')
const jwt = require('jsonwebtoken')
const { call, stub, restoreAll, q } = require('./helpers')
const User = require('../models/User')
const Cart = require('../models/Cart')
const errorHandler = require('../middlewares/errorHandler')
const vendorRoutes = require('../routes/vendorRoutes')
const { sendOtp, verifyOtp, changePin } = require('../controllers/vendorController')

afterEach(restoreAll)
process.env.JWT_SECRET = 'test-secret'

async function withServer(fn) {
  const app = express()
  app.use(express.json())
  app.use('/api/vendors', vendorRoutes)
  app.use(errorHandler)
  const server = app.listen(0)
  try {
    await fn(`http://127.0.0.1:${server.address().port}/api/vendors`)
  } finally {
    server.close()
  }
}

test('login is limited to 10 failed attempts per account', async () => {
  stub(User, 'findOne', () => q(null))
  await withServer(async (base) => {
    const post = (id) =>
      fetch(`${base}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorIdentifier: id, pin: '0000' }),
      })
    for (let i = 0; i < 10; i++) assert.strictEqual((await post('VEN-1')).status, 401)
    assert.strictEqual((await post('VEN-1')).status, 429)
    assert.strictEqual((await post('VEN-2')).status, 401)
  })
})

test('change-pin needs a login token', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/change-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin: '1111', newPin: '2222', id: 'someone' }),
    })
    assert.strictEqual(r.status, 401)
  })
})

test('change-pin changes the logged-in user, not a body id', async () => {
  let looked
  const user = { pinHash: await require('bcrypt').hash('1111', 4), save: async () => {} }
  stub(User, 'findById', (id) => { looked = id; return q(user) })
  const r = await call(changePin, {
    user: { _id: 'me', role: 'vendor' },
    body: { currentPin: '1111', newPin: '2222', id: 'someone-else' },
  })
  assert.strictEqual(r.status, 200)
  assert.strictEqual(looked, 'me')
  const bad = await call(changePin, { user: { _id: 'me' }, body: { currentPin: '1111', newPin: '12a4' } })
  assert.strictEqual(bad.status, 400)
})

test('OTP login is refused for admin and staff accounts', async () => {
  stub(User, 'findOne', () => q({ role: 'admin', save: async () => {} }))
  const r = await call(sendOtp, { body: { phoneNumber: '9999999999', role: 'vendor' } })
  assert.strictEqual(r.status, 403)
  assert.strictEqual(r.body.otp, undefined)
})

test('OTP is refused once a vendor has a finished outlet, but works while onboarding', async () => {
  const user = { _id: 'v1', role: 'vendor', save: async () => {} }
  stub(User, 'findOne', () => q(user))
  let finished = true
  stub(Cart, 'exists', async (filter) => {
    assert.strictEqual(filter.userId, 'v1')
    return finished ? { _id: 'c1' } : null
  })

  let r = await call(sendOtp, { body: { phoneNumber: '9999999999', role: 'vendor' } })
  assert.strictEqual(r.status, 409)
  assert.strictEqual(r.body.otp, undefined)
  r = await call(verifyOtp, { body: { phoneNumber: '9999999999', otp: '123456' } })
  assert.strictEqual(r.status, 409)

  finished = false
  r = await call(sendOtp, { body: { phoneNumber: '9999999999', role: 'vendor' } })
  assert.strictEqual(r.status, 200)
  assert.match(r.body.otp, /^\d{6}$/)
})

test('vendor login tokens expire', async () => {
  const bcrypt = require('bcrypt')
  const user = { _id: 'u1', role: 'vendor', pinHash: await bcrypt.hash('1234', 4) }
  stub(User, 'findOne', () => q(user))
  const { vendorLogin } = require('../controllers/vendorController')
  const r = await call(vendorLogin, { body: { vendorIdentifier: 'VEN-9', pin: '1234' } })
  assert.strictEqual(r.status, 200)
  assert.ok(jwt.decode(r.body.token).exp)
})

test('admin data needs an admin login', async () => {
  const adminRoutes = require('../routes/adminRoutes')
  const cookieParser = require('cookie-parser')
  const app = express()
  app.use(cookieParser())
  app.use('/api/admin', adminRoutes)
  const server = app.listen(0)
  const base = `http://127.0.0.1:${server.address().port}/api/admin`
  try {
    assert.strictEqual((await fetch(`${base}/owners`)).status, 401)
    const vendor = jwt.sign({ _id: 'v', role: 'vendor' }, process.env.JWT_SECRET)
    const r = await fetch(`${base}/owners`, { headers: { Cookie: `token=${vendor}` } })
    assert.strictEqual(r.status, 403)
  } finally {
    server.close()
  }
})

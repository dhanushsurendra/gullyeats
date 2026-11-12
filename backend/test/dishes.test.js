// New dish names: tracked per cart, reviewed by an admin, image copied to S3.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
process.env.PIXABAY_API_KEY = 'test-key'
process.env.BUCKET_NAME = 'test-bucket'
const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert')
const express = require('express')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

const FoodName = require('../models/FoodName')
const DishCandidate = require('../models/DishCandidate')
const AdminAction = require('../models/AdminAction')
const User = require('../models/User')
const translit = require('../utils/transliterate')
const { s3Client } = require('../utils/s3Client')
const { dishKey, trackDishes, forgetKnown, defaultImages } = require('../utils/dishCandidates')
const sharp = require('sharp')
const MenuItem = require('../models/Menu')
const { call } = require('./helpers')
const { getMenuItems } = require('../controllers/cartController')
const errorHandler = require('../middlewares/errorHandler')

let mongo, server, base, photo
const realFetch = global.fetch
const uploads = []
const pixabayCalls = []

before(async () => {
  photo = await sharp({ create: { width: 640, height: 427, channels: 3, background: '#c84' } }).jpeg().toBuffer()
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
  // No Google, Pixabay or S3 in tests.
  translit.transliterate = async (names) => names.map((n) => ({ hi: `hi:${n}`, kn: `kn:${n}`, ta: `ta:${n}` }))
  s3Client.send = async (cmd) => { uploads.push(cmd.input) }
  global.fetch = async (url, opts) => {
    const u = String(url)
    if (u.startsWith('https://pixabay.com/api/')) {
      pixabayCalls.push(u)
      const hits = [1, 2, 3].map((id) => ({
        id, previewURL: `https://cdn.pixabay.com/p${id}_150.jpg`, webformatURL: `https://pixabay.com/get/w${id}_640.jpg`,
        tags: 'food', pageURL: `https://pixabay.com/photos/${id}`,
      }))
      return new Response(JSON.stringify({ hits }), { status: 200 })
    }
    if (u.startsWith('https://pixabay.com/get/')) {
      return new Response(photo, { status: 200, headers: { 'content-type': 'image/jpeg' } })
    }
    return realFetch(url, opts)
  }
  const app = express()
  app.use(express.json())
  app.use('/api/admin', require('../routes/adminRoutes'))
  app.use(errorHandler)
  server = app.listen(0)
  base = `http://127.0.0.1:${server.address().port}/api/admin`
})
after(async () => {
  global.fetch = realFetch
  server.close()
  await mongoose.disconnect()
  await mongo.stop()
})

const adminId = new mongoose.Types.ObjectId()
const admin = jwt.sign({ _id: String(adminId), role: 'admin' }, process.env.JWT_SECRET)
const carts = [1, 2, 3, 4].map(() => new mongoose.Types.ObjectId())

beforeEach(async () => {
  for (const m of [FoodName, DishCandidate, AdminAction, User, MenuItem]) await m.collection.deleteMany({})
  await FoodName.collection.insertOne({ _id: 'pani puri', name: 'Pani Puri', hi: 'पानी पूरी', popularity: 9, reviewed: true })
  uploads.length = 0
  pixabayCalls.length = 0
  forgetKnown()
})

async function api(method, path, body, token = admin) {
  const r = await fetch(base + path, {
    method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body && JSON.stringify(body),
  })
  return { status: r.status, body: await r.json() }
}

test('dishKey ignores sizes, "spl", brackets and punctuation', () => {
  assert.strictEqual(dishKey('Spl. Masala Dosa (Half)'), 'masala dosa')
  assert.strictEqual(dishKey('  Paneer  Roll 2 pcs '), 'paneer roll')
  assert.strictEqual(dishKey('Jumbo Vada-Pav'), 'vada pav')
})

test('a name is counted once per cart, listed dishes are never tracked, and it shows at 3 carts', async () => {
  await trackDishes(carts[0], [{ name: 'Pani Puri' }, { name: 'Kulhad Chai' }])
  await trackDishes(carts[0], [{ name: 'kulhad chai' }])
  await trackDishes(carts[1], [{ name: 'Kulhad Chai (Large)' }])
  assert.strictEqual(await DishCandidate.exists({ _id: 'pani puri' }), null)
  assert.strictEqual((await api('GET', '/dishes')).body.data.length, 0, 'two carts: not yet')

  await trackDishes(carts[2], [{ name: 'Kulhad Chai' }])
  const [row] = (await api('GET', '/dishes')).body.data
  assert.strictEqual(row.id, 'kulhad chai')
  assert.strictEqual(row.name, 'Kulhad Chai')
  assert.strictEqual(row.carts, 3)
})

test('the spelling most vendors typed is suggested, else the automatic one; near-duplicates point to the dish', async () => {
  await trackDishes(carts[0], [{ name: 'Pani Poori', names: { hi: 'पानी पूड़ी' } }])
  await trackDishes(carts[1], [{ name: 'Pani Poori', names: { hi: 'पानी पूड़ी' } }])
  await trackDishes(carts[2], [{ name: 'Pani Poori', names: { hi: 'पाणी पूरी' } }])
  const [row] = (await api('GET', '/dishes')).body.data
  assert.strictEqual(row.spellings.hi, 'पानी पूड़ी')
  assert.strictEqual(row.spellings.kn, 'kn:Pani Poori')
  assert.deepStrictEqual(row.typed, ['hi'])
  assert.strictEqual(row.similar, 'Pani Puri')
})

async function threeCarts(name) {
  for (const c of carts.slice(0, 3)) await trackDishes(c, [{ name }])
}

test('approve adds a checked dish with the picked Pixabay image copied to S3', async () => {
  await threeCarts('Kulhad Chai')
  const imgs = await api('GET', '/dishes/kulhad%20chai/images')
  assert.strictEqual(imgs.status, 200)
  assert.deepStrictEqual(imgs.body.data.map((i) => i.id), [1, 2, 3])
  assert.strictEqual(imgs.body.data[0].web, undefined, 'download URLs stay on the server')

  const r = await api('POST', '/dishes/kulhad%20chai/approve', { name: 'Kulhad Chai', hi: 'कुल्हड़ चाय', imageId: 2 })
  assert.strictEqual(r.status, 200)
  assert.strictEqual(uploads.length, 1)
  assert.strictEqual(uploads[0].Key, 'dish-images/kulhad-chai.jpg')
  assert.strictEqual(uploads[0].Bucket, 'test-bucket')
  assert.strictEqual(pixabayCalls.length, 1, 'the search is cached, not repeated for the upload')
  const meta = await sharp(uploads[0].Body).metadata()
  assert.deepStrictEqual([meta.format, meta.width, meta.height], ['jpeg', 480, 400], 'cropped to the thumbnail shape')

  const dish = await FoodName.findById('kulhad chai').lean()
  assert.strictEqual(dish.hi, 'कुल्हड़ चाय')
  assert.strictEqual(dish.ta, 'ta:Kulhad Chai', 'missing spellings are filled automatically')
  assert.strictEqual(dish.image, 'dish-images/kulhad-chai.jpg')
  assert.strictEqual(dish.reviewed, true)
  assert.strictEqual((await DishCandidate.findById('kulhad chai')).status, 'APPROVED')
  assert.strictEqual((await AdminAction.findOne({ action: 'APPROVE_DISH' })).target.label, 'Kulhad Chai')

  // Now a listed dish: a fourth cart using it is not tracked again.
  await trackDishes(carts[3], [{ name: 'Kulhad Chai' }])
  assert.strictEqual((await DishCandidate.findById('kulhad chai')).carts.length, 3)
  assert.strictEqual((await api('POST', '/dishes/kulhad%20chai/approve', { name: 'Kulhad Chai' })).status, 409)
})

test('only an image from our own search can be uploaded; approving without one is fine', async () => {
  await threeCarts('Kulhad Chai')
  const bad = await api('POST', '/dishes/kulhad%20chai/approve', { name: 'Kulhad Chai', imageId: 999 })
  assert.strictEqual(bad.status, 400)
  const url = await api('POST', '/dishes/kulhad%20chai/approve', { name: 'Kulhad Chai', imageId: 'https://evil.example/x.jpg' })
  assert.strictEqual(url.status, 400)
  assert.strictEqual(uploads.length, 0)
  const ok = await api('POST', '/dishes/kulhad%20chai/approve', { name: 'Kulhad Chai' })
  assert.strictEqual(ok.status, 200)
  assert.strictEqual((await FoodName.findById('kulhad chai').lean()).image, undefined)
})

test('merge makes it another name of a listed dish; reject keeps it out; both only once', async () => {
  await threeCarts('Golgappa')
  assert.strictEqual((await api('POST', '/dishes/golgappa/merge', { into: 'Nope' })).status, 404)
  const m = await api('POST', '/dishes/golgappa/merge', { into: 'Pani Puri' })
  assert.strictEqual(m.status, 200)
  assert.deepStrictEqual((await FoodName.findById('pani puri').lean()).aliases, ['golgappa'])
  await trackDishes(carts[3], [{ name: 'Golgappa' }])
  assert.strictEqual((await DishCandidate.findById('golgappa')).carts.length, 3, 'an alias is not tracked again')
  assert.strictEqual((await api('POST', '/dishes/golgappa/reject')).status, 409)

  await threeCarts('Ramesh Combo Special')
  assert.strictEqual((await api('POST', '/dishes/ramesh/reject')).status, 200)
  assert.strictEqual((await DishCandidate.findById('ramesh')).status, 'REJECTED')
  assert.strictEqual((await api('GET', '/dishes')).body.data.length, 0)
})

test('the Dishes routes are admins only', async () => {
  const vendor = jwt.sign({ _id: String(new mongoose.Types.ObjectId()), role: 'vendor' }, process.env.JWT_SECRET)
  await User.collection.insertOne({ _id: new mongoose.Types.ObjectId(jwt.decode(vendor)._id), role: 'vendor', userId: 'VEN-DISH1', phoneNumber: '9000000123' })
  assert.strictEqual((await fetch(base + '/dishes')).status, 401)
  assert.strictEqual((await api('GET', '/dishes', undefined, vendor)).status, 403)
})

test('items without a photo get the dish default: exact name, alias, or a dish named inside it', async () => {
  await FoodName.collection.insertMany([
    { _id: 'masala dosa', name: 'Masala Dosa', image: 'dish-images/masala-dosa.jpg' },
    { _id: 'dosa', name: 'Dosa', image: 'dish-images/dosa.jpg' },
  ])
  await FoodName.collection.updateOne({ _id: 'pani puri' }, { $set: { image: 'dish-images/pani-puri.jpg', aliases: ['golgappa'] } })
  forgetKnown()
  const imageFor = await defaultImages()
  const s3 = 'https://test-bucket.s3.amazonaws.com/dish-images/'
  assert.strictEqual(imageFor('Masala Dosa'), s3 + 'masala-dosa.jpg')
  assert.strictEqual(imageFor('Spl Butter Masala Dosa (Half)'), s3 + 'masala-dosa.jpg', 'the longest dish named inside wins')
  assert.strictEqual(imageFor('Plain Dosa'), s3 + 'dosa.jpg')
  assert.strictEqual(imageFor('Golgappa'), s3 + 'pani-puri.jpg')
  assert.strictEqual(imageFor('Dosai Special'), null, 'only whole words match')
  assert.strictEqual(imageFor('Kulhad Chai'), null)

  process.env.IMAGE_BASE_URL = 'https://cdn.example.net'
  assert.strictEqual(imageFor('Dosa'), 'https://cdn.example.net/dish-images/dosa.jpg', 'CloudFront later is one setting')
  delete process.env.IMAGE_BASE_URL

  const cartId = new mongoose.Types.ObjectId()
  await MenuItem.collection.insertMany([
    { cartId, name: 'Masala Dosa', price: 60 },
    { cartId, name: 'Pani Puri', price: 30, imageUrl: 'https://test-bucket.s3.amazonaws.com/uploads/x/menu/own.jpg' },
    { cartId, name: 'Kulhad Chai', price: 20 },
  ])
  const r = await call(getMenuItems, { params: { cartId: String(cartId) } })
  const byName = Object.fromEntries(r.body.data.map((i) => [i.name, i]))
  assert.strictEqual(byName['Masala Dosa'].defaultImage, s3 + 'masala-dosa.jpg')
  assert.strictEqual(byName['Pani Puri'].defaultImage, undefined, 'their own photo wins')
  assert.strictEqual(byName['Kulhad Chai'].defaultImage, null)
})

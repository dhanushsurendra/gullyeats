/*
 * QA test data on the database in .env (the live Atlas DB during testing).
 *
 *   node scripts/qa.js setup     creates/refreshes the QA admin, writes its login
 *                                to customer-app/e2e/qa-secrets.local (gitignored)
 *   node scripts/qa.js cleanup   deletes everything the QA tests created
 *   node scripts/qa.js backdate <cartId> [days]
 *                                moves a QA cart's orders back by days (default 2),
 *                                so device tests get an unpaid fee bill to pay
 *
 * QA rows are recognised by phone prefix 00999 or 60000999 (vendors, staff, customers) and
 * the QA admin email, so seeded and real data are never touched.
 */
require('dotenv').config({ quiet: true })
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

// 00999: API tests. 60000999: device tests through screens that only take a
// valid Indian mobile number (nothing is texted: the SMS app only opens a draft).
const QA_PHONE = /^(00999|60000999)/
const QA_ADMIN = 'qa-admin@gullyeats.test'
const SECRETS = path.join(__dirname, '../../customer-app/e2e/qa-secrets.local')

async function setup(db) {
  const password = crypto.randomBytes(12).toString('base64url')
  await db.collection('users').updateOne(
    { email: QA_ADMIN },
    {
      $set: { role: 'admin', name: 'QA Admin', pinHash: await bcrypt.hash(password, 10), isVerified: true },
      $setOnInsert: { phoneNumber: '0099900000', createdAt: new Date() },
    },
    { upsert: true },
  )
  fs.writeFileSync(SECRETS, JSON.stringify({ adminEmail: QA_ADMIN, adminPassword: password }, null, 2))
  console.log(`QA admin ready; login saved to ${SECRETS}`)
}

async function cleanup(db) {
  const users = await db.collection('users').find({ phoneNumber: QA_PHONE }).project({ _id: 1, email: 1 }).toArray()
  const carts = await db.collection('carts').distinct('_id', { userId: { $in: users.map((u) => u._id) } })
  const orders = await db.collection('orders').distinct('_id', { $or: [{ cartId: { $in: carts } }, { phoneNumber: QA_PHONE }] })
  const plan = {
    confessioncomments: { orderId: { $in: orders } },
    confessions: { orderId: { $in: orders } },
    gamescores: { orderId: { $in: orders } },
    orders: { _id: { $in: orders } },
    menuitems: { cartId: { $in: carts } },
    payments: { cartId: { $in: carts } },
    counters: { cartId: { $in: carts } },
    carts: { _id: { $in: carts } },
    // The QA admin stays so its login keeps working between runs.
    users: { phoneNumber: QA_PHONE, email: { $ne: QA_ADMIN } },
  }
  for (const [name, filter] of Object.entries(plan)) {
    const { deletedCount } = await db.collection(name).deleteMany(filter)
    if (deletedCount) console.log(`${name}: ${deletedCount} deleted`)
  }
  // Dish names the QA tests make all start with "QA " (key "qa ...").
  const dishes = await db.collection('dishcandidates').deleteMany({ _id: /^qa / })
  const listed = await db.collection('foodnames').deleteMany({ _id: /^qa / })
  await db.collection('foodnames').updateMany({ aliases: /^qa / }, { $pull: { aliases: /^qa / } })
  if (dishes.deletedCount || listed.deletedCount) console.log(`dishes: ${dishes.deletedCount} proposed, ${listed.deletedCount} listed deleted`)
}

async function backdate(db) {
  const [cartId, days = '2'] = process.argv.slice(3)
  const cart = await db.collection('carts').findOne({ _id: new mongoose.Types.ObjectId(cartId) })
  const owner = cart && (await db.collection('users').findOne({ _id: cart.userId }))
  // Only ever on a QA vendor's cart.
  if (!owner || !QA_PHONE.test(owner.phoneNumber || '')) throw new Error(`${cartId} is not a QA cart`)
  const ms = Number(days) * 24 * 3600 * 1000
  const orders = await db.collection('orders').find({ cartId: cart._id }).toArray()
  for (const o of orders) {
    const $set = {}
    for (const k of ['createdAt', 'orderDate', 'paidAt', 'servedAt', 'preparingAt', 'updatedAt']) {
      if (o[k] instanceof Date) $set[k] = new Date(o[k].getTime() - ms)
    }
    await db.collection('orders').updateOne({ _id: o._id }, { $set })
  }
  console.log(`backdated ${orders.length} orders by ${days} days`)
}

const commands = { setup, cleanup, backdate }
const cmd = process.argv[2]
if (!commands[cmd]) {
  console.error('Usage: node scripts/qa.js setup|cleanup|backdate <cartId> [days]')
  process.exit(1)
}
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => commands[cmd](mongoose.connection.db))
  .then(() => mongoose.disconnect())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

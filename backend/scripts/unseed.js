// Removes everything scripts/seed.js inserted.   node scripts/unseed.js
const mongoose = require('mongoose')
const { SEED_TAG } = require('./seedCommon')

async function main() {
  await mongoose.connect(process.env.MONGO_URI)
  const db = mongoose.connection.db
  const seededCarts = await db.collection('carts').distinct('_id', { seed: SEED_TAG })
  for (const name of ['payments', 'counters', 'orders', 'menuitems', 'carts', 'users']) {
    // Payments are also matched by cart: the app may have written untagged
    // ones for seeded carts (e.g. auto-settling a ₹0 day).
    const filter =
      name === 'payments' ? { $or: [{ seed: SEED_TAG }, { cartId: { $in: seededCarts } }] } : { seed: SEED_TAG }
    const { deletedCount } = await db.collection(name).deleteMany(filter)
    console.log(`${name}: deleted ${deletedCount}`)
  }
  await mongoose.disconnect()
}

main().catch(async (e) => {
  console.error(e.message)
  await mongoose.disconnect()
  process.exit(1)
})

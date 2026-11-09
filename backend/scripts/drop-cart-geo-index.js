// Drops the old 2dsphere index on carts.location (see models/Cart.js), which
// refused carts east of 90°E.   node scripts/drop-cart-geo-index.js
const mongoose = require('mongoose')

async function main() {
  await mongoose.connect(process.env.MONGO_URI)
  const carts = mongoose.connection.db.collection('carts')
  const geo = (await carts.indexes()).filter((i) => Object.values(i.key).includes('2dsphere'))
  for (const { name } of geo) {
    await carts.dropIndex(name)
    console.log(`dropped ${name}`)
  }
  if (!geo.length) console.log('no 2dsphere index on carts')
  await mongoose.disconnect()
}

main().catch(async (e) => {
  console.error(e.message)
  await mongoose.disconnect()
  process.exit(1)
})

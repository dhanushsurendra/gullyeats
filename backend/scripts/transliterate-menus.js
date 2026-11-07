// Fills names.{hi,kn,ta} on menu items saved before transliteration existed.
// Safe to re-run: only touches items missing a language.
//   node scripts/transliterate-menus.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')
const MenuItem = require('../models/Menu')
const { transliterate, LANGS } = require('../utils/transliterate')

async function main() {
  await mongoose.connect(process.env.MONGO_URI)
  const items = await MenuItem.find({ $or: LANGS.map((l) => ({ [`names.${l}`]: { $in: [null, ''] } })) })
    .select('name names')
    .lean()
  console.log(`${items.length} items to fill`)

  // transliterate() dedupes and caches, so the same name across carts costs one lookup.
  const BATCH = 500
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH)
    const names = await transliterate(batch.map((item) => item.name))
    // Keep whatever spelling the item already has (it may be the vendor's own).
    const kept = (item) => Object.fromEntries(Object.entries(item.names || {}).filter(([, v]) => v))
    await MenuItem.bulkWrite(
      batch.map((item, j) => ({
        updateOne: { filter: { _id: item._id }, update: { $set: { names: { ...names[j], ...kept(item) } } } },
      })),
    )
    console.log(`${Math.min(i + BATCH, items.length)} / ${items.length}`)
  }
  await mongoose.disconnect()
}

main().catch(async (e) => {
  console.error(e.message)
  await mongoose.disconnect()
  process.exit(1)
})

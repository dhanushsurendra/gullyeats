// Loads data/food_names.json into the FoodName collection. Safe to re-run:
// entries marked reviewed in the database are left alone.
//   node scripts/seed-food-names.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')
const FoodName = require('../models/FoodName')
const names = require('../data/food_names.json')

async function main() {
  await mongoose.connect(process.env.MONGO_URI)
  const reviewed = new Set(await FoodName.distinct('_id', { reviewed: true }))
  const ops = names
    .map((n) => ({ ...n, _id: n.name.toLowerCase() }))
    .filter((n) => !reviewed.has(n._id))
    .map((n) => ({ replaceOne: { filter: { _id: n._id }, replacement: n, upsert: true } }))
  const r = await FoodName.bulkWrite(ops)
  console.log(`inserted ${r.upsertedCount}, updated ${r.modifiedCount}, kept ${reviewed.size} reviewed`)
  await mongoose.disconnect()
}

main().catch(async (e) => {
  console.error(e.message)
  await mongoose.disconnect()
  process.exit(1)
})

const mongoose = require('mongoose')

// Common menu item names with their spelling in each script, suggested to
// vendors as they type a new item. Loaded by scripts/seed-food-names.js.
const foodNameSchema = new mongoose.Schema(
  {
    _id: String, // lowercased name
    name: { type: String, required: true },
    hi: String,
    kn: String,
    ta: String,
    // How many sources listed it; suggestions are sorted by this.
    popularity: { type: Number, default: 0 },
    // Set once a native speaker has checked the spellings; reseeding skips it.
    reviewed: { type: Boolean, default: false },
  },
  { versionKey: false },
)

module.exports = mongoose.model('FoodName', foodNameSchema)

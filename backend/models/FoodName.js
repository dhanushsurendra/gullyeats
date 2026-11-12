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
    // Other names vendors use for the same dish ("golgappa" for Pani Puri),
    // stored as dishKey(); they never get their own entry.
    aliases: { type: [String], default: undefined },
    // S3 key of the default photo (e.g. dish-images/pani-puri.jpg), shown when
    // an item has none. A key, not a URL, so the image host can change.
    image: String,
  },
  { versionKey: false },
)

module.exports = mongoose.model('FoodName', foodNameSchema)

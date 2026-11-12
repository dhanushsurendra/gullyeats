const mongoose = require('mongoose')

// A dish name vendors use that is not in the common list (FoodName). Once 3
// different carts use it, an admin approves it into the list, merges it as
// another name of an existing dish, or rejects it (Dishes page).
const dishCandidateSchema = new mongoose.Schema(
  {
    _id: String, // dishKey(name)
    name: { type: String, required: true }, // as the first vendor typed it
    carts: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    // Spellings vendors typed themselves, one entry per cart (their latest).
    corrections: {
      type: [{ _id: false, cartId: mongoose.Schema.Types.ObjectId, hi: String, kn: String, ta: String }],
      default: [],
    },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'MERGED', 'REJECTED'], default: 'PENDING' },
    mergedInto: String,
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    resolvedAt: Date,
  },
  { versionKey: false },
)

dishCandidateSchema.index({ status: 1, lastSeen: -1 })

module.exports = mongoose.model('DishCandidate', dishCandidateSchema)

const mongoose = require('mongoose')

// Cache of Google's transliterations, keyed by the lowercased English name.
// Holds machine output only, never a vendor's edit, so one cart can't change
// what another cart gets.
const transliterationSchema = new mongoose.Schema(
  {
    _id: String,
    hi: String,
    kn: String,
    ta: String,
  },
  { versionKey: false },
)

module.exports = mongoose.model('Transliteration', transliterationSchema)

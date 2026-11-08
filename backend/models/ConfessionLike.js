const mongoose = require('mongoose')

// One like per poster per confession (the unique index stops duplicates).
const likeSchema = new mongoose.Schema(
  {
    confessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Confession', required: true },
    authorKey: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

likeSchema.index({ confessionId: 1, authorKey: 1 }, { unique: true })

module.exports = mongoose.model('ConfessionLike', likeSchema)

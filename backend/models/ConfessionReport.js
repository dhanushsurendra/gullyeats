const mongoose = require('mongoose')
const { REPORT_REASONS } = require('./Confession')

// A community report on a confession or comment. One per poster per item.
const reportSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['confession', 'comment'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    authorKey: { type: String, required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

reportSchema.index({ targetId: 1, authorKey: 1 }, { unique: true })
// An item's report history.
reportSchema.index({ targetId: 1, createdAt: -1 })

module.exports = mongoose.model('ConfessionReport', reportSchema)

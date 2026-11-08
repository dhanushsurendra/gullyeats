const mongoose = require('mongoose')

// A poster an admin has stopped from posting, commenting, liking and reporting.
const banSchema = new mongoose.Schema(
  {
    authorKey: { type: String, required: true, unique: true },
    until: { type: Date, required: true },
    reason: { type: String, required: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

module.exports = mongoose.model('ConfessionBan', banSchema)

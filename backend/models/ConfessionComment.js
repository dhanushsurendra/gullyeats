const mongoose = require('mongoose')
const { shared } = require('./Confession')

// A comment on a confession. Same statuses and moderation as confessions.
const commentSchema = new mongoose.Schema(
  {
    ...shared,
    confessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Confession', required: true },
    // The confession's own poster wrote it: shown as an "Author" badge.
    byAuthor: { type: Boolean, default: false },
  },
  { timestamps: true },
)

// A confession's comments, oldest first.
commentSchema.index({ confessionId: 1, status: 1, createdAt: 1, _id: 1 })
// Admin queues, newest first.
commentSchema.index({ status: 1, createdAt: -1, _id: -1 })
commentSchema.index({ authorKey: 1, createdAt: -1 })

module.exports = mongoose.model('ConfessionComment', commentSchema)

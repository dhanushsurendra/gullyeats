const mongoose = require('mongoose')

/*
 * GullyPulse confessions. Public responses never include authorKey, orderId
 * or cartId: see toPublic in controllers/confessionController.js.
 *
 * status:
 *   PUBLISHED       in the feed
 *   PENDING_REVIEW  the word filter wasn't sure; waits for an admin
 *   REPORTED        hidden after REPORT_THRESHOLD unique reports; waits for an admin
 *   BLOCKED         the word filter refused it; kept for admins only
 *   REJECTED        an admin refused it before it was published
 *   REMOVED         an admin took it down after it was published
 */
const STATUSES = ['PUBLISHED', 'PENDING_REVIEW', 'REPORTED', 'BLOCKED', 'REJECTED', 'REMOVED']
const REPORT_REASONS = ['abusive', 'sexual', 'hate', 'harassment', 'personal_info', 'spam', 'other']

// What the word filter found, kept for the admin view.
const moderationSchema = new mongoose.Schema(
  {
    verdict: { type: String, enum: ['ALLOW', 'REVIEW', 'BLOCK'] },
    reason: String,
    matches: [
      {
        _id: false,
        term: String,
        found: String,
        category: String,
        severity: String,
        kind: String,
      },
    ],
  },
  { _id: false },
)

// Fields confessions and comments share.
const shared = {
  publicId: { type: String, required: true, unique: true },
  text: { type: String, required: true, trim: true },
  status: { type: String, enum: STATUSES, required: true },
  // HMAC of the poster's phone (or order id). Ties a poster's posts, likes,
  // reports and bans together without storing who they are.
  authorKey: { type: String, required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  cartId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cart' },
  moderation: { type: moderationSchema, default: () => ({}) },
  reportCount: { type: Number, default: 0 },
  // reason → number of reports giving it.
  reportReasons: { type: Map, of: Number, default: () => ({}) },
  textHash: String,
  publishedAt: { type: Date, default: null },
}

const confessionSchema = new mongoose.Schema(
  {
    ...shared,
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    // Popularity with decay, recomputed on every like or comment (see hotScore).
    hot: { type: Number, default: 0 },
  },
  { timestamps: true },
)

// The feed: published posts by popularity.
confessionSchema.index({ status: 1, hot: -1, _id: -1 })
// Admin queues, newest first.
confessionSchema.index({ status: 1, createdAt: -1, _id: -1 })
// Duplicate check and a poster's history.
confessionSchema.index({ authorKey: 1, createdAt: -1 })

module.exports = mongoose.model('Confession', confessionSchema)
module.exports.STATUSES = STATUSES
module.exports.REPORT_REASONS = REPORT_REASONS
module.exports.shared = shared

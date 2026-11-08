const Confession = require('../models/Confession')

/*
 * Feed rank: hot = log10(1 + likes + 2·comments) + publishedAt(ms) / HOT_DIVISOR.
 * HOT_DIVISOR is 12.5 hours, so a post needs 10× the engagement to stay level
 * with one 12.5 hours newer: old posts sink, new ones get seen first.
 */
const HOT_DIVISOR = 45000 * 1000

// An update pipeline that adds `inc` (e.g. { likeCount: 1 }) without going
// below 0, then recomputes hot from the stored counts, in one atomic write.
function hotUpdate(inc = {}) {
  const set = {}
  for (const [field, delta] of Object.entries(inc)) {
    set[field] = { $max: [0, { $add: [{ $ifNull: [`$${field}`, 0] }, delta] }] }
  }
  const score = {
    $add: [
      { $log10: { $add: [1, { $ifNull: ['$likeCount', 0] }, { $multiply: [2, { $ifNull: ['$commentCount', 0] }] }] } },
      { $divide: [{ $toLong: { $ifNull: ['$publishedAt', '$createdAt'] } }, HOT_DIVISOR] },
    ],
  }
  return [...(Object.keys(set).length ? [{ $set: set }] : []), { $set: { hot: score } }]
}

// Mongoose refuses update pipelines unless asked.
const PIPELINE = { updatePipeline: true }

// commentCount counts published comments only; call on every change in or out of PUBLISHED.
const bumpCommentCount = (confessionId, delta) =>
  Confession.updateOne({ _id: confessionId }, hotUpdate({ commentCount: delta }), PIPELINE)

module.exports = { HOT_DIVISOR, PIPELINE, hotUpdate, bumpCommentCount }

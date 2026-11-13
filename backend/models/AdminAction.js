const mongoose = require('mongoose')

/*
 * Who did what from the admin dashboard (and what the server did on its own,
 * like refunding a duplicate fee payment). Kept so a disputed charge, an
 * unlocked cart or a reset PIN can be traced back to a person and a time.
 */
const adminActionSchema = new mongoose.Schema(
  {
    // null for actions the server took itself (actor 'system').
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    action: {
      type: String,
      required: true,
      enum: [
        'MARK_FEE_PAID',
        'RESET_PIN',
        'SUSPEND_CART',
        'RESUME_CART',
        'DISABLE_VENDOR',
        'ENABLE_VENDOR',
        'SEND_REMINDER',
        'AUTO_REFUND',
        // Confession moderation (target kind confession, comment or poster).
        'APPROVE_CONFESSION',
        'REJECT_CONFESSION',
        'REMOVE_CONFESSION',
        'RESTORE_CONFESSION',
        'APPROVE_COMMENT',
        'REJECT_COMMENT',
        'REMOVE_COMMENT',
        'RESTORE_COMMENT',
        'SUSPEND_POSTER',
        'UNSUSPEND_POSTER',
        // New dish names reviewed into the common list (target kind dish).
        'APPROVE_DISH',
        'MERGE_DISH',
        'REJECT_DISH',
        // Platform fee per order changed (no target; details { from, to }).
        'SET_PLATFORM_FEE',
        // A customer's "not refunded" flag dealt with (target kind order).
        'RESOLVE_REFUND_FLAG',
      ],
    },
    // What it was done to, e.g. { kind: 'cart', id, label: "Raju's Momos" }.
    target: {
      kind: { type: String, enum: ['cart', 'vendor', 'payment', 'confession', 'comment', 'poster', 'dish', 'order'] },
      // A poster is known only by their private authorKey.
      key: String,
      id: { type: mongoose.Schema.Types.ObjectId },
      label: String,
    },
    // Anything that explains the action: amount, reason, refund id...
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

// Newest-first paging for the log page.
adminActionSchema.index({ createdAt: -1, _id: -1 })
// One item's moderation history.
adminActionSchema.index({ 'target.id': 1, createdAt: -1 })

module.exports = mongoose.model('AdminAction', adminActionSchema)

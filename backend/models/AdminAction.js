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
      ],
    },
    // What it was done to, e.g. { kind: 'cart', id, label: "Raju's Momos" }.
    target: {
      kind: { type: String, enum: ['cart', 'vendor', 'payment'] },
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

module.exports = mongoose.model('AdminAction', adminActionSchema)

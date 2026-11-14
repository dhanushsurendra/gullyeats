const mongoose = require('mongoose')

/*
 * A vendor's warning to nearby carts: an eviction drive, a blocked road,
 * heavy rain or a crowd (see controllers/areaAlertController.js). It shows
 * until expiresAt; the row is kept 90 days as a record of where drives happen.
 */
const areaAlertSchema = new mongoose.Schema(
  {
    cartId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cart', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: ['EVICTION', 'ROAD_BLOCKED', 'RAIN', 'CROWD'], required: true },
    // [lat, lng], copied from the sender's cart (same order as Cart).
    coordinates: { type: [Number], required: true },
    // Other vendors who tapped "I see it too".
    confirmedBy: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

areaAlertSchema.index({ cartId: 1, createdAt: -1 })
areaAlertSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 86400 })

module.exports = mongoose.model('AreaAlert', areaAlertSchema)

  const mongoose = require('mongoose')

  const cartSchema = new mongoose.Schema(
    {
      cartName: { type: String, required: true, trim: true },
      cartCity: { type: String, required: true, trim: true },
      cartId: { type: String },
      address: { type: String, trim: true },
      cartImageUrl: String,
      location: {
        type: {
          type: String,
          enum: ['Point'],
        },
        // No default []: a cart without a location then has no location at
        // all, which the old 2dsphere index skips (an empty one it refuses)
        // and the apps read as "not set" (they can't read an empty one).
        coordinates: {
          type: [Number],
          default: undefined,
        },
      },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
      },
      parcelCharge: {
        type: Number,
        default: 0,
        min: 0,
      },
      cartImageUrl: String,
      qrImageUrl: String,
      // New carts start active; the vendor can switch this in the ordering app.
      isActive: { type: Boolean, default: true },
      isOpen: { type: Boolean, default: false },
      // The last fee reminder pushed to the owner, as '<IST day>:<due|locked>'
      // (see utils/feeReminders.js).
      feeReminder: String,
      // Set by a GullyEats admin (e.g. suspected fee avoidance, or the vendor
      // was disabled). A suspended cart takes no orders and can't be reopened
      // from the vendor app until an admin resumes it.
      suspendedAt: { type: Date, default: null },
      suspendReason: { type: String, trim: true, default: null },
    },
    { timestamps: true },
  )

  // No 2dsphere index: coordinates are [lat, lng], which a geo index reads as
  // [lng, lat] and refuses east of 90°E (the North-East, the Andamans). Nothing
  // queries by distance. scripts/drop-cart-geo-index.js removes the old index.

  module.exports = mongoose.model('Cart', cartSchema)

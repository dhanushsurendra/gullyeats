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
        coordinates: {
          type: [Number],
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
      // Set by a GullyEats admin (e.g. suspected fee avoidance, or the vendor
      // was disabled). A suspended cart takes no orders and can't be reopened
      // from the vendor app until an admin resumes it.
      suspendedAt: { type: Date, default: null },
      suspendReason: { type: String, trim: true, default: null },
    },
    { timestamps: true },
  )

  cartSchema.index({ location: '2dsphere' })

  module.exports = mongoose.model('Cart', cartSchema)

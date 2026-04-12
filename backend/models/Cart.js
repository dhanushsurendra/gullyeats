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
    cartImageUrl: String,
    qrImageUrl: String,
    isActive: { type: Boolean, default: false },
    isOpen: { type: Boolean, default: false },
  },
  { timestamps: true },
)

cartSchema.index({ location: '2dsphere' })

module.exports = mongoose.model('Cart', cartSchema)

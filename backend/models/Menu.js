const mongoose = require('mongoose')

const menuSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // The English name written in each script, for the vendor app.
    names: { hi: String, kn: String, ta: String },
    price: { type: Number, required: true, min: 0 },
    isVeg: {
      type: Boolean,
      default: true,
    },
    cartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cart',
      required: true,
      index: true,
    },
    imageUrl: String,
    isInStock: { type: Boolean, default: true },
  },
  { timestamps: true },
)

module.exports = mongoose.model('MenuItem', menuSchema)

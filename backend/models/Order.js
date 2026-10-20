const mongoose = require('mongoose')
const OrderItemSchema = require('./OrderItem')

const PaymentAdjustmentSchema = new mongoose.Schema(
  {
    oldTotal: {
      type: Number,
      required: true,
    },

    newTotal: {
      type: Number,
      required: true,
    },

    difference: {
      type: Number,
      required: true,
    },

    action: {
      type: String,
      enum: ['COLLECT', 'RETURN', 'NONE'],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
)

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: Number,
      required: true,
    },

    orderItems: {
      type: [OrderItemSchema],
      validate: [(val) => val.length > 0, 'Order must have items'],
    },

    subtotal: {
      type: Number,
      required: true,
    },

    parcelCharge: {
      type: Number,
      min: 0,
    },

    platformFee: {
      type: Number,
      default: 2,
    },

    totalPrice: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'SERVED', 'CANCELLED'],
      default: 'PENDING',
    },

    cartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cart',
      required: true,
    },

    orderType: {
      type: String,
      enum: ['QR', 'MANUAL'],
      default: 'MANUAL',
    },

    // Optional payment adjustment
    paymentAdjustment: {
      type: PaymentAdjustmentSchema,
      default: null,
    },

    phoneNumber: {
      type: String,
      default: null,
    },

    servedAt: Date,
    paidAt: Date,

    feedback: {
      type: String,
      default: null,
    },

    orderDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
)

OrderSchema.index({ cartId: 1, orderNumber: 1, createdAt: 1 }, { unique: true })

OrderSchema.index({
  cartId: 1,
  createdAt: 1,
  status: 1,
})

module.exports = mongoose.model('Order', OrderSchema)

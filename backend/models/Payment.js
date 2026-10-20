const mongoose = require('mongoose')

const PaymentSchema = new mongoose.Schema(
  {
    cartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cart',
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    cartName: {
      type: String,
      required: true,
      trim: true,
    },

    // Number of orders included in this payment
    totalOrders: {
      type: Number,
      required: true,
      min: 0,
    },

    // Total platform fee being collected (in rupees)
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },

    // Backend-generated reference. Used as the Razorpay order `receipt`.
    paymentReference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    /*
     * --------------------------------------------------------------------
     * RAZORPAY FIELDS
     * --------------------------------------------------------------------
     * razorpayOrderId is written the moment we create the order with
     * Razorpay (before the user ever sees the checkout sheet). This is
     * what ties our PENDING payment doc to a specific Razorpay order, and
     * is what the webhook uses to find the payment when it fires
     * server-to-server (i.e. even if the app is killed mid-checkout).
     */
    razorpayOrderId: {
      type: String,
      default: null,
      index: true,
    },

    // Set once Razorpay reports a captured payment (via checkout callback
    // and/or webhook — whichever arrives first).
    razorpayPaymentId: {
      type: String,
      default: null,
    },

    // Signature returned by checkout on success. Kept for audit purposes
    // only; verification itself is re-derived server-side, never trusted
    // as-is from the client.
    razorpaySignature: {
      type: String,
      default: null,
    },

    // How this payment ended up VERIFIED — useful for debugging support
    // tickets ("I paid but it shows locked").
    verificationSource: {
      type: String,
      enum: ['CHECKOUT_CALLBACK', 'WEBHOOK', 'MANUAL', null],
      default: null,
    },

    // When admin/backend verified the payment
    verifiedAt: {
      type: Date,
      default: null,
    },

    /*
     * The billing day this payment represents.
     *
     * This is ALWAYS the start of the billing day:
     * midnight IST.
     *
     * Example:
     *
     * Friday 00:00 IST
     *
     * means this payment represents:
     *
     * Friday 00:00 IST
     * ->
     * Saturday 00:00 IST (exclusive)
     *
     * MongoDB stores the Date internally as UTC.
     */
    billingDate: {
      type: Date,
      required: true,
      index: true,
    },

    // When this payment record was created
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  },
)

/*
 * A cart can have many historical payments,
 * but only ONE PENDING payment at a time.
 *
 * Protects against:
 *
 * PAY -> PAY
 * PAY -> PAY -> PAY
 * simultaneous requests
 *
 * UNCHANGED — this is the locking invariant, do not modify.
 */
PaymentSchema.index(
  { cartId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'PENDING',
    },
  },
)

/*
 * Payment history
 */
PaymentSchema.index({
  cartId: 1,
  createdAt: -1,
})

/*
 * Useful for finding a payment
 * for a particular billing day.
 */
PaymentSchema.index({
  cartId: 1,
  billingDate: -1,
})

module.exports = mongoose.model('Payment', PaymentSchema)

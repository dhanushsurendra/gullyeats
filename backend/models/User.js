const mongoose = require('mongoose')
const generateUserId = require('../utils/generateUserId')

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      unique: true,
      index: true,
    },
    cartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        return this.role === 'staff'
      },
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, trim: true },
    role: {
      type: String,
      enum: ['vendor', 'staff'],
      required: true,
    },
    pinHash: {
      type: String,
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otpHash: String,
    otpExpiresAt: Date,
  },
  { timestamps: true },
)

userSchema.pre('save', async function () {
  if (!this.userId) {
    let isUnique = false

    while (!isUnique) {
      const newId = generateUserId(this.role)

      const existing = await this.constructor.findOne({ userId: newId })

      if (!existing) {
        this.userId = newId
        isUnique = true
      }
    }
  }
})

module.exports = mongoose.model('User', userSchema)

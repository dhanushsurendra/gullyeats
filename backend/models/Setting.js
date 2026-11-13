const mongoose = require('mongoose')

/*
 * Platform-wide settings, one document with _id 'global', edited from the
 * admin dashboard. Orders copy the fee when they are placed, so changing it
 * never touches old orders, bills or reports.
 */
const settingSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'global' },
    platformFee: { type: Number, min: 0, required: true },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Setting', settingSchema)

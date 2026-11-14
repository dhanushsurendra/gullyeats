const mongoose = require('mongoose')

/*
 * Something on the platform that needs an admin's attention (the admin
 * dashboard's Notifications page). `to` is the dashboard page that deals
 * with it. `key` stops the same thing being announced twice.
 */
const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    title: { type: String, required: true },
    text: { type: String, default: '' },
    to: { type: String, required: true },
    key: { type: String },
    // Admins who have seen it.
    readBy: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

notificationSchema.index({ key: 1 }, { unique: true, sparse: true })
// Newest first; gone after 60 days.
notificationSchema.index({ createdAt: -1 }, { expireAfterSeconds: 60 * 86400 })

module.exports = mongoose.model('Notification', notificationSchema)

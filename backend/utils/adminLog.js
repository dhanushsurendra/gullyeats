const AdminAction = require('../models/AdminAction')

/*
 * Records an admin (or system) action. Logging must never undo or block the
 * action itself, so a failed write is only reported to the server log.
 * req is null for actions the server takes on its own.
 */
async function logAction(req, action, target, details = {}) {
  try {
    await AdminAction.create({ adminId: req?.user?._id || null, action, target, details })
  } catch (e) {
    console.error(`Could not record admin action ${action}:`, e.message)
  }
}

module.exports = { logAction }

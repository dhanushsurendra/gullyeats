const auth = require('./auth')

// For routes both the customer web app (no login) and the vendor app call:
// with no Authorization header the request continues anonymously, otherwise
// the token must be valid.
const optionalAuth = (req, res, next) => {
  if (!req.headers.authorization) return next()
  return auth(req, res, next)
}

module.exports = optionalAuth

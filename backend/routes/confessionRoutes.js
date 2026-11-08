const express = require('express')
const { rateLimit } = require('express-rate-limit')
const router = express.Router()
const c = require('../controllers/confessionController')
const { confessionPoster } = require('../middlewares/confessionPoster')

// GullyPulse. Reading is open; writing needs a customer's order key (X-Gully-Order).
const poster = confessionPoster()
const reader = confessionPoster({ required: false, allowBanned: true })

// Per poster, not per IP: many customers share a cart's Wi-Fi or a carrier IP.
// shortcut: counts live in this server's memory; move to a shared store if the API runs on more than one instance.
const limit = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    limit: max,
    keyGenerator: (req) => req.poster.authorKey,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
    // Refused input (400, 409) doesn't use up the allowance; blocked posts (422) do.
    skipFailedRequests: true,
    requestWasSuccessful: (req, res) => res.statusCode < 400 || res.statusCode === 422,
    message: { success: false, message },
  })
const HOUR = 36e5
const postHour = limit(HOUR, 3, 'You can post 3 confessions an hour. Try again later.')
const postDay = limit(24 * HOUR, 10, 'You’ve reached today’s confession limit.')
const commentLimit = limit(HOUR, 20, 'You’re commenting too fast. Try again in a while.')
const likeLimit = limit(10 * 60e3, 120, 'Slow down a little.')
const reportLimit = limit(HOUR, 20, 'You’ve sent a lot of reports. Try again later.')

router.get('/me', confessionPoster({ allowBanned: true }), c.me)
router.get('/feed', reader, c.feed)
router.get('/mine', confessionPoster({ allowBanned: true }), c.mine)
router.post('/', poster, postHour, postDay, c.create)
router.post('/comments/:commentId/report', poster, reportLimit, c.reportComment)
router.get('/:publicId', reader, c.get)
router.get('/:publicId/comments', reader, c.comments)
router.post('/:publicId/comments', poster, commentLimit, c.addComment)
router.post('/:publicId/like', poster, likeLimit, c.like)
router.delete('/:publicId/like', poster, likeLimit, c.unlike)
router.post('/:publicId/report', poster, reportLimit, c.report)

module.exports = router

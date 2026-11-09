const express = require('express')
const { rateLimit } = require('express-rate-limit')
const router = express.Router()
const g = require('../controllers/gameController')
const { confessionPoster } = require('../middlewares/confessionPoster')

// GullyPlay. Same identity as GullyPulse (X-Gully-Order); a GullyPulse
// posting ban doesn't stop anyone playing.
const player = confessionPoster({ allowBanned: true })
const reader = confessionPoster({ required: false, allowBanned: true })

// shortcut: counts live in this server's memory; move to a shared store if the API runs on more than one instance.
const scoreLimit = rateLimit({
  windowMs: 36e5,
  limit: 40,
  keyGenerator: (req) => req.poster.authorKey,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: { success: false, message: 'That’s a lot of rounds! Take a break and try again later.' },
})

router.get('/:game/leaderboard', reader, g.leaderboard)
router.post('/:game/scores', player, scoreLimit, g.submit)
router.post('/phone', player, g.linkPhone)

module.exports = router

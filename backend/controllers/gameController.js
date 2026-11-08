const crypto = require('crypto')
const asyncHandler = require('../utils/asyncHandler')
const GameScore = require('../models/GameScore')

/*
 * GullyPlay scores and daily leaderboards. Players are known only by
 * authorKey (see middlewares/confessionPoster.js) and shown by an alias made
 * from it, never by phone or order.
 *
 * shortcut: scores are computed on the phone, so these checks only catch
 * impossible ones; a determined player can fake a believable score. Fine for a
 * fun board, never tie rewards to it without replaying rounds on the server.
 */

// Ceilings for one round, from the game's rules. Keep in sync with
// customer-app/src/game/nebula.js (games.test.js compares them).
const GAMES = {
  nebula: { maxScore: 20000, maxKills: 400, maxEnergy: 40, killPoints: 20, energyPoints: 125, maxMs: 47000 },
}
const BOARD_SIZE = 20

const istDay = (t = Date.now()) => new Date(t + 5.5 * 36e5).toISOString().slice(0, 10)

const ADJ = ['Neon', 'Cosmic', 'Turbo', 'Pixel', 'Laser', 'Solar', 'Nova', 'Quantum', 'Astro', 'Hyper', 'Lunar', 'Ion']
const NOUN = ['Fox', 'Tiger', 'Panda', 'Falcon', 'Cobra', 'Otter', 'Wolf', 'Koala', 'Shark', 'Owl', 'Lynx', 'Gecko']
// Stable per player, different for every game, says nothing about who they are.
function aliasFor(authorKey, game) {
  const h = crypto.createHash('sha256').update(`${game}:${authorKey}`).digest()
  return `${ADJ[h[0] % ADJ.length]} ${NOUN[h[1] % NOUN.length]} ${10 + (h[2] % 90)}`
}

function findGame(req, res) {
  const rules = GAMES[req.params.game]
  if (!rules) {
    res.status(404)
    throw new Error('Unknown game')
  }
  return rules
}

const int = (v) => (Number.isInteger(v) && v >= 0 ? v : null)

// How many players beat this score today (ties go to whoever got it first).
async function rankOf(game, day, row) {
  const ahead = await GameScore.countDocuments({
    game,
    day,
    $or: [{ score: { $gt: row.score } }, { score: row.score, updatedAt: { $lt: row.updatedAt } }],
  })
  return ahead + 1
}

// POST /api/games/:game/scores  { score, durationMs, day, stats: { kills, energy, hits } }
exports.submit = asyncHandler(async (req, res) => {
  const rules = findGame(req, res)
  const { game } = req.params
  const { score: s, durationMs: d, day, stats = {} } = req.body || {}
  const score = int(s)
  const durationMs = int(d)
  const kills = int(stats.kills)
  const energy = int(stats.energy)
  const hits = int(stats.hits)
  const today = istDay()
  // A round finished just after midnight (or sent late from offline) still counts for its day.
  const days = [today, istDay(Date.now() - 864e5)]
  const believable =
    score !== null &&
    durationMs !== null &&
    kills !== null &&
    energy !== null &&
    hits !== null &&
    days.includes(day) &&
    durationMs >= 1000 &&
    durationMs <= rules.maxMs &&
    score <= rules.maxScore &&
    kills <= rules.maxKills &&
    energy <= rules.maxEnergy &&
    hits <= 3 &&
    score <= kills * rules.killPoints + energy * rules.energyPoints
  if (!believable) {
    res.status(400)
    throw new Error('That score doesn’t add up.')
  }

  const { authorKey } = req.poster
  const where = { game, day, authorKey }
  const set = { score, stats: { kills, energy, hits } }
  // Only a better round touches the row: updatedAt breaks ties, so a worse or
  // equal round must not move it.
  const raised = await GameScore.updateOne(
    { ...where, score: { $lt: score } },
    { $set: { ...set, updatedAt: new Date() } },
    { timestamps: false },
  )
  if (!raised.matchedCount) {
    try {
      await GameScore.create({ ...where, ...set, alias: aliasFor(authorKey, game) })
    } catch (e) {
      if (e.code !== 11000) throw e // already has an equal or better score today
    }
  }
  const row = await GameScore.findOne(where).select('score updatedAt alias').lean()
  res.json({ success: true, data: { best: row.score, rank: await rankOf(game, day, row), alias: row.alias, day } })
})

// GET /api/games/:game/leaderboard?day=YYYY-MM-DD
exports.leaderboard = asyncHandler(async (req, res) => {
  findGame(req, res)
  const { game } = req.params
  const day = /^\d{4}-\d{2}-\d{2}$/.test(req.query.day || '') ? req.query.day : istDay()
  const rows = await GameScore.find({ game, day })
    .sort({ score: -1, updatedAt: 1 })
    .limit(BOARD_SIZE)
    .select('alias score authorKey')
    .lean()
  const key = req.poster?.authorKey
  let me = null
  if (key) {
    const mine = await GameScore.findOne({ game, day, authorKey: key }).select('score updatedAt alias').lean()
    me = mine ? { best: mine.score, rank: await rankOf(game, day, mine), alias: mine.alias } : { best: 0, rank: null, alias: aliasFor(key, game) }
  }
  res.json({
    success: true,
    data: {
      day,
      // Only alias and score leave the server.
      top: rows.map((r, i) => ({ rank: i + 1, alias: r.alias, score: r.score, me: Boolean(key) && r.authorKey === key })),
      me,
    },
  })
})

exports.GAMES = GAMES
exports.istDay = istDay

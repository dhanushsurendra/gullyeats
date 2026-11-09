const crypto = require('crypto')
const asyncHandler = require('../utils/asyncHandler')
const GameScore = require('../models/GameScore')
const Order = require('../models/Order')
const ConfessionBan = require('../models/ConfessionBan')
const { authorKeyFor } = require('../middlewares/confessionPoster')

/*
 * GullyPlay scores and daily leaderboards. Players are known only by
 * authorKey (see middlewares/confessionPoster.js) and shown by an alias made
 * from it, never by phone or order.
 *
 * shortcut: scores are computed on the phone, so these checks only catch
 * impossible ones; a determined player can fake a believable score. Fine for a
 * fun board, never tie rewards to it without replaying rounds on the server.
 */

/*
 * Each game's ceilings for one round, from its rules, and a check that the
 * round's numbers fit together. `limits` must equal LIMITS in the game's file
 * under customer-app/src/game/ (games.test.js compares them).
 */
const GAMES = {
  nebula: {
    maxMs: 57000,
    stats: ['kills', 'drones', 'energy', 'near', 'hits', 'boss', 'bossHits'],
    limits: { maxScore: 50000, maxKills: 600, maxDrones: 6, maxEnergy: 40, maxNear: 500, maxBossHits: 120, killPoints: 20, dronePoints: 50, energyPoints: 125, nearPoints: 5, bossHitPoints: 5, bossPoints: 1000, surge: 2 },
    // Every point can be doubled by the Surge (the Mothership fight).
    fits: (score, s, l) =>
      score <= l.maxScore &&
      s.kills <= l.maxKills &&
      s.drones <= l.maxDrones &&
      s.energy <= l.maxEnergy &&
      s.near <= l.maxNear &&
      s.hits <= 3 &&
      s.boss <= 1 &&
      s.bossHits <= l.maxBossHits &&
      score <=
        l.surge *
          (s.kills * l.killPoints + s.drones * l.dronePoints + s.energy * l.energyPoints + s.near * l.nearPoints + s.bossHits * l.bossHitPoints + s.boss * l.bossPoints),
  },
  reflex: {
    maxMs: 22000,
    stats: ['hits', 'wrong', 'missed', 'holds', 'avgMs', 'bestMs'],
    limits: { maxScore: 25000, maxHits: 70, maxHolds: 6, hitPoints: 450, holdPoints: 100, minAvgMs: 150, minBestMs: 100 },
    // Nobody reacts to a target at a random spot in under ~100 ms.
    fits: (score, s, l) =>
      score <= l.maxScore &&
      s.hits <= l.maxHits &&
      s.holds <= l.maxHolds &&
      score <= s.hits * l.hitPoints + s.holds * l.holdPoints &&
      (s.hits === 0 || (s.avgMs >= l.minAvgMs && s.bestMs >= l.minBestMs && s.bestMs <= s.avgMs)),
  },
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

// POST /api/games/:game/scores  { score, durationMs, day, stats: { ...the game's stats } }
exports.submit = asyncHandler(async (req, res) => {
  const rules = findGame(req, res)
  const { game } = req.params
  const { score: s, durationMs: d, day, stats: raw } = req.body || {}
  const score = int(s)
  const durationMs = int(d)
  const stats = Object.fromEntries(rules.stats.map((k) => [k, int(raw?.[k])]))
  // A round finished just after midnight (or sent late from offline) still counts for its day.
  const days = [istDay(), istDay(Date.now() - 864e5)]
  const believable =
    score !== null &&
    durationMs !== null &&
    Object.values(stats).every((v) => v !== null) &&
    days.includes(day) &&
    durationMs >= 1000 &&
    durationMs <= rules.maxMs &&
    rules.fits(score, stats, rules.limits)
  if (!believable) {
    res.status(400)
    throw new Error('That score doesn’t add up.')
  }

  const { authorKey } = req.poster
  const where = { game, day, authorKey }
  const set = { score, stats }
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

/*
 * POST /api/games/phone  { phone }
 * Adds a number to an order placed without one, so the player keeps one
 * identity (name, best scores) across orders and carts. Only an order with no
 * number can take one, so an order can't hop between identities. The order's
 * scores move to the new identity, keeping the better one where both played.
 */
exports.linkPhone = asyncHandler(async (req, res) => {
  const phone = String(req.body?.phone || '')
    .replace(/\D/g, '')
    .slice(-10)
  if (!/^[6-9]\d{9}$/.test(phone)) {
    res.status(400)
    throw new Error('Enter a valid 10-digit mobile number.')
  }
  const order = await Order.findOneAndUpdate(
    { _id: req.poster.orderId, phoneNumber: { $in: [null, ''] } },
    { $set: { phoneNumber: phone } },
    { new: true },
  )
    .select('phoneNumber')
    .lean()
  if (!order) {
    res.status(409)
    throw new Error('This order already has a phone number.')
  }

  const to = authorKeyFor(order)
  // A GullyPulse ban follows the player to the number, or adding one would lift it.
  const ban = await ConfessionBan.findOne({ authorKey: req.poster.authorKey, until: { $gt: new Date() } }).lean()
  if (ban) {
    await ConfessionBan.updateOne(
      { authorKey: to, until: { $not: { $gte: ban.until } } },
      { $set: { until: ban.until, reason: ban.reason, adminId: ban.adminId } },
      { upsert: true },
    ).catch((e) => {
      if (e.code !== 11000) throw e // a longer ban is already on the number
    })
  }
  for (const row of await GameScore.find({ authorKey: req.poster.authorKey }).lean()) {
    const where = { game: row.game, day: row.day, authorKey: to }
    const theirs = await GameScore.findOne(where).select('score').lean()
    // timestamps off: updatedAt orders ties, so a moved score keeps its time.
    if (!theirs) {
      await GameScore.updateOne({ _id: row._id }, { $set: { authorKey: to, alias: aliasFor(to, row.game) } }, { timestamps: false })
      continue
    }
    if (row.score > theirs.score) {
      await GameScore.updateOne({ _id: theirs._id }, { $set: { score: row.score, stats: row.stats, updatedAt: row.updatedAt } }, { timestamps: false })
    }
    await GameScore.deleteOne({ _id: row._id })
  }
  res.json({ success: true, data: { aliases: Object.fromEntries(Object.keys(GAMES).map((g) => [g, aliasFor(to, g)])) } })
})

exports.GAMES = GAMES
exports.istDay = istDay

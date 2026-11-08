const mongoose = require('mongoose')

// A player's best score in one game on one IST day. One row per player per
// day (the unique index); a better round raises `score`.
const gameScoreSchema = new mongoose.Schema(
  {
    game: { type: String, required: true },
    day: { type: String, required: true }, // YYYY-MM-DD, IST
    authorKey: { type: String, required: true }, // same identity as GullyPulse
    alias: { type: String, required: true },
    score: { type: Number, required: true },
    stats: { type: Object }, // the round that set the best; keys depend on the game
  },
  { timestamps: true },
)

gameScoreSchema.index({ game: 1, day: 1, authorKey: 1 }, { unique: true })
gameScoreSchema.index({ game: 1, day: 1, score: -1, updatedAt: 1 })
gameScoreSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 })

module.exports = mongoose.model('GameScore', gameScoreSchema)

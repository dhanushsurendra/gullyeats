const mongoose = require('mongoose')

/*
 * The last weather fetched for the city (utils/weather.js), so a restarted
 * server has something to show before its next fetch. One document per city.
 */
const weatherCacheSchema = new mongoose.Schema(
  {
    _id: { type: String },
    points: { type: mongoose.Schema.Types.Mixed, default: [] },
    fetchedAt: { type: Date, required: true },
  },
  { versionKey: false },
)

module.exports = mongoose.model('WeatherCache', weatherCacheSchema)

const mongoose = require('mongoose')
const WeatherCache = require('../models/WeatherCache')

/*
 * Weather for the vendor app's weather strip (GullyWeather). Every 30 minutes
 * the server fetches a 3x3 grid of points over Bengaluru from MET Norway
 * (api.met.no, free for commercial use under CC BY 4.0: the app credits
 * "MET Norway"), plus today's sunrise and sunset. Every cart reads its nearest
 * point from memory: no call per vendor. Their terms ask for an identifying
 * User-Agent and light use; 10 requests per 30 min is well within that.
 * Everything here is forecast data, never an official weather warning.
 */

const CITY = 'bengaluru'
const REFRESH_MS = 30 * 60 * 1000
const STALE_MS = 2 * 60 * 60 * 1000 // older than this is shown as no data, never as current
const LATS = [12.86, 12.975, 13.09]
const LNGS = [77.51, 77.625, 77.74]
const POINTS = LATS.flatMap((lat) => LNGS.map((lng) => [lat, lng]))
const HOURS_KEPT = 36
const HOURS_SHOWN = 8
const HEAVY_SOON_HOURS = 3
const HOUR = 3600000
const IST_MS = 5.5 * HOUR
const USER_AGENT = 'GullyEats/1.0 (+https://gullyeats.in)'
const MET = 'https://api.met.no/weatherapi'

let cache = null // { points, days, fetchedAt }

// MET Norway symbol codes ("heavyrainshowers_day"), grouped for the app.
function condition(symbol = '') {
  const s = symbol.replace(/_(day|night|polartwilight)$/, '')
  if (s.includes('thunder')) return 'storm'
  if (s.startsWith('heavyrain') || s.startsWith('heavysleet')) return 'heavy_rain'
  if (s.startsWith('light') && /rain|sleet/.test(s)) return 'drizzle'
  if (/rain|sleet/.test(s)) return 'rain'
  if (s === 'clearsky' || s === 'fair') return 'clear'
  if (s === 'fog') return 'fog'
  return 'cloudy' // partlycloudy, cloudy; snow is not expected in Bengaluru
}

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`MET Norway answered ${res.status}`)
  return res.json()
}

// One point's hourly forecast: each entry covers the hour starting at `at` (UTC).
async function fetchPoint([lat, lng]) {
  const body = await get(`${MET}/locationforecast/2.0/complete?lat=${lat}&lon=${lng}`)
  const hourly = body.properties.timeseries
    .filter((t) => t.data.next_1_hours)
    .slice(0, HOURS_KEPT)
    .map((t) => {
      const d = t.data.instant.details
      return {
        at: new Date(t.time).toISOString(),
        tempC: d.air_temperature,
        feelsC: d.apparent_air_temperature ?? d.air_temperature,
        humidity: d.relative_humidity,
        windKph: d.wind_speed * 3.6,
        rainMm: t.data.next_1_hours.details?.precipitation_amount ?? 0,
        condition: condition(t.data.next_1_hours.summary.symbol_code),
      }
    })
  return { lat, lng, hourly }
}

// Today's sunrise and sunset (IST) at the city centre: under a minute apart across the grid.
async function fetchSun(now) {
  const day = new Date(now.getTime() + IST_MS).toISOString().slice(0, 10)
  const body = await get(`${MET}/sunrise/3.0/sun?lat=12.975&lon=77.625&date=${day}&offset=%2B05:30`)
  const p = body.properties
  return [{ day, sunrise: new Date(p.sunrise.time).toISOString(), sunset: new Date(p.sunset.time).toISOString() }]
}

/** Fetches and stores the city's weather. Keeps the last data on failure. */
async function refreshWeather(now = new Date()) {
  const points = []
  for (const p of POINTS) points.push(await fetchPoint(p)) // one at a time: MET asks for light use
  const days = await fetchSun(now)
  cache = { points, days, fetchedAt: now }
  if (mongoose.connection.readyState === 1) {
    await WeatherCache.updateOne({ _id: CITY }, { $set: cache }, { upsert: true })
  }
}

async function loadStored() {
  if (cache || mongoose.connection.readyState !== 1) return
  const doc = await WeatherCache.findById(CITY).lean()
  if (doc?.days && !cache) cache = { points: doc.points, days: doc.days, fetchedAt: doc.fetchedAt }
}

/**
 * What the app shows for a spot at [lat, lng], from its nearest grid point,
 * or null when there is no fresh data (nothing older than STALE_MS).
 */
async function weatherNear(lat, lng, now = new Date()) {
  await loadStored()
  if (!cache || now - new Date(cache.fetchedAt) > STALE_MS) return null
  const p = cache.points.reduce((best, q) =>
    (q.lat - lat) ** 2 + (q.lng - lng) ** 2 < (best.lat - lat) ** 2 + (best.lng - lng) ** 2 ? q : best,
  )
  // From the hour that covers now on.
  const ahead = p.hourly.filter((h) => new Date(h.at).getTime() + HOUR > now.getTime())
  const cur = ahead[0]
  if (!cur) return null
  const today = new Date(now.getTime() + IST_MS).toISOString().slice(0, 10)
  const sun = cache.days.find((d) => d.day === today) || cache.days[0]
  // The first hour soon with heavy rain or a storm: a forecast, never an official warning.
  const soon = now.getTime() + HEAVY_SOON_HOURS * HOUR
  const heavy = ahead.find((h) => new Date(h.at) <= soon && ['heavy_rain', 'storm'].includes(h.condition))

  return {
    tempC: Math.round(cur.tempC),
    feelsC: Math.round(cur.feelsC),
    humidity: Math.round(cur.humidity),
    windKph: Math.round(cur.windKph),
    condition: cur.condition,
    rainMm: cur.rainMm,
    sunrise: sun.sunrise,
    sunset: sun.sunset,
    hourly: ahead.slice(0, HOURS_SHOWN).map((h) => ({
      at: h.at,
      tempC: Math.round(h.tempC),
      rainMm: h.rainMm,
      condition: h.condition,
    })),
    heavyRainAt: heavy ? heavy.at : null,
    updatedAt: new Date(cache.fetchedAt).toISOString(),
  }
}

const RETRY_MS = 5 * 60 * 1000

/** Refreshes every 30 min; after a failure (network down, MET busy), tries again in 5. */
function startWeather() {
  const run = () =>
    refreshWeather()
      .then(() => setTimeout(run, REFRESH_MS).unref())
      .catch((e) => {
        console.error('Weather refresh failed:', e.message)
        setTimeout(run, RETRY_MS).unref()
      })
  run()
}

module.exports = {
  weatherNear,
  refreshWeather,
  startWeather,
  condition,
  POINTS,
  _setCache: (c) => (cache = c),
}

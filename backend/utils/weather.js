const mongoose = require('mongoose')
const WeatherCache = require('../models/WeatherCache')

/*
 * Weather for the vendor app's weather strip (GullyWeather). One request every
 * 30 minutes fetches a 3x3 grid of points over Bengaluru from Open-Meteo, and
 * every cart reads its nearest point from memory: no call per vendor.
 *
 * Open-Meteo's free API is for non-commercial use. With OPEN_METEO_API_KEY set
 * (their commercial plan) the same request goes to customer-api.open-meteo.com.
 * Everything here is forecast data, never an official weather warning.
 */

const CITY = 'bengaluru'
const REFRESH_MS = 30 * 60 * 1000
const STALE_MS = 2 * 60 * 60 * 1000 // older than this is shown as no data, never as current
const LATS = [12.86, 12.975, 13.09]
const LNGS = [77.51, 77.625, 77.74]
const POINTS = LATS.flatMap((lat) => LNGS.map((lng) => [lat, lng]))
const HOURS_SHOWN = 8
const HEAVY_SOON_HOURS = 3
const IST_MS = 5.5 * 3600000

let cache = null // { points, fetchedAt }

// WMO weather codes, as Open-Meteo returns them, grouped for the app.
function condition(code) {
  if (code <= 1) return 'clear'
  if (code <= 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if (code === 65 || code === 67 || code === 82) return 'heavy_rain'
  if ((code >= 61 && code <= 66) || code === 80 || code === 81) return 'rain'
  if (code >= 95) return 'storm'
  return 'cloudy' // snow codes: not expected in Bengaluru
}

// Open-Meteo gives local times without an offset ("2026-11-16T18:00").
const ist = (local) => new Date(`${local}:00+05:30`)

function parsePoint(p) {
  return {
    lat: p.latitude,
    lng: p.longitude,
    current: {
      tempC: p.current.temperature_2m,
      feelsC: p.current.apparent_temperature,
      humidity: p.current.relative_humidity_2m,
      windKph: p.current.wind_speed_10m,
      code: p.current.weather_code,
      at: ist(p.current.time).toISOString(),
    },
    hourly: p.hourly.time.map((t, i) => ({
      at: ist(t).toISOString(),
      tempC: p.hourly.temperature_2m[i],
      rainChance: p.hourly.precipitation_probability[i] ?? 0,
      code: p.hourly.weather_code[i],
    })),
    days: p.daily.time.map((d, i) => ({
      day: d,
      sunrise: ist(p.daily.sunrise[i]).toISOString(),
      sunset: ist(p.daily.sunset[i]).toISOString(),
    })),
  }
}

async function fetchWeather() {
  const key = process.env.OPEN_METEO_API_KEY
  const url = new URL(key ? 'https://customer-api.open-meteo.com/v1/forecast' : 'https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({
    latitude: POINTS.map((p) => p[0]).join(','),
    longitude: POINTS.map((p) => p[1]).join(','),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    daily: 'sunrise,sunset',
    timezone: 'Asia/Kolkata',
    forecast_days: '2',
    ...(key ? { apikey: key } : {}),
  })
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`)
  const body = await res.json()
  return (Array.isArray(body) ? body : [body]).map(parsePoint)
}

/** Fetches and stores the city's weather. Keeps the last data on failure. */
async function refreshWeather() {
  const points = await fetchWeather()
  cache = { points, fetchedAt: new Date() }
  if (mongoose.connection.readyState === 1) {
    await WeatherCache.updateOne({ _id: CITY }, { $set: cache }, { upsert: true })
  }
}

async function loadStored() {
  if (cache || mongoose.connection.readyState !== 1) return
  const doc = await WeatherCache.findById(CITY).lean()
  if (doc && !cache) cache = { points: doc.points, fetchedAt: doc.fetchedAt }
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
  // The current IST hour, whatever the server's own time zone (IST is +5:30).
  const istNow = now.getTime() + IST_MS
  const hourStart = istNow - (istNow % 3600000) - IST_MS
  const ahead = p.hourly.filter((h) => new Date(h.at).getTime() >= hourStart)
  const today = new Date(istNow).toISOString().slice(0, 10)
  const sun = p.days.find((d) => d.day === today) || p.days[0]
  // The first hour soon with heavy rain or a storm: a forecast, never an official warning.
  const soon = now.getTime() + HEAVY_SOON_HOURS * 3600000
  const heavy = ahead.find(
    (h) => new Date(h.at) <= soon && ['heavy_rain', 'storm'].includes(condition(h.code)),
  )

  return {
    tempC: Math.round(p.current.tempC),
    feelsC: Math.round(p.current.feelsC),
    humidity: p.current.humidity,
    windKph: Math.round(p.current.windKph),
    condition: condition(p.current.code),
    rainChance: ahead[0]?.rainChance ?? 0,
    sunrise: sun.sunrise,
    sunset: sun.sunset,
    hourly: ahead.slice(0, HOURS_SHOWN).map((h) => ({
      at: h.at,
      tempC: Math.round(h.tempC),
      rainChance: h.rainChance,
      condition: condition(h.code),
    })),
    heavyRainAt: heavy ? heavy.at : null,
    updatedAt: new Date(cache.fetchedAt).toISOString(),
  }
}

function startWeather() {
  const run = () => refreshWeather().catch((e) => console.error('Weather refresh failed:', e.message))
  setInterval(run, REFRESH_MS).unref()
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

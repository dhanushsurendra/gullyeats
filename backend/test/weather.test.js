const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const weather = require('../utils/weather')

const realFetch = global.fetch
afterEach(() => {
  global.fetch = realFetch
  weather._setCache(null)
  delete process.env.OPEN_METEO_API_KEY
})

// Open-Meteo's reply for one point: local IST times without an offset.
function point(lat, lng, { code = 3, temp = 24, rain = [10, 20, 80, 30], hourCodes = [3, 61, 65, 3] } = {}) {
  const hours = ['2026-11-16T17:00', '2026-11-16T18:00', '2026-11-16T19:00', '2026-11-16T20:00']
  return {
    latitude: lat,
    longitude: lng,
    current: {
      time: '2026-11-16T17:30',
      temperature_2m: temp,
      apparent_temperature: temp - 0.6,
      relative_humidity_2m: 50,
      weather_code: code,
      wind_speed_10m: 9.6,
    },
    hourly: {
      time: hours,
      temperature_2m: [24, 23.4, 22.8, 22.1],
      precipitation_probability: rain,
      weather_code: hourCodes,
    },
    daily: {
      time: ['2026-11-16', '2026-11-17'],
      sunrise: ['2026-11-16T06:16', '2026-11-17T06:16'],
      sunset: ['2026-11-16T17:52', '2026-11-17T17:52'],
    },
  }
}

const at = (local) => new Date(`${local}:00+05:30`)

async function load(points) {
  let url
  global.fetch = async (u) => {
    url = new URL(u)
    return { ok: true, json: async () => points }
  }
  await weather.refreshWeather()
  return url
}

test('one request fetches the whole city grid', async () => {
  const url = await load([point(12.86, 77.51), point(12.975, 77.625)])
  assert.strictEqual(url.searchParams.get('latitude').split(',').length, weather.POINTS.length)
  assert.strictEqual(url.searchParams.get('timezone'), 'Asia/Kolkata')
  assert.strictEqual(url.host, 'api.open-meteo.com')
})

test('a commercial key goes to the customer API', async () => {
  process.env.OPEN_METEO_API_KEY = 'k'
  const url = await load([point(12.86, 77.51)])
  assert.strictEqual(url.host, 'customer-api.open-meteo.com')
  assert.strictEqual(url.searchParams.get('apikey'), 'k')
})

test('a cart gets its nearest point, with the coming hours and the sun', async () => {
  await load([point(12.86, 77.51, { temp: 30, code: 0 }), point(12.975, 77.625, { temp: 24, code: 61 })])
  const w = await weather.weatherNear(12.97, 77.6, at('2026-11-16T17:40'))
  assert.strictEqual(w.tempC, 24)
  assert.strictEqual(w.feelsC, 23)
  assert.strictEqual(w.condition, 'rain')
  assert.strictEqual(w.rainChance, 10) // the 17:00 hour
  assert.deepStrictEqual(w.hourly.map((h) => h.condition), ['cloudy', 'rain', 'heavy_rain', 'cloudy'])
  assert.strictEqual(w.sunset, at('2026-11-16T17:52').toISOString())
  // Heavy rain at 19:00 is within the next 3 hours: flagged as coming (a forecast).
  assert.strictEqual(w.heavyRainAt, at('2026-11-16T19:00').toISOString())
})

test('past hours drop off, and heavy rain further out is not flagged yet', async () => {
  await load([point(12.975, 77.625, { hourCodes: [3, 3, 3, 65] })])
  const early = await weather.weatherNear(12.97, 77.6, at('2026-11-16T15:10'))
  assert.strictEqual(early.heavyRainAt, null) // 20:00 is 5 hours away
  const later = await weather.weatherNear(12.97, 77.6, at('2026-11-16T18:20'))
  assert.strictEqual(later.hourly[0].at, at('2026-11-16T18:00').toISOString())
})

test('stale or missing data is no data, never shown as current', async () => {
  assert.strictEqual(await weather.weatherNear(12.97, 77.6), null)
  await load([point(12.975, 77.625)])
  const threeHoursOn = new Date(Date.now() + 3 * 3600000)
  assert.strictEqual(await weather.weatherNear(12.97, 77.6, threeHoursOn), null)
})

test('a failed fetch keeps the last data', async () => {
  await load([point(12.975, 77.625, { temp: 26 })])
  global.fetch = async () => ({ ok: false, status: 503 })
  await assert.rejects(weather.refreshWeather(), /503/)
  assert.strictEqual((await weather.weatherNear(12.97, 77.6)).tempC, 26)
})

test('weather codes group into what the app shows', () => {
  const c = weather.condition
  assert.deepStrictEqual([0, 1, 2, 3, 45, 53, 61, 63, 65, 80, 82, 95].map(c), [
    'clear', 'clear', 'cloudy', 'cloudy', 'fog', 'drizzle', 'rain', 'rain', 'heavy_rain', 'rain', 'heavy_rain', 'storm',
  ])
})

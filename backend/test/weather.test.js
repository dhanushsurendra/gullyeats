const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const weather = require('../utils/weather')

const realFetch = global.fetch
afterEach(() => {
  global.fetch = realFetch
  weather._setCache(null)
})

const at = (local) => new Date(`${local}:00+05:30`)
const NOW = at('2026-11-16T17:40')

// MET Norway's hourly entries start on the UTC hour, i.e. at :30 in IST.
const HOURS = ['16:30', '17:30', '18:30', '19:30', '20:30'].map((t) => at(`2026-11-16T${t}`).toISOString())

function forecast({ temp = 24, symbols = ['cloudy', 'lightrain', 'heavyrain', 'cloudy', 'cloudy'], rain = [0, 0.4, 9.1, 0, 0] } = {}) {
  return {
    properties: {
      timeseries: [
        ...HOURS.map((time, i) => ({
          time,
          data: {
            instant: { details: { air_temperature: temp - i * 0.6, apparent_air_temperature: temp - 0.6 - i * 0.6, relative_humidity: 58.4, wind_speed: 2.7 } },
            next_1_hours: { summary: { symbol_code: `${symbols[i]}_night` }, details: { precipitation_amount: rain[i] } },
          },
        })),
        // Further out MET gives 6-hour blocks only: not kept.
        { time: '2026-11-19T04:00:00Z', data: { instant: { details: { air_temperature: 30 } }, next_6_hours: {} } },
      ],
    },
  }
}

const sun = { properties: { sunrise: { time: '2026-11-16T06:18+05:30' }, sunset: { time: '2026-11-16T17:49+05:30' } } }

// Stubs MET: forecasts by "lat,lng" (default for any other point), and the sunrise API.
async function load(byPoint = {}, fallback = forecast()) {
  const urls = []
  global.fetch = async (u, opts) => {
    const url = new URL(u)
    urls.push({ url, ua: opts.headers['User-Agent'] })
    const body = url.pathname.includes('/sunrise/')
      ? sun
      : byPoint[`${url.searchParams.get('lat')},${url.searchParams.get('lon')}`] || fallback
    return { ok: true, json: async () => body }
  }
  await weather.refreshWeather(NOW)
  return urls
}

test('fetches the city grid and the sun from MET Norway, with an identifying User-Agent', async () => {
  const urls = await load()
  assert.strictEqual(urls.length, weather.POINTS.length + 1)
  assert.ok(urls.every((u) => u.url.host === 'api.met.no' && /GullyEats/.test(u.ua)))
  const s = urls.find((u) => u.url.pathname.includes('/sunrise/')).url
  assert.strictEqual(s.searchParams.get('date'), '2026-11-16')
  assert.strictEqual(s.searchParams.get('offset'), '+05:30')
})

test('a cart gets its nearest point, with the coming hours and the sun', async () => {
  await load({ '12.86,77.51': forecast({ temp: 30, symbols: Array(5).fill('clearsky') }) }, forecast({ temp: 24 }))
  const w = await weather.weatherNear(12.97, 77.6, NOW)
  // 17:40 falls in the hour from 17:30.
  assert.strictEqual(w.tempC, 23)
  assert.strictEqual(w.feelsC, 23)
  assert.strictEqual(w.humidity, 58)
  assert.strictEqual(w.windKph, 10)
  assert.strictEqual(w.condition, 'drizzle')
  assert.strictEqual(w.rainMm, 0.4)
  assert.deepStrictEqual(w.hourly.map((h) => h.condition), ['drizzle', 'heavy_rain', 'cloudy', 'cloudy'])
  assert.strictEqual(w.hourly[0].at, at('2026-11-16T17:30').toISOString())
  assert.strictEqual(w.sunrise, at('2026-11-16T06:18').toISOString())
  assert.strictEqual(w.sunset, at('2026-11-16T17:49').toISOString())
  // Heavy rain from 18:30 is within the next 3 hours: flagged as coming (a forecast).
  assert.strictEqual(w.heavyRainAt, at('2026-11-16T18:30').toISOString())

  const south = await weather.weatherNear(12.87, 77.5, NOW)
  assert.strictEqual(south.condition, 'clear')
})

test('heavy rain further out is not flagged yet', async () => {
  await load({}, forecast({ symbols: ['cloudy', 'cloudy', 'cloudy', 'cloudy', 'heavyrainandthunder'] }))
  const w = await weather.weatherNear(12.97, 77.6, at('2026-11-16T16:40'))
  assert.strictEqual(w.heavyRainAt, null) // 20:30 is nearly 4 hours away
  assert.strictEqual(w.hourly.at(-1).condition, 'storm')
})

test('stale or missing data is no data, never shown as current', async () => {
  assert.strictEqual(await weather.weatherNear(12.97, 77.6, NOW), null)
  await load()
  assert.strictEqual(await weather.weatherNear(12.97, 77.6, new Date(NOW.getTime() + 3 * 3600000)), null)
})

test('a failed fetch keeps the last data', async () => {
  await load({}, forecast({ temp: 26 }))
  global.fetch = async () => ({ ok: false, status: 503 })
  await assert.rejects(weather.refreshWeather(NOW), /503/)
  assert.strictEqual((await weather.weatherNear(12.97, 77.6, NOW)).tempC, 25)
})

test('MET symbols group into what the app shows', () => {
  const c = weather.condition
  const symbols = ['clearsky_day', 'fair_night', 'partlycloudy_day', 'cloudy', 'fog', 'lightrain', 'lightrainshowers_day',
    'rain', 'rainshowers_night', 'heavyrain', 'heavyrainshowers_day', 'rainandthunder', 'lightrainshowersandthunder_day', undefined]
  assert.deepStrictEqual(symbols.map(c), ['clear', 'clear', 'cloudy', 'cloudy', 'fog', 'drizzle', 'drizzle',
    'rain', 'rain', 'heavy_rain', 'heavy_rain', 'storm', 'storm', 'cloudy'])
})

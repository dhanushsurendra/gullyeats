// Shared by seed.js, verify.js and unseed.js.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

// Every seeded document carries `seed: SEED_TAG`, so unseed.js can remove
// exactly these and nothing else.
const SEED_TAG = 'seed-2k'

const DAY = 24 * 60 * 60 * 1000
const FEE = 2 // backend/controllers/orderController.js PLATFORM_FEE

// The IST calendar date ("2026-11-06") of a moment.
const istDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d)
// Midnight IST of that date, as a Date.
const istMidnight = (d) => new Date(`${istDate(d)}T00:00:00.000+05:30`)

module.exports = { SEED_TAG, DAY, FEE, istDate, istMidnight }

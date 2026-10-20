const { DateTime } = require('luxon')

const TIMEZONE = 'Asia/Kolkata'

function getDashboardDateRange(range, from, to) {
  const now = DateTime.now().setZone(TIMEZONE)

  let start
  let end

  switch (range) {
    case 'today':
      start = now.startOf('day')
      end = now.plus({ days: 1 }).startOf('day')
      break

    case '7d':
      start = now.minus({ days: 6 }).startOf('day')
      end = now.plus({ days: 1 }).startOf('day')
      break

    case '30d':
      start = now.minus({ days: 29 }).startOf('day')
      end = now.plus({ days: 1 }).startOf('day')
      break

    case 'thisMonth':
      start = now.startOf('month')
      end = now.plus({ months: 1 }).startOf('month')
      break

    case 'custom':
      if (!from || !to) {
        throw new Error('from and to are required for custom range')
      }

      start = DateTime.fromISO(from, {
        zone: TIMEZONE,
      }).startOf('day')

      end = DateTime.fromISO(to, {
        zone: TIMEZONE,
      }).plus({ days: 1 }).startOf('day')

      break

    default:
      throw new Error(
        'Invalid range. Use today, 7d, 30d, thisMonth or custom'
      )
  }

  return {
    start: start.toUTC().toJSDate(),
    end: end.toUTC().toJSDate(),

    // Useful for response/debugging
    startISO: start.toUTC().toISO(),
    endISO: end.toUTC().toISO(),
  }
}

module.exports = {
  getDashboardDateRange,
}
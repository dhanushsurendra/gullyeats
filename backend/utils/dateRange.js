// The admin dashboard's one date filter, in IST calendar days:
// ?range=today|7d|30d|month, or ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD.
const TZ = 'Asia/Kolkata'
const DAY = 864e5

const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
const istDay = (s) => new Date(`${s}T00:00:00+05:30`)
const todayStart = () => istDay(ymd(new Date()))
const monthStart = (back = 0) => {
  const [y, m] = ymd(new Date()).split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 - back, 1))
  return istDay(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`)
}
const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(+istDay(s))

/** { start, end } (end exclusive) for the query; anything unreadable is today. */
function rangeFor({ range, startDate, endDate } = {}) {
  const today = todayStart()
  const tomorrow = new Date(+today + DAY)
  if (isDay(startDate) && isDay(endDate) && startDate <= endDate) {
    return { start: istDay(startDate), end: new Date(+istDay(endDate) + DAY) }
  }
  if (range === '7d') return { start: new Date(+today - 6 * DAY), end: tomorrow }
  if (range === '30d') return { start: new Date(+today - 29 * DAY), end: tomorrow }
  if (range === 'month') return { start: monthStart(), end: tomorrow }
  return { start: today, end: tomorrow }
}

/** Whether the query asks for a range at all (lists show everything without one). */
const hasRange = (q = {}) => Boolean(q.range || (q.startDate && q.endDate))

module.exports = { TZ, DAY, ymd, istDay, todayStart, monthStart, rangeFor, hasRange }

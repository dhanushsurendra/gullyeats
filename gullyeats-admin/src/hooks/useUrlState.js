import { useSearchParams } from 'react-router-dom'

/*
 * Page filters live in the URL, so a bookmark, a notification link or the
 * back button lands on the same view. Setting a value replaces the history
 * entry (typing a search doesn't add one per letter); the fallback value is
 * left out of the URL.
 */
export default function useUrlState(key, fallback = '') {
  const [params, setParams] = useSearchParams()
  const value = params.get(key) ?? fallback
  const set = (v) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (v === fallback || v == null || v === '') next.delete(key)
        else next.set(key, v)
        return next
      },
      { replace: true },
    )
  return [value, set]
}

export const RANGES = [
  ['today', 'Today'],
  ['7d', '7 days'],
  ['30d', '30 days'],
  ['month', 'This month'],
  ['custom', 'Custom'],
]
const LABEL = { all: 'all time', today: 'today', '7d': 'last 7 days', '30d': 'last 30 days', month: 'this month' }
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '')
const short = (s) =>
  new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })

/*
 * The page's date range (?range=, or ?from=&to= for custom). `params` is what
 * the API takes (none for "all"), `label` names it in card titles.
 */
export function useRange(fallback = '30d') {
  const [params, setParams] = useSearchParams()
  const from = params.get('from')
  const to = params.get('to')
  const custom = isDay(from) && isDay(to) && from <= to
  const asked = params.get('range')
  const key = custom ? 'custom' : LABEL[asked] ? asked : fallback

  const set = (next, dates) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        n.delete('from')
        n.delete('to')
        n.delete('range')
        if (next === 'custom') {
          n.set('from', dates.from)
          n.set('to', dates.to)
        } else if (next !== fallback) n.set('range', next)
        return n
      },
      { replace: true },
    )

  return {
    key,
    from: custom ? from : '',
    to: custom ? to : '',
    params: custom ? { startDate: from, endDate: to } : key === 'all' ? {} : { range: key },
    label: custom ? (from === to ? short(from) : `${short(from)} – ${short(to)}`) : LABEL[key],
    set,
  }
}

import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { Seg } from './ui'
import { RANGES } from '../hooks/useUrlState'

/*
 * The dashboard's one date control, placed on the page it filters. `range`
 * comes from useRange(); `all` adds an "All time" choice (lists).
 */
export default function DateRange({ range, all = false }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)

  const pick = (key) => {
    if (key !== 'custom') {
      setOpen(false)
      return range.set(key)
    }
    setFrom(range.from)
    setTo(range.to)
    setOpen(true)
  }
  const apply = () => {
    range.set('custom', { from, to })
    setOpen(false)
  }

  return (
    <div className='relative min-w-0 max-w-full'>
      <Seg options={all ? [['all', 'All time'], ...RANGES] : RANGES} value={open ? 'custom' : range.key} onChange={pick} />
      {open && (
        <div className='absolute right-0 top-full z-50 mt-2 w-[min(300px,calc(100vw-32px))] rounded-2xl border border-line bg-white p-4 shadow-float'>
          <div className='mb-3 flex items-center gap-2'>
            <CalendarDays size={16} className='text-brand' />
            <p className='text-sm font-semibold text-ink'>Custom dates</p>
          </div>
          {[
            ['From', from, (v) => (setFrom(v), to && v > to && setTo('')), undefined],
            ['To', to, setTo, from || undefined],
          ].map(([label, value, set, min]) => (
            <label key={label} className='mb-3 block text-xs font-medium text-neutral-500'>
              {label}
              <input
                type='date'
                value={value}
                min={min}
                onChange={(e) => set(e.target.value)}
                className='mt-1 w-full rounded-lg border border-line bg-neutral-50 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15'
              />
            </label>
          ))}
          <div className='flex justify-end gap-2'>
            <button
              onClick={() => setOpen(false)}
              className='rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-50'
            >
              Cancel
            </button>
            <button
              onClick={apply}
              disabled={!from || !to}
              className='rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50'
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

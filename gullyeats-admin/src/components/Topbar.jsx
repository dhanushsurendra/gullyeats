import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Menu, Search, Bell, Moon, Sun, CalendarDays } from 'lucide-react'
import { setRange, setSearch } from '../store/adminSlice'
import { Seg } from './ui'

const TITLES = {
  '/': ['Dashboard', 'Platform overview and real-time activity'],
  '/owners': ['Owners', 'Business owners on GullyEats'],
  '/restaurants': ['Restaurants / Carts', 'Every cart across the platform'],
  '/orders': ['Orders', 'Latest orders across the platform'],
  '/analytics': ['Analytics', 'Order and revenue trends'],
  '/revenue': ['Revenue', 'GMV and platform fee revenue'],
  '/payments': ['Payments', 'Platform fee payments from owners'],
  '/feedback': ['Feedback', 'What customers are saying'],
  '/settings': ['Settings', 'Account and connection'],
}

const RANGES = [
  ['today', 'Today'],
  ['7d', '7 Days'],
  ['30d', '30 Days'],
  ['month', 'This Month'],
  ['custom', 'Custom'],
]

export default function Topbar({ onMenu }) {
  const dispatch = useDispatch()
  const nav = useNavigate()
  const { pathname } = useLocation()

  const { range, search } = useSelector((s) => s.admin)
  const user = useSelector((s) => s.auth.user)

  const attention = useSelector(
    (s) => s.admin.data.overview?.attention?.length || 0,
  )

  const [title, sub] = TITLES[pathname] || TITLES['/']

  const [dark, setDark] = useState(
    () => localStorage.getItem('ge_theme') === 'dark',
  )

  const [showDatePicker, setShowDatePicker] = useState(false)

  const [startDate, setStartDate] = useState(range.startDate || '')
  const [endDate, setEndDate] = useState(range.endDate || '')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('ge_theme', dark ? 'dark' : 'light')
  }, [dark])

  // Keep local picker values synced with Redux
  useEffect(() => {
    setStartDate(range.startDate || '')
    setEndDate(range.endDate || '')
  }, [range.startDate, range.endDate])

  const handleRangeChange = (key) => {
    if (key === 'custom') {
      setStartDate(range.startDate || '')
      setEndDate(range.endDate || '')
      setShowDatePicker(true)
      return
    }

    setShowDatePicker(false)

    dispatch(
      setRange({
        key,
        startDate: '',
        endDate: '',
      }),
    )
  }

  const handleApplyCustomRange = () => {
    if (!startDate || !endDate) return

    dispatch(
      setRange({
        key: 'custom',
        startDate,
        endDate,
      }),
    )

    setShowDatePicker(false)
  }

  const handleCancelCustomRange = () => {
    setStartDate(range.startDate || '')
    setEndDate(range.endDate || '')
    setShowDatePicker(false)
  }

  return (
    <header
      className='sticky top-0 z-20 flex flex-wrap items-center gap-3
      border-b border-line bg-[#f6f6f5]/90 px-3 py-2.5
      backdrop-blur sm:px-5'
    >
      {/* Mobile Menu */}
      <button
        onClick={onMenu}
        className='rounded p-1 hover:bg-neutral-200 lg:hidden'
        aria-label='Open menu'
      >
        <Menu size={18} />
      </button>

      {/* Page Title */}
      <div>
        <h1 className='text-[15px] font-semibold leading-tight'>{title}</h1>

        <p className='text-[12px] text-neutral-500'>{sub}</p>
      </div>

      <div className='flex-1' />

      {/* Search */}
      <label
        className='order-last flex w-full items-center gap-1.5
        rounded-md border border-line bg-white px-2.5 py-1.5
        text-neutral-500 sm:order-none sm:w-56'
      >
        <Search size={14} />

        <input
          value={search}
          onChange={(e) => dispatch(setSearch(e.target.value))}
          placeholder='Filter tables…'
          aria-label='Search'
          className='w-full bg-transparent text-ink outline-none'
        />
      </label>

      {/* Dark Mode */}
      <button
        onClick={() => setDark((d) => !d)}
        aria-label='Toggle dark mode'
        className='rounded p-1.5 text-neutral-500 hover:bg-neutral-200'
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* Date Range */}
      <div className='relative'>
        <Seg options={RANGES} value={range.key} onChange={handleRangeChange} />

        {/* Custom Date Picker */}
        {showDatePicker && (
          <div
            className='absolute right-0 top-full z-50 mt-2 w-[300px]
            rounded-xl border border-[#e7e7e4]
            bg-white p-4 shadow-lg'
          >
            {/* Header */}
            <div className='mb-3 flex items-center gap-2'>
              <CalendarDays size={16} className='text-[#f97316]' />

              <div>
                <p className='text-sm font-semibold text-ink'>
                  Custom Date Range
                </p>

                <p className='text-[11px] text-neutral-500'>
                  Select start and end dates
                </p>
              </div>
            </div>

            {/* Start Date */}
            <div className='mb-3'>
              <label className='mb-1 block text-xs font-medium text-neutral-500'>
                Start Date
              </label>

              <input
                type='date'
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)

                  // Clear end date if it becomes invalid
                  if (endDate && e.target.value && endDate < e.target.value) {
                    setEndDate('')
                  }
                }}
                className='w-full rounded-lg border border-[#e7e7e4]
                bg-[#fafafa] px-3 py-2 text-sm
                outline-none transition
                focus:border-[#f97316]
                focus:ring-1 focus:ring-[#f97316]'
              />
            </div>

            {/* End Date */}
            <div className='mb-4'>
              <label className='mb-1 block text-xs font-medium text-neutral-500'>
                End Date
              </label>

              <input
                type='date'
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className='w-full rounded-lg border border-[#e7e7e4]
                bg-[#fafafa] px-3 py-2 text-sm
                outline-none transition
                focus:border-[#f97316]
                focus:ring-1 focus:ring-[#f97316]'
              />
            </div>

            {/* Actions */}
            <div className='flex justify-end gap-2'>
              <button
                onClick={handleCancelCustomRange}
                className='rounded-lg border border-[#e7e7e4]
                px-3 py-1.5 text-xs font-medium
                text-neutral-500 hover:bg-[#f6f6f5]'
              >
                Cancel
              </button>

              <button
                onClick={handleApplyCustomRange}
                disabled={!startDate || !endDate}
                className='rounded-lg bg-[#f97316]
                px-3 py-1.5 text-xs font-medium text-white
                disabled:cursor-not-allowed disabled:opacity-50'
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Admin Avatar */}
      <div className='flex items-center gap-2'>
        <span
          className='grid h-7 w-7 place-items-center rounded-full
    bg-ink text-[11px] font-semibold text-white'
        >
          {user?.name
            ? user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
            : 'SA'}
        </span>
      </div>
    </header>
  )
}

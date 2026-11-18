import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Menu, Bell, Moon, Sun } from 'lucide-react'

// Each page's own filters (dates, search) sit on the page, next to what they change.
const TITLES = {
  '/': ['Dashboard', 'Today across GullyEats, live'],
  '/notifications': ['Notifications', 'Everything that needs your attention, as it happens'],
  '/collections': ['Collections', 'Overdue platform fees and refunds owed'],
  '/moderation': ['Moderation', 'GullyPulse confessions and comments'],
  '/dishes': ['Dishes', 'New dish names from vendors, to review'],
  '/area-alerts': ['Area alerts', 'Where vendors warned nearby carts'],
  '/broadcast': ['Send message', 'A notification to all vendors, a group or one cart'],
  '/restaurants': ['Carts', 'Every cart across the platform'],
  '/owners': ['Owners', 'Business owners on GullyEats'],
  '/orders': ['Orders', 'Every order across the platform'],
  '/payments': ['Payments', 'Platform fee payments from owners'],
  '/revenue': ['Revenue', 'Fees, GMV and orders over time'],
  '/insights': ['Business', 'Growth, vendors, fee leakage and operations'],
  '/actions': ['Action log', 'Who did what, and when'],
  '/feedback': ['Feedback', 'What customers are saying'],
  '/settings': ['Settings', 'Account and connection'],
}

export default function Topbar({ onMenu }) {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const user = useSelector((s) => s.auth.user)
  const unread = useSelector((s) => s.notify.unread)
  const [title, sub] = TITLES[pathname] || TITLES['/']

  const [dark, setDark] = useState(() => localStorage.getItem('ge_theme') === 'dark')
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('ge_theme', dark ? 'dark' : 'light')
  }, [dark])

  const round = 'relative grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-neutral-500 shadow-sm transition hover:text-ink'

  return (
    <header className='sticky top-0 z-20 flex items-center gap-3 border-b border-line/70 bg-canvas/80 px-3 py-3 backdrop-blur-xl sm:px-6'>
      <button onClick={onMenu} className='rounded-lg p-1.5 hover:bg-neutral-200 lg:hidden' aria-label='Open menu'>
        <Menu size={18} />
      </button>

      <div className='min-w-0'>
        <h1 className='truncate text-[19px] font-extrabold leading-tight tracking-tight'>{title}</h1>
        <p className='truncate text-[12px] text-neutral-500'>{sub}</p>
      </div>

      <div className='flex-1' />

      <button
        onClick={() => nav('/notifications')}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className={round}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className='absolute -right-1 -top-1 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white'>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <button onClick={() => setDark((d) => !d)} aria-label='Toggle dark mode' className={round}>
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <span className='grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-night to-night-soft text-[12px] font-bold text-white shadow-sm'>
        {user?.name
          ? user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()
          : 'SA'}
      </span>
    </header>
  )
}

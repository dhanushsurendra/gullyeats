import { NavLink, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  LayoutDashboard,
  Users,
  Store,
  ShoppingBag,
  BarChart3,
  IndianRupee,
  CreditCard,
  MessageSquare,
  Wallet,
  Lightbulb,
  History,
  Settings,
  ShieldAlert,
  Utensils,
  LogOut,
  X,
} from 'lucide-react'
import { logout } from '../store/authSlice'

const NAV = [
  ['Overview', [['Dashboard', '/', LayoutDashboard]]],
  [
    'Management',
    [
      ['Owners', '/owners', Users],
      ['Carts', '/restaurants', Store],
      ['Orders', '/orders', ShoppingBag],
      ['Moderation', '/moderation', ShieldAlert],
      ['Dishes', '/dishes', Utensils],
    ],
  ],
  [
    'Insights',
    [
      ['Analytics', '/analytics', BarChart3],
      ['Revenue', '/revenue', IndianRupee],
      ['Business', '/insights', Lightbulb],
    ],
  ],
  [
    'System',
    [
      ['Payments', '/payments', CreditCard],
      ['Collections', '/collections', Wallet],
      ['Action log', '/actions', History],
      ['Feedback', '/feedback', MessageSquare],
      ['Settings', '/settings', Settings],
    ],
  ],
]

export default function Sidebar({ open, onClose }) {
  const dispatch = useDispatch()
  const nav = useNavigate()
  const user = useSelector((s) => s.auth.user)

  const handleLogout = async () => {
    try {
      await dispatch(logout()).unwrap()
    } finally {
      nav('/login')
    }
  }

  return (
    <>
      {open && (
        <div
          className='fixed inset-0 z-30 bg-night-deep/50 backdrop-blur-sm lg:hidden'
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col overflow-hidden
           bg-gradient-to-b from-night-deep via-night to-night-soft px-3 py-4 text-white
           transition-transform lg:translate-x-0
           ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* A soft orange glow at the top, like the GullyPlay cards. */}
        <div className='pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-brand/25 blur-3xl' />
        <div className='relative flex items-center gap-2 px-2 pb-4'>
          <div className='leading-tight'>
            <div className='text-[16px] font-extrabold tracking-tight'>
              <span className='text-brand'>Gully</span>Eats
            </div>
            <div className='text-[10px] font-semibold uppercase tracking-[0.18em] text-lilac'>Admin</div>
          </div>
          <button
            onClick={onClose}
            className='ml-auto rounded-lg p-1 text-white/70 hover:bg-white/10 lg:hidden'
            aria-label='Close menu'
          >
            <X size={16} />
          </button>
        </div>
        <nav className='relative -mx-1 flex-1 overflow-y-auto px-1'>
          {NAV.map(([group, items]) => (
            <div key={group}>
              <div className='px-2.5 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-lilac/70'>
                {group}
              </div>
              {items.map(([label, to, Icon]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `mb-0.5 flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-all ${isActive ? 'bg-brand text-white shadow-glow' : 'text-white/60 hover:bg-white/[0.07] hover:text-white'}`
                  }
                >
                  <Icon size={16} strokeWidth={2.2} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className='relative mt-2 flex items-center gap-2.5 rounded-2xl bg-white/[0.06] p-2.5 ring-1 ring-white/10'>
          <span className='grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-[#ff8a4c] text-[12px] font-bold text-white'>
            {user?.name
              ? user.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
              : 'SA'}
          </span>
          <div className='min-w-0 flex-1 leading-tight'>
            <b className='block truncate text-[13px]'>{user?.name || 'Super Admin'}</b>
            <small className='block truncate text-[11px] text-white/50'>Platform Administrator</small>
          </div>
          <button
            onClick={handleLogout}
            aria-label='Log out'
            title='Log out'
            className='rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white'
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>
    </>
  )
}

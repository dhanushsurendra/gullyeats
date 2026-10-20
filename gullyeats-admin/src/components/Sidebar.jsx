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
  Settings,
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
    ],
  ],
  [
    'Insights',
    [
      ['Analytics', '/analytics', BarChart3],
      ['Revenue', '/revenue', IndianRupee],
    ],
  ],
  [
    'System',
    [
      ['Payments', '/payments', CreditCard],
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
          className='fixed inset-0 z-30 bg-black/30 lg:hidden'
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[212px] flex-col border-r border-line
           bg-white px-2.5 py-3.5 transition-transform lg:translate-x-0 
           ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className='flex items-center gap-2 px-2 pb-3.5 text-[15px] font-bold'>
          <div>
            <span className='text-brand'>Gully</span>
            Eats
          </div>
          <button
            onClick={onClose}
            className='ml-auto lg:hidden'
            aria-label='Close menu'
          >
            <X size={16} />
          </button>
        </div>
        <nav className='flex-1 overflow-y-auto'>
          {NAV.map(([group, items]) => (
            <div key={group}>
              <div className='px-2 pb-1 pt-3 text-[11px] font-medium text-neutral-500'>
                {group}
              </div>
              {items.map(([label, to, Icon]) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-md px-2 py-1.5 font-medium transition-colors ${isActive ? 'bg-brand-50 text-brand' : 'text-neutral-500 hover:bg-neutral-100 hover:text-ink'}`
                  }
                >
                  <Icon size={15} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className='flex items-center gap-2 border-t border-line pt-2.5'>
          <span className='grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white'>
            {user?.name
              ? user.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
              : 'SA'}
          </span>
          <div className='min-w-0 flex-1 leading-tight'>
            <b className='block truncate'>{user?.name || 'Super Admin'}</b>
            <small className='text-neutral-500'>Platform Administrator</small>
          </div>
          <button
            onClick={handleLogout}
            aria-label='Log out'
            className='rounded p-1 text-neutral-500 hover:bg-neutral-100'
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>
    </>
  )
}

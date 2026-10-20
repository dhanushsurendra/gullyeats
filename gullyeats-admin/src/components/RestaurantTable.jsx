import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { X } from 'lucide-react'
import {
  Card,
  CardHeader,
  Table,
  State,
  Select,
  Spinner,
  ErrorNote,
} from './ui'
import StatusBadge from './StatusBadge'
import { api } from '../services/api'
import { inr, num, ago, istDate, matches } from '../utils/format'

// Side drawer powered by your EXISTING route: GET /sales-insights/:cartId?startDate&endDate (last 30 days)
function CartDrawer({ cart, onClose }) {
  const [state, setState] = useState({ loading: true })
  useEffect(() => {
    const end = new Date()
    api
      .cartInsights(cart.id, {
        startDate: istDate(new Date(+end - 29 * 864e5)),
        endDate: istDate(end),
      })
      .then((d) => setState({ d }))
      .catch((e) => setState({ error: e.message }))
  }, [cart.id])
  const d = state.d
  const stat = [
    ['Revenue', d && inr(d.revenue)],
    ['Orders', d && num(d.totalOrders)],
    ['Avg order', d && inr(d.avgOrderValue)],
    ['Completion', d && `${d.completionRate.toFixed(1)}%`],
    ['Cancellation', d && `${d.cancellationRate.toFixed(1)}%`],
    ['Peak hour', d && (d.peakHour == null ? '—' : `${d.peakHour}:00`)],
  ]
  return (
    <div
      className='fixed inset-0 z-50 flex justify-end bg-black/30'
      onClick={onClose}
    >
      <aside
        className='h-full w-full max-w-sm overflow-y-auto bg-white p-5 shadow-xl'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-start justify-between'>
          <div>
            <h3 className='text-[16px] font-semibold'>{cart.name}</h3>
            <p className='text-neutral-500'>
              {cart.owner} · {cart.city}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label='Close'
            className='rounded p-1 hover:bg-neutral-100'
          >
            <X size={16} />
          </button>
        </div>
        <div className='mt-2'>
          <StatusBadge status={cart.status} />
        </div>
        <p className='mb-2 mt-5 text-[11.5px] font-medium text-neutral-500'>
          LAST 30 DAYS
        </p>
        {state.loading ? (
          <Spinner />
        ) : state.error ? (
          <ErrorNote message={state.error} />
        ) : (
          <>
            <div className='grid grid-cols-2 gap-2'>
              {stat.map(([k, v]) => (
                <div key={k} className='rounded-md border border-line p-2.5'>
                  <small className='text-neutral-500'>{k}</small>
                  <b className='block text-[15px] font-semibold'>{v}</b>
                </div>
              ))}
            </div>
            <p className='mb-1 mt-5 text-[11.5px] font-medium text-neutral-500'>
              TOP ITEMS BY REVENUE
            </p>
            {d.topItems?.length ? (
              d.topItems.map((i) => (
                <div
                  key={i.name}
                  className='flex justify-between border-b border-line py-1.5 last:border-0'
                >
                  <span>{i.name}</span>
                  <span className='text-neutral-500'>
                    {i.qty} × · <b className='text-ink'>{inr(i.revenue)}</b>
                  </span>
                </div>
              ))
            ) : (
              <p className='text-neutral-500'>No sales in this period.</p>
            )}
          </>
        )}
      </aside>
    </div>
  )
}

export default function RestaurantTable({ carts = [], limit, loading, error }) {
  console.log('carts', carts)
  const nav = useNavigate()
  const [params] = useSearchParams()
  const q = useSelector((s) => s.admin.search)
  const [f, setF] = useState({
    status: '',
    city: '',
    owner: params.get('owner') || '',
    sort: '',
  })
  const [open, setOpen] = useState(null)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  useEffect(() => {
    const id = params.get('cart')
    if (id) setOpen(carts.find((c) => c.id === id) || null)
  }, [params, carts])

  const uniq = (k) =>
    [...new Set(carts.map((c) => c[k]).filter(Boolean))].sort()
  const rows = useMemo(() => {
    let r = carts.filter(
      (c) =>
        (!f.status || c.status === f.status) &&
        (!f.city || c.city === f.city) &&
        (!f.owner || c.owner === f.owner) &&
        matches(c, q),
    )
    if (f.sort) r = [...r].sort((a, b) => b[f.sort] - a[f.sort])
    return limit ? r.slice(0, limit) : r
  }, [carts, f, q, limit])

  const cols = [
    {
      key: 'name',
      label: 'Restaurant',
      render: (c) => <b className='font-medium'>{c.name}</b>,
    },
    { key: 'owner', label: 'Owner' },
    { key: 'city', label: 'Location' },
    {
      key: 'status',
      label: 'Status',
      render: (c) => <StatusBadge status={c.status} />,
    },
    { key: 'ordersToday', label: 'Orders Today' },
    { key: 'gmvToday', label: 'GMV Today', render: (c) => inr(c.gmvToday) },
    { key: 'current', label: 'Current Orders' },
    {
      key: 'lastActive',
      label: 'Last Active',
      render: (c) => (
        <span className='text-neutral-500'>{ago(c.lastActive)}</span>
      ),
    },
  ]
  return (
    <Card>
      <CardHeader
        title='Carts'
        subtitle={`${rows.length} shown`}
        right={
          <div className='flex flex-wrap gap-1.5'>
            <Select
              value={f.status}
              onChange={set('status')}
              aria-label='Status'
            >
              <option value=''>All statuses</option>
              {['LIVE', 'OFFLINE', 'PAUSED', 'ATTENTION'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Select value={f.city} onChange={set('city')} aria-label='Location'>
              <option value=''>All locations</option>
              {uniq('city').map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Select value={f.owner} onChange={set('owner')} aria-label='Owner'>
              <option value=''>All owners</option>
              {uniq('owner').map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Select value={f.sort} onChange={set('sort')} aria-label='Sort'>
              <option value=''>Sort: default</option>
              <option value='ordersToday'>Orders today</option>
              <option value='gmvToday'>Revenue today</option>
            </Select>
            {limit && (
              <button
                onClick={() => nav('/restaurants')}
                className='px-1 text-[12px] font-medium text-brand hover:underline'
              >
                View all
              </button>
            )}
          </div>
        }
      />
      <State loading={loading} error={error}>
        <Table
          columns={cols}
          rows={rows}
          onRow={setOpen}
          empty='No restaurants match these filters.'
        />
      </State>
      {open && <CartDrawer cart={open} onClose={() => setOpen(null)} />}
    </Card>
  )
}

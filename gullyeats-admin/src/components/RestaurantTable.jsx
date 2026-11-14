import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { T } from '../store/adminSlice'
import { X } from 'lucide-react'
import {
  Card,
  CardHeader,
  Table,
  State,
  Select,
  Skeleton,
  ErrorNote,
  ScrollFooter,
  ask,
} from './ui'
import { useReveal } from '../hooks/usePaged'
import useUrlState from '../hooks/useUrlState'
import useSearchBox from '../hooks/useSearchBox'
import StatusBadge from './StatusBadge'
import { api } from '../services/api'
import { inr, num, ago, istDate, matches } from '../utils/format'

// Side drawer powered by your EXISTING route: GET /sales-insights/:cartId?startDate&endDate (last 30 days)
// Marks the cart's due platform fee as paid outside Razorpay (e.g. cash to
// the GullyEats team). Asks first: it unlocks the cart with no payment check.
function MarkFeePaid({ cart }) {
  const dispatch = useDispatch()
  const [state, setState] = useState({})
  const markPaid = async () => {
    if (
      !(await ask({
        title: `Mark ${cart.name}'s fee as paid?`,
        message: 'Only do this if the vendor has paid GullyEats another way. The cart will unlock.',
        confirm: 'Mark paid',
      }))
    )
      return
    setState({ busy: true })
    try {
      const p = await api.markFeePaid(cart.id)
      setState({ done: p.message })
      dispatch(T.carts()) // refresh the cart's status now, not at the next poll
    } catch (e) {
      setState({ error: e.message })
    }
  }
  return (
    <div className='mt-5'>
      <p className='mb-1 text-[11.5px] font-medium text-neutral-500'>
        PLATFORM FEE
      </p>
      <button
        onClick={markPaid}
        disabled={state.busy}
        className='rounded-md border border-line px-3 py-1.5 font-medium hover:bg-neutral-100 disabled:opacity-50'
      >
        {state.busy ? 'Marking…' : 'Mark fee paid'}
      </button>
      {state.done && <p className='mt-1.5 text-emerald-700'>{state.done}</p>}
      {state.error && <ErrorNote message={state.error} />}
    </div>
  )
}

// Suspend stops all orders (customer and vendor-entered) and blocks reopening
// from the vendor app; Resume lifts it. Both are recorded in the action log.
function SuspendCart({ cart }) {
  const dispatch = useDispatch()
  const [state, setState] = useState({})
  const suspended = cart.status === 'SUSPENDED'
  const run = async () => {
    let reason
    if (!suspended) {
      reason = await ask({
        title: `Suspend ${cart.name}?`,
        message: "It will stop taking orders and the vendor can't reopen it.",
        input: 'Reason (shown in the action log)',
        confirm: 'Suspend',
        danger: true,
      })
      if (reason === null) return
    } else if (
      !(await ask({
        title: `Resume ${cart.name}?`,
        message: 'The vendor will be able to open it again.',
        confirm: 'Resume',
      }))
    ) {
      return
    }
    setState({ busy: suspended ? 'Resuming…' : 'Suspending…' })
    try {
      if (suspended) await api.resumeCart(cart.id)
      else await api.suspendCart(cart.id, reason)
      // Stay busy until the list shows the new status, or the button flips
      // back for a moment and looks like the click didn't work.
      await dispatch(T.carts())
      setState({})
    } catch (e) {
      setState({ error: e.message })
    }
  }
  return (
    <div className='mt-5'>
      <p className='mb-1 text-[11.5px] font-medium text-neutral-500'>CART ACCESS</p>
      <button
        onClick={run}
        disabled={state.busy}
        className={`rounded-md border px-3 py-1.5 font-medium disabled:opacity-50 ${
          suspended
            ? 'border-line hover:bg-neutral-100'
            : 'border-red-200 text-red-600 hover:bg-red-50'
        }`}
      >
        {state.busy || (suspended ? 'Resume cart' : 'Suspend cart')}
      </button>
      {state.error && <ErrorNote message={state.error} />}
    </div>
  )
}

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
        {cart.status === 'SUSPENDED' && cart.suspendReason && (
          <p className='mt-2 text-[12px] text-neutral-500'>Reason: {cart.suspendReason}</p>
        )}
        <MarkFeePaid cart={cart} />
        <SuspendCart cart={cart} />
        <p className='mb-2 mt-5 text-[11.5px] font-medium text-neutral-500'>
          LAST 30 DAYS
        </p>
        {state.loading ? (
          <Skeleton rows={6} />
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
  const nav = useNavigate()
  const [params] = useSearchParams()
  // Every filter is in the URL (?status=LIVE&city=…&q=…).
  const [q, searchBox] = useSearchBox('Search carts or owners')
  const url = { status: useUrlState('status'), city: useUrlState('city'), owner: useUrlState('owner'), sort: useUrlState('sort') }
  const f = Object.fromEntries(Object.entries(url).map(([k, [v]]) => [k, v]))
  const ownerId = params.get('ownerId')
  const [open, setOpen] = useState(null)
  const set = (k) => (e) => url[k][1](e.target.value)
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
        (!ownerId || c.ownerId === ownerId) &&
        matches(c, q),
    )
    if (f.sort === 'newest') r = [...r].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    else if (f.sort) r = [...r].sort((a, b) => b[f.sort] - a[f.sort])
    return limit ? r.slice(0, limit) : r
  }, [carts, f.status, f.city, f.owner, f.sort, q, limit, ownerId])
  // All carts stay loaded (the map and filters need them); the table grows 30 rows per scroll.
  const reveal = useReveal(rows, JSON.stringify([f, q, ownerId]))

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
        subtitle={`${num(rows.length)} carts${ownerId ? ' · one owner' : ''}`}
        right={
          <div className='flex flex-wrap gap-1.5'>
            {searchBox}
            {ownerId && (
              <button
                onClick={() => nav('/restaurants')}
                className='px-1 text-[12px] font-medium text-brand hover:underline'
              >
                Show all owners
              </button>
            )}
            <Select
              value={f.status}
              onChange={set('status')}
              aria-label='Status'
            >
              <option value=''>All statuses</option>
              {['LIVE', 'OFFLINE', 'PAUSED', 'ATTENTION', 'SUSPENDED'].map((s) => (
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
              <option value='newest'>Newest first</option>
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
          rows={reveal.visible}
          onRow={setOpen}
          empty='No restaurants match these filters.'
        />
      </State>
      {!limit && <ScrollFooter {...reveal} count={rows.length} noun='carts' />}
      {open && (
        <CartDrawer
          cart={carts.find((c) => c.id === open.id) || open}
          onClose={() => setOpen(null)}
        />
      )}
    </Card>
  )
}

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../store/authSlice'
import useResource from '../hooks/useResource'
import { rangeParams } from '../store/adminSlice'
import OwnerTable from '../components/OwnerTable'
import RestaurantTable from '../components/RestaurantTable'
import RevenueChart from '../components/RevenueChart'
import OrdersChart from '../components/OrdersChart'
import StatusBadge from '../components/StatusBadge'
import KpiCard from '../components/KpiCard'
import { Card, CardHeader, Table, State, Seg, Btn } from '../components/ui'
import { IndianRupee, Wallet, Clock, ShoppingBag } from 'lucide-react'
import { inr, num, ago, ist, matches, ORDER_LABEL } from '../utils/format'
import { API_BASE, api } from '../services/api'
import { useRef, useCallback, useEffect } from 'react'

export function Owners() {
  const q = useSelector((s) => s.admin.search)
  const { data, loading, error } = useResource('owners')
  return (
    <OwnerTable
      title='All Owners'
      owners={(data || []).filter((o) => matches(o, q))}
      loading={loading}
      error={error}
    />
  )
}

export function Restaurants() {
  const { data, loading, error } = useResource('carts', null, 30000)
  return <RestaurantTable carts={data} loading={loading} error={error} />
}

export function Orders() {
  const q = useSelector((s) => s.admin.search)

  const [status, setStatus] = useState('')
  const [rows, setRows] = useState([])
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const observerRef = useRef(null)

  const loadOrders = useCallback(
    async (reset = false) => {
      if (loading) return
      if (!reset && !hasMore) return

      setLoading(true)
      setError(null)

      try {
        const result = await api.orders({
          limit: 50,
          status,
          ...(reset ? {} : cursor ? { cursor } : {}),
        })

        setRows((prev) => (reset ? result.data : [...prev, ...result.data]))

        setCursor(result.pagination.nextCursor || null)

        setHasMore(result.pagination.hasMore === true)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [status, cursor, hasMore, loading],
  )

  // Initial load + reload when status changes
  useEffect(() => {
    setRows([])
    setCursor(null)
    setHasMore(true)

    // Don't use the current cursor when resetting
    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const result = await api.orders({
          status,
        })

        setRows(result.data)
        setCursor(result.pagination.nextCursor || null)
        setHasMore(result.pagination.hasMore === true)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [status])

  // Infinite scroll observer
  const loadMoreRef = useCallback(
    (node) => {
      if (loading) return

      if (observerRef.current) {
        observerRef.current.disconnect()
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loading) {
            loadOrders(false)
          }
        },
        {
          rootMargin: '300px',
        },
      )

      if (node) {
        observerRef.current.observe(node)
      }
    },
    [loading, hasMore, loadOrders],
  )

  const cols = [
    {
      key: 'number',
      label: 'Order',
      render: (r) => <b>#{r.id.slice(-5)}</b>,
    },
    {
      key: 'cart',
      label: 'Restaurant',
    },
    {
      key: 'owner',
      label: 'Owner',
    },
    {
      key: 'items',
      label: 'Items',
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (r) => inr(r.amount),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={ORDER_LABEL[r.status] || r.status} />,
    },
    {
      key: 'createdAt',
      label: 'Placed',
      render: (r) => (
        <span className='text-neutral-500'>{ist(r.createdAt)}</span>
      ),
    },
  ]

  const filteredRows = rows.filter((r) => matches(r, q))

  return (
    <Card>
      <CardHeader
        title='Orders'
        subtitle={`Showing ${rows.length} orders`}
        right={
          <Seg
            value={status}
            onChange={setStatus}
            options={[
              ['', 'All'],
              ['PENDING', 'Pending'],
              ['PAID', 'Preparing'],
              ['SERVED', 'Served'],
              ['CANCELLED', 'Cancelled'],
            ]}
          />
        }
      />

      <State loading={loading && rows.length === 0} error={error}>
        <Table columns={cols} rows={filteredRows} empty='No orders found.' />

        {/* Infinite scroll trigger */}
        {hasMore && (
          <div ref={loadMoreRef} className='flex justify-center py-6'>
            {loading && (
              <span className='text-sm text-neutral-500'>
                Loading more orders...
              </span>
            )}
          </div>
        )}

        {!hasMore && rows.length > 0 && (
          <div className='py-6 text-center text-sm text-neutral-500'>
            You've reached the end.
          </div>
        )}
      </State>
    </Card>
  )
}

export function Analytics() {
  return (
    <div className='grid gap-3 xl:grid-cols-[1.6fr_1fr]'>
      <RevenueChart />
      <OrdersChart />
    </div>
  )
}

export function Revenue() {
  const range = useSelector((s) => s.admin.range)
  const ov = useResource('overview', rangeParams(range), 60000)
  const pay = useResource('payments')
  const k = ov.data?.kpis,
    s = pay.data?.summary
  return (
    <div className='space-y-3'>
      <State loading={ov.loading} error={ov.error}>
        <div className='grid grid-cols-2 gap-2.5 xl:grid-cols-4'>
          <KpiCard
            icon={IndianRupee}
            label='GMV (selected range)'
            value={inr(k?.gmvRange)}
            note={`${num(k?.ordersRange)} orders`}
          />
          <KpiCard
            icon={Wallet}
            label='Platform fee earned'
            value={inr(k?.platformFee)}
            note='from orders in range'
          />
          <KpiCard
            icon={ShoppingBag}
            label='Fees collected'
            value={inr(s?.VERIFIED?.amount)}
            note={`${s?.VERIFIED?.count || 0} verified payments`}
          />
          <KpiCard
            icon={Clock}
            label='Fees outstanding'
            value={inr(s?.PENDING?.amount)}
            note={`${s?.PENDING?.count || 0} pending`}
          />
        </div>
      </State>
      <RevenueChart />
    </div>
  )
}

export function Payments() {
  const q = useSelector((s) => s.admin.search)
  const { data, loading, error } = useResource('payments', null, 60000)
  const s = data?.summary || {}
  const cols = [
    {
      key: 'cart',
      label: 'Restaurant',
      render: (r) => <b className='font-medium'>{r.cart}</b>,
    },
    { key: 'owner', label: 'Owner' },
    { key: 'orders', label: 'Orders billed' },
    { key: 'amount', label: 'Platform fee', render: (r) => inr(r.amount) },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'billingDate',
      label: 'Billing day',
      render: (r) => ist(r.billingDate).split(',')[0],
    },
    {
      key: 'verifiedAt',
      label: 'Verified',
      render: (r) => (
        <span className='text-neutral-500'>
          {r.verifiedAt ? ist(r.verifiedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'source',
      label: 'Source',
      render: (r) => (
        <span className='text-neutral-500'>{r.source || '—'}</span>
      ),
    },
  ]
  return (
    <div className='space-y-3'>
      <div className='grid grid-cols-2 gap-2.5 xl:grid-cols-4'>
        {[
          ['VERIFIED', 'Verified'],
          ['PENDING', 'Pending'],
          ['REJECTED', 'Rejected'],
        ].map(([k, l]) => (
          <KpiCard
            key={k}
            icon={Wallet}
            label={l}
            value={inr(s[k]?.amount)}
            note={`${s[k]?.count || 0} payments`}
          />
        ))}
      </div>
      <Card>
        <CardHeader title='Platform fee payments' subtitle='Latest 200' />
        <State loading={loading} error={error}>
          <Table
            columns={cols}
            rows={(data?.items || []).filter((r) => matches(r, q))}
            empty='No payments yet.'
          />
        </State>
      </Card>
    </div>
  )
}

export function Feedback() {
  const q = useSelector((s) => s.admin.search)
  const { data, loading, error } = useResource('feedback')
  const items = (data?.items || []).filter((r) => matches(r, q))
  return (
    <Card>
      <CardHeader
        title='Customer Feedback'
        subtitle={`${num(data?.total)} total · showing latest 100`}
      />
      <State loading={loading} error={error}>
        {items.length ? (
          items.map((f) => (
            <div
              key={f.id}
              className='flex items-start justify-between gap-4 border-b border-line px-4 py-3 last:border-0'
            >
              <div>
                <p>“{f.text}”</p>
                <p className='text-[12px] text-neutral-500'>
                  {f.cart} · {f.owner} · Order #{f.number}
                </p>
              </div>
              <time className='whitespace-nowrap text-[11.5px] text-neutral-500'>
                {ago(f.at)}
              </time>
            </div>
          ))
        ) : (
          <p className='px-4 py-10 text-center text-neutral-500'>
            No feedback yet.
          </p>
        )}
      </State>
    </Card>
  )
}

export function SettingsPage() {
  const dispatch = useDispatch()
  const user = useSelector((s) => s.auth.user)
  return (
    <Card className='max-w-xl'>
      <CardHeader title='Account & connection' />
      <dl className='grid grid-cols-[120px_1fr] gap-y-2 px-4 py-4 text-[13px]'>
        <dt className='text-neutral-500'>Name</dt>
        <dd>{user?.name}</dd>
        <dt className='text-neutral-500'>Email</dt>
        <dd>{user?.email}</dd>
        <dt className='text-neutral-500'>Role</dt>
        <dd>{user?.role}</dd>
        <dt className='text-neutral-500'>API</dt>
        <dd>{API_BASE}</dd>
        <dt className='text-neutral-500'>Auth</dt>
        <dd>Dummy JWT (temporary)</dd>
      </dl>
      <div className='border-t border-line px-4 py-3'>
        <Btn onClick={() => dispatch(logout())}>Log out</Btn>
      </div>
    </Card>
  )
}

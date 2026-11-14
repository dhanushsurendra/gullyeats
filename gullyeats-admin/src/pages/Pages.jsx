import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import DateRange from '../components/DateRange'
import useUrlState, { useRange } from '../hooks/useUrlState'
import useSearchBox from '../hooks/useSearchBox'
import { logout } from '../store/authSlice'
import useResource from '../hooks/useResource'
import OwnerTable from '../components/OwnerTable'
import RestaurantTable from '../components/RestaurantTable'
import RevenueChart from '../components/RevenueChart'
import OrdersChart from '../components/OrdersChart'
import StatusBadge from '../components/StatusBadge'
import KpiCard from '../components/KpiCard'
import { Card, CardHeader, Table, State, Seg, Btn, ScrollFooter, ExportButton, Skeleton, ask } from '../components/ui'
import { billingDays, downloadCsv, fetchAll, istStamp, today } from '../utils/csv'
import usePaged from '../hooks/usePaged'
import { IndianRupee, Wallet, Clock, ShoppingBag, TrendingUp, PieChart, Ban, CheckCircle2 } from 'lucide-react'
import { inr, num, ago, ist, matches, signed, ORDER_LABEL } from '../utils/format'
import { API_BASE, api } from '../services/api'

export function Owners() {
  const [q, searchBox] = useSearchBox('Search owners')
  const { data, loading, error } = useResource('owners')
  return (
    <OwnerTable
      title='All Owners'
      search={searchBox}
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

const ORDER_STATUSES = [
  ['', 'All'],
  ['PENDING', 'Pending'],
  ['PAID', 'Preparing'],
  ['SERVED', 'Served'],
  ['CANCELLED', 'Cancelled'],
]

const orderPage = (filters) => (cursor) =>
  api.orders({ limit: 50, ...filters, cursor }).then((d) => ({ items: d.data, pagination: d.pagination }))

export function Orders() {
  const [status, setStatus] = useUrlState('status')
  const range = useRange('all')
  const [q, searchBox] = useSearchBox('Order #, cart or owner')
  const filters = { status, q, ...range.params }
  const p = usePaged(orderPage(filters), JSON.stringify(filters))

  const cols = [
    { key: 'number', label: 'Order', render: (r) => <b>#{r.number}</b> },
    { key: 'cart', label: 'Restaurant' },
    { key: 'owner', label: 'Owner' },
    { key: 'items', label: 'Items' },
    { key: 'amount', label: 'Amount', render: (r) => inr(r.amount) },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={ORDER_LABEL[r.status] || r.status} />,
    },
    {
      key: 'createdAt',
      label: 'Placed',
      render: (r) => <span className='text-neutral-500'>{ist(r.createdAt)}</span>,
    },
  ]

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        {searchBox}
        <DateRange range={range} all />
      </div>
      <Card>
        <CardHeader
          title={`Orders · ${range.label}`}
          subtitle={`Newest first · showing ${num(p.rows.length)}${q ? ` matching “${q}”` : ''}`}
          right={
            <div className='flex max-w-full flex-wrap items-center gap-2'>
              <Seg value={status} onChange={setStatus} options={ORDER_STATUSES} />
              <ExportButton run={() => exportOrders(filters)} />
            </div>
          }
        />
        <State loading={p.loading && !p.rows.length} error={!p.rows.length && p.error}>
          <Table columns={cols} rows={p.rows} empty={p.hasMore ? '' : 'No orders found.'} />
        </State>
        <ScrollFooter {...p} count={p.rows.length} noun='orders' />
      </Card>
    </div>
  )
}

const change = (v, invert = false, suffix = '%') =>
  v == null ? {} : { change: signed(v, suffix), tone: v >= 0 !== invert ? 'up' : 'down' }

// Fees, GMV and orders for the page's dates, then the all-time picture.
export function Revenue() {
  const range = useRange('30d')
  const ov = useResource('overview', range.params, 60000)
  const series = useResource('series', range.params, 60000)
  const k = ov.data?.kpis
  const vs = range.key === 'today' ? 'vs yesterday' : 'vs the period before'
  const sp = (f) => (series.data?.points || []).map((pt) => ({ v: f(pt) }))
  const cards = <Skeleton block='h-[118px]' />

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h2 className='text-[15px] font-bold tracking-tight'>
          Showing <span className='text-brand'>{range.label}</span>
        </h2>
        <DateRange range={range} />
      </div>
      <State loading={ov.loading} error={ov.error} skeleton={cards}>
        {k && (
          <div className='grid grid-cols-2 gap-3 xl:grid-cols-4'>
            <KpiCard
              featured
              icon={IndianRupee}
              label={`Fees collected · ${range.label}`}
              value={inr(k.revenueRange.value)}
              {...change(k.revenueRange.change)}
              note={vs}
              series={sp((pt) => pt.revenue)}
            />
            <KpiCard
              icon={Wallet}
              label='Fees earned'
              value={inr(k.platformFeeRange)}
              note='on paid orders placed, paid or not'
            />
            <KpiCard
              icon={TrendingUp}
              label='GMV'
              value={inr(k.orderGmvRange)}
              note="paid orders, carts' sales"
              series={sp((pt) => pt.gmv)}
            />
            <KpiCard
              icon={ShoppingBag}
              label='Orders'
              to={`/orders?${new URLSearchParams(range.key === 'custom' ? { from: range.from, to: range.to } : { range: range.key })}`}
              value={num(k.ordersRange.value)}
              {...change(k.ordersRange.change)}
              note={vs}
              series={sp((pt) => pt.orders)}
            />
            <KpiCard
              icon={CheckCircle2}
              label='Paid orders'
              value={num(series.data?.totals.paidOrders)}
              note='paid or served; fees and GMV count these'
            />
            <KpiCard icon={PieChart} label='Average order' value={inr(k.aov.value)} {...change(k.aov.change)} note={vs} />
            <KpiCard
              icon={Ban}
              label='Cancelled'
              value={`${k.cancelRate.value}%`}
              {...change(k.cancelRate.change, true, ' pp')}
              note={`of orders, ${vs}`}
            />
          </div>
        )}
      </State>
      <div className='grid gap-4 xl:grid-cols-[1.6fr_1fr]'>
        <RevenueChart series={series} label={range.label} />
        <OrdersChart series={series} label={range.label} />
      </div>
      <h2 className='pt-2 text-[15px] font-bold tracking-tight'>All time and this month</h2>
      <State loading={ov.loading} error={ov.error} skeleton={cards}>
        {k && (
          <div className='grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5'>
            <KpiCard
              icon={IndianRupee}
              label='Fees collected, all time'
              value={inr(k.totalRevenue.value)}
              note={`${num(k.totalRevenue.totalPayments)} payments`}
            />
            <KpiCard
              icon={IndianRupee}
              label='Fees collected this month'
              value={inr(k.revenueMonth.value)}
              {...change(k.revenueMonth.change)}
              note='vs same days last month'
            />
            <KpiCard icon={ShoppingBag} label='Orders, all time' value={num(k.totalOrders)} />
            <KpiCard
              icon={CheckCircle2}
              label='Collection rate'
              to='/collections'
              value={`${k.collectionRate}%`}
              note='of fees due so far, paid'
            />
            <KpiCard
              icon={Clock}
              label='Fees overdue now'
              to='/collections'
              value={inr(k.pendingPayments.amount)}
              note={`${num(k.pendingPayments.count)} orders · ${num(k.pendingPayments.carts)} carts`}
            />
          </div>
        )}
      </State>
    </div>
  )
}

const capped = (truncated, n) => (truncated ? `First ${num(n)} rows only.` : '')

async function exportPayments(q) {
  const { rows, truncated } = await fetchAll((cursor) => api.payments({ limit: 200, q, cursor }))
  downloadCsv(`gullyeats-platform-fees-${today()}.csv`, [
    { label: 'Cart', value: (r) => r.cart },
    { label: 'Owner', value: (r) => r.owner },
    { label: 'Billing days', value: (r) => billingDays(r.fromDate, r.billingDate) },
    { label: 'Orders billed', value: (r) => r.orders },
    { label: 'Platform fee (INR)', value: (r) => r.amount },
    { label: 'Status', value: (r) => r.status },
    { label: 'Verified at (IST)', value: (r) => istStamp(r.verifiedAt) },
    { label: 'Source', value: (r) => r.source },
    { label: 'Refunded (INR)', value: (r) => (r.refunds || []).filter((f) => f.status === 'REFUNDED').reduce((t, f) => t + f.amount, 0) || '' },
    { label: 'Created at (IST)', value: (r) => istStamp(r.createdAt) },
  ], rows)
  return capped(truncated, rows.length)
}

async function exportOrders(filters) {
  const { rows, truncated } = await fetchAll((cursor) =>
    api.orders({ limit: 500, ...filters, cursor }).then((d) => ({ items: d.data, pagination: d.pagination })),
  )
  downloadCsv(`gullyeats-orders${filters.status ? `-${filters.status.toLowerCase()}` : ''}-${today()}.csv`, [
    { label: 'Order no.', value: (r) => r.number },
    { label: 'Cart', value: (r) => r.cart },
    { label: 'Owner', value: (r) => r.owner },
    { label: 'Items', value: (r) => r.items },
    { label: 'Amount (INR)', value: (r) => r.amount },
    { label: 'Status', value: (r) => ORDER_LABEL[r.status] || r.status },
    { label: 'Payment', value: (r) => r.payment },
    { label: 'Placed at (IST)', value: (r) => istStamp(r.createdAt) },
  ], rows)
  return capped(truncated, rows.length)
}

export function Payments() {
  const [q, searchBox] = useSearchBox('Search cart or owner')
  const p = usePaged((cursor) => api.payments({ limit: 30, q, cursor }), q)
  const s = p.first?.summary || {}
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
      label: 'Billing days',
      render: (r) => billingDays(r.fromDate, r.billingDate),
    },
    {
      key: 'verifiedAt',
      label: 'Verified',
      render: (r) => <span className='text-neutral-500'>{r.verifiedAt ? ist(r.verifiedAt) : '—'}</span>,
    },
    {
      key: 'source',
      label: 'Source',
      render: (r) => (
        <span className='text-neutral-500'>
          {r.source || '—'}
          {r.refunds?.map((f) => (
            <span
              key={f.razorpayPaymentId}
              title={f.error || f.refundId || ''}
              className={`ml-1.5 font-medium ${f.status === 'FAILED' ? 'text-red-600' : 'text-amber-700'}`}
            >
              · {f.status === 'FAILED' ? 'refund failed' : 'duplicate refunded'} {inr(f.amount)}
            </span>
          ))}
        </span>
      ),
    },
  ]
  return (
    <div className='space-y-3'>
      <div className='grid grid-cols-2 gap-2.5 xl:grid-cols-4'>
        {[
          ['VERIFIED', 'Verified, all time'],
          ['PENDING', 'Pending'],
          ['REJECTED', 'Rejected, all time'],
        ].map(([k, l]) => (
          <KpiCard key={k} icon={Wallet} label={l} value={inr(s[k]?.amount)} note={`${s[k]?.count || 0} payments`} />
        ))}
      </div>
      <Card>
        <CardHeader
          title='Platform fee payments'
          subtitle={`Newest first · showing ${num(p.rows.length)}${q ? ` matching “${q}”` : ''}`}
          right={
            <div className='flex flex-wrap items-center gap-2'>
              {searchBox}
              <ExportButton run={() => exportPayments(q)} />
            </div>
          }
        />
        <State loading={p.loading && !p.rows.length} error={!p.rows.length && p.error}>
          <Table columns={cols} rows={p.rows} empty={p.hasMore ? '' : 'No payments found.'} />
        </State>
        <ScrollFooter {...p} count={p.rows.length} noun='payments' />
      </Card>
    </div>
  )
}

export function Feedback() {
  const [q, searchBox] = useSearchBox('Words, cart, owner or order #')
  const p = usePaged((cursor) => api.feedback({ limit: 30, q, cursor }), q)
  const items = p.rows
  return (
    <Card>
      <CardHeader
        title='Customer Feedback'
        subtitle={`${num(p.first?.total)} ${q ? `matching “${q}”` : 'total'} · showing ${num(p.rows.length)}`}
        right={searchBox}
      />
      <State loading={p.loading && !p.rows.length} error={!p.rows.length && p.error}>
        {items.length ? (
          items.map((f) => (
            <div
              key={f.id}
              className='flex items-start justify-between gap-4 border-b border-line px-4 py-3 last:border-0'
            >
              <div>
                {f.rating ? (
                  <p className='text-amber-500' aria-label={`${f.rating} of 5 stars`}>
                    {'★'.repeat(f.rating)}
                    <span className='text-neutral-300'>{'★'.repeat(5 - f.rating)}</span>
                  </p>
                ) : null}
                {f.text && <p>“{f.text}”</p>}
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
          !p.loading && !p.hasMore && (
            <p className='px-4 py-10 text-center text-neutral-500'>No feedback yet.</p>
          )
        )}
      </State>
      <ScrollFooter {...p} count={p.rows.length} noun='feedback' />
    </Card>
  )
}

export function SettingsPage() {
  const dispatch = useDispatch()
  const user = useSelector((s) => s.auth.user)
  return (
    <div className='space-y-4'>
    <ResetVendorPin />
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
        <dd>{API_BASE || `${window.location.origin}/api (passed on to the backend)`}</dd>
        <dt className='text-neutral-500'>Auth</dt>
        <dd>Login cookie (httpOnly, 7 days)</dd>
      </dl>
      <div className='border-t border-line px-4 py-3'>
        <Btn onClick={() => dispatch(logout())}>Log out</Btn>
      </div>
    </Card>
    </div>
  )
}

function ResetVendorPin() {
  const [vendorId, setVendorId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    const id = vendorId.trim()
    if (!id) return
    if (
      !(await ask({
        title: `Generate a new PIN for ${id}?`,
        message: 'Their current PIN will stop working.',
        confirm: 'Reset PIN',
        danger: true,
      }))
    )
      return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      setResult(await api.resetVendorPin(id))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className='max-w-xl'>
      <CardHeader title='Reset vendor PIN' />
      <form onSubmit={submit} className='flex flex-wrap items-end gap-2 px-4 py-4 text-[13px]'>
        <label className='flex flex-1 flex-col gap-1'>
          <span className='text-neutral-500'>Vendor ID</span>
          <input
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            placeholder='VEN-XXXXXX'
            className='rounded-md border border-line px-2.5 py-1.5 uppercase outline-none focus:border-brand'
          />
        </label>
        <Btn primary type='submit' disabled={busy || !vendorId.trim()} className='py-1.5'>
          {busy ? 'Generating…' : 'Generate new PIN'}
        </Btn>
      </form>
      {error && <p className='px-4 pb-4 text-[13px] text-red-600'>{error}</p>}
      {result && (
        <div className='border-t border-line px-4 py-3 text-[13px]'>
          New PIN for {result.name ? `${result.name} (${result.userId})` : result.userId}:{' '}
          <span className='font-mono text-lg font-semibold tracking-widest'>{result.pin}</span>
          <p className='text-neutral-500'>Shown once. Share it with the vendor now.</p>
        </div>
      )}
    </Card>
  )
}

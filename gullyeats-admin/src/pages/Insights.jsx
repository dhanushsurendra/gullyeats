import { useSearchParams } from 'react-router-dom'
import {
  TrendingUp,
  IndianRupee,
  Store,
  ShoppingBag,
  Wallet,
  UserPlus,
  Zap,
  Moon,
  AlertTriangle,
  QrCode,
  Package,
  Timer,
  Repeat,
} from 'lucide-react'
import useResource from '../hooks/useResource'
import { useReveal } from '../hooks/usePaged'
import KpiCard from '../components/KpiCard'
import { Card, CardHeader, Table, State, Seg, ScrollFooter } from '../components/ui'
import { inr, num, signed, ago } from '../utils/format'

const TABS = [
  ['growth', 'Growth'],
  ['vendors', 'Vendors'],
  ['leakage', 'Fee leakage'],
  ['operations', 'Customers & Ops'],
]

export default function Insights() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'growth'
  const View = { growth: Growth, vendors: Vendors, leakage: Leakage, operations: Operations }[tab]
  return (
    <div className='space-y-3'>
      <Seg options={TABS} value={tab} onChange={(t) => setParams({ tab: t })} />
      <View />
    </div>
  )
}

const Kpis = ({ children }) => (
  <div className='grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5'>{children}</div>
)
const Phone = ({ n }) =>
  n ? (
    <a href={`tel:${n}`} className='text-brand hover:underline'>
      {n}
    </a>
  ) : (
    '—'
  )
const withId = (rows = []) => rows.map((r, i) => ({ ...r, id: r.cartId || r.city || r.week || i }))

// Shows a full in-memory list 30 rows at a time as the end scrolls into view.
function RevealTable({ rows, columns, empty, noun }) {
  const reveal = useReveal(rows, rows.length)
  return (
    <>
      <Table columns={columns} rows={reveal.visible} empty={empty} />
      <ScrollFooter {...reveal} count={rows.length} noun={noun} />
    </>
  )
}

// ------------------------------------------------------------------
function Growth() {
  const { data: d, loading, error } = useResource('growth', null, 60000)
  const r = d?.runRate
  const u = d?.unit
  const cols = [
    { key: 'city', label: 'City', render: (c) => <b className='font-medium'>{c.city}</b> },
    { key: 'carts', label: 'Carts', render: (c) => num(c.carts) },
    { key: 'live', label: 'Live now', render: (c) => num(c.live) },
    { key: 'active30', label: 'Active (30d)', render: (c) => num(c.active30) },
    { key: 'orders30', label: 'Paid orders (30d)', render: (c) => num(c.orders30) },
    { key: 'gmv30', label: 'GMV (30d)', render: (c) => <b>{inr(c.gmv30)}</b> },
    { key: 'fees30', label: 'Our fees (30d)', render: (c) => inr(c.fees30) },
    {
      key: 'growth',
      label: 'GMV vs prev 30d',
      render: (c) =>
        c.growth == null ? (
          <span className='text-neutral-400'>—</span>
        ) : (
          <span className={c.growth < 0 ? 'font-semibold text-red-600' : 'font-semibold text-green-600'}>
            {signed(c.growth)}
          </span>
        ),
    },
  ]
  return (
    <State loading={loading} error={error}>
      <Kpis>
        <KpiCard
          icon={TrendingUp}
          label='Projected this month'
          value={inr(r?.projectedMonth)}
          note={`at this month's pace (day ${r?.elapsedDays} of ${r?.daysInMonth})`}
        />
        <KpiCard icon={IndianRupee} label='Fees earned this month' value={inr(r?.mtdFees)} note={`GMV ${inr(r?.mtdGmv)}`} />
        <KpiCard icon={Wallet} label='Collected this month' value={inr(r?.collectedMtd)} note='verified fee payments' />
        <KpiCard icon={IndianRupee} label='Fees, last 30 days' value={inr(r?.last30Fees)} note='earned on paid orders' />
        <KpiCard icon={Store} label='Active carts (30d)' value={num(u?.activeCarts)} note='at least 1 paid order' />
        <KpiCard icon={IndianRupee} label='Fees per active cart' value={inr(u?.feesPerActiveCart)} note='last 30 days' />
        <KpiCard icon={IndianRupee} label='GMV per active cart' value={inr(u?.gmvPerActiveCart)} note='last 30 days' />
        <KpiCard icon={ShoppingBag} label='Orders / cart / day' value={u?.ordersPerCartPerDay ?? 0} note='active carts, 30 days' />
        <KpiCard icon={ShoppingBag} label='Average order value' value={inr(u?.aov)} note='paid orders, 30 days' />
      </Kpis>
      <Card className='mt-3'>
        <CardHeader title='Cities' subtitle='Paid orders only · sorted by GMV' />
        <Table columns={cols} rows={withId(d?.cities)} empty='No carts yet.' />
      </Card>
    </State>
  )
}

// ------------------------------------------------------------------
function Vendors() {
  const { data: d, loading, error } = useResource('vendors', null, 60000)
  const s = d?.summary
  const cohortCols = [
    { key: 'week', label: 'Onboarded week of', render: (c) => <b className='font-medium'>{c.week}</b> },
    { key: 'onboarded', label: 'Carts' },
    {
      key: 'firstOrderIn3Days',
      label: 'First order ≤ 3 days',
      render: (c) => (c.onboarded ? `${c.firstOrderIn3Days} (${c.activationRate}%)` : '—'),
    },
    { key: 'activeNow', label: 'Active now (7d)' },
    { key: 'quiet', label: 'Quiet (14d+)' },
    { key: 'neverOrdered', label: 'Never ordered' },
  ]
  const riskCols = [
    { key: 'cart', label: 'Cart', render: (c) => <b className='font-medium'>{c.cart}</b> },
    { key: 'city', label: 'City' },
    { key: 'owner', label: 'Owner' },
    { key: 'phone', label: 'Phone', render: (c) => <Phone n={c.phone} /> },
    { key: 'prev7', label: 'Orders, prev 7d' },
    { key: 'last7', label: 'Orders, last 7d' },
    { key: 'drop', label: 'Drop', render: (c) => <b className='text-red-600'>−{c.drop}%</b> },
    { key: 'isOpen', label: 'Open now', render: (c) => (c.isOpen ? 'Yes' : 'No') },
    { key: 'lastOrder', label: 'Last order', render: (c) => <span className='text-neutral-500'>{ago(c.lastOrder)}</span> },
  ]
  return (
    <State loading={loading} error={error}>
      <Kpis>
        <KpiCard icon={Store} label='Carts' value={num(s?.carts)} note='all onboarded' />
        <KpiCard
          icon={UserPlus}
          label='Ever got an order'
          value={num(s?.everOrdered)}
          note={`${s?.carts ? ((s.everOrdered / s.carts) * 100).toFixed(1) : 0}% activated`}
        />
        <KpiCard icon={Zap} label='Active now' value={num(s?.activeNow)} note='an order in the last 7 days' />
        <KpiCard icon={Moon} label='Gone quiet' value={num(s?.quiet)} note='ordered before, none in 14 days' />
        <KpiCard icon={AlertTriangle} label='Never ordered' value={num(s?.neverOrdered)} note='onboarded, no orders yet' />
      </Kpis>
      <Card className='mt-3'>
        <CardHeader
          title='At risk'
          subtitle='Orders fell by more than half this week (5+ orders the week before) · call before they leave'
        />
        <RevealTable rows={withId(d?.atRisk)} columns={riskCols} empty='No cart is dropping off right now.' noun='carts' />
      </Card>
      <Card className='mt-3'>
        <CardHeader
          title='Activation by onboarding week'
          subtitle='Carts onboarded each week (last 12), and how they are doing now'
        />
        <Table columns={cohortCols} rows={withId(d?.cohorts)} />
      </Card>
    </State>
  )
}

// ------------------------------------------------------------------
function Leakage() {
  const { data: d, loading, error } = useResource('leakage', null, 60000)
  const cols = [
    { key: 'cart', label: 'Cart', render: (c) => <b className='font-medium'>{c.cart}</b> },
    { key: 'city', label: 'City' },
    { key: 'owner', label: 'Owner' },
    { key: 'phone', label: 'Phone', render: (c) => <Phone n={c.phone} /> },
    { key: 'orders', label: 'Orders (30d)' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'unpaid', label: 'Never paid' },
    { key: 'leakRate', label: 'Lost share', render: (c) => <b className='text-red-600'>{c.leakRate}%</b> },
    { key: 'manualShare', label: 'Manual orders', render: (c) => `${c.manualShare}%` },
    { key: 'feesAtRisk', label: 'Fees lost', render: (c) => inr(c.feesAtRisk) },
  ]
  return (
    <State loading={loading} error={error}>
      <Card>
        <CardHeader
          title='Carts that may be avoiding the platform fee'
          subtitle={
            d &&
            `Last 30 days. Platform-wide, ${d.platform.rate}% of orders end cancelled or never paid. ` +
              `Flagged: ${d.minOrders}+ orders and at least ${d.platform.threshold}% lost ` +
              '(twice the platform rate, minimum 25%). "Never paid" = still unpaid after 2 hours.'
          }
        />
        <RevealTable rows={withId(d?.items)} columns={cols} empty='No cart stands out.' noun='carts' />
      </Card>
      <p className='mt-2 px-1 text-[12px] text-neutral-500'>
        A flag is a reason to check, not proof: a cart can have a genuinely bad week. Cash taken without
        creating any order can't be seen here.
      </p>
    </State>
  )
}

// ------------------------------------------------------------------
function Heatmap({ days, cells, max }) {
  return (
    <div className='overflow-x-auto px-4 py-3'>
      <div className='grid min-w-[640px] grid-cols-[36px_repeat(24,1fr)] gap-[3px] text-[10.5px] text-neutral-500'>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className='text-center'>
            {h % 3 === 0 ? h : ''}
          </span>
        ))}
        {days.map((d, i) => (
          <div key={d} className='contents'>
            <span className='self-center'>{d}</span>
            {cells[i].map((n, h) => (
              <span
                key={h}
                title={`${d} ${h}:00–${h + 1}:00 · ${n} paid orders`}
                className='h-5 rounded-[3px] border border-line'
                style={{ background: n ? `rgba(249,115,22,${0.12 + (0.88 * n) / (max || 1)})` : undefined }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Operations() {
  const { data: d, loading, error } = useResource('operations', null, 60000)
  const c = d?.channels
  const sv = d?.service
  const rp = d?.repeat
  const slowCols = [
    { key: 'cart', label: 'Cart', render: (x) => <b className='font-medium'>{x.cart}</b> },
    { key: 'city', label: 'City' },
    { key: 'owner', label: 'Owner' },
    { key: 'served', label: 'Served (30d)' },
    { key: 'avgMins', label: 'Avg paid → served', render: (x) => <b>{x.avgMins} min</b> },
  ]
  const repeatCols = [
    { key: 'cart', label: 'Cart', render: (x) => <b className='font-medium'>{x.cart}</b> },
    { key: 'city', label: 'City' },
    { key: 'customers', label: 'Customers (90d)' },
    { key: 'repeaters', label: 'Came back' },
    { key: 'rate', label: 'Repeat rate', render: (x) => <b>{x.rate}%</b> },
  ]
  return (
    <State loading={loading} error={error}>
      <Kpis>
        <KpiCard icon={QrCode} label='QR orders' value={`${c?.qrShare ?? 0}%`} note={`${num(c?.qr)} of ${num(c?.orders)} paid · AOV ${inr(c?.qrAov)}`} />
        <KpiCard icon={ShoppingBag} label='Manual orders' value={`${c ? (100 - c.qrShare).toFixed(1) : 0}%`} note={`entered by vendor · AOV ${inr(c?.manualAov)}`} />
        <KpiCard icon={Package} label='Parcel orders' value={`${c?.parcelShare ?? 0}%`} note='where a parcel charge applied' />
        <KpiCard icon={Timer} label='Paid → served' value={`${sv?.avgMins ?? 0} min`} note={`average of ${num(sv?.served)} orders`} />
        <KpiCard icon={Repeat} label='Repeat customers' value={`${rp?.rate ?? 0}%`} note={`${num(rp?.repeaters)} of ${num(rp?.customers)} came back (90d)`} />
      </Kpis>
      <Card className='mt-3'>
        <CardHeader title='When customers order' subtitle='Paid orders in the last 30 days, by IST day and hour' />
        {d && <Heatmap {...d.heatmap} />}
      </Card>
      <div className='mt-3 grid gap-3 xl:grid-cols-2'>
        <Card>
          <CardHeader title='Slowest to serve' subtitle={`Carts with 10+ served orders in 30 days · waits over 3h left out`} />
          <Table columns={slowCols} rows={withId(sv?.slowest)} empty='Not enough served orders yet.' />
        </Card>
        <Card>
          <CardHeader title='Best repeat rate' subtitle='Carts with 10+ customers in 90 days (customers who gave a phone number)' />
          <Table columns={repeatCols} rows={withId(rp?.topCarts)} empty='Not enough repeat data yet.' />
        </Card>
      </div>
    </State>
  )
}

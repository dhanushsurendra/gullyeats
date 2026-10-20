import { useSelector } from 'react-redux'
import {
  Users,
  CheckCircle2,
  Store,
  Zap,
  ShoppingBag,
  IndianRupee,
  TrendingUp,
  PieChart,
  Clock,
  Ban,
  ArrowRight,
} from 'lucide-react'
import useResource from '../hooks/useResource'
import { rangeParams } from '../store/adminSlice'
import KpiCard from '../components/KpiCard'
import ActivityFeed from '../components/ActivityFeed'
import CartMap from '../components/CartMap'
import RevenueChart from '../components/RevenueChart'
import OrdersChart from '../components/OrdersChart'
import OwnerTable from '../components/OwnerTable'
import RestaurantTable from '../components/RestaurantTable'
import AttentionPanel from '../components/AttentionPanel'
import StatusBadge from '../components/StatusBadge'
import { Card, CardHeader, Table, State } from '../components/ui'
import { inr, num, signed, ago, ORDER_LABEL } from '../utils/format'
import { useNavigate } from 'react-router-dom'

const chg = (v, invert = false, suffix = '%') =>
  v == null
    ? {}
    : { change: signed(v, suffix), tone: v >= 0 !== invert ? 'up' : 'down' }
const HEALTH = [
  ['api', 'API'],
  ['database', 'Database'],
  ['payments', 'Payments'],
  ['orderProcessing', 'Order Processing'],
  ['websocket', 'WebSocket'],
]

export default function Dashboard() {
  const nav = useNavigate()
  const range = useSelector((s) => s.admin.range)
  const q = useSelector((s) => s.admin.search)
  const ov = useResource('overview', rangeParams(range), 30000)
  const act = useResource('activity', null, 30000)
  const owners = useResource('owners')
  const carts = useResource('carts', null, 30000)
  const orders = useResource('orders', { limit: 8 }, 30000)
  const o = ov.data,
    k = o?.kpis
  const sp = (f) => (o?.spark || []).map((p) => ({ v: f(p) }))
  const allOk = o && Object.values(o.health).every(Boolean)
  const hour = new Date().getHours()
  const greet =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const cards = k && [
    // ==================================================
    // 💰 GULLYEATS BUSINESS
    // ==================================================

    {
      label: 'Total Revenue',
      icon: IndianRupee,
      value: inr(k.totalRevenue.value),
      note: 'All-time GullyEats revenue',
    },

    {
      label: 'Revenue Today',
      icon: TrendingUp,
      value: inr(k.revenueToday.value),
      ...chg(k.revenueToday.change),
      note: 'vs yesterday',
      series: sp((p) => p.revenue),
    },

    {
      label: 'Revenue This Month',
      icon: IndianRupee,
      value: inr(k.revenueMonth.value),
      ...chg(k.revenueMonth.change),
      note: 'vs same days last month',
    },

    // ==================================================
    // 🛒 ORDERS
    // ==================================================

    {
      label: 'Total Orders',
      icon: ShoppingBag,
      value: num(k.totalOrders),
      note: 'All-time orders',
    },

    {
      label: 'Orders Today',
      icon: ShoppingBag,
      value: num(k.ordersToday.value),
      ...chg(k.ordersToday.change),
      note: 'vs yesterday',
      series: sp((p) => p.orders),
    },

    // ==================================================
    // 👥 PLATFORM
    // ==================================================

    {
      label: 'Total Owners',
      icon: Users,
      value: num(k.totalOwners.value),
      change: `+${k.totalOwners.delta}`,
      tone: 'up',
      note: 'new in range',
    },

    {
      label: 'Active Owners',
      icon: CheckCircle2,
      value: num(k.activeOwners.value),
      note: `${k.activeOwners.share}% of total`,
    },

    {
      label: 'Total Carts',
      icon: Store,
      value: num(k.totalCarts.value),
      change: `+${k.totalCarts.delta}`,
      tone: 'up',
      note: 'new in range',
    },

    {
      label: 'Live Carts',
      icon: Zap,
      value: num(k.liveCarts.value),
      note: 'Currently accepting orders',
    },

    // ==================================================
    // 💳 PAYMENT HEALTH
    // ==================================================

    {
      label: 'Pending Payments',
      icon: Clock,
      value: inr(k.pendingPayments.amount),
      change: `${k.pendingPayments.count} pending`,
      tone: k.pendingPayments.count ? 'down' : 'neutral',
      note: 'platform fees due',
    },

    {
      label: 'Rejected Payments',
      icon: Ban,
      value: inr(k.rejectedPayments.amount),
      change: `${k.rejectedPayments.count} rejected`,
      tone: k.rejectedPayments.count ? 'down' : 'neutral',
      note: 'payment transactions',
    },

    {
      label: 'Collection Rate',
      icon: CheckCircle2,
      value: `${k.collectionRate}%`,
      note: 'revenue successfully collected',
    },

    // ==================================================
    // 📦 ORDER ECONOMICS
    // ==================================================

    {
      label: 'Average Order Value',
      icon: PieChart,
      value: inr(k.aov.value),
      ...chg(k.aov.change),
      note: 'vs previous period',
      series: sp((p) =>
        p.orders - p.cancelled ? p.gmv / (p.orders - p.cancelled) : 0,
      ),
    },

    {
      label: 'Cancellation Rate',
      icon: Ban,
      value: `${k.cancelRate.value}%`,
      ...chg(k.cancelRate.change, true, ' pp'),
      note: 'vs previous period',
    },
  ]
  const live = o && [
    ['Live Restaurants', o.live.liveCarts, 'text-brand'],
    ['Orders Preparing', o.live.preparing],
    ['Orders Pending Payment', o.live.pendingPayment],
    ['Orders Served Today', o.live.served],
    ['Cancelled Today', o.live.cancelled],
  ]
  const orderCols = [
    { key: 'number', label: 'Order', render: (r) => <b>#{r.id.slice(-5)}</b> },
    { key: 'cart', label: 'Restaurant' },
    { key: 'owner', label: 'Owner' },
    { key: 'amount', label: 'Amount', render: (r) => inr(r.amount) },
    {
      key: 'payment',
      label: 'Payment',
      render: (r) => <StatusBadge status={r.payment} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={ORDER_LABEL[r.status] || r.status} />,
    },
    {
      key: 'createdAt',
      label: 'Time',
      render: (r) => (
        <span className='text-neutral-500'>{ago(r.createdAt)}</span>
      ),
    },
  ]

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h2 className='text-[20px] font-semibold tracking-tight'>
            {greet}, Admin
          </h2>
          <p className='text-neutral-500'>
            Here's what's happening across GullyEats.
          </p>
        </div>
        {o && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px]
               font-medium ${allOk ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}
          >
            <i className='pulse-dot h-1.5 w-1.5 rounded-full bg-current' />
            {allOk ? 'All systems operational' : 'Some systems need attention'}
          </span>
        )}
      </div>

      <State loading={ov.loading} error={ov.error}>
        <div className='grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5'>
          {cards?.map((c) => (
            <KpiCard key={c.label} {...c} />
          ))}
        </div>
      </State>

      <div className='grid gap-3 xl:grid-cols-[1.5fr_1fr]'>
        <ActivityFeed
          items={act.data}
          loading={act.loading}
          error={act.error}
        />
        <Card className='h-full'>
          <CardHeader
            title='Live Platform Status'
            subtitle='Orders counted since midnight IST'
          />
          <State loading={ov.loading} error={ov.error}>
            {live?.map(([l, v, c]) => (
              <div
                key={l}
                className='flex items-center justify-between border-b border-line
                 px-4 py-3 last:border-0'
              >
                <span className='text-neutral-500'>{l}</span>
                <b className={`text-[16px] font-semibold ${c || ''}`}>
                  {num(v)}
                </b>
              </div>
            ))}
          </State>
        </Card>
      </div>

      <CartMap carts={carts.data} loading={carts.loading} error={carts.error} />

      <div className='grid gap-3 xl:grid-cols-[1.6fr_1fr]'>
        <RevenueChart />
        <OrdersChart />
      </div>

      <div className='grid gap-3 xl:grid-cols-[1.6fr_1fr]'>
        <OwnerTable
          owners={(owners.data || []).filter(
            (x) => !q || x.name.toLowerCase().includes(q.toLowerCase()),
          )}
          limit={5}
          loading={owners.loading}
          error={owners.error}
        />
        <AttentionPanel items={o?.attention} />
      </div>

      <RestaurantTable
        carts={carts.data}
        limit={10}
        loading={carts.loading}
        error={carts.error}
      />

      <div className='grid gap-3 xl:grid-cols-[1.6fr_1fr]'>
        <Card>
          <CardHeader
            title='Recent Orders'
            right={
              <button
                onClick={() => nav('/orders')}
                className='flex items-center gap-1 text-[12px] font-medium text-brand hover:underline'
              >
                View all <ArrowRight size={12} />
              </button>
            }
          />
          <State loading={orders.loading} error={orders.error}>
            <Table
              columns={orderCols}
              rows={orders.data || []}
              empty='No orders yet.'
            />
          </State>
        </Card>
        <div className='space-y-3'>
          <Card>
            <CardHeader
              title='Customer Feedback'
              right={
                <button
                  onClick={() => nav('/feedback')}
                  className='text-[12px] font-medium text-brand hover:underline'
                >
                  View feedback
                </button>
              }
            />
            <div className='grid grid-cols-2 border-b border-line'>
              {[
                ['Feedback received', num(o?.feedback.total)],
                ['Of all orders', `${o?.feedback.rate ?? 0}%`],
              ].map(([a, b]) => (
                <div
                  key={a}
                  className='border-r border-line px-4 py-2.5 last:border-0'
                >
                  <small className='block text-neutral-500'>{a}</small>
                  <b className='text-[16px] font-semibold'>{b}</b>
                </div>
              ))}
            </div>
            {o?.feedback.recent.length ? (
              o.feedback.recent.map((f, i) => (
                <p
                  key={i}
                  className='border-b border-line px-4 py-2 last:border-0'
                >
                  “{f.text}”{' '}
                  <span className='text-[11.5px] text-neutral-500'>
                    · {f.cart}
                  </span>
                </p>
              ))
            ) : (
              <p className='px-4 py-6 text-center text-neutral-500'>
                No feedback yet.
              </p>
            )}
          </Card>
          <Card>
            <CardHeader title='Platform Health' />
            {HEALTH.map(([key, label]) => {
              const ok = o?.health[key]
              return (
                <div
                  key={key}
                  className='flex items-center justify-between border-b border-line
                   px-4 py-2.5 last:border-0'
                >
                  <span>{label}</span>
                  <StatusBadge
                    status={ok ? 'ACTIVE' : 'ATTENTION'}
                    label={ok ? 'Operational' : 'Down'}
                  />
                </div>
              )
            })}
          </Card>
        </div>
      </div>
    </div>
  )
}

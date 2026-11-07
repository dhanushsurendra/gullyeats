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
} from 'lucide-react'
import useResource from '../hooks/useResource'
import { rangeParams } from '../store/adminSlice'
import KpiCard from '../components/KpiCard'
import ActivityFeed from '../components/ActivityFeed'
import CartMap from '../components/CartMap'
import AttentionPanel from '../components/AttentionPanel'
import StatusBadge from '../components/StatusBadge'
import { Card, CardHeader, State } from '../components/ui'
import { inr, num, signed } from '../utils/format'

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
  const range = useSelector((s) => s.admin.range)
  const ov = useResource('overview', rangeParams(range), 30000)
  const act = useResource('activity', null, 30000)
  const carts = useResource('carts', null, 30000)
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
      label: 'Overdue Fees',
      icon: Clock,
      value: inr(k.pendingPayments.amount),
      change: `${num(k.pendingPayments.count)} orders`,
      tone: k.pendingPayments.count ? 'down' : 'neutral',
      note: `overdue fees · ${num(k.pendingPayments.carts)} carts`,
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
      note: 'of fees due so far, paid',
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
      series: sp((p) => p.aov),
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
        <AttentionPanel items={o?.attention} />
        <div>
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

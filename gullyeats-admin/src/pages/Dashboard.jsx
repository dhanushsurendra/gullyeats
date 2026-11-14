import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { T } from '../store/adminSlice'
import { Link } from 'react-router-dom'
import {
  Bell,
  ChevronRight,
  Store,
  Wallet,
  Zap,
  TrendingDown,
  CheckCircle2,
  IndianRupee,
  TrendingUp,
  Clock,
  Ban,
} from 'lucide-react'
import useResource from '../hooks/useResource'
import KpiCard from '../components/KpiCard'
import ActivityFeed from '../components/ActivityFeed'
import CartMap from '../components/CartMap'
import AttentionPanel from '../components/AttentionPanel'
import StatusBadge from '../components/StatusBadge'
import { Card, CardHeader, State } from '../components/ui'
import { useOpenNotification } from '../components/NotificationsLive'

const KPI_SKELETON = (
  <div role='status' aria-label='Loading' className='grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5'>
    {[0, 1, 2, 3, 4].map((i) => (
      <div key={i} className='skeleton h-[118px] rounded-2xl' />
    ))}
  </div>
)
import { inr, num, signed, ago } from '../utils/format'

const chg = (v, invert = false, suffix = '%') =>
  v == null
    ? {}
    : { change: signed(v, suffix), tone: v >= 0 !== invert ? 'up' : 'down' }
// Platform Health row states (backend utils/platformHealth.js) as badges.
const HEALTH_BADGE = {
  ok: ['ACTIVE', 'OK'],
  warn: ['PENDING', 'Check'],
  bad: ['ATTENTION', 'Down'],
}

const TODAY = { range: 'today' }

export default function Dashboard() {
  const dispatch = useDispatch()
  const firstName = useSelector((s) => s.auth.user?.name)?.split(' ')[0] || 'Admin'
  // Every minute; anything urgent arrives sooner as a notification, which
  // also refreshes the cards (below).
  const ov = useResource('overview', TODAY, 60000)
  const notes = useSelector((s) => s.notify.items).slice(0, 5)
  const openNote = useOpenNotification()
  const act = useResource('activity', null, 60000)
  // Cart-level insights, refreshed every 5 minutes.
  const vendors = useResource('vendors', null, 300000)
  const leakage = useResource('leakage', null, 300000)
  const carts = useResource('carts', null, 60000)
  // A new notification (not the list loading on open) refreshes the cards.
  const latest = notes[0]?.id
  const seen = useRef(latest)
  useEffect(() => {
    if (seen.current && latest !== seen.current) dispatch(T.overview(TODAY))
    seen.current = latest
  }, [latest, dispatch])
  const o = ov.data,
    k = o?.kpis
  const sp = (f) => (o?.spark || []).map((p) => ({ v: f(p) }))
  // An old backend sends health as an object of booleans: show no rows then.
  const health = Array.isArray(o?.health) ? o.health : []
  const allOk = o && health.every((h) => h.state === 'ok')
  const hour = new Date().getHours()
  const greet =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // GullyEats' own numbers: money in, money owed, and how the cart network is
  // doing. How each cart trades (orders, GMV, average order) is on Revenue.
  const atRisk = vendors.data?.atRisk?.length
  const leaking = leakage.data?.items?.length
  const cards = k && [
    {
      label: 'Fees collected today',
      to: '/payments',
      featured: true,
      icon: IndianRupee,
      value: inr(k.revenueToday.value),
      ...chg(k.revenueToday.change),
      note: 'vs yesterday',
      series: sp((p) => p.revenue),
    },
    {
      label: 'Fees earned today',
      to: '/revenue?range=today',
      icon: Wallet,
      value: inr(k.feesEarnedToday?.value),
      note: `from ${num(k.feesEarnedToday?.paidOrders)} paid orders, due tomorrow`,
    },
    {
      label: 'Fees this month',
      to: '/revenue?range=month',
      icon: TrendingUp,
      value: inr(k.feesEarnedMonth?.value),
      note: `on pace for ${inr(k.feesEarnedMonth?.projected)}`,
    },
    {
      label: 'Overdue fees',
      to: '/collections',
      icon: Clock,
      value: inr(k.pendingPayments.amount),
      change: `${num(k.pendingPayments.carts)} carts locked`,
      tone: k.pendingPayments.carts ? 'down' : 'neutral',
    },
    {
      label: 'Collection rate',
      to: '/collections',
      icon: CheckCircle2,
      value: `${k.collectionRate}%`,
      note: 'of fees due so far, paid',
    },
    {
      label: 'Active carts today',
      to: '/restaurants?sort=ordersToday',
      icon: Zap,
      value: `${num(k.activeCartsToday)} / ${num(k.totalCarts.value)}`,
      note: 'took a paid order today',
    },
    {
      label: 'New carts this week',
      to: '/restaurants?sort=newest',
      icon: Store,
      value: num(k.newCartsWeek),
      note: `${num(k.inactiveCarts)} carts quiet for 7+ days`,
    },
    {
      label: 'Carts slowing down',
      to: '/insights?tab=vendors',
      icon: TrendingDown,
      value: atRisk == null ? '—' : num(atRisk),
      tone: atRisk ? 'down' : 'neutral',
      note: 'orders halved this week · call them',
    },
    {
      label: 'Possible fee leakage',
      to: '/insights?tab=leakage',
      icon: Ban,
      value: leaking == null ? '—' : num(leaking),
      note: 'carts cancelling or not charging a lot',
    },
  ]

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h2 className='text-[26px] font-extrabold tracking-tight'>
            {greet}, <span className='bg-gradient-to-r from-brand to-[#ff8a4c] bg-clip-text text-transparent'>{firstName}</span> 👋
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

      <State loading={ov.loading} error={ov.error} skeleton={KPI_SKELETON}>
        <div className='grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5'>
          {cards?.map((c) => (
            <KpiCard key={c.label} {...c} />
          ))}
        </div>
      </State>

      <div className='grid gap-4 xl:grid-cols-[1.6fr_1fr]'>
        <AttentionPanel items={o?.attention} />
        <Card className='h-full'>
          <CardHeader
            title='Latest notifications'
            right={
              <Link to='/notifications' className='text-[12px] font-semibold text-brand hover:underline'>
                See all
              </Link>
            }
          />
          {notes.length ? (
            notes.map((n) => (
              <button
                key={n.id}
                onClick={() => openNote(n)}
                className='flex w-full items-center gap-3 border-b border-line px-4 py-2.5 text-left transition last:border-0 hover:bg-neutral-50'
              >
                <span className='min-w-0 flex-1'>
                  <b className={`block truncate text-[13px] ${n.read ? 'font-medium text-neutral-600' : 'font-semibold'}`}>{n.title}</b>
                  <span className='block text-[11.5px] text-neutral-500'>{ago(n.at)}</span>
                </span>
                {!n.read && <span aria-label='Unread' className='h-2 w-2 shrink-0 rounded-full bg-brand' />}
                <ChevronRight size={14} className='shrink-0 text-neutral-400' />
              </button>
            ))
          ) : (
            <div className='flex flex-col items-center gap-2 px-4 py-10 text-neutral-500'>
              <Bell className='text-neutral-400' /> Nothing yet.
            </div>
          )}
        </Card>
      </div>

      <div className='grid gap-4 xl:grid-cols-[1.5fr_1fr]'>
        {/* Platform events only: new owners, carts and fee payments, not each order. */}
        <ActivityFeed
          items={act.data?.filter((a) => a.type !== 'order' && a.type !== 'large')}
          loading={act.loading}
          error={act.error}
        />
        <div className='space-y-4'>
          <Card>
            <CardHeader title='Platform Health' />
            {health.map(({ key, label, state, detail }) => {
              const [status, word] = HEALTH_BADGE[state] || HEALTH_BADGE.warn
              return (
                <div key={key} className='flex items-center justify-between gap-3 border-b border-line px-5 py-3 last:border-0'>
                  <div className='min-w-0'>
                    <div className='font-medium'>{label}</div>
                    <div className='text-[12px] text-neutral-500'>{detail}</div>
                  </div>
                  <StatusBadge status={status} label={word} />
                </div>
              )
            })}
          </Card>
        </div>
      </div>

      <CartMap carts={carts.data} loading={carts.loading} error={carts.error} />
    </div>
  )
}

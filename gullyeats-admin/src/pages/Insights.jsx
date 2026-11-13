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
  Gamepad2,
  Users,
  Phone as PhoneIcon,
  MessageCircle,
  Heart,
  ShieldAlert,
  Clock,
} from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
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
  ['play', 'GullyPlay'],
  ['pulse', 'GullyPulse'],
]

export default function Insights() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'growth'
  const View = { growth: Growth, vendors: Vendors, leakage: Leakage, operations: Operations, play: Play, pulse: Pulse }[tab]
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

// ------------------------------------------------------------------
// GullyPlay / GullyPulse: players are anonymous, so counts only.
const RANGES = [
  ['7', 'Last 7 days'],
  ['30', 'Last 30 days'],
]
function useDays() {
  const [params, setParams] = useSearchParams()
  const days = params.get('days') === '7' ? '7' : '30'
  const setDays = (d) => setParams((p) => ({ ...Object.fromEntries(p), days: d }))
  return [days, setDays]
}

// Counts per IST day, one line per series ([key, label], colours in fixed order).
function Trend({ title, subtitle, points = [], series }) {
  const colour = (i) => `var(--viz-${i + 1})`
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className='h-[220px] px-2 pt-4'>
        <ResponsiveContainer>
          <LineChart data={points} margin={{ left: 0, right: 12 }}>
            <CartesianGrid stroke='#efedf5' strokeDasharray='3 4' vertical={false} />
            <XAxis dataKey='label' tick={{ fontSize: 11, fill: '#8a8d94' }} tickLine={false} axisLine={false} minTickGap={18} />
            <YAxis tick={{ fontSize: 11, fill: '#8a8d94' }} tickLine={false} axisLine={false} width={34} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none', boxShadow: '0 12px 32px -8px rgba(26,15,69,.25)' }}
              itemStyle={{ color: '#3f3f46' }}
            />
            {series.map(([k, label], i) => (
              <Line key={k} dataKey={k} name={label} stroke={colour(i)} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className='flex flex-wrap gap-x-5 gap-y-1.5 border-t border-line px-4 py-3 text-[12px]'>
        {series.map(([k, label], i) => (
          <span key={k} className='flex items-center gap-1.5 text-neutral-500'>
            <i className='h-0.5 w-3 rounded' style={{ background: colour(i) }} />
            {label} <b className='text-ink'>{num(points.reduce((t, p) => t + (p[k] || 0), 0))}</b>
          </span>
        ))}
      </div>
    </Card>
  )
}

const cartCols = (verb) => [
  { key: 'cart', label: 'Cart', render: (c) => <b className='font-medium'>{c.cart}</b> },
  { key: 'city', label: 'City' },
  { key: 'customers', label: 'QR customers' },
  { key: 'active', label: verb },
  { key: 'rate', label: 'Share', render: (c) => <b>{c.rate}%</b> },
]

function Play() {
  const [days, setDays] = useDays()
  const { data: d, loading, error } = useResource('play', { days }, 60000)
  const s = d?.summary
  const games = d?.perGame || []
  const gameCols = [
    { key: 'name', label: 'Game', render: (g) => <b className='font-medium'>{g.name}</b> },
    { key: 'players', label: 'Players', render: (g) => num(g.players) },
    { key: 'rounds', label: 'Rounds', render: (g) => num(g.rounds) },
    { key: 'perPlayer', label: 'Rounds / player' },
    { key: 'median', label: 'Median best', render: (g) => num(g.median) },
    { key: 'p90', label: 'Top 10% from', render: (g) => num(g.p90) },
    { key: 'top', label: 'Highest', render: (g) => num(g.top) },
  ]
  return (
    <>
      <Seg options={RANGES} value={days} onChange={setDays} />
      <State loading={loading} error={error}>
        <Kpis>
          <KpiCard icon={Gamepad2} label='Players' value={num(s?.players)} note={`${num(s?.rounds)} rounds played`} />
          <KpiCard icon={QrCode} label='QR customers who played' value={`${s?.playedShare ?? 0}%`} note={`of ${num(s?.customers)} customers`} />
          <KpiCard icon={Repeat} label='Came back' value={num(s?.returning)} note='played on 2+ days' />
          <KpiCard icon={PhoneIcon} label='With a phone number' value={num(s?.withPhone)} note='one identity across orders' />
          <KpiCard icon={Store} label='Played from 2+ carts' value={num(s?.multiCart)} note='ordered at more than one cart' />
        </Kpis>
        <div className='mt-3'>
          <Trend
            title='Players per day'
            subtitle='Each player counts once per game per day (IST)'
            points={d?.daily}
            series={games.map((g) => [g.game, g.name])}
          />
        </div>
        <Card className='mt-3'>
          <CardHeader title='Games' subtitle='From each player’s best score of the day' />
          <Table columns={gameCols} rows={games.map((g) => ({ ...g, id: g.game }))} />
        </Card>
        <Card className='mt-3'>
          <CardHeader title='Carts whose customers play most' subtitle='QR customers in this period who played any game' />
          <Table columns={cartCols('Played')} rows={withId(d?.carts)} empty='Nobody has played yet.' />
        </Card>
        <p className='mt-2 px-1 text-[12px] text-neutral-500'>
          Players are anonymous. Rounds are counted from 13 Nov 2026; earlier days count one round per player per game.
        </p>
      </State>
    </>
  )
}

function Pulse() {
  const [days, setDays] = useDays()
  const { data: d, loading, error } = useResource('pulse', { days }, 60000)
  const s = d?.summary
  const e = d?.engagement
  const h = d?.health
  const topCols = [
    { key: 'text', label: 'Post', className: '!whitespace-normal', render: (p) => <span className='line-clamp-2'>{p.text}</span> },
    { key: 'likes', label: 'Likes', render: (p) => num(p.likes) },
    { key: 'comments', label: 'Comments', render: (p) => num(p.comments) },
  ]
  return (
    <>
      <Seg options={RANGES} value={days} onChange={setDays} />
      <State loading={loading} error={error}>
        <Kpis>
          <KpiCard icon={MessageCircle} label='Posts' value={num(s?.posts)} note={`${num(s?.comments)} comments`} />
          <KpiCard icon={Heart} label='Likes' value={num(s?.likes)} note={`${e?.likesPerPost ?? 0} per published post`} />
          <KpiCard icon={Users} label='Posters' value={num(s?.posters)} note={`${num(s?.repeatPosters)} posted 2+ times`} />
          <KpiCard icon={QrCode} label='QR customers who posted' value={`${s?.postedShare ?? 0}%`} note={`of ${num(s?.customers)} customers`} />
          <KpiCard
            icon={Clock}
            label='Time to moderate'
            value={h?.avgMinsToDecide == null ? '—' : h.avgMinsToDecide < 90 ? `${h.avgMinsToDecide} min` : `${(h.avgMinsToDecide / 60).toFixed(1)} h`}
            note={`${num(h?.decisions)} approve/reject decisions`}
          />
        </Kpis>
        <div className='mt-3'>
          <Trend
            title='Activity per day'
            subtitle='New posts, comments and likes (IST)'
            points={d?.daily}
            series={[
              ['posts', 'Posts'],
              ['comments', 'Comments'],
              ['likes', 'Likes'],
            ]}
          />
        </div>
        <div className='mt-3 grid gap-3'>
          <Card>
            <CardHeader
              title='Most engaging posts'
              subtitle={`Published in this period · ${e?.commentsPerPost ?? 0} comments per post on average`}
            />
            <Table columns={topCols} rows={e?.top} empty='No published posts yet.' />
          </Card>
          <Card>
            <CardHeader title='Moderation health' subtitle={`Posts and comments in this period (${num(h?.items)})`} />
            <div className='grid grid-cols-2 gap-2.5 p-4 lg:grid-cols-4'>
              <KpiCard icon={ShieldAlert} label='Blocked by the filter' value={`${h?.rates.blocked ?? 0}%`} note={`${num(h?.blocked)} items`} />
              <KpiCard icon={AlertTriangle} label='Held for review' value={`${h?.rates.held ?? 0}%`} note={`${num(h?.held)} items`} />
              <KpiCard icon={AlertTriangle} label='Reported' value={`${h?.rates.reported ?? 0}%`} note={`${num(h?.reports)} reports in all`} />
              <KpiCard icon={ShieldAlert} label='Rejected or removed' value={num(h?.removed)} note='by an admin' />
            </div>
          </Card>
        </div>
        <Card className='mt-3'>
          <CardHeader title='Carts whose customers post most' subtitle='QR customers in this period who posted or commented' />
          <Table columns={cartCols('Posted')} rows={withId(d?.carts)} empty='Nobody has posted yet.' />
        </Card>
      </State>
    </>
  )
}

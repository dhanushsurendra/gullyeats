import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { Card, CardHeader, Skeleton, State } from './ui'
import { inr, num, signed } from '../utils/format'

// `series` is useResource('series', range params): the Revenue page's dates.
export default function RevenueChart({ series, label }) {
  const { data, loading, error } = series
  const t = data?.totals

  return (
    <Card>
      <CardHeader
        title={`Fees collected & orders · ${label}`}
        subtitle='Fees collected (orange) · orders placed (purple)'
      />
      <State loading={loading} error={error} skeleton={<Skeleton block='h-[250px]' />}>
        <div className='h-[250px] px-2 pt-4'>
          <ResponsiveContainer>
            <ComposedChart
              data={data?.points || []}
              margin={{ left: 0, right: 8 }}
            >
              <defs>
                <linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor='#FE5200' stopOpacity={0.28} />
                  <stop offset='100%' stopColor='#FE5200' stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke='#efedf5' strokeDasharray='3 4' vertical={false} />
              <XAxis
                dataKey='label'
                tick={{ fontSize: 11, fill: '#8a8d94' }}
                tickLine={false}
                axisLine={false}
                minTickGap={18}
              />
              <YAxis
                yAxisId='g'
                tick={{ fontSize: 11, fill: '#8a8d94' }}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={inr}
              />
              <YAxis yAxisId='o' orientation='right' hide />
              <Tooltip
                formatter={(v, n) => (n === 'Fees collected' ? inr(v) : num(v))}
contentStyle={{
                  fontSize: 12,
                  borderRadius: 12,
                  border: 'none',
                  boxShadow: '0 12px 32px -8px rgba(26,15,69,.25)',
                }}
              />
              <Area
                yAxisId='g'
                dataKey='revenue'
                name='Fees collected'
                type='monotone'
                stroke='#FE5200'
                strokeWidth={2.5}
                fill='url(#g)'
              />
              <Line
                yAxisId='o'
                dataKey='orders'
                name='Orders'
                type='monotone'
                stroke='#8b5cf6'
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className='grid grid-cols-2 border-t border-line sm:grid-cols-4'>
          {[
            ['Fees collected', inr(t?.revenue), 'text-brand'],
            ['Orders', num(t?.totalOrders)],
            ['AOV', inr(t?.aov)],
            [
              'vs period before',
              t?.revenueGrowth == null ? '—' : signed(t.revenueGrowth),
              t?.revenueGrowth < 0 ? 'text-red-600' : 'text-green-600',
            ],
          ].map(([k, v, c]) => (
            <div
              key={k}
              className='border-r border-line px-5 py-3.5 last:border-0'
            >
              <small className='block text-[11px] font-semibold uppercase tracking-wider text-neutral-500'>{k}</small>
              <b className={`mt-0.5 block text-[20px] font-extrabold tracking-tight ${c || ''}`}>{v}</b>
            </div>
          ))}
        </div>
      </State>
    </Card>
  )
}

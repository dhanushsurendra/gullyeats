import { useDispatch, useSelector } from 'react-redux'
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
import useResource from '../hooks/useResource'
import { setPeriod } from '../store/adminSlice'
import { Card, CardHeader, Seg, State } from './ui'
import { inr, num, signed } from '../utils/format'

export const PERIODS = [
  ['7d', '7 Days'],
  ['30d', '30 Days'],
  ['3m', '3 Months'],
  ['12m', '12 Months'],
]

export default function RevenueChart() {
  const dispatch = useDispatch()
  const period = useSelector((s) => s.admin.period)
  const { data, loading, error } = useResource('series', { period }, 60000)
  const t = data?.totals

  return (
    <Card>
      <CardHeader
        title='Revenue & Orders'
        subtitle='Revenue (solid orange) · orders (dashed)'
        right={
          <Seg
            options={PERIODS}
            value={period}
            onChange={(p) => dispatch(setPeriod(p))}
          />
        }
      />
      <State loading={loading} error={error}>
        <div className='h-[250px] px-2 pt-4'>
          <ResponsiveContainer>
            <ComposedChart
              data={data?.points || []}
              margin={{ left: 0, right: 8 }}
            >
              <defs>
                <linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor='#F97316' stopOpacity={0.2} />
                  <stop offset='100%' stopColor='#F97316' stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke='#eee' vertical={false} />
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
                formatter={(v, n) => (n === 'Revenue' ? inr(v) : num(v))}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #e7e7e4',
                }}
              />
              <Area
                yAxisId='g'
                dataKey='revenue'
                name='Revenue'
                type='monotone'
                stroke='#F97316'
                strokeWidth={2}
                fill='url(#g)'
              />
              <Line
                yAxisId='o'
                dataKey='orders'
                name='Orders'
                type='monotone'
                stroke='#1f2023'
                strokeWidth={1.4}
                strokeDasharray='4 3'
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className='grid grid-cols-2 border-t border-line sm:grid-cols-4'>
          {[
            ['Revenue', inr(t?.revenue), 'text-brand'],
            ['Orders', num(t?.orders)],
            ['AOV', inr(t?.aov)],
            [
              'Growth',
              t?.growth == null ? '—' : signed(t.growth),
              t?.growth < 0 ? 'text-red-600' : 'text-green-600',
            ],
          ].map(([k, v, c]) => (
            <div
              key={k}
              className='border-r border-line px-4 py-2.5 last:border-0'
            >
              <small className='block text-neutral-500'>{k}</small>
              <b className={`text-[16px] font-semibold ${c || ''}`}>{v}</b>
            </div>
          ))}
        </div>
      </State>
    </Card>
  )
}

import { useSelector } from 'react-redux'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import useResource from '../hooks/useResource'
import { Card, CardHeader, State } from './ui'

const STATES = [['pending', 'Pending', '#FBBF24'], ['preparing', 'Preparing', '#F97316'], ['served', 'Served', '#16A34A'], ['cancelled', 'Cancelled', '#DC2626']]

export default function OrdersChart() {
  const period = useSelector((s) => s.admin.period)
  const { data, loading, error } = useResource('series', { period }, 60000)
  const pts = data?.points || []
  const total = pts.reduce((s, p) => s + p.pending + p.preparing + p.served + p.cancelled, 0)
  const share = (k) => (total ? ((pts.reduce((s, p) => s + p[k], 0) / total) * 100).toFixed(1) : '0.0')

  return (
    <Card className="h-full">
      <CardHeader title="Order Overview" subtitle="Orders by state · follows the GMV period" />
      <State loading={loading} error={error}>
        <div className="h-[200px] px-2 pt-4">
          <ResponsiveContainer>
            <BarChart data={pts} margin={{ left: 0, right: 8 }}>
              <CartesianGrid stroke="#eee" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8a8d94' }} tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis tick={{ fontSize: 11, fill: '#8a8d94' }} tickLine={false} axisLine={false} width={34} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e7e4' }} cursor={{ fill: '#f6f6f5' }} />
              {STATES.map(([k, n, c]) => <Bar key={k} dataKey={k} name={n} stackId="a" fill={c} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line px-4 py-3 text-[12px]">
          {STATES.map(([k, n, c]) => (
            <div key={k} className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-neutral-500"><i className="h-2 w-2 rounded-sm" style={{ background: c }} />{n}</span><b>{share(k)}%</b></div>
          ))}
        </div>
      </State>
    </Card>
  )
}

import { useSelector } from 'react-redux'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import useResource from '../hooks/useResource'
import { Card, CardHeader, Skeleton, State } from './ui'

const STATES = [['pending', 'Pending', '#FBBF24'], ['preparing', 'Preparing', '#FE5200'], ['served', 'Served', '#8b5cf6'], ['cancelled', 'Cancelled', '#F87171']]

export default function OrdersChart() {
  const period = useSelector((s) => s.admin.period)
  const { data, loading, error } = useResource('series', { period }, 60000)
  const pts = data?.points || []
  const total = pts.reduce((s, p) => s + p.pending + p.preparing + p.served + p.cancelled, 0)
  const share = (k) => (total ? ((pts.reduce((s, p) => s + p[k], 0) / total) * 100).toFixed(1) : '0.0')

  return (
    <Card className="h-full">
      <CardHeader title="Order Overview" subtitle="Orders by state · follows the GMV period" />
      <State loading={loading} error={error} skeleton={<Skeleton block='h-[200px]' />}>
        <div className="h-[200px] px-2 pt-4">
          <ResponsiveContainer>
            <BarChart data={pts} margin={{ left: 0, right: 8 }}>
              <CartesianGrid stroke="#efedf5" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8a8d94' }} tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis tick={{ fontSize: 11, fill: '#8a8d94' }} tickLine={false} axisLine={false} width={34} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none', boxShadow: '0 12px 32px -8px rgba(26,15,69,.25)' }} cursor={{ fill: 'rgba(139,92,246,.08)' }} />
              {STATES.map(([k, n, c]) => <Bar key={k} dataKey={k} name={n} stackId="a" fill={c} radius={k === 'cancelled' ? [4, 4, 0, 0] : 0} />)}
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

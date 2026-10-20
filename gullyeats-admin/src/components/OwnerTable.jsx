import { useNavigate } from 'react-router-dom'
import { Phone } from 'lucide-react'
import { Card, CardHeader, Table, State, Btn } from './ui'
import StatusBadge from './StatusBadge'
import { inr, num, signed } from '../utils/format'

export default function OwnerTable({
  owners = [],
  limit,
  loading,
  error,
  title = 'Top Performing Owners',
}) {
  const nav = useNavigate()
  const rows = limit ? owners.slice(0, limit) : owners
  const cols = [
    {
      key: 'name',
      label: 'Owner',
      render: (o) => (
        <div className='flex items-center gap-2 font-medium'>
          <span className='grid h-6 w-6 place-items-center rounded-md bg-brand-50 
          text-[10px] font-bold text-brand-600'>
            {o.name
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')}
          </span>
          {o.name}
        </div>
      ),
    },
    {
      key: 'restaurants',
      label: 'Restaurants',
      render: (o) => `${o.restaurants} (${o.live} live)`,
    },
    { key: 'orders', label: 'Orders', render: (o) => num(o.orders) },
    { key: 'gmv', label: 'GMV', render: (o) => <b>{inr(o.gmv)}</b> },
    { key: 'aov', label: 'AOV', render: (o) => inr(o.aov) },
    {
      key: 'growth',
      label: 'Growth (30d)',
      render: (o) =>
        o.growth == null ? (
          <span className='text-neutral-400'>—</span>
        ) : (
          <span
            className={
              o.growth < 0
                ? 'font-semibold text-red-600'
                : 'font-semibold text-green-600'
            }
          >
            {signed(o.growth)}
          </span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (o) => <StatusBadge status={o.status} />,
    },
    {
      key: 'action',
      label: 'Action',
      render: (o) => (
        <div className='flex gap-1.5'>
          <Btn
            onClick={() =>
              nav(`/restaurants?owner=${encodeURIComponent(o.name)}`)
            }
          >
            View
          </Btn>
        </div>
      ),
    },
  ]
  return (
    <Card>
      <CardHeader
        title={title}
        right={
          limit ? (
            <button
              onClick={() => nav('/owners')}
              className='text-[12px] font-medium text-brand hover:underline'
            >
              View all owners
            </button>
          ) : null
        }
      />
      <State loading={loading} error={error}>
        <Table columns={cols} rows={rows} empty='No owners match.' />
      </State>
    </Card>
  )
}

import { LineChart, Line } from 'recharts'
import { Card } from './ui'

const TONE = {
  up: 'text-green-600',
  down: 'text-red-600',
  neutral: 'text-neutral-500',
}

export default function KpiCard({
  icon: Icon,
  label,
  value,
  change,
  tone = 'neutral',
  note,
  series,
}) {
  return (
    <Card className='p-3 transition-colors hover:border-orange-300'>
      <div className='flex items-center gap-1.5 text-[12px] text-neutral-500'>
        <Icon size={14} className='text-brand' />
        {label}
      </div>
      <div className='mb-0.5 mt-1.5 text-[21px] font-semibold tracking-tight'>
        {value}
      </div>
      <div className='flex items-end justify-between gap-2 text-[11.5px] text-neutral-500'>
        <span>
          {change && <b className={`font-semibold ${TONE[tone]}`}>{change} </b>}
          {note}
        </span>
        {series?.length > 1 && (
          <LineChart width={60} height={22} data={series}>
            <Line
              dataKey='v'
              type='monotone'
              dot={false}
              stroke='#F97316'
              strokeWidth={1.6}
              isAnimationActive={false}
            />
          </LineChart>
        )}
      </div>
    </Card>
  )
}

import { LineChart, Line } from 'recharts'
import { Link } from 'react-router-dom'
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
  to, // page this number comes from; makes the card a link
  featured = false, // the headline number: night purple with an orange figure
}) {
  const spark = series?.length > 1 && (
    <LineChart width={72} height={26} data={series}>
      <Line
        dataKey='v'
        type='monotone'
        dot={false}
        stroke={featured ? '#a78bfa' : '#FE5200'}
        strokeWidth={2}
        isAnimationActive={false}
      />
    </LineChart>
  )

  const card = featured ? (
    <div className='rise relative h-full overflow-hidden rounded-2xl bg-gradient-to-br from-night-deep via-night to-night-soft p-5 text-white shadow-card'>
      <div className='pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-brand/30 blur-3xl' />
      <div className='relative flex items-center gap-2.5 text-[12px] font-semibold text-lilac'>
        <span className='grid h-8 w-8 place-items-center rounded-xl bg-white/10'>
          <Icon size={16} className='text-white' />
        </span>
        {label}
      </div>
      <div className='relative mt-3 text-[34px] font-extrabold leading-none tracking-tight text-brand'>{value}</div>
      <div className='relative mt-2 flex items-end justify-between gap-2 text-[12px] text-white/70'>
        <span>
          {change && <b className='font-semibold text-white'>{change} </b>}
          {note}
        </span>
        {spark}
      </div>
    </div>
  ) : (
    <Card className={`h-full p-4 transition-all ${to ? 'hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-float' : ''}`}>
      <div className='flex items-center gap-2.5 text-[12px] font-semibold text-neutral-500'>
        <span className='grid h-8 w-8 place-items-center rounded-xl bg-brand-50'>
          <Icon size={16} className='text-brand' />
        </span>
        {label}
      </div>
      <div className='mb-1 mt-3 text-[24px] font-extrabold leading-none tracking-tight'>{value}</div>
      <div className='flex items-end justify-between gap-2 text-[11.5px] text-neutral-500'>
        <span>
          {change && <b className={`font-semibold ${TONE[tone]}`}>{change} </b>}
          {note}
        </span>
        {spark}
      </div>
    </Card>
  )
  return to ? (
    <Link
      to={to}
      title={`Open ${label}`}
      className={`block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${featured ? 'col-span-2' : ''}`}
    >
      {card}
    </Link>
  ) : (
    <div className={featured ? 'col-span-2' : ''}>{card}</div>
  )
}

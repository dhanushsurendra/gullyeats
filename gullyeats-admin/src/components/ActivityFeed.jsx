import {
  UserPlus,
  Store,
  ShoppingBag,
  Zap,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardHeader, State } from './ui'
import { ago } from '../utils/format'

const ICON = {
  owner: [UserPlus, 'bg-green-50 text-green-700'],
  cart: [Store, 'bg-brand-50 text-brand-600'],
  order: [ShoppingBag, 'bg-neutral-100 text-neutral-600'],
  large: [Zap, 'bg-brand-50 text-brand-600'],
  payment: [CheckCircle2, 'bg-green-50 text-green-700'],
  alert: [AlertTriangle, 'bg-red-50 text-red-600'],
}

export default function ActivityFeed({ items, loading, error }) {
  return (
    <Card className='h-full'>
      <CardHeader
        title='Platform Activity'
        subtitle='Live feed · refreshes every 30s'
        right={
          <span className='inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2 
          py-px text-[11px] font-semibold text-brand-600'>
            <i className='pulse-dot h-1.5 w-1.5 rounded-full bg-current' />
            Live
          </span>
        }
      />
      <State loading={loading} error={error}>
        {items?.length ? (
          <ul>
            {items.map((a, i) => {
              const [Icon, cls] = ICON[a.type] || ICON.order
              return (
                <li
                  key={i}
                  className='flex gap-3 border-b border-line px-4 py-2.5 last:border-0'
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${cls}`}
                  >
                    <Icon size={14} />
                  </span>
                  <div className='min-w-0 flex-1'>
                    <b className='font-semibold'>{a.title}</b>
                    <p className='truncate text-[12px] text-neutral-500'>
                      {a.text}
                    </p>
                  </div>
                  <time className='whitespace-nowrap text-[11.5px] text-neutral-500'>
                    {ago(a.at)}
                  </time>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className='px-4 py-10 text-center text-neutral-500'>
            No activity yet.
          </p>
        )}
      </State>
    </Card>
  )
}

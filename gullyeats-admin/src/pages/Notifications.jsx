import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  ShieldAlert,
  Star,
  Store,
  TrendingDown,
  Undo2,
  Utensils,
  XCircle,
} from 'lucide-react'
import { Card, CardHeader, Btn, Skeleton } from '../components/ui'
import { useOpenNotification } from '../components/NotificationsLive'
import { api } from '../services/api'
import { loaded, read } from '../store/notifySlice'
import { ago, ist } from '../utils/format'

const TYPES = {
  review: [ShieldAlert, 'bg-amber-50 text-amber-700'],
  reported: [ShieldAlert, 'bg-red-50 text-red-600'],
  'refund-flag': [Undo2, 'bg-red-50 text-red-600'],
  'refund-failed': [XCircle, 'bg-red-50 text-red-600'],
  'refund-owed': [Undo2, 'bg-amber-50 text-amber-700'],
  'fees-overdue': [CreditCard, 'bg-red-50 text-red-600'],
  'low-rating': [Star, 'bg-amber-50 text-amber-700'],
  dish: [Utensils, 'bg-brand/10 text-brand'],
  leakage: [TrendingDown, 'bg-red-50 text-red-600'],
  'new-cart': [Store, 'bg-green-50 text-green-700'],
}

export default function Notifications() {
  const dispatch = useDispatch()
  const { items, unread, hasMore, loaded: ready } = useSelector((s) => s.notify)
  const open = useOpenNotification()
  const [busy, setBusy] = useState(false)

  const markAll = () => {
    dispatch(read('all'))
    api.readNotifications({ all: true }).catch(() => {})
  }
  const more = async () => {
    setBusy(true)
    try {
      dispatch(loaded({ ...(await api.notifications({ before: items.at(-1).at })), more: true }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title='Notifications'
        subtitle={unread ? `${unread} unread · new ones appear here as they happen` : 'New ones appear here as they happen'}
        right={unread ? <Btn onClick={markAll}>Mark all read</Btn> : null}
      />
      {!ready ? (
        <Skeleton />
      ) : items.length ? (
        <>
          {items.map((n) => {
            const [Icon, tone] = TYPES[n.type] || [Bell, 'bg-neutral-100 text-neutral-600']
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={`flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition last:border-0 hover:bg-neutral-50 ${n.read ? '' : 'bg-brand/[0.04]'}`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone}`}>
                  <Icon size={15} />
                </span>
                <span className='min-w-0 flex-1'>
                  <b className={`block text-[13px] ${n.read ? 'font-medium text-neutral-600' : 'font-semibold'}`}>{n.title}</b>
                  {n.text && <span className='block text-[12px] text-neutral-500'>{n.text}</span>}
                </span>
                <time title={ist(n.at)} className='whitespace-nowrap text-[11.5px] text-neutral-500'>
                  {ago(n.at)}
                </time>
                {!n.read && <span aria-label='Unread' className='h-2 w-2 shrink-0 rounded-full bg-brand' />}
                <ChevronRight size={14} className='shrink-0 text-neutral-400' />
              </button>
            )
          })}
          {hasMore && (
            <div className='p-3 text-center'>
              <Btn onClick={more} disabled={busy}>
                {busy ? 'Loading…' : 'Show older'}
              </Btn>
            </div>
          )}
        </>
      ) : (
        <div className='flex flex-col items-center gap-2 px-4 py-10 text-neutral-500'>
          <CheckCircle2 className='text-green-600' /> Nothing yet. You'll see things that need you here.
        </div>
      )}
    </Card>
  )
}

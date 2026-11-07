import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { IndianRupee, Store, Clock, AlertTriangle, Phone, MessageCircle } from 'lucide-react'
import useResource from '../hooks/useResource'
import { useReveal } from '../hooks/usePaged'
import { T } from '../store/adminSlice'
import { api } from '../services/api'
import KpiCard from '../components/KpiCard'
import { Card, CardHeader, Table, State, Btn, Seg, ScrollFooter, ExportButton } from '../components/ui'
import { downloadCsv, istDay, today } from '../utils/csv'
import { inr, num, ist, matches } from '../utils/format'

const AGE_ICON = [Clock, Clock, AlertTriangle]

// Indian mobile numbers are stored as 10 digits; wa.me and sms: need +91.
const intl = (phone) => {
  const d = String(phone || '').replace(/\D/g, '')
  return d.length === 10 ? `91${d}` : d
}

const reminderText = (r) =>
  `Hi ${r.owner}, this is GullyEats. The platform fee of ₹${r.amount} for ${r.cart} ` +
  `has been due since ${ist(r.oldestDay).split(',')[0]}, so the cart is locked for new orders. ` +
  'Please open the GullyEats vendor app and pay to unlock it. Thank you!'

// Opens WhatsApp or SMS with the reminder typed in (the admin presses send),
// and records that a reminder went out.
function Reminder({ row }) {
  const [sent, setSent] = useState(null)
  if (!row.phone) return '—'
  const to = intl(row.phone)
  const text = encodeURIComponent(reminderText(row))
  const open = (channel, href) => {
    window.open(href, '_blank', 'noopener')
    setSent(channel)
    api.logReminder(row.cartId, row.amount, channel).catch(() => {})
  }
  return (
    <span className='inline-flex items-center gap-1.5'>
      <Btn onClick={() => open('whatsapp', `https://wa.me/${to}?text=${text}`)} title='Send on WhatsApp'>
        <MessageCircle size={12} className='inline' /> WhatsApp
      </Btn>
      <Btn onClick={() => open('sms', `sms:+${to}?body=${text}`)} title='Send as SMS'>
        SMS
      </Btn>
      {sent && <span className='text-[11px] text-green-700'>Opened</span>}
    </span>
  )
}

export default function Collections() {
  const dispatch = useDispatch()
  const q = useSelector((s) => s.admin.search)
  const { data, loading, error } = useResource('collections', null, 60000)
  const [bucket, setBucket] = useState('')
  const [marking, setMarking] = useState({}) // cartId -> 'busy' | message

  const rows = (data?.items || [])
    .filter((r) => !bucket || r.bucket === bucket)
    .filter((r) => matches(r, q))
    .map((r) => ({ ...r, id: r.cartId }))
  const reveal = useReveal(rows, JSON.stringify([bucket, q]))

  // Marks the cart's oldest unpaid billing day as paid (one day per click).
  const markPaid = async (r) => {
    if (
      !window.confirm(
        `Mark ${r.cart}'s oldest unpaid day as paid? Only do this if the vendor ` +
          'has paid GullyEats another way (e.g. cash).',
      )
    )
      return
    setMarking((m) => ({ ...m, [r.cartId]: 'busy' }))
    try {
      const p = await api.markFeePaid(r.cartId)
      setMarking((m) => ({ ...m, [r.cartId]: p.message }))
      dispatch(T.collections())
    } catch (e) {
      setMarking((m) => ({ ...m, [r.cartId]: e.message }))
    }
  }

  const exportCsv = () =>
    downloadCsv(`gullyeats-overdue-fees-${today()}.csv`, [
      { label: 'Cart', value: (r) => r.cart },
      { label: 'City', value: (r) => r.city },
      { label: 'Owner', value: (r) => r.owner },
      { label: 'Phone', value: (r) => r.phone },
      { label: 'Overdue (INR)', value: (r) => r.amount },
      { label: 'Orders', value: (r) => r.orders },
      { label: 'Oldest unpaid day', value: (r) => istDay(r.oldestDay) },
      { label: 'Days owed', value: (r) => r.days },
    ], rows)

  const cols = [
    { key: 'cart', label: 'Cart', render: (r) => <b className='font-medium'>{r.cart}</b> },
    { key: 'city', label: 'City' },
    { key: 'owner', label: 'Owner' },
    {
      key: 'phone',
      label: 'Phone',
      render: (r) =>
        r.phone ? (
          <a href={`tel:${r.phone}`} className='inline-flex items-center gap-1 text-brand hover:underline'>
            <Phone size={12} /> {r.phone}
          </a>
        ) : (
          '—'
        ),
    },
    { key: 'amount', label: 'Overdue', render: (r) => <b>{inr(r.amount)}</b> },
    { key: 'orders', label: 'Orders', render: (r) => num(r.orders) },
    { key: 'oldestDay', label: 'Oldest unpaid day', render: (r) => ist(r.oldestDay).split(',')[0] },
    {
      key: 'days',
      label: 'Days',
      render: (r) => (
        <span className={r.days >= 8 ? 'font-semibold text-red-600' : r.days >= 3 ? 'text-amber-700' : ''}>
          {r.days}
        </span>
      ),
    },
    {
      key: 'remind',
      label: 'Remind',
      render: (r) => <Reminder row={r} />,
    },
    {
      key: 'action',
      label: '',
      render: (r) =>
        marking[r.cartId] && marking[r.cartId] !== 'busy' ? (
          <span className='inline-block max-w-[220px] whitespace-normal text-[12px] text-neutral-500'>
            {marking[r.cartId]}
          </span>
        ) : (
          <Btn onClick={() => markPaid(r)} disabled={marking[r.cartId] === 'busy'}>
            {marking[r.cartId] === 'busy' ? 'Marking…' : 'Mark fee paid'}
          </Btn>
        ),
    },
  ]

  return (
    <div className='space-y-3'>
      <State loading={loading} error={error}>
        <div className='grid grid-cols-2 gap-2.5 xl:grid-cols-4'>
          <KpiCard
            icon={IndianRupee}
            label='Total overdue'
            value={inr(data?.totals.amount)}
            note={`${num(data?.totals.orders)} orders · ${num(data?.totals.carts)} carts`}
          />
          {(data?.buckets || []).map((b, i) => (
            <KpiCard
              key={b.label}
              icon={AGE_ICON[i] || Store}
              label={`Owed ${b.label}`}
              value={inr(b.amount)}
              note={`${num(b.carts)} carts`}
            />
          ))}
        </div>
      </State>
      <Card>
        <CardHeader
          title='Call list'
          subtitle={`${num(rows.length)} carts · longest owed first. "Mark fee paid" settles the oldest unpaid day.`}
          right={
            <div className='flex flex-wrap items-center gap-2'>
              <Seg
                value={bucket}
                onChange={setBucket}
                options={[['', 'All'], ...(data?.buckets || []).map((b) => [b.label, b.label])]}
              />
              <ExportButton run={exportCsv} disabled={!data} />
            </div>
          }
        />
        <State loading={loading} error={error}>
          <Table columns={cols} rows={reveal.visible} empty='Nobody owes overdue fees. 🎉' />
        </State>
        <ScrollFooter {...reveal} count={rows.length} noun='carts' />
      </Card>
    </div>
  )
}

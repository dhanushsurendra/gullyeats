import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { IndianRupee, Store, Clock, AlertTriangle, Phone } from 'lucide-react'
import useResource from '../hooks/useResource'
import { useReveal } from '../hooks/usePaged'
import { T } from '../store/adminSlice'
import { api } from '../services/api'
import KpiCard from '../components/KpiCard'
import { Card, CardHeader, Table, State, Btn, Seg, ScrollFooter } from '../components/ui'
import { inr, num, ist, matches } from '../utils/format'

const AGE_ICON = [Clock, Clock, AlertTriangle]

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
      setMarking((m) => ({ ...m, [r.cartId]: `Marked ${inr(p.amount)} paid` }))
      dispatch(T.collections())
    } catch (e) {
      setMarking((m) => ({ ...m, [r.cartId]: e.message }))
    }
  }

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
      key: 'action',
      label: '',
      render: (r) =>
        marking[r.cartId] && marking[r.cartId] !== 'busy' ? (
          <span className='text-[12px] text-neutral-500'>{marking[r.cartId]}</span>
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
            <Seg
              value={bucket}
              onChange={setBucket}
              options={[['', 'All'], ...(data?.buckets || []).map((b) => [b.label, b.label])]}
            />
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

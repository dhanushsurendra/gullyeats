import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { IndianRupee, Store, Clock, AlertTriangle, Phone, MessageCircle } from 'lucide-react'
import useResource from '../hooks/useResource'
import usePaged, { useReveal } from '../hooks/usePaged'
import { T } from '../store/adminSlice'
import { api } from '../services/api'
import KpiCard from '../components/KpiCard'
import { Card, CardHeader, Table, State, Btn, Seg, ScrollFooter, ExportButton, ask } from '../components/ui'
import { downloadCsv, istDay, today } from '../utils/csv'
import { inr, num, ist, ago, matches } from '../utils/format'

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

// GullyEats' fee per order. A change applies to orders placed from then on;
// placed orders, bills and reports keep the fee each order was charged.
function PlatformFee() {
  const [saved, setSaved] = useState(null)
  const [max, setMax] = useState(100)
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .settings()
      .then((s) => {
        setSaved(s.platformFee)
        setMax(s.maxPlatformFee)
        setValue(String(s.platformFee))
      })
      .catch((e) => setNote(e.message))
  }, [])

  const fee = Number(value)
  const valid = value !== '' && Number.isInteger(fee) && fee >= 0 && fee <= max

  const save = async () => {
    if (
      !(await ask({
        title: `Change the platform fee from ${inr(saved)} to ${inr(fee)}?`,
        message: 'New orders on every cart pay the new fee. Orders already placed keep theirs.',
        confirm: 'Change fee',
      }))
    )
      return
    setBusy(true)
    try {
      const s = await api.updateSettings({ platformFee: fee })
      setSaved(s.platformFee)
      setNote('Saved. New orders now pay this fee.')
    } catch (e) {
      setNote(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title='Platform fee per order'
        subtitle='Added to every order on every cart. Orders already placed keep the fee they were charged.'
        right={
          <div className='flex flex-wrap items-center gap-2'>
            <label className='flex items-center gap-1.5 text-[13px] font-semibold'>
              ₹
              <input
                type='number'
                min={0}
                max={max}
                step={1}
                inputMode='numeric'
                aria-label='Platform fee in rupees'
                value={value}
                disabled={saved === null}
                onChange={(e) => {
                  setValue(e.target.value)
                  setNote('')
                }}
                className='w-20 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] font-normal text-ink outline-none focus:border-brand dark:bg-transparent'
              />
            </label>
            <Btn primary onClick={save} disabled={busy || !valid || fee === saved}>
              {busy ? 'Saving…' : 'Save'}
            </Btn>
            {(note || (value !== '' && !valid)) && (
              <span className='text-[12px] text-neutral-500'>
                {note || `Whole rupees from 0 to ${max}.`}
              </span>
            )}
          </div>
        }
      />
    </Card>
  )
}

// Money carts owe customers back on cancelled or reduced paid orders: not yet
// handed back, or marked handed back but flagged by the customer.
const REFUND_TABS = [
  ['owed', 'Not handed back'],
  ['flagged', 'Customer says not refunded'],
]
const fetchRefunds = {
  owed: (cursor) => api.refunds({ status: 'owed', limit: 30, cursor }),
  flagged: (cursor) => api.refunds({ status: 'flagged', limit: 30, cursor }),
}

function RefundList({ status }) {
  const q = useSelector((s) => s.admin.search)
  const p = usePaged(fetchRefunds[status])
  const [done, setDone] = useState({}) // orderId -> note
  const resolve = async (r) => {
    const reason = await ask({
      title: `Mark order #${r.number}'s refund flag as resolved?`,
      message: `${r.cart} marked ${inr(r.refunded)} as refunded; the customer says they didn't get it. Resolve it once you've sorted it out with the cart.`,
      input: 'What happened (shown in the action log)',
      confirm: 'Resolved',
    })
    if (reason === null) return
    try {
      await api.resolveRefundFlag(r.id, reason)
      setDone((d) => ({ ...d, [r.id]: 'Resolved' }))
    } catch (e) {
      setDone((d) => ({ ...d, [r.id]: e.message }))
    }
  }
  const cols = [
    { key: 'cart', label: 'Cart', render: (r) => <b className='font-medium'>{r.cart}</b> },
    { key: 'owner', label: 'Owner' },
    { key: 'number', label: 'Order', render: (r) => `#${r.number}` },
    { key: 'reasons', label: 'Why', render: (r) => r.reasons.map((x) => (x === 'CANCELLED' ? 'Cancelled' : 'Items removed')).join(', ') },
    status === 'owed'
      ? { key: 'owed', label: 'To refund', render: (r) => <b>{inr(r.owed)}</b> }
      : { key: 'refunded', label: 'Marked refunded', render: (r) => <b>{inr(r.refunded)}</b> },
    status === 'owed'
      ? { key: 'owedSince', label: 'Owed for', render: (r) => <span className='text-neutral-500'>{ago(r.owedSince)}</span> }
      : { key: 'refundedBy', label: 'Marked by', render: (r) => <span className='text-neutral-500'>{r.refundedBy} · {ago(r.refundedAt)}</span> },
    ...(status === 'flagged'
      ? [{
          key: 'action',
          label: '',
          render: (r) => (done[r.id] ? <span className='text-[12px] text-neutral-500'>{done[r.id]}</span> : <Btn onClick={() => resolve(r)}>Resolve</Btn>),
        }]
      : []),
  ]
  return (
    <>
      <State loading={p.loading && !p.rows.length} error={!p.rows.length && p.error}>
        <Table
          columns={cols}
          rows={p.rows.filter((r) => matches(r, q))}
          empty={p.hasMore ? '' : status === 'owed' ? 'Every refund has been handed back. 🎉' : 'No customer has flagged a refund.'}
        />
      </State>
      <ScrollFooter {...p} count={p.rows.length} noun='orders' />
    </>
  )
}

function Refunds() {
  const [params, setParams] = useSearchParams()
  const status = params.get('refunds') === 'flagged' ? 'flagged' : 'owed'
  return (
    <Card>
      <CardHeader
        title='Refunds'
        subtitle='Paid orders that were cancelled or made smaller: the cart owes the customer the difference.'
        right={<Seg value={status} onChange={(v) => setParams({ refunds: v })} options={REFUND_TABS} />}
      />
      <RefundList key={status} status={status} />
    </Card>
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

  // Marks every unpaid day through yesterday as paid (the whole open bill).
  const markPaid = async (r) => {
    if (
      !(await ask({
        title: `Mark ${inr(r.amount)} from ${r.cart} as paid?`,
        // r.amount is overdue fees; between midnight and the 2am lock the bill also holds yesterday.
        message: `This settles every unpaid day through yesterday (${r.days} day${r.days === 1 ? '' : 's'}, ${inr(r.amount)} overdue; between midnight and 2am, yesterday's fees too). Only do this if the vendor has paid GullyEats another way (e.g. cash).`,
        confirm: 'Mark paid',
      }))
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
      <PlatformFee />
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
          subtitle={`${num(rows.length)} carts · longest owed first. "Mark fee paid" settles every unpaid day through yesterday.`}
          right={
            <div className='flex max-w-full flex-wrap items-center gap-2'>
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
      <Refunds />
    </div>
  )
}

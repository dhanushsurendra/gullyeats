import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import usePaged from '../hooks/usePaged'
import { api } from '../services/api'
import { Card, CardHeader, Table, State, Select, ScrollFooter, ExportButton } from '../components/ui'
import StatusBadge from '../components/StatusBadge'
import { inr, num, ist } from '../utils/format'
import { billingDays, downloadCsv, fetchAll, istStamp, today } from '../utils/csv'

const ACTIONS = {
  MARK_FEE_PAID: 'Marked fee paid',
  RESET_PIN: 'Reset PIN',
  SUSPEND_CART: 'Suspended cart',
  RESUME_CART: 'Resumed cart',
  DISABLE_VENDOR: 'Disabled vendor',
  ENABLE_VENDOR: 'Enabled vendor',
  SEND_REMINDER: 'Sent fee reminder',
  AUTO_REFUND: 'Refunded duplicate payment',
  APPROVE_CONFESSION: 'Approved confession',
  REJECT_CONFESSION: 'Rejected confession',
  REMOVE_CONFESSION: 'Removed confession',
  RESTORE_CONFESSION: 'Restored confession',
  APPROVE_COMMENT: 'Approved comment',
  REJECT_COMMENT: 'Rejected comment',
  REMOVE_COMMENT: 'Removed comment',
  RESTORE_COMMENT: 'Restored comment',
  SUSPEND_POSTER: 'Suspended GullyPulse poster',
  UNSUSPEND_POSTER: 'Lifted GullyPulse suspension',
  APPROVE_DISH: 'Added dish to the common list',
  MERGE_DISH: 'Merged dish name',
  REJECT_DISH: 'Rejected dish name',
  SET_PLATFORM_FEE: 'Changed platform fee',
  RESOLVE_REFUND_FLAG: 'Resolved refund flag',
  SEND_BROADCAST: 'Sent message to vendors',
}

// One readable line per action, from the details the server stored.
function describe({ action, details: d }) {
  switch (action) {
    case 'MARK_FEE_PAID':
      return `${inr(d.amount)} for ${billingDays(d.fromDate, d.billingDate)}`
    case 'SET_PLATFORM_FEE':
      return `${inr(d.from)} → ${inr(d.to)} per order`
    case 'RESET_PIN':
      return 'New PIN issued'
    case 'SUSPEND_CART':
    case 'DISABLE_VENDOR':
      return [d.reason || 'No reason given', d.cartsSuspended != null && `${d.cartsSuspended} carts suspended`]
        .filter(Boolean)
        .join(' · ')
    case 'SEND_REMINDER':
      return `${inr(d.amount)} via ${d.channel === 'sms' ? 'SMS' : 'WhatsApp'}`
    case 'AUTO_REFUND':
      return d.status === 'FAILED'
        ? `${inr(d.amount)} refund FAILED (${d.error}). Refund ${d.razorpayPaymentId} in the Razorpay dashboard.`
        : `${inr(d.amount)} refunded · ${d.razorpayPaymentId} → ${d.refundId}`
    case 'SUSPEND_POSTER':
      return `${d.days} days · ${d.reason}`
    case 'APPROVE_DISH':
      return d.image ? 'With a default photo' : 'No default photo'
    case 'SEND_BROADCAST':
      return `"${d.title}" · ${d.body} · to ${d.picked?.length ? d.picked.join(', ') : { all: 'all carts', unpaid: 'carts with unpaid fees', inactive: `carts with no orders for ${d.days} days` }[d.audience] || 'picked carts'} (${d.carts ?? '?'} carts) · ${d.sent} of ${d.phones} phones${d.staff ? ', staff included' : ''}`
    case 'MERGE_DISH':
      return `Now another name for ${d.into}`
    default:
      return d.reason ? [d.reason, d.from && `${d.from} → ${d.to}`].filter(Boolean).join(' · ') : ''
  }
}

const cols = [
  { key: 'at', label: 'When', render: (r) => <span className='text-neutral-500'>{ist(r.at)}</span> },
  { key: 'by', label: 'By', render: (r) => <b className='font-medium'>{r.by}</b> },
  {
    key: 'action',
    label: 'Action',
    render: (r) =>
      r.action === 'AUTO_REFUND' && r.details.status === 'FAILED' ? (
        <StatusBadge status='REJECTED' label='Refund failed' />
      ) : (
        ACTIONS[r.action] || r.action
      ),
  },
  { key: 'target', label: 'On' },
  { key: 'details', label: 'Details', className: 'whitespace-normal', render: describe },
]

function Log({ action }) {
  const fetchPage = useCallback((cursor) => api.actions({ limit: 30, cursor, action }), [action])
  const p = usePaged(fetchPage)
  return (
    <>
      <State loading={p.loading && !p.rows.length} error={!p.rows.length && p.error}>
        <Table columns={cols} rows={p.rows} empty={p.hasMore ? '' : 'No actions recorded yet.'} />
      </State>
      <ScrollFooter {...p} count={p.rows.length} noun='actions' />
    </>
  )
}

export default function Actions() {
  const [params, setParams] = useSearchParams()
  const action = ACTIONS[params.get('action')] ? params.get('action') : ''

  const exportCsv = async () => {
    const { rows, truncated } = await fetchAll((cursor) => api.actions({ limit: 200, cursor, action }))
    downloadCsv(`gullyeats-admin-actions-${today()}.csv`, [
      { label: 'When (IST)', value: (r) => istStamp(r.at) },
      { label: 'By', value: (r) => r.by },
      { label: 'Action', value: (r) => ACTIONS[r.action] || r.action },
      { label: 'On', value: (r) => r.target },
      { label: 'Details', value: describe },
    ], rows)
    return truncated ? `First ${num(rows.length)} rows only.` : ''
  }

  return (
    <Card>
      <CardHeader
        title='Action log'
        subtitle='Everything admins did from this dashboard, and refunds the server made on its own'
        right={
          <div className='flex max-w-full flex-wrap items-center gap-2'>
            <Select
              value={action}
              onChange={(e) => setParams(e.target.value ? { action: e.target.value } : {})}
              aria-label='Action'
            >
              <option value=''>All actions</option>
              {Object.entries(ACTIONS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
            <ExportButton run={exportCsv} />
          </div>
        }
      />
      {/* Remount on filter change so paging starts over. */}
      <Log key={action} action={action} />
    </Card>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { T, patchOwner } from '../store/adminSlice'
import { api } from '../services/api'
import { Phone } from 'lucide-react'
import { Card, CardHeader, Table, State, Btn, ScrollFooter, ask } from './ui'
import { useReveal } from '../hooks/usePaged'
import StatusBadge from './StatusBadge'
import { inr, num, signed } from '../utils/format'

// Disable blocks the vendor's logins and suspends their carts; Enable restores
// logins (carts are resumed one by one from the Carts page).
function VendorAccess({ owner }) {
  const dispatch = useDispatch()
  const [busy, setBusy] = useState('') // the label while saving
  const run = async () => {
    let reason
    if (!owner.disabled) {
      reason = await ask({
        title: `Disable ${owner.name}?`,
        message: "They won't be able to log in, and all their carts will be suspended.",
        input: 'Reason (shown in the action log)',
        confirm: 'Disable',
        danger: true,
      })
      if (reason === null) return
    } else if (
      !(await ask({
        title: `Enable ${owner.name}?`,
        message: 'They can log in again. Resume their carts from the Carts page.',
        confirm: 'Enable',
      }))
    ) {
      return
    }
    setBusy(owner.disabled ? 'Enabling…' : 'Disabling…')
    try {
      if (owner.disabled) await api.enableVendor(owner.id)
      else await api.disableVendor(owner.id, reason)
      dispatch(patchOwner({ id: owner.id, disabled: !owner.disabled }))
      // Full reloads are slow (every order and cart); run them in the background
      // to fill in the real status (Active/Review/Inactive) and suspended carts.
      dispatch(T.carts())
      dispatch(T.owners())
    } catch (e) {
      ask({ title: "Couldn't save", message: e.message, alert: true })
    } finally {
      setBusy('')
    }
  }
  return (
    <Btn onClick={run} disabled={!!busy} className={`disabled:opacity-60 ${owner.disabled ? '' : 'text-red-600'}`}>
      {busy || (owner.disabled ? 'Enable' : 'Disable')}
    </Btn>
  )
}

export default function OwnerTable({
  owners = [],
  limit,
  loading,
  error,
  title = 'Top Performing Owners',
}) {
  const nav = useNavigate()
  const all = limit ? owners.slice(0, limit) : owners
  // The full ranked list is loaded once; the table grows 30 rows per scroll.
  const reveal = useReveal(all, owners.length)
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
              nav(`/restaurants?ownerId=${o.id}`)
            }
          >
            View
          </Btn>
          <VendorAccess owner={o} />
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
        <Table columns={cols} rows={reveal.visible} empty='No owners match.' />
      </State>
      {!limit && <ScrollFooter {...reveal} count={all.length} noun='owners' />}
    </Card>
  )
}

const STYLE = {
  LIVE: 'bg-brand-50 text-brand-600',
  PREPARING: 'bg-brand-50 text-brand-600',
  OFFLINE: 'bg-neutral-100 text-neutral-600 border border-line',
  INACTIVE: 'bg-neutral-100 text-neutral-600 border border-line',
  VOID: 'bg-neutral-100 text-neutral-600 border border-line',
  PAUSED: 'bg-amber-50 text-amber-700',
  PENDING: 'bg-amber-50 text-amber-700',
  REVIEW: 'bg-amber-50 text-amber-700',
  ATTENTION: 'bg-red-50 text-red-600',
  CANCELLED: 'bg-red-50 text-red-600',
  REJECTED: 'bg-red-50 text-red-600',
  PAID: 'bg-green-50 text-green-700',
  SERVED: 'bg-green-50 text-green-700',
  VERIFIED: 'bg-green-50 text-green-700',
  ACTIVE: 'bg-green-50 text-green-700',
}

export default function StatusBadge({ status = '', label }) {
  const key = String(status).toUpperCase()
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-px text-[11px] font-semibold ${STYLE[key] || STYLE.OFFLINE}`}
    >
      {key === 'LIVE' && (
        <i className='pulse-dot h-1.5 w-1.5 rounded-full bg-current' />
      )}
      {label || status}
    </span>
  )
}

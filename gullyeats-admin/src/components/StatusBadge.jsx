const STYLE = {
  LIVE: 'bg-brand-50 text-brand-600',
  PREPARING: 'bg-brand-50 text-brand-600',
  OFFLINE: 'bg-neutral-100 text-neutral-600',
  INACTIVE: 'bg-neutral-100 text-neutral-600',
  VOID: 'bg-neutral-100 text-neutral-600',
  PAUSED: 'bg-amber-50 text-amber-700',
  PENDING: 'bg-amber-50 text-amber-700',
  REVIEW: 'bg-amber-50 text-amber-700',
  ATTENTION: 'bg-red-50 text-red-600',
  SUSPENDED: 'bg-night text-lilac',
  DISABLED: 'bg-night text-lilac',
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${STYLE[key] || STYLE.OFFLINE}`}
    >
      <i className={`h-1.5 w-1.5 rounded-full bg-current ${key === 'LIVE' ? 'pulse-dot' : 'opacity-70'}`} />
      {label || status}
    </span>
  )
}

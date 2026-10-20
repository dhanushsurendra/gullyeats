export const inr = (n = 0) => {
  const v = Number(n) || 0, a = Math.abs(v)
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`
  return `₹${Math.round(v).toLocaleString('en-IN')}`
}
export const num = (n) => (Number(n) || 0).toLocaleString('en-IN')
export const signed = (v, suffix = '%') => (v == null ? null : `${v > 0 ? '+' : ''}${v}${suffix}`)
export const ago = (d) => {
  if (!d) return '—'
  const s = (Date.now() - new Date(d)) / 1000
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`
  return `${Math.floor(s / 86400)}d ago`
}
export const ist = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
export const istDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d)
export const matches = (row, q) => !q || JSON.stringify(row).toLowerCase().includes(q.toLowerCase())
export const ORDER_LABEL = { PENDING: 'PENDING', PAID: 'PREPARING', SERVED: 'SERVED', CANCELLED: 'CANCELLED' }

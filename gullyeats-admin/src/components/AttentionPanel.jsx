import { useNavigate } from 'react-router-dom'
import { CreditCard, Store, TrendingDown, XCircle, MapPinOff, CheckCircle2 } from 'lucide-react'
import { Card, CardHeader, Btn } from './ui'

const ICON = { payment: CreditCard, inactive: Store, low: TrendingDown, failed: XCircle, location: MapPinOff }
const SEV = { High: 'bg-red-50 text-red-600', Medium: 'bg-amber-50 text-amber-700', Low: 'bg-neutral-100 text-neutral-600' }

export default function AttentionPanel({ items = [] }) {
  const nav = useNavigate()
  return (
    <Card className="h-full">
      <CardHeader title="Attention Required" right={items.length ? <span className="rounded-full bg-red-50 px-2 py-px text-[11px] font-semibold text-red-600">{items.length} open</span> : null} />
      {items.length ? items.map((a) => {
        const Icon = ICON[a.kind] || Store
        return (
          <div key={a.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${SEV[a.severity]}`}><Icon size={14} /></span>
            <div className="min-w-0 flex-1"><b className="font-semibold">{a.title}</b><p className="text-[12px] text-neutral-500">{a.text}</p></div>
            <span className={`hidden rounded-full px-2 py-px text-[11px] font-semibold sm:inline ${SEV[a.severity]}`}>{a.severity}</span>
            <Btn onClick={() => nav(a.to)}>Review</Btn>
          </div>
        )
      }) : (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-neutral-500"><CheckCircle2 className="text-green-600" /> Nothing needs attention.</div>
      )}
    </Card>
  )
}

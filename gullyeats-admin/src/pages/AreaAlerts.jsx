import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Siren, Users, Store, Radio } from 'lucide-react'
import useResource from '../hooks/useResource'
import { useRange } from '../hooks/useUrlState'
import DateRange from '../components/DateRange'
import KpiCard from '../components/KpiCard'
import { Card, CardHeader, State, Skeleton, Table } from '../components/ui'
import { ago, ist, num } from '../utils/format'

/*
 * Where vendors warn each other (vendor app "Alert nearby carts"). Each
 * hotspot is drawn with the 1 km reach of an alert; reports = the sender plus
 * every "I see it too". A record of where drives happen, not a police tracker.
 */
const REASONS = [
  ['EVICTION', 'Eviction drive', '#DC2626'],
  ['ROAD_BLOCKED', 'Road blocked', '#F59E0B'],
  ['RAIN', 'Heavy rain', '#2563EB'],
  ['CROWD', 'Crowd or event', '#7C3AED'],
]
const LABEL = Object.fromEntries(REASONS.map(([k, l]) => [k, l]))
const COLOR = Object.fromEntries(REASONS.map(([k, , c]) => [k, c]))
const top = (reasons) => Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]?.[0]

function FitTo({ points, fitKey, focus }) {
  const map = useMap()
  useEffect(() => {
    if (points.length) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])).pad(0.3), { maxZoom: 15 })
  }, [map, fitKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], 15, { duration: 0.7 })
  }, [map, focus])
  return null
}

export default function AreaAlerts() {
  const range = useRange('30d')
  const { data, loading, error } = useResource('areaAlerts', range.params, 60000)
  const [hidden, setHidden] = useState([])
  const [focus, setFocus] = useState(null)

  const alerts = useMemo(() => (data?.alerts || []).filter((a) => !hidden.includes(a.reason)), [data, hidden])
  const spots = useMemo(
    () => (data?.hotspots || []).filter((h) => Object.keys(h.reasons).some((r) => !hidden.includes(r))),
    [data, hidden],
  )
  const radius = (data?.radiusKm || 1) * 1000
  const t = data?.totals
  const toggle = (k) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]))

  const cols = [
    { key: 'when', label: 'When', render: (a) => <span title={ist(a.createdAt)}>{ago(a.createdAt)}</span> },
    {
      key: 'reason',
      label: 'What',
      render: (a) => (
        <span className='inline-flex items-center gap-1.5'>
          <i className='h-2 w-2 rounded-full' style={{ background: COLOR[a.reason] }} />
          {LABEL[a.reason]}
        </span>
      ),
    },
    { key: 'reports', label: 'Reports', render: (a) => num(a.reports) },
    {
      key: 'cart',
      label: 'Sent by',
      render: (a) => (
        <span>
          <b className='font-medium'>{a.cart.name}</b>
          <small className='block text-neutral-500'>{a.cart.address || a.cart.city}</small>
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (a) => (a.active ? <b className='font-medium text-red-600'>Showing now</b> : <span className='text-neutral-500'>Ended</span>),
    },
  ]

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='px-1 text-[13px] font-semibold'>
          Showing <span className='text-brand'>{range.label}</span>
        </p>
        <DateRange range={range} all />
      </div>

      <div className='grid grid-cols-2 gap-3 lg:grid-cols-5'>
        <KpiCard icon={Siren} label='Alerts sent' value={t ? num(t.alerts) : '…'} note={t ? `${num(t.active)} showing now` : ''} featured />
        <KpiCard icon={Users} label='Reports' value={t ? num(t.reports) : '…'} note='senders + "I see it too"' />
        <KpiCard icon={Store} label='Carts that sent one' value={t ? num(t.carts) : '…'} />
        <KpiCard icon={Radio} label='Hotspots' value={data ? num(data.hotspots.length) : '…'} note='alerts within 1 km of each other' />
      </div>

      <Card>
        <CardHeader
          title='Alert map'
          subtitle='Each ring is the 1 km an alert reaches. Darker rings had more reports.'
          right={
            <div className='flex flex-wrap gap-1.5'>
              {REASONS.map(([k, label, c]) => {
                const on = !hidden.includes(k)
                return (
                  <button
                    key={k}
                    onClick={() => toggle(k)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium ${
                      on ? 'border-line bg-white text-ink' : 'border-dashed border-line text-neutral-400'
                    }`}
                  >
                    <i className='h-2 w-2 rounded-full' style={{ background: on ? c : '#d4d4d4' }} />
                    {label}
                    <span className='text-neutral-400'>{num(data?.byReason?.[k])}</span>
                  </button>
                )
              })}
            </div>
          }
        />
        <State loading={loading} error={error} skeleton={<Skeleton block='h-[460px]' />}>
          <div className='grid lg:grid-cols-[1fr_290px]'>
            <div className='cart-map h-[460px] overflow-hidden lg:rounded-bl-[10px]'>
              <MapContainer center={[12.97, 77.59]} zoom={11} minZoom={4} maxZoom={19} scrollWheelZoom className='h-full w-full'>
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                  maxZoom={19}
                />
                <FitTo points={spots} fitKey={`${range.key}:${range.from}:${range.to}:${spots.length > 0}`} focus={focus} />
                {spots.map((h) => {
                  const c = COLOR[top(h.reasons)]
                  return (
                    <Circle
                      key={`${h.lat}:${h.lng}`}
                      center={[h.lat, h.lng]}
                      radius={radius}
                      pathOptions={{ color: c, weight: 2, fillColor: c, fillOpacity: Math.min(0.45, 0.08 + h.reports * 0.04) }}
                      eventHandlers={{ click: () => setFocus(h) }}
                    >
                      <Tooltip sticky>
                        <b>{h.area || 'Hotspot'}</b>
                        <br />
                        {num(h.alerts)} alerts · {num(h.reports)} reports · {num(h.carts)} cart{h.carts === 1 ? '' : 's'}
                        <br />
                        {Object.entries(h.reasons).map(([r, n]) => `${LABEL[r]} ${n}`).join(' · ')}
                      </Tooltip>
                    </Circle>
                  )
                })}
                {alerts.map((a) => (
                  <CircleMarker
                    key={a.id}
                    center={[a.lat, a.lng]}
                    radius={a.active ? 8 : 5}
                    pathOptions={{ color: '#fff', weight: 2, fillColor: COLOR[a.reason], fillOpacity: a.active ? 1 : 0.6 }}
                  >
                    <Tooltip direction='top' offset={[0, -6]}>
                      <b>{LABEL[a.reason]}</b> · {num(a.reports)} reports
                      <br />
                      {a.cart.name} · {ago(a.createdAt)}
                      {a.active ? ' · showing now' : ''}
                    </Tooltip>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>

            <div className='border-t border-line p-4 lg:border-l lg:border-t-0'>
              <p className='mb-2 text-[11.5px] font-medium text-neutral-500'>TOP HOTSPOTS</p>
              {spots.length ? (
                spots.slice(0, 8).map((h) => (
                  <button
                    key={`${h.lat}:${h.lng}`}
                    onClick={() => setFocus(h)}
                    className='flex w-full items-center gap-2.5 border-b border-line py-2 text-left last:border-0 hover:text-brand'
                  >
                    <i className='h-2.5 w-2.5 shrink-0 rounded-full' style={{ background: COLOR[top(h.reasons)] }} />
                    <span className='min-w-0 flex-1'>
                      <b className='block truncate font-medium'>{h.area || 'Unnamed spot'}</b>
                      <small className='text-neutral-500'>
                        {num(h.alerts)} alerts · last {ago(h.last)}
                      </small>
                    </span>
                    <span className='text-right text-[11.5px] text-neutral-500'>
                      <b className='block text-[13px] text-ink'>{num(h.reports)}</b>
                      reports
                    </span>
                  </button>
                ))
              ) : (
                <p className='py-6 text-center text-neutral-500'>No alerts in this period.</p>
              )}
            </div>
          </div>
        </State>
      </Card>

      <Card>
        <CardHeader title='Every alert' subtitle='Newest first. Rows are kept 90 days.' />
        <State loading={loading} error={error}>
          <Table columns={cols} rows={alerts} empty='No alerts in this period.' />
        </State>
      </Card>
    </div>
  )
}

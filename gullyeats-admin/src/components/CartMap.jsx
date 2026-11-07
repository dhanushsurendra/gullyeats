import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapContainer,
  TileLayer,
  Marker,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import { ArrowLeft, MapPin } from 'lucide-react'

import { Card, CardHeader, State, Btn, Select } from './ui'
import StatusBadge from './StatusBadge'
import { inr, ago, num } from '../utils/format'

const STATUS = [
  ['LIVE', 'Live', '#F97316'],
  ['ATTENTION', 'Attention', '#DC2626'],
  ['PAUSED', 'Paused', '#F59E0B'],
  ['OFFLINE', 'Offline', '#A3A3A3'],
]
const COLOR = Object.fromEntries(STATUS.map(([k, , c]) => [k, c]))
const colorOf = (s) => COLOR[s] || COLOR.OFFLINE

const CELL = 110 // px: carts closer than this on screen merge into one bubble
const SPLIT_ZOOM = 14 // from street level on, every cart gets its own dot

// Groups carts into screen-space grid cells at the current zoom.
function groupCarts(map, carts, zoom) {
  if (zoom >= SPLIT_ZOOM) return carts.map((c) => [c])
  const cells = new Map()
  for (const c of carts) {
    const p = map.project([c.lat, c.lng], zoom)
    const k = `${Math.floor(p.x / CELL)}:${Math.floor(p.y / CELL)}`
    const cell = cells.get(k)
    if (cell) cell.push(c)
    else cells.set(k, [c])
  }
  return [...cells.values()]
}

// Count bubble whose ring shows the status mix of the carts inside it.
function clusterIcon(group) {
  const n = group.length
  const size = Math.round(28 + Math.min(18, Math.log2(n) * 3))
  let at = 0
  const stops = STATUS.map(([k, , c]) => {
    const share = (group.filter((g) => (COLOR[g.status] ? g.status : 'OFFLINE') === k).length / n) * 100
    const stop = `${c} ${at}% ${at + share}%`
    at += share
    return stop
  }).join(',')
  return L.divIcon({
    className: 'cart-cluster',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;padding:4px;
      background:conic-gradient(${stops});box-shadow:0 2px 8px rgba(0,0,0,.18)">
      <div style="width:100%;height:100%;border-radius:50%;background:#fff;display:grid;
        place-items:center;font:600 ${n > 999 ? 10.5 : 12}px Inter,system-ui,sans-serif;color:#1f2023">${n}</div></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function Markers({ carts, selectedId, onSelect }) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const groups = useMemo(() => groupCarts(map, carts, zoom), [map, carts, zoom])

  return groups.map((g) => {
    if (g.length === 1) {
      const c = g[0]
      const sel = c.id === selectedId
      return (
        <Fragment key={c.id}>
          {sel && (
            // Soft halo so the selected cart stands out (dots are on a canvas, so no CSS).
            <CircleMarker
              center={[c.lat, c.lng]}
              radius={20}
              interactive={false}
              pathOptions={{ stroke: false, fillColor: '#F97316', fillOpacity: 0.22 }}
            />
          )}
        <CircleMarker
          center={[c.lat, c.lng]}
          radius={sel ? 10 : 7}
          pathOptions={{ color: '#fff', weight: sel ? 3 : 2, fillColor: colorOf(c.status), fillOpacity: 1 }}
          eventHandlers={{ click: () => onSelect(c.id) }}
        >
          <Tooltip direction='top' offset={[0, -8]}>
            <b>{c.name}</b> · {c.city}
          </Tooltip>
        </CircleMarker>
        </Fragment>
      )
    }
    const lat = g.reduce((t, c) => t + c.lat, 0) / g.length
    const lng = g.reduce((t, c) => t + c.lng, 0) / g.length
    const live = g.filter((c) => c.status === 'LIVE').length
    return (
      <Marker
        key={`${g[0].id}:${g.length}`}
        position={[lat, lng]}
        icon={clusterIcon(g)}
        eventHandlers={{
          click: () =>
            map.flyToBounds(L.latLngBounds(g.map((c) => [c.lat, c.lng])), {
              padding: [48, 48],
              maxZoom: SPLIT_ZOOM + 2,
              duration: 0.6,
            }),
        }}
      >
        <Tooltip direction='top' offset={[0, -14]}>
          {num(g.length)} carts · {num(live)} live · click to zoom in
        </Tooltip>
      </Marker>
    )
  })
}

// Fits the map to the given carts whenever fitKey changes (first load, city change).
function FitTo({ carts, fitKey }) {
  const map = useMap()
  useEffect(() => {
    if (!carts.length) return
    map.flyToBounds(L.latLngBounds(carts.map((c) => [c.lat, c.lng])), {
      padding: [32, 32],
      maxZoom: 15,
      duration: 0.6,
    })
  }, [map, fitKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function FlyToSelected({ cart }) {
  const map = useMap()
  useEffect(() => {
    if (cart) map.flyTo([cart.lat, cart.lng], Math.max(map.getZoom(), 16), { duration: 0.8 })
  }, [map, cart?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function CartMap({ carts = [], loading, error }) {
  const nav = useNavigate()
  const [selectedId, setSelectedId] = useState(null)
  const [hidden, setHidden] = useState([]) // statuses switched off
  const [city, setCity] = useState('')

  const located = useMemo(
    () =>
      carts
        .filter((c) => c.lat != null && c.lng != null)
        .map((c) => ({ ...c, lat: Number(c.lat), lng: Number(c.lng) }))
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng)),
    [carts],
  )
  const inCity = useMemo(() => located.filter((c) => !city || c.city === city), [located, city])
  const shown = useMemo(() => inCity.filter((c) => !hidden.includes(c.status)), [inCity, hidden])
  const cities = useMemo(() => [...new Set(located.map((c) => c.city).filter(Boolean))].sort(), [located])
  const count = (k) => inCity.filter((c) => (COLOR[c.status] ? c.status : 'OFFLINE') === k).length
  const busiest = useMemo(
    () =>
      [...shown]
        .filter((c) => c.current || c.ordersToday)
        .sort((a, b) => b.current - a.current || b.ordersToday - a.ordersToday)
        .slice(0, 6),
    [shown],
  )
  const selected = located.find((c) => c.id === selectedId) || null
  const toggle = (k) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]))

  return (
    <Card>
      <CardHeader
        title='Cart Network'
        subtitle={`${num(shown.length)} carts on the map${
          located.length < carts.length ? ` · ${num(carts.length - located.length)} have no location` : ''
        }`}
        right={
          <div className='flex flex-wrap items-center gap-1.5'>
            {STATUS.map(([k, label, c]) => {
              const on = !hidden.includes(k)
              return (
                <button
                  key={k}
                  onClick={() => toggle(k)}
                  aria-pressed={on}
                  title={on ? `Hide ${label.toLowerCase()} carts` : `Show ${label.toLowerCase()} carts`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                    on ? 'border-line bg-white text-ink' : 'border-dashed border-line bg-transparent text-neutral-400'
                  }`}
                >
                  <i className='h-2 w-2 rounded-full' style={{ background: on ? c : '#d4d4d4' }} />
                  {label}
                  <span className='text-neutral-400'>{num(count(k))}</span>
                </button>
              )
            })}
            <Select value={city} onChange={(e) => setCity(e.target.value)} aria-label='City'>
              <option value=''>All cities</option>
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
        }
      />

      <State loading={loading} error={error}>
        <div className='grid lg:grid-cols-[1fr_290px]'>
          <div className='cart-map h-[460px] overflow-hidden lg:rounded-bl-[10px]'>
            <MapContainer
              center={[20.6, 78.9]}
              zoom={5}
              minZoom={4}
              maxZoom={19}
              scrollWheelZoom
              preferCanvas
              className='h-full w-full'
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                maxZoom={19}
              />
              <FitTo carts={inCity} fitKey={`${city}:${located.length > 0}`} />
              <FlyToSelected cart={selected} />
              <Markers carts={shown} selectedId={selectedId} onSelect={setSelectedId} />
            </MapContainer>
          </div>

          <div className='border-t border-line p-4 lg:border-l lg:border-t-0'>
            {selected ? (
              <>
                <button
                  onClick={() => setSelectedId(null)}
                  className='mb-3 inline-flex items-center gap-1 text-[12px] font-medium text-neutral-500 hover:text-brand'
                >
                  <ArrowLeft size={13} /> All carts
                </button>
                <h4 className='text-[15px] font-semibold leading-tight'>{selected.name}</h4>
                <p className='text-neutral-500'>
                  {selected.owner} · {selected.city}
                </p>
                <div className='mt-2'>
                  <StatusBadge status={selected.status} />
                </div>
                <div className='my-4 grid grid-cols-2 gap-2'>
                  {[
                    ['Orders today', num(selected.ordersToday)],
                    ['GMV today', inr(selected.gmvToday)],
                    ['In progress', num(selected.current)],
                    ['Last order', ago(selected.lastActive)],
                  ].map(([k, v]) => (
                    <div key={k} className='rounded-md border border-line p-2'>
                      <small className='block text-[11px] text-neutral-500'>{k}</small>
                      <b className='text-[14px] font-semibold'>{v}</b>
                    </div>
                  ))}
                </div>
                <Btn primary className='w-full py-1.5' onClick={() => nav(`/restaurants?cart=${selected.id}`)}>
                  Open cart details
                </Btn>
              </>
            ) : (
              <>
                <p className='mb-2 text-[11.5px] font-medium text-neutral-500'>BUSIEST RIGHT NOW</p>
                {busiest.length ? (
                  busiest.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className='flex w-full items-center gap-2.5 border-b border-line py-2 text-left last:border-0 hover:text-brand'
                    >
                      <i className='h-2.5 w-2.5 shrink-0 rounded-full' style={{ background: colorOf(c.status) }} />
                      <span className='min-w-0 flex-1'>
                        <b className='block truncate font-medium'>{c.name}</b>
                        <small className='text-neutral-500'>{c.city}</small>
                      </span>
                      <span className='text-right text-[11.5px] text-neutral-500'>
                        <b className='block text-[13px] text-ink'>{num(c.current)}</b>
                        in progress
                      </span>
                    </button>
                  ))
                ) : (
                  <p className='py-6 text-center text-neutral-500'>No orders on the map today yet.</p>
                )}
                <p className='mt-4 flex items-start gap-1.5 text-[11.5px] text-neutral-500'>
                  <MapPin size={13} className='mt-px shrink-0' />
                  Click a bubble to zoom in, or a dot to see that cart.
                </p>
              </>
            )}
          </div>
        </div>
      </State>
    </Card>
  )
}

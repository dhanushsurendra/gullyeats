import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'

import { Card, CardHeader, State, Btn } from './ui'
import StatusBadge from './StatusBadge'
import { inr, ago } from '../utils/format'

const BANGALORE = [12.9716, 77.5946]

const COLOR = {
  LIVE: '#F97316',
  ATTENTION: '#DC2626',
  OFFLINE: '#9CA3AF',
}

const colorOf = (status) =>
  COLOR[status] || COLOR.OFFLINE

/*
 * Smoothly moves and zooms the map when
 * a restaurant is selected.
 */
function FocusRestaurant({ restaurant }) {
  const map = useMap()

  useEffect(() => {
    if (!restaurant) return

    map.flyTo(
      [restaurant.lat, restaurant.lng],
      18,
      {
        animate: true,
        duration: 1.2,
        easeLinearity: 0.2,
      },
    )
  }, [map, restaurant])

  return null
}

/*
 * Creates the restaurant location pin.
 */
function createLocationIcon(status, selected) {
  const color = colorOf(status)

  const size = selected ? 38 : 32

  return L.divIcon({
    className: 'gullyeats-location-icon',
    html: `
      <div
        style="
          position: relative;
          width: ${size}px;
          height: ${size}px;
        "
      >
        <div
          style="
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border: 3px solid #ffffff;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow:
              0 3px 8px rgba(0,0,0,0.25),
              0 1px 3px rgba(0,0,0,0.15);
          "
        ></div>

        <div
          style="
            position: absolute;
            top: ${size / 2 - 4}px;
            left: ${size / 2 - 4}px;
            width: 8px;
            height: 8px;
            background: #ffffff;
            border-radius: 50%;
            z-index: 2;
          "
        ></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [
      size / 2,
      size,
    ],
    popupAnchor: [0, -size],
  })
}

export default function CartMap({
  carts = [],
  loading,
  error,
}) {
  const nav = useNavigate()

  /*
   * Selected restaurant.
   * null = nothing selected initially.
   */
  const [selectedId, setSelectedId] =
    useState(null)

  /*
   * Normalize coordinates.
   *
   * This is important because APIs sometimes
   * return lat/lng as strings.
   */
  const plotted = useMemo(
    () =>
      carts
        .map((cart) => ({
          ...cart,
          lat: Number(cart.lat),
          lng: Number(cart.lng),
        }))
        .filter(
          (cart) =>
            Number.isFinite(cart.lat) &&
            Number.isFinite(cart.lng),
        ),
    [carts],
  )

  /*
   * Currently selected restaurant.
   */
  const selected =
    plotted.find(
      (cart) => cart.id === selectedId,
    ) || null

  return (
    <Card>
      <CardHeader
        title='Restaurant Network'
        subtitle={`Live locations across the GullyEats network · ${plotted.length} of ${carts.length} have coordinates`}
        right={
          <div className='flex gap-3 text-[11.5px] text-neutral-500'>
            {[
              ['Live', '#F97316'],
              ['Offline', '#9CA3AF'],
              ['Attention', '#DC2626'],
            ].map(([label, color]) => (
              <span
                key={label}
                className='flex items-center gap-1.5'
              >
                <i
                  className='h-2 w-2 rounded-full'
                  style={{
                    background: color,
                  }}
                />

                {label}
              </span>
            ))}
          </div>
        }
      />

      <State
        loading={loading}
        error={error}
      >
        <div className='grid lg:grid-cols-[1fr_280px]'>
          {/* ================= MAP ================= */}

          <div className='h-[420px] overflow-hidden lg:rounded-bl-[10px]'>
            <MapContainer
              center={BANGALORE}
              zoom={11}
              minZoom={3}
              maxZoom={19}
              scrollWheelZoom
              doubleClickZoom
              zoomControl
              className='h-full w-full'
            >
              {/* OpenStreetMap */}
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                maxZoom={19}
              />

              {/* Smooth zoom to selected restaurant */}
              <FocusRestaurant
                restaurant={selected}
              />

              {/* Restaurant locations */}
              {plotted.map((cart) => {
                const isSelected =
                  cart.id === selectedId

                return (
                  <Marker
                    key={cart.id}
                    position={[
                      cart.lat,
                      cart.lng,
                    ]}
                    icon={createLocationIcon(
                      cart.status,
                      isSelected,
                    )}
                    eventHandlers={{
                      click: () => {
                        setSelectedId(
                          cart.id,
                        )
                      },
                    }}
                  />
                )
              })}
            </MapContainer>
          </div>

          {/* ================= DETAILS ================= */}

          <div className='border-t border-line p-4 lg:border-l lg:border-t-0'>
            {selected ? (
              <>
                <h4 className='text-[15px] font-semibold'>
                  {selected.name}
                </h4>

                <p className='text-neutral-500'>
                  {selected.city}
                </p>

                <div className='mt-2'>
                  <StatusBadge
                    status={
                      selected.status
                    }
                  />
                </div>

                <dl className='my-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12.5px]'>
                  {[
                    [
                      'Owner',
                      selected.owner,
                    ],
                    [
                      'Orders today',
                      selected.ordersToday,
                    ],
                    [
                      'GMV today',
                      inr(
                        selected.gmvToday,
                      ),
                    ],
                    [
                      'Current orders',
                      selected.current,
                    ],
                    [
                      'Last active',
                      ago(
                        selected.lastActive,
                      ),
                    ],
                  ].map(([key, value]) => (
                    <div
                      key={key}
                      className='contents'
                    >
                      <dt className='text-neutral-500'>
                        {key}
                      </dt>

                      <dd className='text-right font-medium'>
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <Btn
                  primary
                  className='w-full py-1.5'
                  onClick={() =>
                    nav(
                      `/restaurants?cart=${selected.id}`,
                    )
                  }
                >
                  View restaurant
                </Btn>
              </>
            ) : (
              <div className='flex h-full min-h-[250px] items-center justify-center'>
                <p className='text-center text-neutral-500'>
                  Select a restaurant on the map
                  <br />
                  to view its details.
                </p>
              </div>
            )}
          </div>
        </div>
      </State>
    </Card>
  )
}
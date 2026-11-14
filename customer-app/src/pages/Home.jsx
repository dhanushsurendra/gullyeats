import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  RiArrowRightSLine,
  RiCloseLine,
  RiMapPin2Line,
  RiMapPinUserLine,
  RiQrScan2Line,
  RiSearchLine,
  RiStore2Line,
} from 'react-icons/ri'

import illustration from '../assets/welcome.png'
import ActiveOrders from '../components/ActiveOrders'
import { Button, Card, Page, Spinner, ThemeToggle } from '../components/ui'
import { api } from '../constants/api'
import { shortAddress } from '../utils/format'
import { STEPS } from './Welcome'

/*
 * gullyeats.in: carts near the customer, a search over every cart, and the
 * cart they last ordered from. Location is asked for on arrival; without it
 * (denied, unsupported, timed out) the page is a landing page with search.
 * The position only goes to /carts/discover to sort, never stored.
 */

// idle → locating → located | denied | unavailable
function useLocation() {
  const [state, setState] = useState({ status: 'idle', here: null })
  const locate = () => {
    if (!navigator.geolocation) return setState({ status: 'unavailable', here: null })
    setState((s) => ({ ...s, status: 'locating' }))
    navigator.geolocation.getCurrentPosition(
      (p) => setState({ status: 'located', here: [p.coords.latitude, p.coords.longitude] }),
      (e) => setState({ status: e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable', here: null }),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    )
  }
  return [state, locate]
}

function useDebounced(value, ms) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

const km = (d) => (d < 1 ? `${Math.max(50, Math.round((d * 1000) / 50) * 50)} m` : `${d.toFixed(1)} km`)

export default function Home() {
  const navigate = useNavigate()
  const lastCart = useSelector((state) => state.cart.details)
  const [{ status, here }, locate] = useLocation()
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim(), 300)
  const [result, setResult] = useState({ key: null, carts: [], error: '' })

  useEffect(locate, []) // eslint-disable-line react-hooks/exhaustive-deps

  // What to ask for: a search, and/or the carts around the customer.
  const key = q || here ? JSON.stringify([q, here]) : null
  useEffect(() => {
    if (!key) return
    let live = true
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (here) {
      params.set('lat', here[0].toFixed(5))
      params.set('lng', here[1].toFixed(5))
    }
    api(`/carts/discover?${params}`).then(
      (carts) => live && setResult({ key, carts, error: '' }),
      (e) => live && setResult({ key, carts: [], error: e.message }),
    )
    return () => {
      live = false
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const loading = Boolean(key) && result.key !== key
  const showList = Boolean(key)
  const noLocation = status === 'denied' || status === 'unavailable'

  return (
    <Page className='bg-surface'>
      <div className='relative overflow-hidden bg-linear-to-br from-[#ff8a3d] to-primary px-5 pb-16 pt-4 text-white'>
        <img
          src={illustration}
          alt=''
          className='pointer-events-none absolute -right-16 -top-4 h-40 opacity-15 [filter:brightness(0)_invert(1)]'
        />
        <div className='relative flex items-center justify-between'>
          <p className='rounded-full bg-surface/90 px-3 py-1 text-xs font-bold tracking-wide text-primary'>GullyEats</p>
          <ThemeToggle className='bg-black/20 text-white backdrop-blur-sm hover:bg-black/30' />
        </div>
        <h1 className='animate-fade-up relative mt-6 text-[28px] font-extrabold leading-tight'>
          Street food,
          <br />
          right around you.
        </h1>
        <p className='animate-fade-up relative mt-2 max-w-[17rem] text-sm text-white/85'>
          Order from your local cart, get a token, pay at the counter. No app, no login.
        </p>
      </div>

      <main className='relative -mt-8 flex-1 rounded-t-[28px] bg-surface px-4 pb-10 pt-5'>
        <label className='sticky top-2 z-20 flex h-13 items-center gap-3 rounded-2xl bg-grey-100 px-4 ring-1 ring-transparent transition focus-within:bg-surface focus-within:ring-2 focus-within:ring-primary/40 shadow-card'>
          <RiSearchLine size={20} className='shrink-0 text-grey-400' />
          <input
            type='search'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search a cart, dish spot or area'
            aria-label='Search carts'
            enterKeyHint='search'
            className='w-full bg-transparent text-[15px] outline-none placeholder:text-grey-400 [&::-webkit-search-cancel-button]:hidden'
          />
          {query && (
            <button type='button' onClick={() => setQuery('')} aria-label='Clear search' className='text-grey-400'>
              <RiCloseLine size={20} />
            </button>
          )}
        </label>

        {lastCart?._id && !q && (
          <div className='mt-4'>
            <ActiveOrders cartId={lastCart._id} />
            <button
              type='button'
              onClick={() => navigate(`/c/${lastCart._id}/menu`)}
              className='animate-fade-up flex w-full items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3 text-left transition active:scale-[0.98]'
            >
              <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-primary'>
                <RiStore2Line size={20} />
              </span>
              <span className='min-w-0 flex-1'>
                <span className='block text-xs text-grey-500'>Continue at</span>
                <span className='block truncate font-semibold'>{lastCart.cartName}</span>
              </span>
              <RiArrowRightSLine size={22} className='shrink-0 text-grey-400' />
            </button>
          </div>
        )}

        <section className='mt-6' aria-live='polite'>
          {!q && status === 'located' && (
            <h2 className='mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-grey-400'>
              <RiMapPinUserLine /> Near you
            </h2>
          )}
          {q && <h2 className='mb-3 text-xs font-semibold uppercase tracking-wider text-grey-400'>Results for “{q}”</h2>}

          {!q && (status === 'idle' || status === 'locating') && (
            <div className='flex items-center gap-3 rounded-2xl bg-grey-100 px-4 py-4 text-sm text-grey-600'>
              <Spinner className='h-4 w-4 text-primary' /> Finding carts near you…
            </div>
          )}

          {showList && loading && (
            <div className='space-y-3' role='status' aria-label='Loading carts'>
              {[0, 1, 2].map((i) => (
                <div key={i} className='skeleton h-24' />
              ))}
            </div>
          )}

          {showList && !loading && result.error && (
            <Card tone='bg-danger-soft' className='text-sm text-danger'>
              Couldn't load carts: {result.error}
            </Card>
          )}

          {showList && !loading && !result.error && result.carts.length > 0 && (
            <ul className='space-y-3'>
              {result.carts.map((c, i) => (
                <li key={c._id} className='animate-fade-up' style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}>
                  <CartRow cart={c} onOpen={() => navigate(`/c/${c._id}`)} />
                </li>
              ))}
            </ul>
          )}

          {showList && !loading && !result.error && result.carts.length === 0 && (
            <EmptyNote
              title={q ? 'No carts match that' : 'No GullyEats carts nearby yet'}
              text={q ? 'Try a cart name or an area, like “Indiranagar”.' : 'Search by cart or area above, or scan the QR code on a cart.'}
            />
          )}

          {!q && noLocation && <Landing status={status} onRetry={locate} />}
        </section>
      </main>
    </Page>
  )
}

function CartRow({ cart, onOpen }) {
  const [broken, setBroken] = useState(false) // a photo that fails to load shows the icon
  return (
    <button
      type='button'
      onClick={onOpen}
      className='flex w-full items-center gap-3 rounded-card bg-surface p-3 text-left shadow-card transition active:scale-[0.98]'
    >
      <span className='h-18 w-18 shrink-0 overflow-hidden rounded-2xl bg-linear-to-br from-[#ff8a3d] to-primary'>
        {cart.cartImageUrl && !broken ? (
          <img
            src={cart.cartImageUrl}
            alt=''
            loading='lazy'
            onError={() => setBroken(true)}
            className='h-full w-full object-cover'
          />
        ) : (
          <span className='flex h-full w-full items-center justify-center text-white/90'>
            <RiStore2Line size={30} />
          </span>
        )}
      </span>
      <span className='min-w-0 flex-1'>
        <span className='block truncate text-[15px] font-semibold'>{cart.cartName}</span>
        <span className='mt-0.5 flex items-center gap-1 text-xs text-grey-500'>
          <RiMapPin2Line className='shrink-0' />
          <span className='truncate'>{shortAddress(cart.address) || cart.cartCity}</span>
        </span>
        <span className='mt-1.5 flex items-center gap-2 text-xs'>
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
              cart.isOpen ? 'bg-success-soft text-success' : 'bg-grey-100 text-grey-500'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${cart.isOpen ? 'bg-success' : 'bg-grey-400'}`} />
            {cart.isOpen ? 'Open now' : 'Closed'}
          </span>
          {cart.distanceKm != null && <span className='font-medium text-grey-600'>{km(cart.distanceKm)}</span>}
        </span>
      </span>
      <RiArrowRightSLine size={22} className='shrink-0 text-grey-300' />
    </button>
  )
}

function EmptyNote({ title, text }) {
  return (
    <div className='rounded-2xl bg-grey-100 px-5 py-6 text-center'>
      <p className='font-semibold'>{title}</p>
      <p className='mt-1 text-sm text-grey-500'>{text}</p>
    </div>
  )
}

// No location: what GullyEats is, how to find a cart, and a way to try again.
function Landing({ status, onRetry }) {
  const [tried, setTried] = useState(false)
  const denied = status === 'denied'
  return (
    <div className='animate-fade-up'>
      <Card tone='bg-ink text-white' className='overflow-hidden'>
        <div className='flex items-start gap-3'>
          <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-primary'>
            <RiMapPinUserLine size={22} />
          </span>
          <div className='min-w-0'>
            <p className='font-semibold'>{denied ? 'Location is off' : "Couldn't find your location"}</p>
            <p className='mt-1 text-sm text-white/70'>
              {denied && tried
                ? 'Your browser is blocking it. Allow location for this site in the browser settings, or search above.'
                : 'Turn it on to see the carts around you, or search for one above.'}
            </p>
          </div>
        </div>
        <Button
          className='mt-4 h-11'
          onClick={() => {
            setTried(true)
            onRetry()
          }}
        >
          <RiMapPinUserLine size={18} /> Find carts near me
        </Button>
      </Card>

      <h2 className='mt-8 text-xs font-semibold uppercase tracking-wider text-grey-400'>How it works</h2>
      <ol className='mt-3 space-y-1'>
        <li className='flex items-center gap-4 py-2'>
          <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary'>
            <RiQrScan2Line size={22} />
          </span>
          <span>
            <span className='block text-[15px] font-semibold'>Scan or find a cart</span>
            <span className='block text-sm text-grey-500'>Scan the QR on the cart, or pick one here.</span>
          </span>
        </li>
        {STEPS.map(({ icon, title, text }, i) => (
          <li key={title} className='animate-fade-up flex items-center gap-4 py-2' style={{ animationDelay: `${100 + i * 80}ms` }}>
            <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary'>
              {icon({ size: 22 })}
            </span>
            <span>
              <span className='block text-[15px] font-semibold'>{title}</span>
              <span className='block text-sm text-grey-500'>{text}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

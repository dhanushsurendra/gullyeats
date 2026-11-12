import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { RiMapPin2Line, RiRestaurantLine, RiStarFill, RiTicket2Line, RiWallet3Line } from 'react-icons/ri'

import illustration from '../assets/welcome.png'
import ActiveOrders from '../components/ActiveOrders'
import { Button, LoadingScreen, Page, StatusScreen, BottomBar, ThemeToggle } from '../components/ui'
import { api } from '../constants/api'
import { setCartDetails } from '../store/cartSlice'
import { shortAddress } from '../utils/format'

const STEPS = [
  { icon: RiRestaurantLine, title: 'Pick your food', text: 'Add items from the menu. No login.' },
  { icon: RiTicket2Line, title: 'Get your token', text: 'Your token number appears instantly.' },
  { icon: RiWallet3Line, title: 'Pay at the counter', text: 'Cooking starts once you pay.' },
]

export default function Welcome() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { cartId } = useParams()
  const cached = useSelector((state) => state.cart.details)
  const [cart, setCart] = useState(cached?._id === cartId ? cached : null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    api(`/carts/get-cart/${cartId}`)
      .then((data) => {
        if (!live) return
        dispatch(setCartDetails(data))
        setCart(data)
        setError('')
      })
      .catch((e) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [cartId, dispatch, attempt])

  if (!cart) {
    return (
      <Page>
        {error ? (
          <StatusScreen icon='🛺' title="Couldn't open this cart" message={error}>
            <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
          </StatusScreen>
        ) : (
          <LoadingScreen label='Opening the cart…' blocks={['h-64', 'h-8 w-2/3', 'h-4 w-1/2', 'h-24', 'h-13 mt-6']} />
        )}
      </Page>
    )
  }

  const isOpen = cart.isOpen && cart.isActive !== false

  return (
    <Page className='bg-surface'>
      <div className='relative h-64 overflow-hidden bg-linear-to-br from-[#ff8a3d] to-primary'>
        {cart.cartImageUrl ? (
          <img src={cart.cartImageUrl} alt='' className='h-full w-full object-cover' />
        ) : (
          <img src={illustration} alt='' className='mx-auto h-full object-contain py-4' />
        )}
        <div className='absolute inset-0 bg-linear-to-t from-black/45 to-transparent' />
        <p className='absolute left-4 top-4 rounded-full bg-surface/90 px-3 py-1 text-xs font-bold tracking-wide text-primary'>
          GullyEats
        </p>
        <ThemeToggle className='absolute right-3 top-3 bg-black/30 text-white backdrop-blur-sm hover:bg-black/40' />
      </div>

      <main className='relative -mt-8 flex-1 rounded-t-[28px] bg-surface px-5 pt-6'>
        <div className='animate-fade-up flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h1 className='text-2xl font-bold leading-tight'>{cart.cartName}</h1>
            {cart.address && (
              <p className='mt-1 flex items-start gap-1 text-sm text-grey-500'>
                <RiMapPin2Line className='mt-0.5 shrink-0' />
                <span className='line-clamp-2 min-w-0 break-words'>{shortAddress(cart.address)}</span>
              </p>
            )}
            {cart.rating?.count > 0 && (
              <p
                className='mt-1.5 flex items-center gap-1 text-sm'
                aria-label={`Rated ${cart.rating.average} out of 5 by ${cart.rating.count} ${cart.rating.count === 1 ? 'customer' : 'customers'}`}
              >
                <RiStarFill className='shrink-0 text-amber-400' size={16} />
                <b className='tabular-nums text-grey-900'>{cart.rating.average.toFixed(1)}</b>
                <span className='text-grey-500'>
                  · {cart.rating.count} {cart.rating.count === 1 ? 'rating' : 'ratings'}
                </span>
              </p>
            )}
          </div>
          <span
            className={`mt-1 flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              isOpen ? 'bg-success-soft text-success' : 'bg-grey-100 text-grey-500'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isOpen ? 'animate-pulse bg-success' : 'bg-grey-400'}`} />
            {isOpen ? 'Open now' : 'Closed'}
          </span>
        </div>

        {!isOpen && (
          <p className='animate-fade-up mt-4 rounded-2xl bg-grey-100 px-4 py-3 text-sm text-grey-600'>
            This cart isn't taking orders right now. You can still look at the menu.
          </p>
        )}

        <div className='mt-6'>
          <ActiveOrders cartId={cartId} />
        </div>

        <h2 className='mt-2 text-xs font-semibold uppercase tracking-wider text-grey-400'>How it works</h2>
        <ol className='mt-3 space-y-1'>
          {STEPS.map(({ icon, title, text }, i) => (
            <li
              key={title}
              className='animate-fade-up flex items-center gap-4 py-2'
              style={{ animationDelay: `${100 + i * 80}ms` }}
            >
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
      </main>

      <BottomBar>
        <Button onClick={() => navigate(`/c/${cartId}/menu`)}>
          {isOpen ? 'Start my order' : 'View the menu'}
        </Button>
        <p className='mt-2 text-center text-xs text-grey-400'>
          No app download needed ·{' '}
          <a href='/terms.html' target='_blank' rel='noopener' className='underline underline-offset-2'>
            Terms &amp; Privacy
          </a>
        </p>
      </BottomBar>
    </Page>
  )
}

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { RiAddLine, RiPhoneLine } from 'react-icons/ri'

import defaultFoodImage from '../assets/default-food.png'
import { BottomBar, Button, Card, Page, Row, StatusScreen, Stepper, TopBar, VegMark } from '../components/ui'
import { api } from '../constants/api'
import { addItem, clearCart, removeItem, rememberOrder, setCartDetails, setPhoneNumber } from '../store/cartSlice'
import { itemCount, itemsTotal, rupees } from '../utils/format'

// The open state saved from the menu goes stale when the vendor closes the
// cart meanwhile, so the cart page asks again. A failed check keeps what we have.
function refreshCart(dispatch, cartId) {
  api(`/carts/get-cart/${cartId}`)
    .then((data) => data?._id === cartId && dispatch(setCartDetails(data)))
    .catch(() => {})
}

// Review the basket, optionally leave a phone number, and place the order.
export default function CustomerCart() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { cartId } = useParams()

  const cart = useSelector((state) => state.cart.details)
  const menuItems = useSelector((state) => state.cart.items)
  const basket = useSelector((state) => state.cart.cart)
  const savedPhone = useSelector((state) => state.cart.phone)

  const [phone, setPhone] = useState(savedPhone || '')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => refreshCart(dispatch, cartId), [dispatch, cartId])

  const items = menuItems.filter((item) => basket[item._id] > 0)
  const subtotal = itemsTotal(items, basket)
  const count = itemCount(Object.fromEntries(items.map((i) => [i._id, basket[i._id]])))
  const isOpen = cart?._id === cartId && cart.isOpen && cart.isActive !== false
  // The server's current fee, sent with the cart (it sets the real one on the order).
  const fee = Number(cart?._id === cartId && cart.platformFee) || 0
  const phoneInvalid = phone.length > 0 && !/^[6-9]\d{9}$/.test(phone)

  const toMenu = () => navigate(`/c/${cartId}/menu`)

  const placeOrder = async () => {
    if (phoneInvalid) {
      setError('Enter a 10-digit mobile number, or leave it empty.')
      return
    }
    setPlacing(true)
    setError('')
    try {
      // The server prices the order itself; names, prices and totals are only
      // for backends deployed before that, which store what they're sent.
      const order = await api('/orders/create-order', {
        method: 'POST',
        body: {
          cartId,
          orderItems: items.map((item) => ({
            menuItemId: item._id,
            name: item.name,
            price: item.price,
            quantity: basket[item._id],
            total: item.price * basket[item._id],
          })),
          status: 'PENDING',
          orderType: 'QR',
          subtotal,
          parcelCharge: 0,
          platformFee: fee,
          totalPrice: subtotal + fee,
          phoneNumber: phone || null,
        },
      })
      dispatch(setPhoneNumber(phone || null))
      dispatch(rememberOrder(order))
      dispatch(clearCart())
      navigate(`/c/${cartId}/order/${order._id}`, { replace: true })
    } catch (e) {
      setError(e.message)
      setPlacing(false)
      // Closed or paused since the page opened: show it and disable ordering.
      if (e.status === 403) refreshCart(dispatch, cartId)
    }
  }

  if (!items.length) {
    return (
      <Page>
        <TopBar title='Your cart' onBack={toMenu} />
        <StatusScreen icon='🛒' title='Your cart is empty' message='Add something tasty from the menu.'>
          <Button onClick={toMenu}>Browse the menu</Button>
        </StatusScreen>
      </Page>
    )
  }

  return (
    <Page>
      <TopBar
        title='Your cart'
        subtitle={cart?.cartName}
        onBack={toMenu}
        right={
          <button
            type='button'
            onClick={() => dispatch(clearCart())}
            className='rounded-full px-3 py-1.5 text-sm font-medium text-grey-500 hover:bg-grey-100'
          >
            Clear
          </button>
        }
      />

      <main className='flex-1 space-y-4 px-4 py-4'>
        <Card className='animate-fade-up p-0'>
          <ul className='divide-y divide-grey-100'>
            {items.map((item) => (
              <li key={item._id} className='flex items-center gap-3 p-4'>
                <img
                  src={item.imageUrl || item.defaultImage || defaultFoodImage}
                  alt=''
                  className='h-12 w-12 shrink-0 rounded-xl bg-grey-100 object-cover'
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = defaultFoodImage
                  }}
                />
                <div className='min-w-0 flex-1'>
                  {/* Up to two lines: one line cut most names after a word or two. */}
                  <div className='flex items-start gap-2'>
                    <span className='mt-1 shrink-0'>
                      <VegMark isVeg={item.isVeg} />
                    </span>
                    <p className='line-clamp-2 min-w-0 break-words text-sm font-medium leading-snug'>{item.name}</p>
                  </div>
                  <p className='mt-0.5 text-sm text-grey-500'>{rupees(item.price * basket[item._id])}</p>
                </div>
                <Stepper
                  name={item.name}
                  quantity={basket[item._id]}
                  onAdd={() => dispatch(addItem(item._id))}
                  onRemove={() => dispatch(removeItem(item._id))}
                />
              </li>
            ))}
          </ul>
          <button
            type='button'
            onClick={toMenu}
            className='flex w-full items-center gap-2 border-t border-grey-100 px-4 py-3.5 text-sm font-semibold text-primary'
          >
            <RiAddLine size={18} /> Add more items
          </button>
        </Card>

        <Card className='animate-fade-up space-y-3 [animation-delay:60ms]'>
          <h2 className='text-[15px] font-semibold'>Bill details</h2>
          <Row label='Item total' value={rupees(subtotal)} />
          <Row label='Platform fee' value={rupees(fee)} />
          <div className='border-t border-dashed border-grey-200' />
          <Row label='To pay at the counter' value={rupees(subtotal + fee)} strong />
          <p className='text-xs text-grey-400'>Need it packed to take away? Tell the vendor when you pay.</p>
        </Card>

        <Card className='animate-fade-up [animation-delay:120ms]'>
          <label htmlFor='phone' className='text-[15px] font-semibold'>
            Phone number <span className='font-normal text-grey-400'>(optional)</span>
          </label>
          <p className='mt-0.5 text-xs text-grey-500'>
            So the vendor can reach you about this order, and to keep your GullyPlay rank across orders.{' '}
            <a href='/terms.html#privacy' target='_blank' rel='noopener' className='underline underline-offset-2'>
              Privacy
            </a>
          </p>
          <div
            className={`mt-3 flex h-12 items-center gap-3 rounded-xl bg-grey-100 px-4 ring-1 transition focus-within:bg-surface focus-within:ring-2 ${
              phoneInvalid ? 'ring-danger/50' : 'ring-transparent focus-within:ring-primary/40'
            }`}
          >
            <RiPhoneLine className='shrink-0 text-grey-400' size={18} />
            <span className='text-[15px] text-grey-500'>+91</span>
            <input
              id='phone'
              type='tel'
              inputMode='numeric'
              autoComplete='tel-national'
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/\D/g, '').slice(-10))
                setError('')
              }}
              placeholder='98765 43210'
              className='w-full bg-transparent text-[15px] tracking-wide outline-none placeholder:text-grey-400'
            />
          </div>
        </Card>
      </main>

      <BottomBar>
        {error && (
          <p role='alert' className='mb-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger'>
            {error}
          </p>
        )}
        {!isOpen && !error && (
          <p className='mb-3 rounded-xl bg-grey-100 px-3 py-2 text-sm text-grey-600'>
            This cart is closed right now, so it can't take your order.
          </p>
        )}
        <Button onClick={placeOrder} loading={placing} disabled={!isOpen}>
          {placing ? 'Placing order…' : `Place order · ${rupees(subtotal + fee)}`}
        </Button>
        <p className='mt-2 text-center text-xs text-grey-400'>
          {count} {count === 1 ? 'item' : 'items'} · You'll get a token. Pay at the counter.
          <br />
          By ordering you agree to the{' '}
          <a href='/terms.html' target='_blank' rel='noopener' className='underline underline-offset-2'>
            Terms
          </a>
          .
        </p>
      </BottomBar>
    </Page>
  )
}

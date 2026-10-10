import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'

import Button from '../components/Button'
import MenuHeader from '../components/MenuHeader'
import phone from '../assets/phone.png'

import { setPhoneNumber, setOrder } from '../store/cartSlice'
import { API_BASE_URL } from '../constants/api'

const PLATFORM_FEE = 2

export default function PhoneCapture() {
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const { cartId } = useParams()

  const savedPhone = useSelector((state) => state.cart.phone)
  const menuItems = useSelector((state) => state.cart.items)
  const cart = useSelector((state) => state.cart.cart)

  const [phoneNumber, setPhoneInput] = useState(savedPhone || '')

  // Separate loading states
  const [isContinuing, setIsContinuing] = useState(false)
  const [isSkipping, setIsSkipping] = useState(false)

  const isSaving = isContinuing || isSkipping
  const isValidPhone = phoneNumber.length === 10

  /*
   * Get items currently in the cart.
   */
  const cartItems = useMemo(() => {
    return menuItems.filter((item) => Number(cart[item._id]) > 0)
  }, [menuItems, cart])

  /*
   * Calculate subtotal.
   */
  const subtotal = useMemo(() => {
    return cartItems.reduce(
      (total, item) => total + Number(item.price) * Number(cart[item._id]),
      0,
    )
  }, [cartItems, cart])

  /*
   * Parcel charge is initially zero.
   * Vendor can update it later if required.
   */
  const parcelCharge = 0

  /*
   * Final order total.
   */
  const total = subtotal + parcelCharge + PLATFORM_FEE

  /*
   * Convert Redux cart into backend orderItems.
   */
  const orderItems = useMemo(() => {
    return cartItems.map((item) => ({
      menuItemId: item._id,
      name: item.name,
      quantity: Number(cart[item._id]),
      price: Number(item.price),
      total: Number(item.price) * Number(cart[item._id]),
    }))
  }, [cartItems, cart])

  /*
   * Create QR order.
   */
  const placeOrder = async (phone) => {
    const payload = {
      cartId,
      orderItems,
      status: 'PENDING',
      orderType: 'QR',
      subtotal,
      parcelCharge,
      platformFee: PLATFORM_FEE,
      totalPrice: total,
      phoneNumber: phone || null,
    }

    const response = await fetch(`${API_BASE_URL}/orders/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data?.message || 'Unable to place your order.')
    }

    return data.data
  }

  /*
   * Continue with phone number.
   */
  const handleContinue = async () => {
    // Don't allow submission without a valid phone number
    if (!isValidPhone || isSaving) return

    setIsContinuing(true)

    const phone = phoneNumber

    dispatch(setPhoneNumber(phone))

    try {
      const order = await placeOrder(phone)

      dispatch(setOrder(order))

      /*
       * Navigate using the order ID.
       */
      navigate(`/c/${cartId}/order/${order._id}`)
    } catch (error) {

      setIsContinuing(false)
    }
  }

  /*
   * Skip phone number but still place the order.
   */
  const handleSkip = async () => {
    if (isSaving) return

    setIsSkipping(true)

    dispatch(setPhoneNumber(null))

    try {
      const order = await placeOrder(null)

      dispatch(setOrder(order))

      /*
       * Phone is optional, but the order is still created.
       */
      navigate(`/c/${cartId}/order/${order._id}`)
    } catch (error) {

      setIsSkipping(false)
    }
  }

  return (
    <div className='min-h-screen bg-white font-poppins flex flex-col'>
      <MenuHeader
        onBack={() => navigate(-1)}
        title='Get Order Updates'
        subtitle='No OTP. No spam. Only for this order.'
      />

      <main className='flex-1 px-4 py-5'>
        {/* Phone Illustration */}
        <div
          className='
            flex
            justify-center
            mb-6
            animate-[phoneIllustrationIn_0.5s_ease-out]
          '
        >
          <img
            src={phone}
            alt='Order updates'
            className='
              w-full
              object-contain
              animate-[phoneFloat_4s_ease-in-out_infinite]
            '
          />
        </div>

        {/* Phone Card */}
        <section
          className='
            bg-white
            border
            border-grey-200
            rounded-2xl
            p-4
            shadow-sm
            animate-[phoneCardIn_0.45s_ease-out]
          '
        >
          <div className='mb-3'>
            <h3 className='text-body font-semibold text-black'>
              Add your phone number
            </h3>

            <p className='text-caption text-grey-400 mt-1'>
              Optional — you can continue without it.
            </p>
          </div>

          {/* Phone Input */}
          <div
            className={`
              flex
              items-center
              rounded-xl
              px-3
              h-12
              transition-all
              duration-200
              ${
                isValidPhone
                  ? 'bg-success/5 border border-success/30'
                  : 'bg-grey-100 border border-transparent focus-within:border-primary/30 focus-within:bg-white'
              }
            `}
          >
            <span
              className='
                text-sm
                font-medium
                text-grey-700
                pr-3
                mr-3
                border-r
                border-grey-300
              '
            >
              +91
            </span>

            <input
              type='tel'
              inputMode='numeric'
              autoComplete='tel'
              value={phoneNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 10)

                setPhoneInput(value)
              }}
              placeholder='98765 43210'
              disabled={isSaving}
              className='
                bg-transparent
                outline-none
                w-full
                text-sm
                text-grey-800
                placeholder:text-grey-400
                disabled:opacity-60
              '
            />

            {isValidPhone && (
              <span
                className='
                  text-success
                  text-sm
                  font-semibold
                  animate-[phoneCheckIn_0.2s_ease-out]
                '
              >
                ✓
              </span>
            )}
          </div>

          {/* Benefits */}
          <div className='mt-5 space-y-3'>
            <p className='text-caption text-grey-500'>
              Faster updates if your token is called
            </p>

            <p className='text-caption text-grey-500'>
              Helps the vendor confirm your order
            </p>

            <p className='text-caption text-grey-500'>
              Useful if you temporarily lose network access
            </p>
          </div>
        </section>

        <p
          className='
            text-center
            text-caption
            text-grey-400
            mt-5
            px-4
          '
        >
          Your number is only used for updates about this order.
        </p>
      </main>

      {/* Footer */}
      <div
        className='
          px-4
          pb-5
          pt-3
          bg-white
          animate-[phoneFooterIn_0.4s_ease-out]
        '
      >
        {/* Main Continue Button */}
        <Button onClick={handleContinue} disabled={!isValidPhone || isSaving}>
          {isContinuing ? 'PLACING ORDER...' : 'GET ORDER UPDATES'}
        </Button>

        {/* Skip */}
        {!isValidPhone && (
          <button
            type='button'
            onClick={handleSkip}
            disabled={isSaving}
            className='
              w-full
              mt-2
              py-2
              text-caption
              font-medium
              text-grey-500
              hover:text-grey-800
              transition-colors
              disabled:opacity-50
              disabled:cursor-not-allowed
            '
          >
            {isSkipping ? 'PLACING ORDER...' : 'Skip for now'}
          </button>
        )}
      </div>
    </div>
  )
}

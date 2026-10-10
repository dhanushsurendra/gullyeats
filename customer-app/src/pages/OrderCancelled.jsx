import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { RiArrowLeftSLine } from 'react-icons/ri'

import Button from '../components/Button'

const getShortLocation = (address = '') => {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  return parts.length >= 4
    ? `${parts[2]} • ${parts[3]}`
    : address
}

export default function OrderCancelled() {
  const navigate = useNavigate()
  const { cartId } = useParams()

  const order = useSelector((state) => state.cart.order)
  const cartDetails = useSelector((state) => state.cart.details)

  const orderNumber = order?.orderNumber

  const vendorName = cartDetails?.cartName || 'GullyEats'
  const vendorAddress = cartDetails?.address || ''

  /*
   * Prefer the actual paid amount.
   *
   * If paidAmount is not available in the order,
   * fall back to the refund amount from paymentAdjustment.
   */
  const paidAmount = Number(
    order?.paidAmount ??
      (order?.paymentAdjustment?.action === 'RETURN'
        ? Math.abs(Number(order.paymentAdjustment.amount || 0))
        : 0),
  )

  const wasPaid = paidAmount > 0

  /*
   * If the order wasn't paid, there is nothing
   * for the customer to collect.
   *
   * Redirect back to the menu automatically.
   */
  useEffect(() => {
    if (!order) return

    if (!wasPaid) {
      const timer = setTimeout(() => {
        navigate(`/c/${cartId}/menu`, { replace: true })
      }, 1800)

      return () => clearTimeout(timer)
    }
  }, [order, wasPaid, cartId, navigate])

  /*
   * No order available.
   */
  if (!order) {
    return (
      <div className='min-h-screen bg-white font-poppins flex items-center justify-center px-5'>
        <div className='text-center'>
          <p className='text-sm font-semibold text-grey-800'>
            Order not found
          </p>

          <button
            type='button'
            onClick={() => navigate(`/c/${cartId}/menu`)}
            className='mt-4 text-sm font-semibold text-primary'
          >
            GO TO MENU
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-white font-poppins flex flex-col'>
      {/* Header */}
      <header className='px-4 pt-5'>
        <button
          type='button'
          onClick={() => navigate(`/c/${cartId}/menu`)}
          className='
            w-9
            h-9
            rounded-full
            bg-grey-100
            flex
            items-center
            justify-center
            text-grey-700
            active:scale-95
            transition
          '
        >
          <RiArrowLeftSLine className='text-xl' />
        </button>

        <div className='mt-4'>
          <p className='text-caption text-grey-400'>
            {vendorName}
          </p>

          {vendorAddress && (
            <p className='text-caption text-grey-500 mt-0.5'>
              {getShortLocation(vendorAddress)}
            </p>
          )}
        </div>
      </header>

      {/* Content */}
      <main className='flex-1 px-4 flex flex-col justify-center pb-10'>
        {/* Cancel icon */}
        <div
          className='
            mx-auto
            w-16
            h-16
            rounded-full
            bg-red-50
            flex
            items-center
            justify-center
            animate-[cancelIconIn_0.45s_ease-out]
          '
        >
          <div className='relative w-8 h-8'>
            <span
              className='
                absolute
                top-1/2
                left-1/2
                w-7
                h-0.5
                bg-red-500
                -translate-x-1/2
                -translate-y-1/2
                rotate-45
                rounded-full
              '
            />

            <span
              className='
                absolute
                top-1/2
                left-1/2
                w-7
                h-0.5
                bg-red-500
                -translate-x-1/2
                -translate-y-1/2
                -rotate-45
                rounded-full
              '
            />
          </div>
        </div>

        {/* Heading */}
        <div className='text-center mt-5 animate-[cancelContentIn_0.45s_ease-out]'>
          <h1 className='text-[18px] font-bold text-grey-900'>
            Order cancelled
          </h1>

          <p className='text-caption text-grey-500 mt-1.5'>
            Order #{orderNumber}
          </p>
        </div>

        {/* Paid order */}
        {wasPaid ? (
          <div
            className='
              mt-6
              border
              border-grey-200
              rounded-2xl
              p-4
              bg-white
              shadow-sm
              animate-[cancelCardIn_0.5s_ease-out]
            '
          >
            <div className='text-center'>
              <p className='text-caption text-grey-500'>
                Amount to be returned
              </p>

              <p className='text-[28px] leading-tight font-bold text-primary mt-1'>
                ₹{paidAmount}
              </p>

              <p className='text-caption text-grey-500 mt-3 leading-relaxed'>
                Please collect this amount from the vendor at the counter.
              </p>
            </div>

            {/* Order details */}
            <div className='border-t border-grey-200 mt-4 pt-3'>
              <div className='flex items-center justify-between'>
                <span className='text-caption text-grey-500'>
                  Order
                </span>

                <span className='text-caption font-semibold text-grey-800'>
                  #{orderNumber}
                </span>
              </div>

              <div className='flex items-center justify-between mt-2'>
                <span className='text-caption text-grey-500'>
                  Status
                </span>

                <span className='text-caption font-semibold text-red-500'>
                  Cancelled
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Unpaid order */
          <div
            className='
              mt-6
              border
              border-grey-200
              rounded-2xl
              p-4
              bg-white
              shadow-sm
              text-center
              animate-[cancelCardIn_0.5s_ease-out]
            '
          >
            <p className='text-sm font-semibold text-grey-800'>
              No payment was made
            </p>

            <p className='text-caption text-grey-500 mt-1.5 leading-relaxed'>
              Your order has been cancelled. Taking you back to the menu...
            </p>

            <div className='mt-4 h-1.5 rounded-full bg-grey-100 overflow-hidden'>
              <div
                className='
                  h-full
                  bg-primary
                  rounded-full
                  animate-[cancelProgress_1.8s_linear_forwards]
                '
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      {wasPaid && (
        <div className='px-4 pb-5 pt-3'>
          <Button
            onClick={() => navigate(`/c/${cartId}/menu`)}
          >
            BACK TO MENU
          </Button>
        </div>
      )}

      {/* Home indicator */}
      <div className='pb-2 flex justify-center'>
        <div className='w-24 h-1 rounded-full bg-grey-300' />
      </div>
    </div>
  )
}
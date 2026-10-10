import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { RiShareLine, RiArrowRightLine } from 'react-icons/ri'
import Button from '../components/Button'

export default function ThankYou() {
  const navigate = useNavigate()
  const { cartId } = useParams()

  const order = useSelector((state) => state.cart.order)
  const cartDetails = useSelector((state) => state.cart.details)

  const orderNumber = order?.orderNumber
  const total = Number(order?.totalPrice || 0)

  const vendorName = cartDetails?.cartName || 'GullyEats'
  const vendorAddress = cartDetails?.address || ''

  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContent(true)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  const getShortLocation = (address = '') => {
    const parts = address
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)

    return parts.length >= 4 ? `${parts[2]} • ${parts[3]}` : address
  }

  const handleOrderAgain = () => {
    navigate(`/c/${cartId}/menu`)
  }

  return (
    <div className='min-h-screen bg-grey-50 font-poppins flex flex-col'>
      {/* Top accent */}
      <div className='h-0.75 bg-sky-500' />

      <main
        className={`
          flex-1
          w-full
          max-w-107.5
          mx-auto
          bg-white
          px-4
          pb-6
          transition-all
          duration-500
          ${
            showContent
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-3'
          }
        `}
      >
        {/* Header */}
        <header className='pt-6 text-center'>
          <div className='text-[12px] font-bold leading-none'>
            <span className='text-primary'>Gully</span>
            <span className='text-grey-900'>Eats</span>
          </div>

          <h1 className='text-[14px] font-bold text-grey-900 mt-1.5'>
            {vendorName}
          </h1>

          <p className='text-[9px] text-grey-500 mt-0.5'>
            {getShortLocation(vendorAddress)}
          </p>
        </header>

        {/* Success */}
        <section className='mt-7 text-center'>
          <div className='relative mx-auto w-17 h-17'>
            {/* Subtle yellow tint */}
            <div
              className='
                absolute
                inset-0
                rounded-full
                bg-[#FFF7ED]
              '
            />

            {/* Smiley */}
            <div
              className='
                  relative
                  w-17
                  h-17
                  rounded-full
                  bg-[#FFF7ED]
                  flex
                  items-center
                  justify-center
                '
            >
              <div className='relative w-10 h-10'>
                {/* Eyes */}
                <span
                  className='
                    absolute
                    top-2
                    left-1
                    w-1.25
                    h-1.25
                    rounded-full
                    bg-primary
                  '
                />

                <span
                  className='
                    absolute
                    top-2
                    right-1
                    w-1.25
                    h-1.25
                    rounded-full
                    bg-primary
                  '
                />

                {/* Smile */}
                <div
                  className='
                    absolute
                    left-1/2
                    bottom-1
                    -translate-x-1/2
                    w-7
                    h-3.5
                    border-b-2
                    border-primary
                    rounded-b-full
                  '
                />
              </div>
            </div>
          </div>

          <h2 className='mt-4 text-[18px] leading-tight font-bold text-grey-900'>
            Thank you!
          </h2>

          <p className='text-[10px] text-grey-500 mt-1'>
            Hope your food hit the spot.
          </p>
        </section>

        {/* Order card */}
        <section
          className='
            mt-6
            rounded-2xl
            border
            border-grey-200
            bg-white
            overflow-hidden
            shadow-sm
          '
        >
          <div className='px-4 py-3.5'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-[8px] uppercase tracking-wide text-grey-400 font-medium'>
                  Order number
                </p>

                <p className='text-[22px] leading-none font-bold text-grey-900 mt-1'>
                  #{orderNumber || '--'}
                </p>
              </div>

              <div className='text-right'>
                <p className='text-[8px] uppercase tracking-wide text-grey-400 font-medium'>
                  Total
                </p>

                <p className='text-[18px] leading-none font-bold text-primary mt-1'>
                  ₹{total}
                </p>
              </div>
            </div>
          </div>

          <div className='border-t border-grey-100 px-4 py-2.5 flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <span className='flex h-5 w-5 items-center justify-center rounded-full bg-green-50 text-green-600'>
                <svg
                  viewBox='0 0 24 24'
                  fill='none'
                  className='h-3 w-3'
                  stroke='currentColor'
                  strokeWidth='2.5'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                >
                  <path d='M5 12.5l4 4L19 7' />
                </svg>
              </span>

              <span className='text-[9px] font-medium text-grey-600'>
                Order completed
              </span>
            </div>

            <span className='text-[8px] text-grey-400'>
              Thank you for ordering
            </span>
          </div>
        </section>

        {/* Order again */}
        <section className='mt-4'>
          <Button type='button' onClick={handleOrderAgain} className='w-full'>
            <span className='flex items-center justify-center gap-2'>
              ORDER AGAIN
              <RiArrowRightLine size={15} />
            </span>
          </Button>

          <p className='text-center text-xs text-grey-400 mt-1.5'>
            Start a fresh order from this cart.
          </p>
        </section>

        {/* Small closing message */}
        <div className='mt-6 text-center'>
          <div className='mx-auto w-8 h-px bg-grey-200' />

          <p className='text-xs text-grey-400 mt-3'>
            Thanks for choosing GullyEats
          </p>
        </div>
      </main>

      {/* Home indicator */}
      <div className='fixed bottom-2 left-1/2 -translate-x-1/2'>
        <div className='w-10 h-1 rounded-full bg-grey-900' />
      </div>
    </div>
  )
}

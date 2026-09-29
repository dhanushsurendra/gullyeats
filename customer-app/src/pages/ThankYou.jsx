import { useNavigate, useParams } from 'react-router-dom'

export default function ThankYou() {
  const navigate = useNavigate()
  const { token } = useParams()

  const orderId = token || '67'
  const total = 130

  const handleOrderAgain = () => {
    navigate('/new-order')
  }

  const handleShare = async () => {
    const shareData = {
      title: 'GullyEats',
      text: `I ordered from GullyEats. Token #${orderId}`,
      url: window.location.href,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href)
        alert('Cart link copied!')
      }
    } catch (error) {
      console.log('Share cancelled')
    }
  }

  return (
    <div className='min-h-screen bg-[#F7F7F7] font-poppins flex flex-col'>
      {/* Top line */}
      <div className='h-0.75 bg-sky-500' />

      {/* Main mobile container */}
      <div
        className='
        flex-1
        w-full
        max-w-107.5
        mx-auto
        bg-white
        rounded-b-[28px]
        px-4
      '
      >
        {/* ================================
            HEADER
        ================================= */}
        <header className='pt-12'>
          <div className='text-center leading-tight'>
            <div className='text-[13px] font-bold'>
              <span className='text-primary'>Gully</span>

              <span className='text-grey-900'>Eats</span>
            </div>

            <h1 className='text-[15px] font-bold text-grey-900 mt-1'>
              Raju Momos
            </h1>

            <p className='text-[10px] text-grey-500 mt-1'>
              BTM 2nd Stage • Bengaluru
            </p>
          </div>
        </header>

        {/* ================================
            SUCCESS ICON
        ================================= */}
        <div className='flex justify-center mt-7'>
          <div
            className='
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

        {/* ================================
            THANK YOU
        ================================= */}
        <div className='text-center mt-4'>
          <h2
            className='
            text-[22px]
            leading-tight
            font-bold
            text-grey-900
          '
          >
            Thank you! 👋
          </h2>

          <p
            className='
            text-[11px]
            text-grey-500
            mt-1
          '
          >
            Hope your food hit the spot.
          </p>
        </div>

        {/* ================================
            ORDER COMPLETED
        ================================= */}
        <div
          className='
            mt-5
            bg-white
            border
            border-grey-200
            rounded-xl
            px-4
            py-3.5
          '
        >
          <div className='flex items-center justify-between'>
            <div>
              <p
                className='
                text-[12px]
                font-bold
                text-grey-900
              '
              >
                Token #{orderId}
              </p>

              <p
                className='
                text-[10px]
                text-grey-500
                mt-1
              '
              >
                Saved for your next visit.
              </p>
            </div>

            <div className='text-right'>
              <p
                className='
                text-[13px]
                font-bold
                text-grey-900
              '
              >
                ₹{total}
              </p>

              <p
                className='
                text-[9px]
                font-semibold
                text-green-600
                mt-0.5
              '
              >
                Completed
              </p>
            </div>
          </div>
        </div>

        {/* ================================
            ORDER AGAIN
        ================================= */}
        <div className='mt-5'>
          <button
            onClick={handleOrderAgain}
            className='
              w-full
              h-12
              rounded-full
              bg-primary
              text-white
              text-[11px]
              font-bold
              active:scale-[0.98]
              transition
            '
          >
            ORDER AGAIN
          </button>

          <p
            className='
            text-center
            text-[9px]
            text-grey-500
            mt-2
          '
          >
            Start a fresh token anytime.
          </p>
        </div>

        {/* ================================
            SHARE CART
        ================================= */}
        <div className='mt-5'>
          <button
            onClick={handleShare}
            className='
              w-full
              h-11
              rounded-full
              bg-white
              border
              border-grey-200
              text-grey-900
              text-[10px]
              font-semibold
              active:scale-[0.98]
              transition
            '
          >
            SHARE THIS CART QR
          </button>

          <p
            className='
            text-center
            text-[9px]
            text-grey-500
            mt-2
          '
          >
            Send this cart to friends.
          </p>
        </div>

        {/* Bottom spacing */}
        <div className='h-10' />
      </div>

      {/* Home indicator */}
      <div className='fixed bottom-2 left-1/2 -translate-x-1/2'>
        <div
          className='
            w-12
            h-1
            rounded-full
            bg-grey-900
          '
        />
      </div>
    </div>
  )
}

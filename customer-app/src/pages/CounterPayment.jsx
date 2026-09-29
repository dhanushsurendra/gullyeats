import { useNavigate, useParams } from 'react-router-dom'
import { RiArrowLeftSLine } from 'react-icons/ri'

export default function CounterPayment() {
  const navigate = useNavigate()
  const { token } = useParams()

  const orderId = token || '67'

  return (
    <div className='min-h-screen bg-[#FAFAFA] font-poppins flex flex-col'>

      {/* Top blue line */}
      <div className='h-0.75 bg-sky-500' />

      {/* ================================
          HEADER
      ================================= */}
      <header className='px-4 pt-5'>

        <div className='relative flex items-center justify-center min-h-13.75'>

          {/* Back */}
          <button
            onClick={() => navigate(`/order/${orderId}`)}
            className='
              absolute
              left-0
              top-1/2
              -translate-y-1/2
              p-2
              bg-white
              border
              border-gray-200
              rounded-xl
              active:scale-95
              transition
            '
          >
            <RiArrowLeftSLine
              size={20}
              className='text-black'
            />
          </button>

          {/* Vendor */}
          <div className='text-center leading-tight'>

            <div className='text-[12px] font-bold'>
              <span className='text-primary'>
                Gully
              </span>

              <span className='text-grey-900'>
                Eats
              </span>
            </div>

            <h1 className='text-[14px] font-bold text-grey-900 mt-1'>
              Indie Momos
            </h1>

            <p className='text-[9px] text-grey-500 mt-0.5'>
              BTM 2nd Stage • Bengaluru
            </p>

          </div>

        </div>

      </header>


      {/* ================================
          CONTENT
      ================================= */}
      <main className='flex-1 px-4 pt-7 pb-8'>

        {/* ================================
            YOUR TURN CARD
        ================================= */}
        <div
          className='
            bg-white
            border
            border-[#FDBA74]
            rounded-2xl
            px-5
            py-5
            text-center
          '
        >

          {/* Your Turn */}
          <p
            className='
              text-[9px]
              text-grey-500
              font-semibold
              uppercase
            '
          >
            Your Turn
          </p>


          {/* Token */}
          <h2
            className='
              text-[44px]
              leading-none
              font-bold
              text-grey-900
              mt-2
            '
          >
            #{orderId}
          </h2>


          {/* Token Called */}
          <div
            className='
              inline-flex
              items-center
              justify-center
              bg-primary
              text-white
              rounded-full
              px-3
              py-1
              mt-2
            '
          >
            <span className='text-[8px] font-bold'>
              TOKEN CALLED
            </span>
          </div>


          {/* Heading */}
          <h2
            className='
              text-[17px]
              font-bold
              text-grey-900
              mt-3
            '
          >
            Go to the counter now!
          </h2>


          {/* Description */}
          <p
            className='
              text-[9px]
              leading-normal
              text-grey-500
              mt-1
              max-w-57.5
              mx-auto
            '
          >
            Show this token to the vendor and confirm
            <br />
            payment to finalize your order.
          </p>

        </div>


        {/* ================================
            ORDER SUMMARY
        ================================= */}
        <div
          className='
            mt-3
            bg-white
            border
            border-grey-100
            rounded-2xl
            px-4
            py-3.5
          '
        >

          <h3
            className='
              text-[12px]
              font-semibold
              text-grey-900
            '
          >
            Order Summary
          </h3>


          <div className='mt-2.5 space-y-1.5'>

            {/* Pani Puri */}
            <div className='flex justify-between'>

              <span className='text-[10px] text-grey-700'>
                Pani Puri ×2
              </span>

              <span className='text-[10px] text-grey-500'>
                ₹80
              </span>

            </div>


            {/* Dahi Puri */}
            <div className='flex justify-between'>

              <span className='text-[10px] text-grey-700'>
                Dahi Puri ×1
              </span>

              <span className='text-[10px] text-grey-500'>
                ₹50
              </span>

            </div>


            {/* Total */}
            <div
              className='
                border-t
                border-grey-100
                pt-1.5
                mt-1
                flex
                justify-between
              '
            >

              <span className='text-[11px] font-bold text-grey-900'>
                Total:
              </span>

              <span className='text-[11px] font-bold text-primary'>
                ₹130
              </span>

            </div>

          </div>

        </div>


        {/* ================================
            PAYMENT NOTE
        ================================= */}
        <p
          className='
            text-center
            text-[8px]
            text-grey-500
            mt-3
          '
        >
          Payment happens only at the counter. No online payment.
        </p>


        {/* ================================
            TRUTH LINE
        ================================= */}
        <div
          className='
            mt-3
            rounded-xl
            border
            border-[#FDBA74]
            bg-white
            px-3
            py-3
          '
        >

          <p
            className='
              text-[8px]
              font-bold
              text-primary
              uppercase
            '
          >
            Truth Line
          </p>


          <p
            className='
              text-[10px]
              italic
              text-grey-700
              mt-1
            '
          >
            "Some wins are small, but today you showed up."
          </p>

        </div>


        {/* ================================
            VENDOR WAITING
        ================================= */}
        <p
          className='
            text-center
            text-[9px]
            text-grey-900
            font-medium
            mt-4
          '
        >
          Vendor is waiting for you at the counter.
        </p>

      </main>


      {/* ================================
          HOME INDICATOR
      ================================= */}
      <div className='flex justify-center pb-2'>

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
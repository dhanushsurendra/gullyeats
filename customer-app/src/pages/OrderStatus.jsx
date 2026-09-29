import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { RiArrowLeftSLine } from 'react-icons/ri'

import Button from '../components/Button'
import CancelOrderModal from '../components/CancelOrderModal'

export default function OrderStatus() {
  const navigate = useNavigate()
  const { state } = useLocation()

  const [showCancelModal, setShowCancelModal] = useState(false)

  const orderId = state?.orderId || '67'

  // -----------------------------
  // ADD MORE ITEMS
  // -----------------------------
  const handleAddItems = () => {
    navigate(`/order/${orderId}/add`, {
      state: {
        orderId,
        items: state?.items || [],
        total: state?.total || 130,
      },
    })
  }

  // -----------------------------
  // DELETE ORDER
  // -----------------------------
  const handleDeleteOrder = () => {
    setShowCancelModal(true)
  }

  // -----------------------------
  // CONFIRM DELETE
  // -----------------------------
  const handleCancelConfirmed = () => {
    console.log('Delete order:', orderId)

    // TODO:
    // Call your backend API here
    //
    // await deleteOrder(orderId)

    setShowCancelModal(false)

    navigate('/new-order')
  }

  // -----------------------------
  // KEEP WAITING
  // -----------------------------
  const handleKeepWaiting = () => {
    setShowCancelModal(false)
  }

  // -----------------------------
  // BACK
  // -----------------------------
  const handleBack = () => {
    navigate(-1)
  }

  return (
    <div className='min-h-screen bg-white font-poppins flex flex-col'>

      {/* =====================================
          TOP LINE
      ====================================== */}
      <div className='h-0.75 bg-sky-500' />


      {/* =====================================
          HEADER
      ====================================== */}
      <header className='px-4 pt-4 pb-3'>

        <div className='relative flex items-center justify-center min-h-13'>

          {/* Back Button */}
          <button
            onClick={handleBack}
            className='
              absolute
              left-0
              top-1/2
              -translate-y-1/2
              p-2
              bg-gray-100
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


          {/* Brand */}
          <div className='text-center leading-tight'>

            <div className='text-[11px] font-bold'>
              <span className='text-primary'>
                Gully
              </span>

              <span className='text-grey-900'>
                Eats
              </span>
            </div>


            <h1 className='text-body font-bold text-grey-900 mt-1'>
              Indie Momos
            </h1>


            <p className='text-[9px] text-grey-500 mt-0.5'>
              BTM 2nd Stage • Bengaluru
            </p>

          </div>

        </div>


        {/* Currently Serving */}
        <div className='flex justify-center mt-5'>

          <div
            className='
              bg-lightOrange
              rounded-pill
              px-8
              py-2.5
              text-center
              min-w-35
            '
          >

            <p className='text-[8px] text-primary font-semibold'>
              Currently Serving
            </p>

            <p className='text-body font-bold text-grey-900 mt-0.5'>
              #62
            </p>

          </div>

        </div>

      </header>


      {/* =====================================
          CONTENT
      ====================================== */}
      <main className='flex-1 px-4 py-5'>


        {/* =====================================
            TOKEN CARD
        ====================================== */}
        <div
          className='
            bg-white
            border
            border-grey-100
            rounded-2xl
            px-4
            py-5
            text-center
            shadow-sm
          '
        >

          <p className='text-caption text-grey-500 uppercase'>
            Your Token
          </p>


          <h2 className='
            text-[38px]
            leading-none
            font-bold
            text-grey-900
            mt-1
          '>
            #{orderId}
          </h2>


          <div
            className='
              inline-block
              mt-3
              px-4
              py-1.5
              rounded-pill
              bg-lightOrange
              text-[9px]
              text-primary
              font-medium
            '
          >
            Show this token when called
          </div>

        </div>


        {/* =====================================
            ORDER SUMMARY
        ====================================== */}
        <div
          className='
            mt-3
            bg-white
            border
            border-grey-100
            rounded-2xl
            p-4
            shadow-sm
          '
        >

          <h3 className='text-body font-semibold text-grey-900'>
            Order Summary
          </h3>


          <div className='mt-3 space-y-2'>

            {/* Pani Puri */}
            <div className='flex justify-between text-caption'>

              <span className='text-grey-700'>
                Pani Puri ×2
              </span>

              <span className='text-grey-500'>
                ₹80
              </span>

            </div>


            {/* Dahi Puri */}
            <div className='flex justify-between text-caption'>

              <span className='text-grey-700'>
                Dahi Puri ×1
              </span>

              <span className='text-grey-500'>
                ₹50
              </span>

            </div>


            {/* Total */}
            <div
              className='
                border-t
                border-grey-100
                pt-2
                mt-2
                flex
                justify-between
              '
            >

              <span className='text-caption font-semibold text-grey-900'>
                Total:
              </span>

              <span className='text-body font-bold text-primary'>
                ₹130
              </span>

            </div>

          </div>

        </div>


        {/* =====================================
            STATUS
        ====================================== */}
        <div
          className='
            mt-3
            rounded-xl
            border
            border-[#FDBA74]
            bg-lightOrange
            px-4
            py-3
          '
        >

          <p className='text-caption font-semibold text-primary'>
            Status: Waiting
          </p>


          <p className='text-[10px] text-grey-600 mt-1'>
            Stay nearby. Vendor will call your token.
          </p>


          {/* Progress */}
          <div className='mt-3 h-1 bg-[#FED7AA] rounded-full'>

            <div
              className='
                h-full
                w-[35%]
                bg-primary
                rounded-full
              '
            />

          </div>

        </div>


        {/* =====================================
            TRUTH LINE
        ====================================== */}
        <div
          className='
            mt-3
            rounded-xl
            border
            border-[#FDBA74]
            px-4
            py-3
            text-center
          '
        >

          <p className='
            text-[8px]
            font-semibold
            text-primary
            uppercase
          '>
            Truth Line
          </p>


          <p className='
            text-[10px]
            italic
            text-grey-600
            mt-1.5
            leading-relaxed
          '>
            You're not just waiting for food... you're pausing
            <br />
            from everything.
          </p>

        </div>


        {/* =====================================
            ACTIONS
        ====================================== */}
        <div className='mt-3 space-y-2'>


          {/* ADD MORE ITEMS */}
          <Button
            onClick={handleAddItems}
            className='
              w-full
              bg-primary!
              rounded-pill!
              text-white!
              text-body!
              font-bold!
              py-3!
            '
          >
            ADD MORE ITEMS
          </Button>


          {/* DELETE ORDER */}
          <button
            onClick={handleDeleteOrder}
            className='
              w-full
              h-11
              rounded-pill
              border
              border-red-200
              bg-white
              text-red-500
              text-caption
              font-semibold
              active:scale-[0.98]
              transition
            '
          >
            DELETE ORDER
          </button>

        </div>


        {/* =====================================
            PAYMENT NOTE
        ====================================== */}
        <p className='
          text-center
          text-[9px]
          text-grey-500
          mt-3
        '>
          No online payment. Pay only at the counter.
        </p>


        <p className='
          text-center
          text-[10px]
          text-primary
          font-semibold
          mt-1
        '>
          Your order is safe in the queue.
        </p>

      </main>


      {/* =====================================
          HOME INDICATOR
      ====================================== */}
      <div className='flex justify-center pb-2'>

        <div className='
          w-12
          h-1
          rounded-full
          bg-grey-900
        ' />

      </div>


      {/* =====================================
          CANCEL ORDER MODAL
      ====================================== */}
      {showCancelModal && (
        <CancelOrderModal
          orderId={orderId}
          onCancel={handleCancelConfirmed}
          onKeepWaiting={handleKeepWaiting}
        />
      )}

    </div>
  )
}
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RiArrowLeftSLine } from 'react-icons/ri'
import CancelOrderModal from '../components/CancelOrderModal'
import { io } from 'socket.io-client'
import { setOrder } from '../store/cartSlice'

import { useDispatch } from 'react-redux'

import Button from '../components/Button'
import { API_BASE_URL } from '../constants/api'

function Shimmer({ className = '' }) {
  return (
    <div
      className={`
        relative
        overflow-hidden
        bg-grey-100
        rounded-xl
        before:absolute
        before:inset-0
        before:-translate-x-full
        before:animate-[shimmer_1.5s_infinite]
        before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.7),transparent)]
        ${className}
      `}
    />
  )
}

function OrderTokenSkeleton({ cartId, navigate }) {
  return (
    <div
      className='
        min-h-screen
        font-poppins
        flex
        flex-col
        bg-[linear-gradient(to_bottom,#FFF4EE_0%,#FAFAFA_50%,#FFFFFF_50%,#FFFFFF_100%)]
      '
    >
      {/* Header */}
      <header className='px-4 pt-4 pb-2'>
        <div className='flex items-center justify-between'>
          <button
            type='button'
            onClick={() => navigate(`/c/${cartId}/menu`)}
            className='
              w-9
              h-9
              shrink-0
              rounded-full
              bg-white/80
              border
              border-grey-200
              flex
              items-center
              justify-center
              text-grey-700
              shadow-sm
              transition-all
              duration-200
              hover:border-primary/30
              active:scale-95
            '
          >
            <RiArrowLeftSLine size={20} />
          </button>

          <div className='text-center'>
            <p
              className='
                text-caption
                text-primary
                font-bold
                tracking-wide
              '
            >
              GullyEats
            </p>

            <p className='text-sm font-bold text-grey-900'>Order Summary</p>

            <p className='text-[0.65rem] text-grey-400'>QR Order</p>
          </div>

          <div className='w-9' />
        </div>
      </header>

      {/* Shimmer content */}
      <main className='flex-1 px-4 pt-2 pb-4'>
        <div className='space-y-3'>
          {/* Token */}
          <section
            className='
              bg-white
              rounded-2xl
              border
              border-orange-100
              px-5
              py-5
              text-center
              shadow-sm
            '
          >
            <Shimmer className='h-3 w-20 mx-auto' />

            <Shimmer className='h-12 w-32 mx-auto mt-3 rounded-lg' />

            <Shimmer className='h-6 w-44 mx-auto mt-3 rounded-full' />
          </section>

          {/* Order summary */}
          <section
            className='
              bg-white
              rounded-2xl
              border
              border-grey-200
              px-4
              py-4
              shadow-sm
            '
          >
            <div className='flex items-center justify-between mb-4'>
              <Shimmer className='h-4 w-28' />
              <Shimmer className='h-3 w-12' />
            </div>

            <div className='space-y-3'>
              <div className='flex items-center justify-between gap-3'>
                <Shimmer className='h-3 w-36' />
                <Shimmer className='h-3 w-12' />
              </div>

              <div className='flex items-center justify-between gap-3'>
                <Shimmer className='h-3 w-44' />
                <Shimmer className='h-3 w-12' />
              </div>

              <div className='flex items-center justify-between gap-3'>
                <Shimmer className='h-3 w-28' />
                <Shimmer className='h-3 w-12' />
              </div>
            </div>

            <div
              className='
                border-t
                border-grey-200
                mt-4
                pt-3
                flex
                items-center
                justify-between
              '
            >
              <Shimmer className='h-4 w-16' />
              <Shimmer className='h-4 w-16' />
            </div>
          </section>

          {/* Status */}
          <section
            className='
              rounded-2xl
              border
              border-orange-200
              bg-orange-50/70
              px-4
              py-3
            '
          >
            <div className='flex items-center justify-between'>
              <div className='space-y-2'>
                <Shimmer className='h-3 w-24' />
                <Shimmer className='h-3 w-48' />
              </div>

              <Shimmer className='w-2 h-2 rounded-full' />
            </div>

            <Shimmer className='mt-3 h-1 w-full rounded-full' />
          </section>

          {/* Adjustment skeleton */}
          <section
            className='
              rounded-2xl
              border
              border-orange-200
              bg-orange-50/70
              px-4
              py-4
            '
          >
            <div className='flex items-center gap-3'>
              <Shimmer className='w-9 h-9 rounded-full shrink-0' />

              <div className='flex-1 space-y-2'>
                <Shimmer className='h-3 w-40' />
                <Shimmer className='h-3 w-56' />
              </div>

              <Shimmer className='h-5 w-14' />
            </div>
          </section>

          {/* Truth line */}
          <section
            className='
              rounded-2xl
              border
              border-orange-200
              bg-[linear-gradient(to_bottom,#FFF4EE_0%,#FAFAFA_50%,#FFFFFF_50%,#FFFFFF_100%)]
              px-4
              py-4
              text-center
              shadow-sm
            '
          >
            <Shimmer className='h-2 w-20 mx-auto' />

            <Shimmer className='h-3 w-4/5 mx-auto mt-4' />
            <Shimmer className='h-3 w-3/5 mx-auto mt-2' />
          </section>

          {/* Add more */}
          <Shimmer className='w-full h-12 rounded-full' />

          {/* Delete */}
          <Shimmer className='w-full h-12 rounded-full' />

          {/* Payment */}
          <div className='flex flex-col items-center gap-2 pb-1'>
            <Shimmer className='h-2 w-52' />
            <Shimmer className='h-2 w-44' />
          </div>
        </div>
      </main>
    </div>
  )
}

export default function OrderToken() {
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const { cartId, orderNumber } = useParams()

  const [showCancelModal, setShowCancelModal] = useState(false)

  const [order, setLocalOrder] = useState(null)

  const [isOrderLoading, setIsOrderLoading] = useState(true)

  const [orderError, setOrderError] = useState(null)

  const [isDeleting, setIsDeleting] = useState(false)

  // --------------------------------------------------
  // Truth line state
  // --------------------------------------------------

  const [truthLine, setTruthLine] = useState('')

  const [isTruthLoading, setIsTruthLoading] = useState(true)

  // --------------------------------------------------
  // Fetch latest order
  // --------------------------------------------------

  useEffect(() => {
    if (!orderNumber) return

    const socket = io(API_BASE_URL.replace('/api', ''), {
      transports: ['websocket'],
    })

    socket.on('connect', () => {
      socket.emit('join_order', orderNumber)
    })

    socket.on('order_cancelled', (cancelledOrder) => {
      if (String(cancelledOrder?._id) !== String(orderNumber)) {
        return
      }

      console.log('OrderToken received cancellation:', cancelledOrder)
      if (cancelledOrder.status === 'CANCELLED') {
        navigate(`/c/${cartId}/order/${cancelledOrder._id}/cancelled`, {
          replace: true,
        })
      }
    })

    socket.on('order_updated', (updatedOrder) => {
      if (String(updatedOrder?._id) !== String(orderNumber)) {
        return
      }

      setLocalOrder(updatedOrder)

      if (updatedOrder.status === 'SERVED') {
        navigate(`/c/${cartId}/order/${orderNumber}/served`, { replace: true })
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [orderNumber, cartId, navigate])

  useEffect(() => {
    if (!orderNumber) {
      setIsOrderLoading(false)
      setOrderError('Order number is missing.')
      return
    }

    const fetchOrder = async () => {
      try {
        setIsOrderLoading(true)
        setOrderError(null)

        const url = `${API_BASE_URL}/orders/order/${orderNumber}`

        const response = await fetch(url)

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.message || 'Unable to fetch order.')
        }

        const latestOrder = data?.data

        if (!latestOrder) {
          throw new Error('Order details not found.')
        }

        setLocalOrder(latestOrder)
      } catch (error) {
        console.error('Failed to fetch order:', error)

        setOrderError(error?.message || 'Unable to load your order.')
      } finally {
        setIsOrderLoading(false)
      }
    }

    fetchOrder()
  }, [orderNumber])

  // --------------------------------------------------
  // Fetch random truth line
  // --------------------------------------------------

  useEffect(() => {
    const fetchTruthLine = async () => {
      try {
        setIsTruthLoading(true)

        const response = await fetch(`${API_BASE_URL}/orders/get-truth-line`)

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.message || 'Unable to get truth line.')
        }

        const text =
          typeof data?.data === 'string' ? data.data : data?.data?.text

        setTruthLine(text || '')
      } catch (error) {
        console.error('Failed to fetch truth line:', error)
      } finally {
        setIsTruthLoading(false)
      }
    }

    fetchTruthLine()
  }, [])

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (isOrderLoading) {
    return <OrderTokenSkeleton cartId={cartId} navigate={navigate} />
  }

  // --------------------------------------------------
  // Error
  // --------------------------------------------------

  if (orderError || !order) {
    return (
      <div
        className='
          min-h-screen
          font-poppins
          flex
          flex-col
          bg-[linear-gradient(to_bottom,#FFF4EE_0%,#FAFAFA_50%,#FFFFFF_50%,#FFFFFF_100%)]
        '
      >
        <header className='px-4 pt-5 pb-3'>
          <div className='flex items-center justify-between'>
            <button
              type='button'
              onClick={() => navigate(`/c/${cartId}/menu`)}
              className='
                w-10
                h-10
                shrink-0
                rounded-xl
                border
                border-grey-200
                bg-white/90
                flex
                items-center
                justify-center
                text-grey-700
                shadow-sm
                active:scale-95
                transition-all
              '
            >
              <RiArrowLeftSLine size={22} />
            </button>

            <p
              className='
                text-caption
                text-primary
                font-bold
                tracking-wider
                uppercase
              '
            >
              GULLYEATS
            </p>

            <div className='w-10' />
          </div>
        </header>

        <main
          className='
            flex-1
            flex
            flex-col
            items-center
            justify-center
            text-center
            px-5
          '
        >
          <div
            className='
              w-14
              h-14
              rounded-full
              bg-lightOrange
              text-primary
              flex
              items-center
              justify-center
              text-xl
              font-bold
            '
          >
            !
          </div>

          <h2 className='text-h2 font-bold text-black mt-5'>
            Order details unavailable
          </h2>

          <p className='text-body text-grey-500 mt-2 max-w-sm'>
            {orderError || "We couldn't find your order details."}
          </p>

          <Button
            onClick={() => navigate(`/c/${cartId}/menu`)}
            className='mt-6 px-8'
          >
            BACK TO MENU
          </Button>
        </main>
      </div>
    )
  }

  // --------------------------------------------------
  // Order data
  // --------------------------------------------------

  const orderItems = order?.orderItems || []

  const displayOrderNumber = order?.orderNumber || orderNumber

  const displayStatus = order?.status || 'PENDING'

  const statusLabel = {
    PENDING: 'Waiting',
    PAID: 'Paid',
    SERVED: 'Served',
    CANCELLED: 'Cancelled',
  }

  const readableStatus = statusLabel[displayStatus] || displayStatus

  const subtotal = Number(order?.subtotal || 0)

  const parcelCharge = Number(order?.parcelCharge || 0)

  const platformFee = Number(order?.platformFee || 0)

  const totalPrice = Number(order?.totalPrice || 0)

  const totalItems = orderItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  )

  // --------------------------------------------------
  // Payment adjustment
  // --------------------------------------------------

  const paymentAdjustment = order?.paymentAdjustment || null

  const adjustmentAction = paymentAdjustment?.action || 'NONE'

  const adjustmentAmount = Number(paymentAdjustment?.amount || 0)

  const showAdjustment =
    paymentAdjustment && adjustmentAction !== 'NONE' && adjustmentAmount > 0

  // --------------------------------------------------
  // Navigation
  // --------------------------------------------------

  const handleBack = () => {
    navigate(`/c/${cartId}/menu`)
  }

  const handleAddMore = () => {
    navigate(`/c/${cartId}/order/${orderNumber}/add`)
  }

  const handleDeleteOrder = async () => {
    if (!order?._id) return

    try {
      setIsDeleting(true)

      const response = await fetch(
        `${API_BASE_URL}/orders/delete-order/${order._id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to cancel order.')
      }

      dispatch(setOrder(data.data))

      navigate(`/c/${cartId}/order/${data.data.orderNumber}/cancelled`, {
        replace: true,
      })
    } catch (error) {
      console.error('Failed to cancel order:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  // --------------------------------------------------
  // Main UI
  // --------------------------------------------------

  return (
    <div
      className='
        min-h-screen
        font-poppins
        flex
        flex-col
        bg-[linear-gradient(to_bottom,#FFF4EE_0%,#FAFAFA_50%,#FFFFFF_50%,#FFFFFF_100%)]
      '
    >
      {showCancelModal && (
        <CancelOrderModal
          onClose={() => setShowCancelModal(false)}
          onCancel={handleDeleteOrder}
          orderId={displayOrderNumber}
          onKeepWaiting={() => setShowCancelModal(false)}
        />
      )}

      {/* ---------------------------------------------- */}
      {/* Header */}
      {/* ---------------------------------------------- */}

      <header className='px-4 pt-4 pb-2'>
        <div className='flex items-center justify-between'>
          <button
            type='button'
            onClick={handleBack}
            className='
              w-9
              h-9
              shrink-0
              rounded-full
              bg-white/80
              border
              border-grey-200
              flex
              items-center
              justify-center
              text-grey-700
              shadow-sm
              transition-all
              duration-200
              hover:border-primary/30
              active:scale-95
            '
          >
            <RiArrowLeftSLine size={20} />
          </button>

          <div className='text-center'>
            <p
              className='
                text-caption
                text-primary
                font-bold
                tracking-wide
              '
            >
              GullyEats
            </p>

            <p className='text-sm font-bold text-grey-900'>Order Summary</p>

            <p className='text-[0.65rem] text-grey-400'>
              {order?.orderType === 'QR' ? 'QR Order' : 'GullyEats'}
            </p>
          </div>

          <div className='w-9' />
        </div>
      </header>

      {/* ---------------------------------------------- */}
      {/* Main */}
      {/* ---------------------------------------------- */}

      <main className='flex-1 px-4 pt-2 pb-4'>
        <div className='space-y-3'>
          {/* ------------------------------------------ */}
          {/* Token */}
          {/* ------------------------------------------ */}

          <section
            className='
              bg-white
              rounded-2xl
              border
              border-orange-100
              px-5
              py-5
              text-center
              shadow-sm
              animate-[orderSuccessIn_0.45s_ease-out]
            '
          >
            <p
              className='
                text-[0.65rem]
                text-grey-400
                uppercase
                tracking-wider
                font-medium
              '
            >
              Your token
            </p>

            <h1
              className='
                text-5xl
                leading-none
                font-bold
                text-grey-900
                mt-2
              '
            >
              #{displayOrderNumber}
            </h1>

            <div
              className='
                inline-flex
                mt-3
                px-3
                py-1
                rounded-full
                bg-orange-50
                text-primary
                text-[0.65rem]
                font-medium
              '
            >
              Show this token when called
            </div>
          </section>

          {/* ------------------------------------------ */}
          {/* Order Summary */}
          {/* ------------------------------------------ */}

          <section
            className='
              bg-white
              rounded-2xl
              border
              border-grey-200
              px-4
              py-4
              shadow-sm
              animate-[orderCardIn_0.5s_ease-out]
            '
          >
            <div className='flex items-center justify-between mb-3'>
              <h2 className='text-sm font-bold text-grey-900'>Order Summary</h2>

              <span className='text-[0.65rem] text-grey-400'>
                {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </span>
            </div>

            <div className='space-y-2'>
              {orderItems.map((item, index) => {
                const quantity = Number(item.quantity || 0)

                const price = Number(item.price || 0)

                const itemTotal = Number(item.total ?? price * quantity)

                return (
                  <div
                    key={item.menuItemId || item._id || index}
                    className='
                        flex
                        items-center
                        justify-between
                        gap-3
                      '
                  >
                    <p
                      className='
                          text-caption
                          text-grey-700
                          min-w-0
                          truncate
                        '
                    >
                      {item.name}{' '}
                      <span className='text-grey-400'>×{quantity}</span>
                    </p>

                    <span
                      className='
                          text-caption
                          text-grey-500
                          shrink-0
                        '
                    >
                      ₹{itemTotal}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className='border-t border-grey-200 mt-3 pt-2 space-y-1.5'>
              <div className='flex items-center justify-between'>
                <span className='text-xs text-grey-500'>Platform fee</span>

                <span className='text-xs font-medium text-grey-700'>₹2</span>
              </div>

              <div className='flex items-center justify-between'>
                <span className='text-sm font-bold text-grey-900'>Total:</span>

                <span className='text-sm font-bold text-primary'>
                  ₹{totalPrice}
                </span>
              </div>
            </div>
          </section>

          {/* ------------------------------------------ */}
          {/* Payment Adjustment */}
          {/* ------------------------------------------ */}

          {showAdjustment && (
            <section
              className={`
                rounded-2xl
                border
                px-4
                py-4
                shadow-sm
                animate-[orderCardIn_0.55s_ease-out]
                ${
                  adjustmentAction === 'COLLECT'
                    ? 'border-orange-200 bg-orange-50/70'
                    : 'border-green-200 bg-green-50/70'
                }
              `}
            >
              <div className='flex items-start gap-3'>
                {/* Icon */}

                <div
                  className={`
                    w-9
                    h-9
                    shrink-0
                    rounded-full
                    flex
                    items-center
                    justify-center
                    font-bold
                    ${
                      adjustmentAction === 'COLLECT'
                        ? 'bg-orange-100 text-primary'
                        : 'bg-green-100 text-green-600'
                    }
                  `}
                >
                  {adjustmentAction === 'COLLECT' ? '+' : '✓'}
                </div>

                {/* Message */}

                <div className='min-w-0 flex-1'>
                  <p
                    className={`
                      text-sm
                      font-bold
                      ${
                        adjustmentAction === 'COLLECT'
                          ? 'text-primary'
                          : 'text-green-700'
                      }
                    `}
                  >
                    {adjustmentAction === 'COLLECT'
                      ? 'Additional payment required'
                      : 'Payment adjustment'}
                  </p>

                  <p className='text-[0.7rem] text-grey-600 mt-1 leading-relaxed'>
                    {adjustmentAction === 'COLLECT'
                      ? 'Your order total increased. Please pay the additional amount at the counter. Your order will start preparing once the vendor confirms your payment.'
                      : 'Your order total decreased. The vendor needs to return the difference to you.'}
                  </p>
                </div>

                {/* Amount */}

                <div className='shrink-0 text-right'>
                  <p
                    className={`
                      text-lg
                      font-bold
                      ${
                        adjustmentAction === 'COLLECT'
                          ? 'text-primary'
                          : 'text-green-600'
                      }
                    `}
                  >
                    ₹{adjustmentAmount}
                  </p>

                  <p className='text-[0.6rem] text-grey-400 mt-0.5'>
                    {adjustmentAction === 'COLLECT' ? 'TO PAY' : 'TO RETURN'}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ------------------------------------------ */}
          {/* Status */}
          {/* ------------------------------------------ */}

          <section
            className='
              rounded-2xl
              border
              border-orange-200
              bg-orange-50/70
              px-4
              py-3
              animate-[orderCardIn_0.55s_ease-out]
            '
          >
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-caption text-primary font-semibold'>
                  Status: {readableStatus}
                </p>

                {displayStatus === 'PENDING' && (
                  <p className='text-[0.65rem] text-grey-500 mt-0.5'>
                    Please pay at the counter. Your order will start preparing
                    after payment is confirmed.
                  </p>
                )}

                {displayStatus === 'PAID' && (
                  <p className='text-[0.65rem] text-grey-500 mt-0.5'>
                    Payment received. Your order is being handled.
                  </p>
                )}

                {displayStatus === 'SERVED' && (
                  <p className='text-[0.65rem] text-grey-500 mt-0.5'>
                    Your order has been served. Enjoy your meal!
                  </p>
                )}

                {displayStatus === 'CANCELLED' && (
                  <p className='text-[0.65rem] text-grey-500 mt-0.5'>
                    This order has been cancelled.
                  </p>
                )}
              </div>

              <span
                className={`
                  w-2
                  h-2
                  shrink-0
                  rounded-full
                  animate-pulse
                  ${
                    displayStatus === 'CANCELLED'
                      ? 'bg-red-500'
                      : displayStatus === 'SERVED'
                        ? 'bg-green-500'
                        : 'bg-primary'
                  }
                `}
              />
            </div>

            {/* Progress */}

            <div className='mt-3 h-1 rounded-full bg-orange-200 overflow-hidden'>
              <div
                className={`
                  h-full
                  rounded-full
                  transition-all
                  duration-500
                  ${
                    displayStatus === 'PENDING'
                      ? 'w-1/3 bg-primary'
                      : displayStatus === 'PAID'
                        ? 'w-2/3 bg-primary'
                        : displayStatus === 'SERVED'
                          ? 'w-full bg-green-500'
                          : 'w-0 bg-red-500'
                  }
                `}
              />
            </div>
          </section>

          {/* ------------------------------------------ */}
          {/* Truth Line */}
          {/* ------------------------------------------ */}

          <section
            className='
              rounded-2xl
              border
              border-orange-200
              bg-[linear-gradient(to_bottom,#FFF4EE_0%,#FAFAFA_50%,#FFFFFF_50%,#FFFFFF_100%)]
              px-4
              py-4
              text-center
              shadow-sm
              animate-[orderCardIn_0.6s_ease-out]
            '
          >
            <p
              className='
                text-[0.6rem]
                text-primary
                uppercase
                tracking-widest
                font-bold
              '
            >
              Truth Line
            </p>

            {isTruthLoading ? (
              <div className='mt-3 flex justify-center'>
                <div
                  className='
                    h-4
                    w-32
                    rounded-full
                    bg-orange-100
                    animate-pulse
                  '
                />
              </div>
            ) : truthLine ? (
              <p
                className='
                  text-caption
                  italic
                  text-grey-700
                  leading-relaxed
                  mt-2
                  px-2
                '
              >
                "{truthLine}"
              </p>
            ) : (
              <p
                className='
                  text-caption
                  text-grey-400
                  mt-2
                '
              >
                Your truth line will appear here.
              </p>
            )}
          </section>

          {/* ------------------------------------------ */}
          {/* Add More */}
          {/* ------------------------------------------ */}

          <Button
            onClick={handleAddMore}
            className='
              w-full
              rounded-full
              py-3
              text-sm
              font-bold
              shadow-sm
              transition-all
              duration-200
              active:scale-[0.98]
            '
          >
            ADD MORE ITEMS
          </Button>

          {/* ------------------------------------------ */}
          {/* Delete */}
          {/* ------------------------------------------ */}

          <button
            type='button'
            onClick={() => setShowCancelModal(true)}
            className='
              w-full
              rounded-full
              border
              border-red-200
              bg-white
              py-3
              text-sm
              font-semibold
              text-red-500
              transition-all
              duration-200
              hover:bg-red-50
              active:scale-[0.98]
            '
          >
            DELETE ORDER
          </button>

          {/* ------------------------------------------ */}
          {/* Payment */}
          {/* ------------------------------------------ */}

          <div className='text-center pb-1'>
            <p className='text-[0.65rem] text-grey-400'>
              No online payment. Pay only at the counter.
            </p>

            <p
              className='
                text-[0.65rem]
                font-semibold
                text-primary
                mt-1
              '
            >
              You're officially in the queue now.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

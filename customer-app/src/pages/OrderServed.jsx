import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { io } from 'socket.io-client'
import { API_BASE_URL } from '../constants/api'
import Button from '../components/Button'

export default function OrderServed() {
  const navigate = useNavigate()
  const { cartId, orderNumber } = useParams()

  const order = useSelector((state) => state.cart.order)
  const cartDetails = useSelector((state) => state.cart.details)

  const orderNo = order?.orderNumber

  const vendorName = cartDetails?.cartName || 'GullyEats'
  const vendorAddress = cartDetails?.address || ''

  const [selectedFeedback, setSelectedFeedback] = useState(
    'Food was satisfying',
  )

  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const feedbackOptions = [
    'Food was satisfying',
    'Service was smooth',
    'Wait felt long',
    "I'll come back again",
  ]

  /* --------------------------------
     Short location
  -------------------------------- */

  const getShortLocation = (address = '') => {
    const parts = address
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)

    return parts.length >= 4
      ? `${parts[2]} • ${parts[3]}`
      : address
  }

  /* --------------------------------
     Socket
  -------------------------------- */

  useEffect(() => {
    if (!orderNumber) return

    const socket = io(API_BASE_URL.replace('/api', ''))

    socket.on('connect', () => {
      console.log(
        'OrderServed socket connected:',
        socket.id,
      )

      socket.emit('join_order', orderNumber)
    })

    socket.on('connect_error', (error) => {
      console.error(
        'OrderServed socket connection error:',
        error,
      )
    })

    socket.on('order_updated', (updatedOrder) => {
      console.log(
        'OrderServed received update:',
        updatedOrder,
      )

      if (
        String(updatedOrder?.orderNumber) !==
        String(orderNumber)
      ) {
        return
      }

      // Vendor undid "SERVED"
      if (updatedOrder?.status === 'PREPARING') {
        navigate(
          `/c/${cartId}/order/${orderNumber}`,
          { replace: true },
        )
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [orderNumber, cartId, navigate])

  /* --------------------------------
     Feedback
  -------------------------------- */

  const handleSubmit = async () => {
    const feedback = note.trim() || selectedFeedback

    if (!orderNumber) {
      setError('Order number not found.')
      return
    }

    try {
      setIsSubmitting(true)
      setError('')

      const response = await fetch(
        `${API_BASE_URL}/orders/submit-feedback/${orderNumber}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            feedback,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data?.message || 'Failed to submit feedback.',
        )
      }

      navigate(
        `/c/${cartId}/order/${orderNumber}/thank-you`,
        { replace: true },
      )
    } catch (error) {
      console.error(
        'Feedback submission error:',
        error,
      )

      setError(
        error.message || 'Unable to submit feedback.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-grey-50 font-poppins flex flex-col">

      {/* Top accent */}
      <div className="h-0.75 bg-sky-500" />

      {/* Header */}
      <header className="px-4 pt-4">
        <div className="text-center leading-tight">
          <div className="text-[12px] font-bold">
            <span className="text-primary">Gully</span>
            <span className="text-grey-900">Eats</span>
          </div>

          <h1 className="text-[13px] font-bold text-grey-900 mt-0.5">
            {vendorName}
          </h1>

          <p className="text-[9px] text-grey-500 mt-0.5">
            {getShortLocation(vendorAddress)}
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-4 pt-5 pb-5">

        {/* Success */}
        <section className="text-center">

          <div
            className="
              mx-auto
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-full
              bg-green-50
              text-green-600
              ring-4
              ring-green-50/60
            "
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12.5l4 4L19 7" />
            </svg>
          </div>

          <h2 className="mt-2.5 text-[17px] font-bold text-grey-900">
            Order Served
          </h2>

          <p className="text-[9px] text-grey-500 mt-0.5">
            Hope you enjoyed your meal!
          </p>

        </section>

        {/* Order number */}
        <section
          className="
            mt-4
            rounded-2xl
            border
            border-grey-200
            bg-white
            px-4
            py-3
            flex
            items-center
            justify-between
          "
        >
          <div>
            <p className="text-[8px] uppercase tracking-wide text-grey-400 font-medium">
              Order number
            </p>

            <p className="text-[22px] leading-none font-bold text-grey-900 mt-1">
              #{orderNo || '--'}
            </p>
          </div>

          <div
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-full
              bg-lightOrange
              text-primary
            "
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 4h12v16H6z" />
              <path d="M9 8h6M9 12h6M9 16h4" />
            </svg>
          </div>
        </section>

        {/* Feedback */}
        <section
          className="
            mt-3
            rounded-2xl
            border
            border-grey-200
            bg-white
            px-4
            py-4
          "
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[12px] font-bold text-grey-900">
                How was your experience?
              </h3>

              <p className="text-[9px] text-grey-500 mt-0.5">
                Tell us in a few words.
              </p>
            </div>

            <span className="text-[9px] text-grey-400">
              Optional
            </span>
          </div>

          {/* Presets */}
          <div className="grid grid-cols-2 gap-1.5 mt-3">
            {feedbackOptions.map((option) => {
              const selected = selectedFeedback === option

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setSelectedFeedback(option)
                    setNote('')
                    setError('')
                  }}
                  className={`
                    min-h-8
                    rounded-lg
                    px-2
                    text-[9px]
                    font-medium
                    border
                    transition-all
                    duration-150
                    active:scale-[0.97]
                    ${
                      selected
                        ? 'border-primary bg-lightOrange text-primary shadow-sm'
                        : 'border-grey-200 bg-white text-grey-600 hover:border-grey-300'
                    }
                  `}
                >
                  {option}
                </button>
              )
            })}
          </div>

          {/* Custom feedback */}
          <div className="relative mt-3">
            <textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setError('')
              }}
              maxLength={300}
              rows={3}
              placeholder="Or write a short note..."
              className="
                w-full
                rounded-xl
                border
                border-grey-200
                bg-grey-50
                px-3
                py-2.5
                pr-12
                resize-none
                outline-none
                text-[10px]
                leading-relaxed
                text-grey-800
                placeholder:text-grey-400
                transition
                focus:border-primary/40
                focus:bg-white
              "
            />

            <span className="absolute right-2.5 bottom-2 text-[7px] text-grey-400">
              {note.length}/300
            </span>
          </div>

          {error && (
            <p className="mt-1.5 text-[9px] text-red-500">
              {error}
            </p>
          )}

          {/* Button component */}
          <div className="mt-3">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting
                ? 'SENDING...'
                : 'SEND FEEDBACK'}
            </Button>
          </div>
        </section>

      </main>

      {/* Home indicator */}
      <div className="flex justify-center pb-2">
        <div className="w-10 h-1 rounded-full bg-grey-900" />
      </div>

    </div>
  )
}
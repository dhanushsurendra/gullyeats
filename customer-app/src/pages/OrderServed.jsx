import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RiArrowLeftSLine } from 'react-icons/ri'

export default function OrderServed() {
  const navigate = useNavigate()
  const { token } = useParams()

  const orderId = token || '67'

  const [selectedFeedback, setSelectedFeedback] = useState(
    'Food was satisfying',
  )

  const [note, setNote] = useState('')

  const feedbackOptions = [
    'Food was satisfying',
    'Service was smooth',
    'Wait felt long',
    "I'll come back again",
  ]

  const handleSubmit = () => {
    console.log({
      orderId,
      feedback: selectedFeedback,
      note,
    })

    // Navigate to Thank You screen
    navigate(`/order/${orderId}/thank-you`, {
      state: {
        orderId,
        feedback: selectedFeedback,
      },
    })
  }

  return (
    <div className='min-h-screen bg-[#FAFAFA] font-poppins flex flex-col'>

      {/* Top blue line */}
      <div className='h-0.75 bg-sky-500' />

      {/* Header */}
      <header className='px-4 pt-5'>

        <div className='relative flex items-center justify-center min-h-13.75'>

          {/* Back */}
          <button
            onClick={() => navigate(-1)}
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
              Raju Momos
            </h1>

            <p className='text-[9px] text-grey-500 mt-0.5'>
              BTM 2nd Stage • Bengaluru
            </p>

          </div>

        </div>

      </header>


      {/* Content */}
      <main className='flex-1 px-4 pt-6 pb-8'>

        {/* Order Served */}
        <div className='text-center'>

          <h2 className='text-[18px] font-bold text-grey-900'>
            Order Served <span className='text-[17px]'>✅</span>
          </h2>

          <p className='text-[10px] text-grey-500 mt-1'>
            Enjoy your food!
          </p>

        </div>


        {/* Token Card */}
        <div
          className='
            mt-3
            bg-white
            border
            border-grey-200
            rounded-xl
            px-4
            py-3
            text-center
          '
        >

          <p className='
            text-[8px]
            uppercase
            text-grey-500
            font-medium
          '>
            Your Token
          </p>

          <p className='
            text-[20px]
            leading-none
            font-bold
            text-grey-900
            mt-1
          '>
            #{orderId}
          </p>

        </div>


        {/* Feedback Card */}
        <div
          className='
            mt-5
            bg-white
            border
            border-grey-200
            rounded-2xl
            px-4
            py-4
          '
        >

          {/* Heading */}
          <h3 className='text-[12px] font-bold text-grey-900'>
            Before you go...
          </h3>

          <p className='text-[9px] text-grey-500 mt-0.5'>
            What would you like to say?
          </p>


          {/* Feedback options */}
          <div className='grid grid-cols-2 gap-2 mt-3'>

            {feedbackOptions.map((option) => {
              const selected = selectedFeedback === option

              return (
                <button
                  key={option}
                  onClick={() => setSelectedFeedback(option)}
                  className={`
                    h-8
                    rounded-full
                    px-2
                    text-[9px]
                    transition
                    border
                    ${
                      selected
                        ? 'border-primary text-primary bg-[#FFF7ED]'
                        : 'border-grey-200 text-grey-700 bg-white'
                    }
                  `}
                >
                  {option}
                </button>
              )
            })}

          </div>


          {/* Note */}
          <input
            type='text'
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='Add a short note (optional)'
            className='
              w-full
              h-10
              mt-4
              px-3
              rounded-xl
              bg-grey-50
              border
              border-grey-200
              outline-none
              text-[9px]
              text-grey-800
              placeholder:text-grey-400
              focus:border-primary/40
            '
          />


          {/* Submit */}
          <button
            onClick={handleSubmit}
            className='
              w-full
              h-11
              mt-4
              rounded-xl
              bg-primary
              text-white
              text-[10px]
              font-bold
              active:scale-[0.98]
              transition
            '
          >
            SUBMIT FEEDBACK
          </button>

        </div>

      </main>


      {/* Home indicator */}
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
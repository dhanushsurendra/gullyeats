import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Button from '../components/Button'
import MenuHeader from '../components/MenuHeader'
import illustration from '../assets/updates.png'

export default function GetOrderUpdates() {
  const navigate = useNavigate()
  const { state } = useLocation()

  const orderId = state?.orderId || '67'

  const [phone, setPhone] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSkip = () => {
    navigate('/order-status', {
      state: {
        orderId,
        phone: null,
      },
    })
  }

  const handleContinue = async () => {
    if (!phone.trim()) return

    try {
      setIsSaving(true)

      // API-ready
      // await orderService.savePhoneNumber(orderId, phone)

      console.log('Saving phone:', {
        orderId,
        phone,
      })

      navigate('/order-status', {
        state: {
          orderId,
          phone,
        },
      })
    } catch (error) {
      console.error('Failed to save phone number:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className='min-h-screen bg-white font-poppins flex flex-col'>
      <MenuHeader
        title={'Get Order Updates'}
        subtitle={'No OTP. No spam. Only for this order.'}
      />

      {/* Content */}
      <main className='flex-1 px-4 py-3'>
        {/* Illustration placeholder */}
        <div className='flex justify-center mt-4 mb-6'>
          <div
            className='
              w-full
              h-72
              rounded-2xl
              bg-[#FFF7ED]
              flex
              items-center
              justify-center
            '
          >
            <img
              src={illustration}
              alt='food illustration'
              className='w-72 h-72 object-contain'
            />
          </div>
        </div>

        {/* Phone Card */}
        <div
          className='
            bg-white
            border
            border-grey-100
            rounded-2xl
            p-4
            shadow-sm
          '
        >
          <h2 className='text-body font-semibold text-grey-900'>
            Add your phone number
          </h2>

          {/* Phone input */}
          <div
            className='
              flex
              items-center
              border
              border-grey-200
              rounded-xl
              h-12
              px-3
              mt-3
              bg-grey-50
            '
          >
            <span className='text-sm text-grey-700 mr-2'>+91</span>

            <input
              type='tel'
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
              }
              placeholder='98765 43210'
              className='
                flex-1
                bg-transparent
                outline-none
                text-sm
                text-grey-800
                placeholder:text-grey-400
              '
            />
          </div>

          {/* Information */}
          <div className='mt-4 space-y-3'>
            <p className='text-[11px] text-grey-500'>
              Faster updates if token is called
            </p>

            <p className='text-[11px] text-grey-500'>
              Helps vendor confirm your order
            </p>

            <p className='text-[11px] text-grey-500'>
              Useful if network disconnects
            </p>
          </div>
        </div>
      </main>

      {/* Bottom */}
      <div className='px-4 pb-5 pt-3'>
        <Button onClick={handleSkip} className='w-full' disabled={isSaving}>
          SKIP
        </Button>

        <p
          className='
          text-center
          text-[10px]
          text-grey-400
          mt-2
        '
        >
          🔒 Your number is used only for this order and never saved.
        </p>
      </div>
    </div>
  )
}

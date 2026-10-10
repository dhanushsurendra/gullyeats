import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'

import Button from '../components/Button'
import Card from '../components/Card'
import InfoCard from '../components/InfoCard'
import illustration from '../assets/welcome.png'

import { API_BASE_URL } from '../constants/api'
import { setCartDetails } from '../store/cartSlice'

export default function Welcome() {
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const { cartId } = useParams()

  // Redux cart details
  const cartDetails = useSelector((state) => state.cart.details)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ==========================================
  // FETCH CART DETAILS
  // ==========================================

  useEffect(() => {
    let isMounted = true

    const fetchCartDetails = async () => {
      if (!cartId) {
        setError('Cart ID is missing')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')

        const response = await fetch(
          `${API_BASE_URL}/carts/get-cart/${cartId}`,
        )

        if (!response.ok) {
          throw new Error('Failed to fetch cart details')
        }

        const responseData = await response.json()

        if (!responseData?.data) {
          throw new Error('Cart details not found')
        }

        if (isMounted) {
          // Store the COMPLETE cart object in Redux
          dispatch(setCartDetails(responseData.data))
        }
      } catch (error) {

        if (isMounted) {
          setError('Unable to load cart. Please try again.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchCartDetails()

    return () => {
      isMounted = false
    }
  }, [cartId, dispatch])

  // ==========================================
  // START ORDER
  // ==========================================

  const handleStart = () => {
    navigate(`/c/${cartId}/menu`)
  }

  // ==========================================
  // LOADING
  // ==========================================

  if (loading) {
    return (
      <div className='min-h-screen bg-white flex items-center justify-center font-poppins'>
        <div className='text-center animate-[welcomeLoadingIn_0.4s_ease-out]'>
          <div
            className='
              w-8 h-8
              border-4
              border-primary/20
              border-t-primary
              rounded-full
              animate-spin
              mx-auto
            '
          />

          <p className='text-caption text-grey-500 mt-3'>
            Loading restaurant...
          </p>
        </div>
      </div>
    )
  }

  // ==========================================
  // ERROR
  // ==========================================

  if (error) {
    return (
      <div className='min-h-screen bg-white flex items-center justify-center font-poppins px-4'>
        <div className='text-center animate-[welcomeErrorIn_0.45s_ease-out]'>
          <p className='text-h2 text-black'>
            Something went wrong
          </p>

          <p className='text-body text-grey-500 mt-2'>
            {error}
          </p>

          <button
            onClick={() => window.location.reload()}
            className='
              mt-6
              bg-primary
              text-white
              px-6
              py-3
              rounded-pill
              font-semibold
              transition-all
              duration-200
              hover:opacity-90
              active:scale-95
            '
          >
            TRY AGAIN
          </button>
        </div>
      </div>
    )
  }

  // ==========================================
  // DISPLAY ADDRESS
  // ==========================================

  const displayAddress = cartDetails?.address
    ? cartDetails.address
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(2, 4)
        .join(', ')
    : 'Location unavailable'

  // ==========================================
  // UI
  // ==========================================

  return (
    <div className='min-h-screen bg-white flex justify-center font-poppins'>
      <div className='w-full max-w-md px-16px py-24px'>

        {/* ========================================
            HEADER
        ======================================== */}

        <div
          className='
            text-center
            mt-16px
            animate-[welcomeHeaderIn_0.5s_ease-out]
          '
        >
          <p className='text-primary text-caption font-semibold tracking-wider uppercase'>
            GULLYEATS
          </p>

          <h1 className='text-h1 text-black mt-8px font-bold'>
            Welcome
          </h1>

          <p className='text-body text-grey-500 mt-4px'>
            Order directly. No app download needed.
          </p>
        </div>

        {/* ========================================
            RESTAURANT / CART INFO
        ======================================== */}

        <div
          className='
            mt-24px
            animate-[welcomeCardIn_0.5s_ease-out_0.1s_both]
          '
        >
          <InfoCard
            name={cartDetails?.cartName || 'Restaurant'}
            location={displayAddress}
            isOpen={cartDetails?.isOpen || false}
          />
        </div>

        {/* ========================================
            ILLUSTRATION
        ======================================== */}

        <div
          className='
            flex
            justify-center
            my-6
            animate-[welcomeIllustrationIn_0.6s_ease-out_0.2s_both]
          '
        >
          <img
            src={illustration}
            alt='food illustration'
            className='w-72 object-contain'
          />
        </div>

        {/* ========================================
            START ORDER
        ======================================== */}

        <div
          className='
            mt-32px
            animate-[welcomeButtonIn_0.5s_ease-out_0.35s_both]
          '
        >
          <Button
            onClick={handleStart}
            className='w-full'
          >
            {cartDetails?.isOpen ? 'START ORDER' : 'VIEW MENU'}
          </Button>

          <p className='text-center text-caption text-grey-400 mt-8px'>
            Takes less than 10 seconds.
          </p>
        </div>

        {/* ========================================
            HOW IT WORKS
        ======================================== */}

        <Card
          className='
            mt-24px
            bg-grey-100
            p-16px
            rounded-xl
            animate-[welcomeHowItWorksIn_0.5s_ease-out_0.45s_both]
          '
        >
          <p className='text-h3 text-black mb-12px uppercase'>
            HOW IT WORKS
          </p>

          <ul className='space-y-8px text-body text-grey-500 list-disc list-inside'>
            <li>No login required</li>
            <li>Token generated instantly</li>
            <li>Pay only at the counter</li>
          </ul>
        </Card>

        {/* ========================================
            FOOTER
        ======================================== */}

        <div
          className='
            my-24px
            text-center
            animate-[welcomeFooterIn_0.5s_ease-out_0.55s_both]
          '
        >
          <p className='text-primary text-caption font-medium'>
            ✨ You're about to unlock this cart's menu
          </p>

          <p className='text-caption text-grey-400 mt-4px'>
            By continuing, you agree to fair use rules.
          </p>
        </div>
      </div>
    </div>
  )
}
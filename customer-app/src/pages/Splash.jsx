import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import illustration from '../assets/welcome.png'

// What the cart's QR code opens: a short brand moment, then the cart's welcome page.
export default function Splash() {
  const navigate = useNavigate()
  const { cartId } = useParams()

  useEffect(() => {
    const timer = setTimeout(() => navigate(`/c/${cartId}/welcome`, { replace: true }), 1200)
    return () => clearTimeout(timer)
  }, [cartId, navigate])

  return (
    <div className='flex min-h-dvh flex-col items-center justify-center bg-linear-to-b from-[#ff7a2e] to-primary text-white'>
      <img src={illustration} alt='' className='animate-pop w-60 object-contain drop-shadow-xl' />
      <h1 className='animate-fade-up mt-2 text-4xl font-bold tracking-tight'>GullyEats</h1>
      <p className='animate-fade-up mt-1 text-base font-medium text-white/85'>Scan. Crave. Devour.</p>
      <span className='absolute bottom-10 h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white' />
    </div>
  )
}

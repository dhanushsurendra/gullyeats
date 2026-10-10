import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import illustration from '../assets/welcome.png'

export default function Splash() {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/c/69db91dd3766ae8b43dd50c7/welcome')
    }, 2000)

    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#FF6422] flex items-center justify-center font-poppins relative">
      
      {/* Center Content */}
      <div className="w-full max-w-md flex flex-col items-center justify-center text-center text-white">
        
        <img
          src={illustration}
          alt="GullyEats"
          className="w-72 h-72 object-contain"
        />

        <div className="mt-1">
          <h1 className="text-4xl leading-10 font-bold tracking-tight">
            GullyEats
          </h1>

          <p className="text-base leading-6 font-medium mt-0.5">
            Scan. Crave. Devour.
          </p>
        </div>
      </div>

      {/* Bottom Loading Spinner */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      </div>

    </div>
  )
}
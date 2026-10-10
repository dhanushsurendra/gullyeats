import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

export default function NotFound() {
  const navigate = useNavigate()

  const menuItems = useSelector((state) => state.cart.items)

  const cartId = menuItems?.[0]?.cartId

  const handleBackToMenu = () => {
    if (cartId) {
      navigate(`/c/${cartId}`)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-grey-50 flex items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">

        {/* 404 Illustration */}
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-lightOrange">
          <span className="text-3xl font-bold text-primary">
            404
          </span>
        </div>

        <h1 className="mt-6 text-2xl font-bold text-grey-900">
          Page not found
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-grey-500">
          Sorry, we couldn't find the page you're looking for.
        </p>

        <button
          type="button"
          onClick={handleBackToMenu}
          className="
            mt-6
            w-full
            rounded-full
            bg-primary
            py-3
            text-sm
            font-semibold
            text-white
            transition-all
            duration-200
            hover:opacity-90
            active:scale-[0.98]
          "
        >
          BACK TO MENU
        </button>

        <p className="mt-3 text-[10px] text-grey-400">
          Let's get you back to your menu.
        </p>
      </div>
    </div>
  )
}
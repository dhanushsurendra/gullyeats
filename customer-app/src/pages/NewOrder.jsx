import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiArrowLeftSLine } from 'react-icons/ri'
import { MenuItem } from '../components/MenuItem'

export default function NewOrder() {
  const navigate = useNavigate()

  const [cart, setCart] = useState({
    1: 2,
    2: 0,
    3: 0,
  })

  const menuItems = [
    {
      id: 1,
      name: 'Pani Puri',
      isVeg: true,
      price: 40,
    },
    {
      id: 2,
      name: 'Dahi Puri',
      isVeg: false,
      price: 50,
    },
    {
      id: 3,
      name: 'Special Pani Puri',
      isVeg: true,
      price: 60,
    },
  ]

  const handleAdd = (id) => {
    setCart((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }))
  }

  const handleRemove = (id) => {
    setCart((prev) => {
      const quantity = (prev[id] || 0) - 1

      return {
        ...prev,
        [id]: Math.max(quantity, 0),
      }
    })
  }

  const totalItems = Object.values(cart).reduce(
    (sum, quantity) => sum + quantity,
    0,
  )

  const totalPrice = menuItems.reduce(
    (sum, item) =>
      sum + item.price * (cart[item.id] || 0),
    0,
  )

  const handleContinue = () => {
    navigate('/customer-cart/new', {
      state: {
        cart,
        menuItems,
      },
    })
  }

  const handleRepeatOrder = () => {
    setCart({
      1: 2,
      2: 1,
      3: 0,
    })
  }

  return (
    <div className='min-h-screen bg-[#F7F7F7] font-poppins flex flex-col'>

      {/* Top line */}
      <div className='h-0.75 bg-sky-500' />

      {/* Mobile container */}
      <div className='
        flex-1
        w-full
        max-w-107.5
        mx-auto
        bg-white
        flex
        flex-col
      '>

        {/* ================================
            HEADER
        ================================= */}
        <header className='px-4 pt-4 pb-3 border-b border-grey-100'>

          <div className='relative flex items-center justify-center min-h-11.25'>

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
                border-grey-200
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

              <div className='text-[12px] font-bold'>
                <span className='text-primary'>
                  Gully
                </span>
                <span className='text-grey-900'>
                  Eats
                </span>
              </div>

              <p className='text-[9px] text-grey-500 mt-1'>
                Raju Momos • BTM 2nd Stage
              </p>

            </div>

            {/* New order badge */}
            <div
              className='
                absolute
                right-0
                top-1/2
                -translate-y-1/2
                px-2
                py-1
                rounded-full
                bg-grey-100
                text-[7px]
                text-grey-700
                font-semibold
              '
            >
              NEW ORDER
            </div>

          </div>

        </header>


        {/* ================================
            CONTENT
        ================================= */}
        <main className='flex-1 px-4 pt-4 pb-32 overflow-y-auto'>

          {/* Title */}
          <div>

            <h1 className='
              text-[20px]
              leading-tight
              font-bold
              text-grey-900
            '>
              Start New Order
            </h1>

            <p className='
              text-[10px]
              text-grey-500
              mt-1
            '>
              Pick items. Token will be generated instantly.
            </p>

          </div>


          {/* ================================
              REPEAT ORDER
          ================================= */}
          <div
            className='
              mt-4
              border
              border-[#FDBA74]
              bg-[#FFFDF9]
              rounded-xl
              px-3
              py-3
            '
          >

            <div className='flex items-center justify-between gap-3'>

              <div className='flex-1'>

                <p className='
                  text-[10px]
                  text-primary
                  font-bold
                '>
                  Order Again Faster
                </p>

                <p className='
                  text-[9px]
                  text-grey-700
                  mt-1
                '>
                  Pani Puri ×2
                </p>

                <p className='
                  text-[9px]
                  text-grey-700
                '>
                  Dahi Puri ×1
                </p>

                <p className='
                  text-[9px]
                  text-grey-500
                  mt-1
                '>
                  Total last time: ₹130
                </p>

              </div>

              <button
                onClick={handleRepeatOrder}
                className='
                  h-9
                  px-4
                  rounded-xl
                  border
                  border-primary
                  text-primary
                  bg-white
                  text-[8px]
                  font-bold
                  whitespace-nowrap
                  active:scale-[0.98]
                  transition
                '
              >
                REPEAT LAST ORDER
              </button>

            </div>

          </div>


          {/* ================================
              MENU
          ================================= */}
          <div className='mt-4 space-y-2'>

            {menuItems.map((item) => (
              <MenuItem
                key={item.id}
                item={item}
                quantity={cart[item.id] || 0}
                onAdd={handleAdd}
                onRemove={handleRemove}
              />
            ))}

          </div>


          {/* New token note */}
          <div className='flex justify-center mt-4'>

            <div
              className='
                bg-[#FFF7ED]
                border
                border-[#FDBA74]
                rounded-full
                px-3
                py-1.5
              '
            >
              <p className='
                text-[8px]
                text-primary
                font-medium
              '>
                New token will be created after you confirm.
              </p>
            </div>

          </div>

        </main>


        {/* ================================
            BOTTOM CART
        ================================= */}
        <div
          className='
            fixed
            bottom-0
            left-1/2
            -translate-x-1/2
            w-full
            max-w-107.5
            bg-white
            border-t
            border-grey-100
            px-4
            pt-3
            pb-4
            z-50
          '
        >

          <div className='flex items-center justify-between'>

            {/* Cart */}
            <div>

              <p className='
                text-[8px]
                text-grey-500
                uppercase
                font-semibold
              '>
                Your Cart
              </p>

              <p className='
                text-[9px]
                text-grey-500
                mt-1
              '>
                {totalItems} Items
              </p>

              <p className='
                text-[19px]
                leading-none
                font-bold
                text-grey-900
                mt-1
              '>
                ₹{totalPrice}
              </p>

            </div>


            {/* Continue */}
            <button
              onClick={handleContinue}
              disabled={totalItems === 0}
              className='
                h-11
                px-7
                rounded-full
                bg-primary
                text-white
                text-[10px]
                font-bold
                disabled:opacity-50
                active:scale-[0.98]
                transition
              '
            >
              CONTINUE
            </button>

          </div>


          <p className='
            text-center
            text-[8px]
            text-grey-400
            mt-2
          '>
            No payment now. Pay at counter when called.
          </p>

        </div>


        {/* Home indicator */}
        <div className='flex justify-center pb-2'>

          <div className='
            w-12
            h-1
            rounded-full
            bg-grey-900
          ' />

        </div>

      </div>

    </div>
  )
}
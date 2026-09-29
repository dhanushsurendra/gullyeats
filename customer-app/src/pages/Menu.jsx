import { useState } from 'react'
import { RiSearchLine } from 'react-icons/ri'
import { FaRegCheckCircle } from 'react-icons/fa'
import { MenuItem } from '../components/MenuItem'
import MenuHeader from '../components/MenuHeader'
import { useNavigate, useParams } from 'react-router-dom'

export default function Menu() {
  const [cart, setCart] = useState({
    1: 2,
    2: 1,
    3: 0,
  })

  const [showAdded, setShowAdded] = useState(false)
  const [search, setSearch] = useState('')

  const navigate = useNavigate()
  const { token } = useParams()

  // Are we adding items to an existing order?
  const isAddMoreMode = Boolean(token)

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
      name: 'Masala Puri',
      isVeg: true,
      price: 45,
    },
  ]

  const handleAdd = (id) => {
    setCart((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }))

    setShowAdded(true)

    setTimeout(() => {
      setShowAdded(false)
    }, 1200)
  }

  const handleRemove = (id) => {
    setCart((prev) => {
      const newQty = (prev[id] || 0) - 1
      const newCart = { ...prev }

      if (newQty <= 0) {
        delete newCart[id]
      } else {
        newCart[id] = newQty
      }

      return newCart
    })
  }

  const filteredItems = menuItems.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  )

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0)

  const totalPrice = menuItems.reduce(
    (acc, item) => acc + item.price * (cart[item.id] || 0),
    0,
  )

  // Normal order
  const handleViewCart = () => {
    navigate('/customer-cart/dfjlsj', {
      state: {
        cart,
        menuItems,
      },
    })
  }

  // Existing order
  const handleContinueToPayment = () => {
    navigate(`/order/${token}/payment`, {
      state: {
        orderId: token,
        cart,
        menuItems,
        total: totalPrice,
      },
    })
  }

  return (
    <div className='min-h-screen bg-white font-poppins pb-30'>
      {/* HEADER */}
      <MenuHeader
        title={isAddMoreMode ? 'Add More Items' : 'Raju Momos'}
        subtitle={
          isAddMoreMode
            ? 'Add items while waiting. Final payment at counter.'
            : 'BTM 2nd Stage • Bengaluru'
        }
        showLive={!isAddMoreMode}
        showInfo={!isAddMoreMode}
        showToken={isAddMoreMode}
        token={isAddMoreMode ? token : undefined}
        onBack={() =>
          isAddMoreMode ? navigate(`/order/${token}`) : navigate(-1)
        }
      />

      <main className='px-4 py-6'>
        {/* ADD MORE MODE MESSAGE */}
        {isAddMoreMode && (
          <div className='mb-4'>
            <p className='text-[10px] text-grey-500'>
              Add items while waiting. Final payment at counter.
            </p>
          </div>
        )}

        {/* NORMAL ORDER MESSAGE */}
        {!isAddMoreMode && (
          <div className='mt-3 mb-4 bg-lightOrange p-2 rounded-lg text-center'>
            <p className='text-[11px] text-primary font-medium'>
              Token generated after continue. Payment at counter.
            </p>
          </div>
        )}

        {/* SEARCH */}
        <div className='relative mb-6'>
          <RiSearchLine
            className='absolute left-4 top-1/2 -translate-y-1/2 text-grey-400'
            size={18}
          />

          <input
            type='text'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search food items...'
            className='
              w-full
              bg-grey-100
              border
              border-grey-200
              rounded-xl
              py-3
              pl-12
              pr-4
              focus:outline-none
              focus:border-primary/50
              text-body
            '
          />
        </div>

        <h2 className='text-h2 mb-4'>{isAddMoreMode ? 'Menu' : 'Menu'}</h2>

        {/* MENU */}
        <div className='space-y-3'>
          {filteredItems.map((item) => (
            <MenuItem
              key={item.id}
              item={item}
              quantity={cart[item.id] || 0}
              onAdd={handleAdd}
              onRemove={handleRemove}
            />
          ))}
        </div>

        {/* ADDED */}
        {showAdded && (
          <div className='fixed bottom-30 left-1/2 -translate-x-1/2 z-50'>
            <div
              className='
                inline-flex
                items-center
                gap-2
                bg-[#E7F7EF]
                text-success
                font-medium
                px-4
                py-2
                rounded-pill
                text-caption
                border
                border-success/10
                whitespace-nowrap
              '
            >
              Added to cart
              <FaRegCheckCircle size={16} />
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM BAR */}
      {totalItems > 0 && (
        <div className='fixed bottom-6 left-4 right-4 z-50'>
          <div
            className='
              bg-[#0B121F]
              rounded-pill
              p-2
              flex
              items-center
              justify-between
              shadow-xl
            '
          >
            <div className='pl-4'>
              <p className='text-[10px] text-grey-400 uppercase tracking-widest font-bold'>
                {isAddMoreMode ? 'Cart Total' : 'Your Cart'}
              </p>

              <p className='text-white text-body font-bold'>
                {totalItems} Items
              </p>
            </div>

            <div className='flex items-center gap-4'>
              <span className='text-h2 text-white'>₹{totalPrice}</span>

              {isAddMoreMode ? (
                <button
                  onClick={handleContinueToPayment}
                  className='
                    bg-primary
                    text-white
                    px-6
                    py-3
                    rounded-pill
                    font-bold
                    text-body
                  '
                >
                  SAVE & GO BACK
                </button>
              ) : (
                <button
                  onClick={handleViewCart}
                  className='
                    bg-primary
                    text-white
                    px-6
                    py-3
                    rounded-pill
                    font-bold
                    text-body
                  '
                >
                  VIEW CART
                </button>
              )}
            </div>
          </div>

          <p className='text-center text-[10px] text-grey-500 mt-2'>
            No payment online. Pay directly at counter.
          </p>
        </div>
      )}
    </div>
  )
}

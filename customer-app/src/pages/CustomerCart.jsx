import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import MenuHeader from '../components/MenuHeader'
import { MenuItem } from '../components/MenuItem'
import Button from '../components/Button'

export default function CustomerCart() {
  const { state } = useLocation()
  const navigate = useNavigate()

  const [cart, setCart] = useState({})
  const [menuItems, setMenuItems] = useState([])

  // ✅ Properly receive data from previous screen
  useEffect(() => {
    if (state?.cart && state?.menuItems) {
      setCart(state.cart)
      setMenuItems(state.menuItems)
    }
  }, [state])

  const handleAdd = (id) => {
    setCart((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }))
  }

  const handleRemove = (id) => {
    setCart((prev) => {
      const newQty = (prev[id] || 0) - 1
      const updated = { ...prev }

      if (newQty <= 0) delete updated[id]
      else updated[id] = newQty

      return updated
    })
  }

  const handleClear = () => setCart({})

  const handleSubmit = () => {
    navigate('/get-updates')
  }

  const cartItems = menuItems.filter((item) => cart[item.id])

  const total = cartItems.reduce(
    (acc, item) => acc + item.price * cart[item.id],
    0,
  )

  return (
    <div className='min-h-screen bg-white font-poppins flex flex-col'>
      <MenuHeader
        title='Your Cart'
        subtitle='Payment happens only at the counter.'
        showIcon={true}
        onDelete={handleClear}
        onBack={() => navigate(-1)}
      />

      <main className='flex-1 px-4 py-5 space-y-4'>
        {cartItems.length === 0 ? (
          <p className='text-center text-grey-500 mt-10'>Your cart is empty</p>
        ) : (
          <>
            {cartItems.map((item) => (
              <MenuItem
                key={item.id}
                item={item}
                quantity={cart[item.id]}
                onAdd={handleAdd}
                onRemove={handleRemove}
              />
            ))}

            <button
              onClick={() => navigate(-1)}
              className='w-full text-primary text-center text-body font-semibold mt-2'
            >
              + Add more items
            </button>

            <div className='bg-grey-50 rounded-2xl p-4 mt-6 space-y-3'>
              <h3 className='font-semibold text-body'>Bill Summary</h3>

              {cartItems.map((item) => (
                <div key={item.id} className='flex justify-between text-sm'>
                  <span className='text-grey-600'>{item.name}</span>
                  <span className='font-medium'>
                    ₹{item.price * cart[item.id]}
                  </span>
                </div>
              ))}

              <div className='flex justify-between border-gray-300 font-semibold pt-2 border-t'>
                <span>Total</span>
                <span>₹{total}</span>
              </div>
            </div>

            <div
              className='bg-lightOrange bg-[#FFF7ED] text-primary text-[12px] text-center p-3
             rounded-xl mt-4'
            >
              Token will be generated instantly. <br />
              Pay at counter to start preparing your order.
            </div>
          </>
        )}
      </main>

      <div className='sticky bottom-0 bg-white px-4 py-4 border-t border-grey-100'>
        <Button
          onClick={handleSubmit}
          disabled={cartItems.length === 0}
          className='w-full'
        >
          CONTINUE → GET TOKEN
        </Button>

        <p className='text-center text-[11px] text-grey-500 mt-2'>
          You're about to enter the queue.
        </p>

        <button
          onClick={handleClear}
          className='w-full text-center text-grey-500 text-sm mt-4 underline'
        >
          Cancel Order
        </button>
      </div>
    </div>
  )
}

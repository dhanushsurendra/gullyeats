import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import MenuHeader from '../components/MenuHeader'
import { MenuItem } from '../components/MenuItem'
import Button from '../components/Button'
import { clearCart, addItem, removeItem } from '../store/cartSlice'

const PLATFORM_FEE = 2

export default function CustomerCart() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { cartId } = useParams()

  const [isParcel, setIsParcel] = useState(false)

  // ==========================================
  // REDUX STATE
  // ==========================================

  const menuItems = useSelector((state) => state.cart.items)
  const cart = useSelector((state) => state.cart.cart)

  // ==========================================
  // CART ITEMS
  // ==========================================

  const cartItems = menuItems.filter((item) => cart[item._id] > 0)

  // ==========================================
  // ITEM TOTAL
  // ==========================================

  const itemTotal = cartItems.reduce(
    (total, item) => total + item.price * cart[item._id],
    0,
  )

  // ==========================================
  // PLATFORM FEE
  // ==========================================

  const total = itemTotal + PLATFORM_FEE

  // ==========================================
  // QUANTITY
  // ==========================================

  const totalItems = Object.values(cart).reduce(
    (total, quantity) => total + quantity,
    0,
  )

  // ==========================================
  // ADD / REMOVE
  // ==========================================

  const handleAdd = (id) => {
    dispatch(addItem(id))
  }

  const handleRemove = (id) => {
    dispatch(removeItem(id))
  }

  // ==========================================
  // CLEAR / DELETE ORDER
  // ==========================================

  const handleClear = () => {
    dispatch(clearCart())
    navigate(`/c/${cartId}/menu`)
  }

  // ==========================================
  // ADD MORE ITEMS
  // ==========================================

  const handleAddMore = () => {
    navigate(`/c/${cartId}/menu`, {
      state: {
        fromCart: true,
      },
    })
  }

  // ==========================================
  // CONTINUE
  // ==========================================

  const handleSubmit = () => {
    navigate(`/c/${cartId}/phone`)
  }

  return (
    <div className='min-h-screen bg-white font-poppins flex flex-col pb-36'>
      {/* ========================================
          HEADER
      ======================================== */}

      <MenuHeader
        title='Your Cart'
        subtitle='Payment happens only at the counter.'
        showIcon={false}
        onBack={() => navigate(`/c/${cartId}/menu`, { state: { fromCart: true } })}
      />

      {/* ========================================
          MAIN
      ======================================== */}

      <main className='flex-1 px-4 py-5'>
        {cartItems.length === 0 ? (
          /* ====================================
             EMPTY CART
          ==================================== */

          <div className='flex flex-col items-center justify-center py-20 cart-empty-enter'>
            <div
              className='
                w-20 h-20
                rounded-full
                bg-lightOrange
                flex items-center justify-center
                mb-5
              '
            >
              <span className='text-3xl'>🛒</span>
            </div>

            <h2 className='text-h2 text-black'>Your cart is empty</h2>

            <p className='text-body text-grey-500 mt-2 text-center'>
              Looks like you haven't added anything yet.
            </p>

            <button
              onClick={handleAddMore}
              className='
                mt-6
                bg-primary
                text-white
                px-6 py-3
                rounded-pill
                font-semibold
                text-sm
                transition-all
                duration-200
                hover:opacity-90
                active:scale-95
              '
            >
              BROWSE MENU
            </button>
          </div>
        ) : (
          <>
            {/* ==================================
                CART ITEMS
            ================================== */}

            <div className='space-y-3'>
              {cartItems.map((item, index) => (
                <div
                  key={item._id}
                  className='cart-item-enter'
                  style={{
                    animationDelay: `${index * 70}ms`,
                  }}
                >
                  <MenuItem
                    item={item}
                    quantity={cart[item._id]}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                  />
                </div>
              ))}
            </div>

            {/* ==================================
                ADD MORE
            ================================== */}

            <button
              onClick={handleAddMore}
              className='
                w-full
                mt-5
                py-3
                rounded-xl
                text-primary
                text-sm
                font-semibold
                transition-all
                duration-200
                hover:border-primary/40
                active:scale-[0.99]
              '
            >
              + Add more items
            </button>

            {/* ==================================
                PARCEL TOGGLE
            ================================== */}

            <div
              className='
                mt-5
                flex items-center justify-between
                bg-grey-50
                border border-grey-100
                rounded-xl
                px-4 py-3
              '
            >
              <div>
                <p className='text-sm font-semibold text-black'>Parcel order</p>

                <p className='text-caption text-grey-500 mt-0.5'>
                  Pack your order for takeaway
                </p>
              </div>

              <button
                type='button'
                onClick={() => setIsParcel((prev) => !prev)}
                className={`
                  relative
                  w-12 h-7
                  rounded-full
                  transition-all
                  duration-200
                  ${isParcel ? 'bg-primary' : 'bg-grey-300'}
                `}
                aria-label='Toggle parcel order'
                aria-pressed={isParcel}
              >
                <span
                  className={`
                    absolute
                    top-1
                    w-5 h-5
                    rounded-full
                    bg-white
                    shadow-sm
                    transition-all
                    duration-200
                    ${isParcel ? 'left-6' : 'left-1'}
                  `}
                />
              </button>
            </div>

            {/* ==================================
                BILL SUMMARY
            ================================== */}

            <div
              className='
                mt-5
                bg-grey-50
                rounded-2xl
                p-4
                border border-grey-100
              '
            >
              <h3 className='text-body font-semibold text-black mb-4'>
                Bill Summary
              </h3>

              {/* Item total */}

              <div className='flex items-center justify-between text-sm'>
                <span className='text-grey-500'>Item total</span>

                <span className='font-medium text-black'>₹{itemTotal}</span>
              </div>

              {/* Platform fee */}

              <div className='flex items-center justify-between text-sm mt-3'>
                <span className='text-grey-500'>Platform fee</span>

                <span className='font-medium text-black'>₹{PLATFORM_FEE}</span>
              </div>

              {/* Divider */}

              <div className='border-t border-grey-200 my-4' />

              {/* Total */}

              <div className='flex items-center justify-between'>
                <span className='text-body font-semibold text-black'>
                  Total
                </span>

                <span className='text-h2 font-bold text-black'>₹{total}</span>
              </div>
            </div>

            {/* ==================================
                COUNTER INFO
            ================================== */}

            <div
              className='
                mt-4
                bg-lightOrange
                text-primary
                text-[12px]
                text-center
                p-3
                rounded-xl
              '
            >
              Token will be generated instantly.
              <br />
              Pay at counter to start preparing your order.
            </div>
          </>
        )}
      </main>

      {/* ========================================
          BOTTOM ACTION
      ======================================== */}

      {cartItems.length > 0 && (
        <div
          className='
            fixed
            bottom-0
            left-0
            right-0
            z-50
            bg-white
            border-t border-grey-100
            px-4
            pt-3
            pb-4
            cart-footer-enter
          '
        >
          {/* Total + item count */}

          <div className='flex items-center justify-between mb-3'>
            <div>
              <p className='text-caption text-grey-500'>
                {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </p>

              <p className='text-lg font-bold text-black'>₹{total}</p>
            </div>

            {isParcel && (
              <span
                className='
                  text-caption
                  text-primary
                  bg-lightOrange
                  px-3 py-1
                  rounded-pill
                  font-semibold
                '
              >
                PARCEL
              </span>
            )}
          </div>

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

          {/* Cancel = delete order/cart */}

          <button
            onClick={handleClear}
            className='
              w-full
              text-center
              text-grey-500
              text-sm
              mt-3
              transition-colors
              duration-200
              hover:text-primary
            '
          >
            Cancel Order
          </button>
        </div>
      )}
    </div>
  )
}

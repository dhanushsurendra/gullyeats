import { useEffect, useState } from 'react'
import { RiSearchLine } from 'react-icons/ri'
import { FaRegCheckCircle } from 'react-icons/fa'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { clearCart } from '../store/cartSlice'

import { MenuItem } from '../components/MenuItem'
import MenuItemShimmer from '../components/MenuItemShimmer'
import MenuHeader from '../components/MenuHeader'
import { useLocation } from 'react-router-dom'

import { setMenuItems, setCart, addItem, removeItem } from '../store/cartSlice'

import { API_BASE_URL } from '../constants/api'

export default function Menu() {
  const [showAdded, setShowAdded] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [foodFilter, setFoodFilter] = useState('all')

  const [isExistingOrderLoading, setIsExistingOrderLoading] = useState(false)
  const [existingOrder, setExistingOrder] = useState(null)

  const [existingOrderError, setExistingOrderError] = useState('')

  const navigate = useNavigate()
  const dispatch = useDispatch()

  const location = useLocation()

  const cameFromCart = location.state?.fromCart === true

  const { cartId, orderNumber } = useParams()

  const menuItems = useSelector((state) => state.cart.items)

  const cart = useSelector((state) => state.cart.cart)

  const cartDetails = useSelector((state) => state.cart.details)

  const isAddMoreMode = Boolean(orderNumber)

  const [isSaving, setIsSaving] = useState(false)

  // ==================================================
  // FETCH MENU ITEMS
  // ==================================================

  useEffect(() => {
    const fetchMenuItems = async () => {
      if (!cartId) {
        setError('Cart ID is missing')
        setLoading(false)
        return
      }

      // Menu already exists in Redux
      if (menuItems.length > 0) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')

        const response = await fetch(
          `${API_BASE_URL}/carts/get-menu-items/${cartId}`,
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.message || 'Failed to fetch menu items')
        }

        dispatch(setMenuItems(data?.data || []))
      } catch (error) {

        setError('Unable to load menu. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchMenuItems()
  }, [cartId, menuItems.length, dispatch])

  useEffect(() => {
    if (!isAddMoreMode && !cameFromCart) {
      dispatch(clearCart())
    }
  }, [isAddMoreMode, cameFromCart, dispatch])

  // ==================================================
  // FETCH EXISTING ORDER
  // ==================================================

  useEffect(() => {
    if (!isAddMoreMode || !orderNumber) {
      return
    }

    const fetchExistingOrder = async () => {
      try {
        setIsExistingOrderLoading(true)
        setExistingOrderError('')

        const response = await fetch(
          `${API_BASE_URL}/orders/order/${orderNumber}`,
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.message || 'Unable to fetch existing order.')
        }

        const orderData = data?.data

        if (!orderData) {
          throw new Error('Existing order not found.')
        }

        // Store order in state
        setExistingOrder(orderData)

        // Build Redux cart from the fetched order
        const existingCart = {}

        const orderItems = orderData?.orderItems || []

        orderItems.forEach((item) => {
          const itemId = item.menuItemId

          if (!itemId) {
            return
          }

          existingCart[itemId] = Number(item.quantity || 0)
        })

        // Replace Redux cart with existing order
        dispatch(setCart(existingCart))
      } catch (error) {

        setExistingOrderError(
          error?.message || 'Unable to load your existing order.',
        )
      } finally {
        setIsExistingOrderLoading(false)
      }
    }

    fetchExistingOrder()
  }, [isAddMoreMode, orderNumber, dispatch])

  // ==================================================
  // ADD ITEM
  // ==================================================

  const handleAdd = (id) => {
    dispatch(addItem(id))

    setShowAdded(true)

    setTimeout(() => {
      setShowAdded(false)
    }, 1200)
  }

  // ==================================================
  // REMOVE ITEM
  // ==================================================

  const handleRemove = (id) => {
    dispatch(removeItem(id))
  }

  // ==================================================
  // SEARCH + FOOD FILTER
  // ==================================================

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())

    const matchesFoodType =
      foodFilter === 'all' ||
      (foodFilter === 'veg' && item.isVeg) ||
      (foodFilter === 'nonveg' && !item.isVeg)

    return matchesSearch && matchesFoodType
  })

  // ==================================================
  // TOTALS
  // ==================================================

  const totalItems = Object.values(cart).reduce(
    (total, quantity) => total + Number(quantity || 0),
    0,
  )

  const totalPrice = menuItems.reduce(
    (total, item) =>
      total + Number(item.price || 0) * Number(cart[item._id] || 0),
    0,
  )

  // ==================================================
  // NORMAL ORDER
  // ==================================================

  const handleViewCart = () => {
    navigate(`/c/${cartId}/cart`)
  }

  // ==================================================
  // EXISTING ORDER
  // ==================================================

  const handleSaveAndGoBack = async () => {
    if (!existingOrder?._id) {
      return
    }

    try {
      setIsSaving(true)
      setExistingOrderError('')

      // Build the COMPLETE updated order items
      const updatedOrderItems = menuItems
        .filter((item) => Number(cart[item._id] || 0) > 0)
        .map((item) => {
          const quantity = Number(cart[item._id] || 0)

          return {
            menuItemId: item._id,
            name: item.name,
            price: Number(item.price),
            quantity,
            total: Number(item.price) * quantity,
          }
        })

      if (updatedOrderItems.length === 0) {
        throw new Error('Your order cannot be empty.')
      }

      // Calculate updated subtotal
      const subtotal = updatedOrderItems.reduce(
        (total, item) => total + Number(item.price) * Number(item.quantity),
        0,
      )

      // Keep existing charges
      const platformFee = Number(existingOrder.platformFee || 0)

      const parcelCharge = Number(existingOrder.parcelCharge || 0)

      const totalPrice = subtotal + platformFee + parcelCharge

      const payload = {
        orderItems: updatedOrderItems,
        subtotal,
        platformFee,
        parcelCharge,
        totalPrice,
      }

      const response = await fetch(
        `${API_BASE_URL}/orders/update-order/${existingOrder._id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to update order.')
      }

      // Only navigate after successful update
      navigate(`/c/${cartId}/order/${orderNumber}`)
    } catch (error) {

      setExistingOrderError(error.message || 'Unable to update your order.')
    } finally {
      setIsSaving(false)
    }
  }

  // ==================================================
  // ADDRESS
  // ==================================================

  const getDisplayAddress = (address) => {
    if (!address) {
      return 'Location unavailable'
    }

    const parts = address
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)

    if (parts.length >= 4) {
      return `${parts[2]}, ${parts[3]}`
    }

    return address
  }

  // ==================================================
  // ERROR
  // ==================================================

  if (error) {
    return (
      <div className='min-h-screen bg-white flex items-center justify-center font-poppins px-4'>
        <div className='text-center'>
          <p className='text-h2 text-black'>Something went wrong</p>

          <p className='text-body text-grey-500 mt-2'>{error}</p>

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
            '
          >
            TRY AGAIN
          </button>
        </div>
      </div>
    )
  }

  // ==================================================
  // EXISTING ORDER ERROR
  // ==================================================

  if (isAddMoreMode && existingOrderError) {
    return (
      <div
        className='
          min-h-screen
          bg-white
          flex
          items-center
          justify-center
          font-poppins
          px-4
        '
      >
        <div className='text-center'>
          <p className='text-h2 text-black'>Unable to load order</p>

          <p className='text-body text-grey-500 mt-2'>{existingOrderError}</p>

          <button
            onClick={() => navigate(`/c/${cartId}/order/${orderNumber}`)}
            className='
              mt-6
              bg-primary
              text-white
              px-6
              py-3
              rounded-pill
              font-semibold
            '
          >
            BACK TO ORDER
          </button>
        </div>
      </div>
    )
  }

  // ==================================================
  // MAIN UI
  // ==================================================

  return (
    <div className='min-h-screen bg-white font-poppins pb-30'>
      {/* ==================================================
          HEADER
      ================================================== */}

      <MenuHeader
        title={
          isAddMoreMode
            ? 'Add More Items'
            : cartDetails?.cartName || 'Restaurant'
        }
        subtitle={
          isAddMoreMode
            ? 'Edit your order and add more items.'
            : getDisplayAddress(cartDetails?.address)
        }
        showLive={!isAddMoreMode && cartDetails?.isOpen}
        showInfo={!isAddMoreMode}
        showToken={isAddMoreMode}
        token={isAddMoreMode ? orderNumber : undefined}
        onBack={() =>
          isAddMoreMode
            ? navigate(`/c/${cartId}/order/${orderNumber}`)
            : navigate(`/c/${cartId}/welcome`)
        }
      />

      {/* ==================================================
          MAIN
      ================================================== */}

      <main className='px-4 py-6'>
        {/* Existing order loading */}

        {isAddMoreMode && isExistingOrderLoading && (
          <div
            className='
                mb-4
                bg-lightOrange
                p-2
                rounded-lg
                text-center
              '
          >
            <p className='text-[11px] text-primary font-medium'>
              Loading your current order...
            </p>
          </div>
        )}

        {/* Add more message */}

        {isAddMoreMode && !isExistingOrderLoading && (
          <div className='mb-4'>
            <p className='text-[10px] text-grey-500'>
              Your current items are already selected. Add or remove items
              before saving.
            </p>
          </div>
        )}

        {/* Normal order message */}

        {!isAddMoreMode && (
          <div className='mb-1 bg-lightOrange p-2 rounded-lg text-center'>
            <p className='text-[11px] text-primary font-medium'>
              Pay at the counter. Your order starts preparing after payment.
            </p>
          </div>
        )}

        {/* ==================================================
            SEARCH
        ================================================== */}

        <div className='relative mb-6'>
          <RiSearchLine
            className='
              absolute
              left-4
              top-1/2
              -translate-y-1/2
              text-grey-400
            '
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

        {/* ==================================================
            FOOD FILTER
        ================================================== */}

        <div className='flex gap-2 mb-6'>
          <button
            onClick={() => setFoodFilter('all')}
            className={`
              px-4
              py-2
              rounded-pill
              text-sm
              font-semibold
              border
              transition
              ${
                foodFilter === 'all'
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-grey-500 border-grey-200'
              }
            `}
          >
            All
          </button>

          <button
            onClick={() => setFoodFilter('veg')}
            className={`
              flex
              items-center
              gap-2
              px-4
              py-2
              rounded-pill
              text-sm
              font-semibold
              border
              transition
              ${
                foodFilter === 'veg'
                  ? 'bg-green-50 text-green-600 border-green-500'
                  : 'bg-white text-grey-500 border-grey-200'
              }
            `}
          >
            <span className='w-2 h-2 rounded-full bg-green-500' />
            Veg
          </button>

          <button
            onClick={() => setFoodFilter('nonveg')}
            className={`
              flex
              items-center
              gap-2
              px-4
              py-2
              rounded-pill
              text-sm
              font-semibold
              border
              transition
              ${
                foodFilter === 'nonveg'
                  ? 'bg-red-50 text-red-600 border-red-500'
                  : 'bg-white text-grey-500 border-grey-200'
              }
            `}
          >
            <span className='w-2 h-2 rounded-full bg-red-500' />
            Non-Veg
          </button>
        </div>

        {/* ==================================================
            MENU TITLE
        ================================================== */}

        <h2 className='text-h2 mb-4'>Menu</h2>

        {/* ==================================================
            MENU ITEMS
        ================================================== */}

        <div className='space-y-3'>
          {loading || (isAddMoreMode && isExistingOrderLoading) ? (
            <>
              <MenuItemShimmer />
              <MenuItemShimmer />
              <MenuItemShimmer />
              <MenuItemShimmer />
            </>
          ) : filteredItems.length > 0 ? (
            filteredItems.map((item, index) => (
              <div
                key={item._id}
                className='menu-item-enter'
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
              >
                <MenuItem
                  item={item}
                  quantity={cart[item._id] || 0}
                  onAdd={handleAdd}
                  onRemove={handleRemove}
                  disabled={!cartDetails?.isOpen}
                />
              </div>
            ))
          ) : (
            <div className='text-center py-10'>
              <p className='text-body text-grey-500'>No menu items found.</p>
            </div>
          )}
        </div>

        {/* ==================================================
            ADDED TO CART
        ================================================== */}

        {showAdded && (
          <div className='fixed bottom-30 left-0 right-0 z-50 flex justify-center pointer-events-none'>
            <div
              className='
                toast-enter
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
                shadow-lg
              '
            >
              <FaRegCheckCircle size={16} />
              Added to cart
            </div>
          </div>
        )}
      </main>

      {/* ==================================================
          BOTTOM CART BAR
      ================================================== */}

      {totalItems > 0 && (
        <div className='fixed bottom-6 left-4 right-4 z-50 cart-bar-enter'>
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
            {/* Cart information */}

            <div className='pl-4'>
              <p
                className='
                  text-[10px]
                  text-grey-400
                  uppercase
                  tracking-widest
                  font-bold
                '
              >
                {isAddMoreMode ? 'Updated Order' : 'Your Cart'}
              </p>

              <p className='text-white text-body font-bold'>
                {totalItems} Items
              </p>
            </div>

            {/* Price + action */}

            <div className='flex items-center gap-4'>
              <span className='text-h2 text-white'>₹{totalPrice}</span>

              {isAddMoreMode ? (
                <button
                  onClick={handleSaveAndGoBack}
                  disabled={isExistingOrderLoading || isSaving}
                  className='
                    bg-primary
                    text-white
                    px-6
                    py-3
                    rounded-pill
                    font-bold
                    text-body
                    transition-all
                    duration-200
                    hover:opacity-90
                    active:scale-95
                    disabled:opacity-50
                    disabled:cursor-not-allowed
                  '
                >
                  {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
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
                    transition-all
                    duration-200
                    active:scale-95
                  '
                >
                  {cartDetails?.isOpen ? 'VIEW CART' : 'VIEW MENU'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

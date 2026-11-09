import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { RiArrowRightLine, RiCloseLine, RiSearchLine } from 'react-icons/ri'

import ActiveOrders from '../components/ActiveOrders'
import { MenuItem } from '../components/MenuItem'
import MenuItemShimmer from '../components/MenuItemShimmer'
import { Button, Page, StatusScreen, TopBar } from '../components/ui'
import { api } from '../constants/api'
import { addItem, removeItem, setCartDetails, setMenuItems } from '../store/cartSlice'
import { itemCount, itemsTotal, PLATFORM_FEE, rupees, shortAddress } from '../utils/format'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'veg', label: 'Veg' },
  { id: 'nonveg', label: 'Non-veg' },
]

/*
 * The cart's menu. At /order/:id/add it edits an existing order instead:
 * the order's items start selected and "Save" updates the order.
 */
export default function Menu() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { cartId, orderNumber: orderId } = useParams()
  const isAddMore = Boolean(orderId)

  const cart = useSelector((state) => state.cart.details)
  const menuItems = useSelector((state) => state.cart.items)
  const basket = useSelector((state) => state.cart.cart)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  // Add-more mode: the order being edited and its quantities.
  const [order, setOrder] = useState(null)
  const [draft, setDraft] = useState({})
  const [original, setOriginal] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Always refetch, so stock and prices are current even with a saved menu.
  useEffect(() => {
    let live = true
    Promise.all([
      api(`/carts/get-cart/${cartId}`),
      api(`/carts/get-menu-items/${cartId}`),
      isAddMore ? api(`/orders/order/${orderId}`) : null,
    ])
      .then(([cartData, items, existing]) => {
        if (!live) return
        dispatch(setCartDetails(cartData))
        dispatch(setMenuItems(items || []))
        if (existing) {
          setOrder(existing)
          const ordered = Object.fromEntries(
            (existing.orderItems || [])
              .filter((i) => i.menuItemId)
              .map((i) => [i.menuItemId, Number(i.quantity)]),
          )
          setOriginal(ordered)
          setDraft(ordered)
        }
        setError('')
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [cartId, orderId, isAddMore, dispatch, attempt])

  const quantities = isAddMore ? draft : basket
  const change = (id, delta) => {
    if (!isAddMore) return dispatch(delta > 0 ? addItem(id) : removeItem(id))
    setSaveError('')
    setDraft((d) => {
      const next = { ...d, [id]: Math.max(0, (d[id] || 0) + delta) }
      if (!next[id]) delete next[id]
      return next
    })
  }

  const isOpen = cart?._id === cartId && cart.isOpen && cart.isActive !== false
  const canOrder = isAddMore ? ['PENDING', 'PAID'].includes(order?.status) : isOpen
  const count = itemCount(quantities)
  const changed = Object.keys({ ...draft, ...original }).some((id) => draft[id] !== original[id])
  // Items already in the order keep the price they were ordered at.
  const orderPrices = Object.fromEntries((order?.orderItems || []).map((i) => [i.menuItemId, i.price]))
  const total = isAddMore
    ? Object.entries(draft).reduce(
        (sum, [id, q]) => sum + q * (orderPrices[id] ?? menuItems.find((m) => m._id === id)?.price ?? 0),
        0,
      )
    : itemsTotal(menuItems, quantities)

  const query = search.trim().toLowerCase()
  const shown = menuItems
    .filter(
      (item) =>
        item.name.toLowerCase().includes(query) &&
        (filter === 'all' || (filter === 'veg') === Boolean(item.isVeg)),
    )
    // Sold-out items sink to the bottom.
    .sort((a, b) => (b.isInStock !== false) - (a.isInStock !== false))

  // Replace, so the back button from the order doesn't reopen this editor.
  const backToOrder = () => navigate(`/c/${cartId}/order/${orderId}`, { replace: true })

  const save = async () => {
    // From the draft, not the menu: keeps ordered items that have left the menu.
    // Names, prices and totals are only for backends deployed before the
    // server priced orders itself (see CustomerCart).
    const orderItems = Object.entries(draft).map(([menuItemId, quantity]) => {
      const known = order.orderItems.find((i) => i.menuItemId === menuItemId) || menuItems.find((m) => m._id === menuItemId)
      return { menuItemId, name: known?.name, price: known?.price, quantity, total: (known?.price || 0) * quantity }
    })
    if (!orderItems.length) {
      setSaveError('Your order needs at least one item. To cancel it, go back to your order.')
      return
    }
    const parcelCharge = Number(order.parcelCharge || 0)
    setSaving(true)
    try {
      await api(`/orders/update-order/${orderId}`, {
        method: 'PUT',
        body: {
          orderItems,
          subtotal: total,
          platformFee: PLATFORM_FEE,
          parcelCharge,
          totalPrice: total + PLATFORM_FEE + parcelCharge,
        },
      })
      backToOrder()
    } catch (e) {
      setSaveError(e.message)
      setSaving(false)
    }
  }

  if (error && !menuItems.length) {
    return (
      <Page>
        <TopBar title='Menu' onBack={() => navigate(-1)} />
        <StatusScreen icon='🍽️' title="Couldn't load the menu" message={error}>
          <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
        </StatusScreen>
      </Page>
    )
  }

  const paidAmount = Number(order?.paidAmount || 0)

  return (
    <Page>
      <TopBar
        title={isAddMore ? `Edit token #${order?.orderNumber ?? ''}` : cart?.cartName || 'Menu'}
        subtitle={isAddMore ? 'Add or change items' : shortAddress(cart?.address)}
        onBack={isAddMore ? backToOrder : () => navigate(`/c/${cartId}/welcome`)}
      />

      <div className='sticky top-16 z-20 space-y-3 bg-grey-50/95 px-4 pb-3 pt-4 backdrop-blur-md'>
        <label className='flex h-12 items-center gap-3 rounded-2xl bg-surface px-4 shadow-card ring-1 ring-grey-200/60 focus-within:ring-2 focus-within:ring-primary/40'>
          <RiSearchLine size={20} className='shrink-0 text-grey-400' />
          <input
            type='search'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search dishes'
            aria-label='Search dishes'
            className='w-full bg-transparent text-[15px] outline-none placeholder:text-grey-400 [&::-webkit-search-cancel-button]:hidden'
          />
          {search && (
            <button type='button' onClick={() => setSearch('')} aria-label='Clear search' className='text-grey-400'>
              <RiCloseLine size={20} />
            </button>
          )}
        </label>
        <div className='flex gap-2' role='group' aria-label='Filter'>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type='button'
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition ${
                filter === f.id
                  ? 'bg-ink text-white'
                  : 'bg-surface text-grey-600 ring-1 ring-grey-200'
              }`}
            >
              {f.id !== 'all' && (
                <span className={`h-2 w-2 rounded-full ${f.id === 'veg' ? 'bg-veg' : 'bg-nonveg'}`} />
              )}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <main className='flex-1 px-4 pb-6'>
        {!isAddMore && <ActiveOrders cartId={cartId} />}
        {!loading && !isAddMore && !isOpen && (
          <p className='mb-4 rounded-2xl bg-grey-100 px-4 py-3 text-sm text-grey-600'>
            This cart is closed right now, so ordering is paused. Here's what they serve.
          </p>
        )}
        {!loading && !isAddMore && isOpen && (
          <p className='mb-4 rounded-2xl bg-primary-soft px-4 py-3 text-sm text-primary'>
            Order here, then pay at the counter. Cooking starts once you pay.
          </p>
        )}
        {isAddMore && paidAmount > 0 && (
          <p className='mb-4 rounded-2xl bg-primary-soft px-4 py-3 text-sm text-primary'>
            You've paid {rupees(paidAmount)}. Pay for new items at the counter. To remove paid
            items, ask the vendor.
          </p>
        )}

        <div className='space-y-3'>
          {loading && !menuItems.length ? (
            [0, 1, 2, 3].map((i) => <MenuItemShimmer key={i} />)
          ) : shown.length ? (
            shown.map((item, i) => (
              <div key={item._id} className='animate-fade-up' style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <MenuItem
                  item={item}
                  quantity={quantities[item._id] || 0}
                  onAdd={(id) => change(id, 1)}
                  onRemove={(id) => change(id, -1)}
                  canOrder={canOrder}
                />
              </div>
            ))
          ) : (
            <StatusScreen
              icon='🔍'
              tone='grey'
              title={menuItems.length ? 'No dishes match' : 'The menu is empty'}
              message={menuItems.length ? 'Try another name or filter.' : 'This cart hasn\'t added any dishes yet.'}
            />
          )}
        </div>
      </main>

      {isAddMore ? (
        <div className='sticky bottom-0 z-30 pb-safe border-t border-grey-200/70 bg-surface/95 px-4 pt-3 backdrop-blur-md'>
          {saveError && <p className='mb-2 text-sm text-danger'>{saveError}</p>}
          <div className='mb-3 flex items-center justify-between text-sm'>
            <span className='text-grey-500'>
              {count} {count === 1 ? 'item' : 'items'}
            </span>
            <span className='font-semibold'>New total {rupees(total + PLATFORM_FEE + Number(order?.parcelCharge || 0))}</span>
          </div>
          <Button onClick={save} loading={saving} disabled={!order || !changed}>
            {changed ? 'Save changes' : 'No changes yet'}
          </Button>
        </div>
      ) : (
        count > 0 && (
          <div className='pb-safe sticky bottom-0 z-30 px-4'>
            <button
              key={count}
              type='button'
              onClick={() => navigate(`/c/${cartId}/cart`)}
              className='animate-bump flex h-15 w-full items-center justify-between rounded-2xl bg-ink px-5 text-white shadow-float transition active:scale-[0.98]'
            >
              <span className='text-left'>
                <span className='block text-xs text-white/60'>
                  {count} {count === 1 ? 'item' : 'items'}
                </span>
                <span className='block text-base font-semibold'>{rupees(total)}</span>
              </span>
              <span className='flex items-center gap-1.5 font-semibold'>
                View cart <RiArrowRightLine size={20} />
              </span>
            </button>
          </div>
        )
      )}
    </Page>
  )
}

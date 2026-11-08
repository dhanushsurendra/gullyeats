import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  details: null,
  items: [],
  cart: {},
  phone: null,
  // Orders placed on this phone, newest first, so leaving the order page
  // (back button, closing the tab, scanning again) never loses one.
  orders: [],
}

const KEEP = 10
const cartSlice = createSlice({
  name: 'cart',

  initialState,

  reducers: {
    setCartDetails: (state, action) => {
      // Scanning a different cart: drop the old cart's menu and basket.
      if (state.details?._id !== action.payload?._id) {
        state.items = []
        state.cart = {}
      }
      state.details = action.payload
    },

    setMenuItems: (state, action) => {
      state.items = action.payload
    },

    addItem: (state, action) => {
      const id = action.payload
      state.cart[id] = (state.cart[id] || 0) + 1
    },

    removeItem: (state, action) => {
      const id = action.payload

      if (!state.cart[id]) return

      state.cart[id] -= 1

      if (state.cart[id] <= 0) {
        delete state.cart[id]
      }
    },

    clearCart: (state) => {
      state.cart = {}
    },

    setPhoneNumber: (state, action) => {
      state.phone = action.payload
    },

    // Adds or refreshes an order's summary.
    rememberOrder: (state, action) => {
      const { _id, cartId, orderNumber, status, createdAt, preparingAt = null } = action.payload
      const summary = { _id, cartId, orderNumber, status, createdAt, preparingAt }
      const orders = state.orders || []
      const i = orders.findIndex((o) => o._id === _id)
      // A known order is updated where it is: moving it to the top on every
      // refresh reordered the list, which triggered another refresh, forever.
      if (i >= 0) orders[i] = summary
      else state.orders = [summary, ...orders].slice(0, KEEP)
      delete state.order // the single order kept by older versions
    },

    forgetOrder: (state, action) => {
      state.orders = (state.orders || []).filter((o) => o._id !== action.payload)
    },

    setCart: (state, action) => {
      state.cart = action.payload
    },

    clearCartSession: (state) => {
      state.details = null
      state.items = []
      state.cart = {}
      state.phone = null
      state.orders = []
    },
  },
})

export const {
  setCartDetails,
  setMenuItems,
  addItem,
  removeItem,
  clearCart,
  setPhoneNumber,
  rememberOrder,
  forgetOrder,
  setCart,
  clearCartSession,
} = cartSlice.actions

export default cartSlice.reducer

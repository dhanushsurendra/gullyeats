import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  details: null,
  items: [],
  cart: {},
  phone: null,
  order: null,
}
const cartSlice = createSlice({
  name: 'cart',

  initialState,

  reducers: {
    setCartDetails: (state, action) => {
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

    setOrder: (state, action) => {
      state.order = action.payload
    },

    setCart: (state, action) => {
      state.cart = action.payload
    },

    clearCartSession: (state) => {
      state.details = null
      state.items = []
      state.cart = {}
      state.phone = null
      state.order = null
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
  setOrder,
  setCart,
  clearCartSession,
} = cartSlice.actions

export default cartSlice.reducer

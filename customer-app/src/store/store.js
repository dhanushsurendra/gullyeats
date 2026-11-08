import { configureStore } from '@reduxjs/toolkit'
import {
  persistStore,
  persistReducer,
} from 'redux-persist'

import cartReducer, { addOrders } from './cartSlice'

// ==========================================
// LOCAL STORAGE ADAPTER
// ==========================================

const storage = {
  getItem: (key) => {
    return Promise.resolve(localStorage.getItem(key))
  },

  setItem: (key, value) => {
    localStorage.setItem(key, value)
    return Promise.resolve()
  },

  removeItem: (key) => {
    localStorage.removeItem(key)
    return Promise.resolve()
  },
}

// ==========================================
// PERSIST CONFIG
// ==========================================

const persistConfig = {
  key: 'gullyeats',
  storage,
}

// ==========================================
// PERSISTED REDUCER
// ==========================================

const persistedCartReducer = persistReducer(
  persistConfig,
  cartReducer,
)

// ==========================================
// STORE
// ==========================================

export const store = configureStore({
  reducer: {
    cart: persistedCartReducer,
  },

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'persist/PAUSE',
          'persist/PURGE',
          'persist/REGISTER',
          'persist/FLUSH',
        ],
      },
    }),
})

// ==========================================
// PERSISTOR
// ==========================================

export const persistor = persistStore(store)

// Every tab saves its whole state to the same storage key, so a tab opened
// before an order was placed in another tab would erase that order when it
// saved. Take in orders other tabs save before that can happen.
window.addEventListener('storage', (e) => {
  if (e.key !== `persist:${persistConfig.key}` || !e.newValue) return
  try {
    const orders = JSON.parse(JSON.parse(e.newValue).orders || '[]')
    store.dispatch(addOrders(orders))
  } catch {
    // Not our format (or corrupt): ignore it.
  }
})
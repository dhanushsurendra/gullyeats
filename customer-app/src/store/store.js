import { configureStore } from '@reduxjs/toolkit'
import {
  persistStore,
  persistReducer,
} from 'redux-persist'

import cartReducer from './cartSlice'

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
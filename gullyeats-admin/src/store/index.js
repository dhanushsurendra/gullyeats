import { configureStore, combineReducers } from '@reduxjs/toolkit'
import { persistStore, persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage'

import auth, { sessionExpired } from './authSlice'
import { SESSION_EXPIRED_EVENT } from '../services/api'
import admin from './adminSlice'
import notify from './notifySlice'

const rootReducer = combineReducers({
  auth,
  // Only the view choices; fetched data is refetched on load.
  admin: persistReducer({ key: 'admin', storage, whitelist: ['range', 'period'] }, admin),
  notify,
})

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth'],
}

const persistedReducer = persistReducer(persistConfig, rootReducer)

const store = configureStore({
  reducer: persistedReducer,

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

export const persistor = persistStore(store)

window.addEventListener(SESSION_EXPIRED_EVENT, () => store.dispatch(sessionExpired()))

export default store

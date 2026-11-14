import { createSlice } from '@reduxjs/toolkit'

// Admin notifications: the loaded list (newest first), the unread count, and
// the latest live one for the toast.
const slice = createSlice({
  name: 'notify',
  initialState: { items: [], unread: 0, hasMore: false, loaded: false, toast: null },
  reducers: {
    loaded: (s, { payload: { items, unread, hasMore, more } }) => {
      s.items = more ? [...s.items, ...items] : items
      s.unread = unread
      s.hasMore = hasMore
      s.loaded = true
    },
    arrived: (s, { payload }) => {
      if (s.items.some((n) => n.id === payload.id)) return
      s.items.unshift(payload)
      s.unread += 1
      s.toast = payload
    },
    read: (s, { payload: ids }) => {
      for (const n of s.items) {
        if (!n.read && (ids === 'all' || ids.includes(n.id))) {
          n.read = true
          s.unread = Math.max(0, s.unread - 1)
        }
      }
      if (ids === 'all') s.unread = 0
    },
    hideToast: (s) => {
      s.toast = null
    },
  },
})

export const { loaded, arrived, read, hideToast } = slice.actions
export default slice.reducer

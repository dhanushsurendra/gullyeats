import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { api } from '../services/api'

const make = (name, fn) =>
  createAsyncThunk(`admin/${name}`, async (arg, { rejectWithValue }) => {
    try {
      return await fn(arg)
    } catch (e) {
      return rejectWithValue(e.message)
    }
  })

export const T = Object.fromEntries(
  [
    'overview',
    'series',
    'owners',
    'carts',
    'orders',
    'payments',
    'feedback',
    'activity',
  ].map((k) => [k, make(k, api[k])]),
)

// Maps the date-range selector to backend query params
export const rangeParams = (r) =>
  r.key === 'custom' && r.startDate && r.endDate
    ? { startDate: r.startDate, endDate: r.endDate }
    : { range: r.key === 'custom' ? 'today' : r.key }

const slice = createSlice({
  name: 'admin',
  initialState: {
    range: { key: 'today', startDate: '', endDate: '' },
    period: '30d',
    search: '',
    data: {},
    loading: {},
    error: {},
  },
  reducers: {
    setRange: (s, a) => {
      s.range = { ...s.range, ...a.payload }
    },
    setPeriod: (s, a) => {
      s.period = a.payload
    },
    setSearch: (s, a) => {
      s.search = a.payload
    },
  },
  extraReducers: (b) => {
    Object.entries(T).forEach(([k, t]) =>
      b
        .addCase(t.pending, (s) => {
          s.loading[k] = true
          s.error[k] = null
        })
        .addCase(t.fulfilled, (s, a) => {
          s.loading[k] = false
          s.data[k] = a.payload
        })
        .addCase(t.rejected, (s, a) => {
          s.loading[k] = false
          s.error[k] = a.payload || a.error.message
        }),
    )
  },
})
export const { setRange, setPeriod, setSearch } = slice.actions
export default slice.reducer

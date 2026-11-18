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
    'activity',
    'collections',
    'leakage',
    'vendors',
    'growth',
    'operations',
    'play',
    'pulse',
    'todo',
    'areaAlerts',
  ].map((k) => [k, make(k, api[k])]),
)

const slice = createSlice({
  name: 'admin',
  initialState: {
    data: {},
    // The argument each resource was last fetched with (see useResource).
    argOf: {},
    loading: {},
    error: {},
  },
  reducers: {
    // Flips one owner's row right away, so the button doesn't wait for a full reload.
    patchOwner: (s, { payload: { id, disabled } }) => {
      const o = s.data.owners?.find((x) => x.id === id)
      if (o) Object.assign(o, { disabled, status: disabled ? 'Disabled' : 'Active' })
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
          s.argOf[k] = JSON.stringify(a.meta.arg ?? null)
        })
        .addCase(t.rejected, (s, a) => {
          s.loading[k] = false
          s.error[k] = a.payload || a.error.message
        }),
    )
  },
})
export const { patchOwner } = slice.actions
export default slice.reducer

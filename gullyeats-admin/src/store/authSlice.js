import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { loginRequest, logoutRequest } from '../services/api'

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      return await loginRequest(email, password)
    } catch (e) {
      return rejectWithValue(e.message)
    }
  },
)

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      return await logoutRequest()
    } catch (e) {
      return rejectWithValue(e.message)
    }
  },
)

const slice = createSlice({
  name: 'auth',

  initialState: {
    user: null,
    loading: false,
    error: null,
  },

  reducers: {
    // A request found the login cookie expired (services/api.js).
    sessionExpired: (state) => {
      state.user = null
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
      })

      .addCase(login.fulfilled, (state, action) => {
        state.loading = false
        state.error = null
        state.user = action.payload.user
      })

      .addCase(login.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Login failed'
      })

      .addCase(logout.fulfilled, (state) => {
        state.user = null
        state.error = null
      })

      // Clear the user even if the server call fails, or the admin can't leave.
      .addCase(logout.rejected, (state) => {
        state.user = null
      })

  },
})

export const { sessionExpired } = slice.actions

export default slice.reducer
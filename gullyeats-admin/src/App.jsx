import { Navigate, Route, Routes } from 'react-router-dom'
import { useSelector } from 'react-redux'
import AdminLayout from './layouts/AdminLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import {
  Owners,
  Restaurants,
  Orders,
  Analytics,
  Revenue,
  Payments,
  Feedback,
  SettingsPage,
} from './pages/Pages'

function Protected({ children }) {
  const user = useSelector((s) => s.auth.user)

  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  const user = useSelector((s) => s.auth.user)

  return (
    <Routes>
      {/* Login */}
      <Route
        path="/login"
        element={
          user ? <Navigate to="/" replace /> : <Login />
        }
      />

      {/* Protected Admin Routes */}
      <Route
        element={
          <Protected>
            <AdminLayout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="owners" element={<Owners />} />
        <Route path="restaurants" element={<Restaurants />} />
        <Route path="orders" element={<Orders />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="revenue" element={<Revenue />} />
        <Route path="payments" element={<Payments />} />
        <Route path="feedback" element={<Feedback />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
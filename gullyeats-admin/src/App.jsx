import { Navigate, Route, Routes } from 'react-router-dom'
import { useSelector } from 'react-redux'
import AdminLayout from './layouts/AdminLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Collections from './pages/Collections'
import Insights from './pages/Insights'
import Actions from './pages/Actions'
import Moderation from './pages/Moderation'
import Dishes from './pages/Dishes'
import Notifications from './pages/Notifications'
import Launch from './pages/Launch'
import AreaAlerts from './pages/AreaAlerts'
import Broadcast from './pages/Broadcast'
import {
  Owners,
  Restaurants,
  Orders,
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

      {/* The launch ceremony: full screen, without the sidebar. */}
      <Route
        path="/launch"
        element={
          <Protected>
            <Launch />
          </Protected>
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
        {/* Analytics merged into Revenue; old links still work. */}
        <Route path="analytics" element={<Navigate to="/revenue" replace />} />
        <Route path="revenue" element={<Revenue />} />
        <Route path="payments" element={<Payments />} />
        <Route path="collections" element={<Collections />} />
        <Route path="insights" element={<Insights />} />
        <Route path="actions" element={<Actions />} />
        <Route path="moderation" element={<Moderation />} />
        <Route path="dishes" element={<Dishes />} />
        <Route path="area-alerts" element={<AreaAlerts />} />
        <Route path="broadcast" element={<Broadcast />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="feedback" element={<Feedback />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
import { useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'

// "/" takes a returning customer back to the last cart they scanned.
export default function RootRedirect() {
  const cartId = useSelector((state) => state.cart.details?._id)
  return <Navigate to={cartId ? `/c/${cartId}/menu` : '/not-found'} replace />
}

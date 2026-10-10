import { useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'

export default function RootRedirect() {
  const cartDetails = useSelector((state) => state.cart.details)

  const cartId = cartDetails?._id

  if (!cartId) {
    return <Navigate to="/not-found" replace />
  }

  return <Navigate to={`/c/${cartId}`} replace />
}
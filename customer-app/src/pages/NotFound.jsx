import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

import { Button, Page, StatusScreen } from '../components/ui'

export default function NotFound() {
  const navigate = useNavigate()
  const cart = useSelector((state) => state.cart.details)

  return (
    <Page className='bg-surface'>
      <StatusScreen
        icon='📷'
        tone='grey'
        title='Scan a cart to start'
        message="This link doesn't lead to a cart. Scan the QR code on a GullyEats cart to see its menu."
      >
        {cart?._id && <Button onClick={() => navigate(`/c/${cart._id}/menu`)}>Back to {cart.cartName}</Button>}
        <Button variant={cart?._id ? 'secondary' : 'primary'} onClick={() => navigate('/')}>
          Find carts near me
        </Button>
      </StatusScreen>
    </Page>
  )
}

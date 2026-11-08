import { useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'

import { Button, Page, StatusScreen } from '../components/ui'

export default function ThankYou() {
  const navigate = useNavigate()
  const { cartId } = useParams()
  const cartName = useSelector((state) => state.cart.details?.cartName)

  return (
    <Page className='bg-surface'>
      <StatusScreen
        icon='🧡'
        title='Thanks for your feedback!'
        message={`Hope to see you again at ${cartName || 'this cart'}.`}
      >
        <Button onClick={() => navigate(`/c/${cartId}/menu`, { replace: true })}>Order again</Button>
        <Button variant='secondary' onClick={() => navigate('/confessions')}>
          🤫 Read GullyPulse confessions
        </Button>
      </StatusScreen>
      <p className='pb-safe text-center text-xs text-grey-400'>
        Powered by <span className='font-semibold text-primary'>GullyEats</span>
      </p>
    </Page>
  )
}

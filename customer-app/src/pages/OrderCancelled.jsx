import { useNavigate } from 'react-router-dom'

import { Button, LoadingScreen, Page, StatusScreen } from '../components/ui'
import useOrder from '../hooks/useOrder'
import { rupees } from '../utils/format'

export default function OrderCancelled() {
  const navigate = useNavigate()
  const { order, cartId } = useOrder({ page: '/cancelled' })

  if (!order) {
    return (
      <Page>
        <LoadingScreen blocks={['h-40', 'h-24', 'h-13']} />
      </Page>
    )
  }

  const adjustment = order.paymentAdjustment
  const refund = adjustment?.action === 'RETURN' ? Number(adjustment.amount || 0) : 0

  return (
    <Page className='bg-surface'>
      <StatusScreen
        icon='✕'
        tone='danger'
        title='Order cancelled'
        message={
          refund > 0
            ? `Token #${order.orderNumber} was cancelled.`
            : `Token #${order.orderNumber} was cancelled. You weren't charged anything.`
        }
      >
        {refund > 0 && (
          <div className='rounded-card bg-primary-soft px-5 py-4 text-center'>
            <p className='text-sm text-grey-600'>Collect your money back from the vendor</p>
            <p className='mt-1 text-3xl font-bold text-primary'>{rupees(refund)}</p>
          </div>
        )}
        <Button onClick={() => navigate(`/c/${cartId}/menu`, { replace: true })}>Order something else</Button>
      </StatusScreen>
    </Page>
  )
}

import { useNavigate } from 'react-router-dom'

import { Button, LoadingScreen, Page, StatusScreen } from '../components/ui'
import RefundNote from '../components/RefundNote'
import useOrder from '../hooks/useOrder'

export default function OrderCancelled() {
  const navigate = useNavigate()
  const { order, setOrder, cartId } = useOrder({ page: '/cancelled' })

  if (!order) {
    return (
      <Page>
        <LoadingScreen blocks={['h-40', 'h-24', 'h-13']} />
      </Page>
    )
  }

  const paidBack = (order.refunds?.length ? order.refunds.reduce((t, r) => t + r.amount, 0) : 0) ||
    (order.paymentAdjustment?.action === 'RETURN' ? Number(order.paymentAdjustment.amount || 0) : 0)

  return (
    <Page className='bg-surface'>
      <StatusScreen
        icon='✕'
        tone='danger'
        title='Order cancelled'
        message={
          paidBack > 0
            ? `Token #${order.orderNumber} was cancelled.`
            : `Token #${order.orderNumber} was cancelled. You weren't charged anything.`
        }
      >
        <RefundNote order={order} onChange={setOrder} large />
        <Button onClick={() => navigate(`/c/${cartId}/menu`, { replace: true })}>Order something else</Button>
      </StatusScreen>
    </Page>
  )
}

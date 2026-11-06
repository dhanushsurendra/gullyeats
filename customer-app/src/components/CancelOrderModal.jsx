import { useEffect } from 'react'
import { RiDeleteBinLine } from 'react-icons/ri'
import { Button } from './ui'

// Bottom sheet asking the customer to confirm cancelling their order.
export default function CancelOrderModal({ token, onCancel, onKeepWaiting, cancelling, error }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onKeepWaiting()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKeepWaiting])

  return (
    <div className='fixed inset-0 z-50 flex items-end justify-center'>
      <div className='animate-fade absolute inset-0 bg-grey-900/40 backdrop-blur-[2px]' onClick={onKeepWaiting} />
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='cancel-title'
        className='animate-sheet pb-safe relative w-full max-w-md rounded-t-[28px] bg-white px-5 pt-3'
      >
        <div className='mx-auto h-1 w-10 rounded-full bg-grey-200' />
        <div className='mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger'>
          <RiDeleteBinLine size={26} />
        </div>
        <h2 id='cancel-title' className='mt-4 text-xl font-semibold'>
          Cancel token #{token}?
        </h2>
        <p className='mt-1.5 text-sm leading-relaxed text-grey-500'>
          You'll lose your place in the queue and need to order again.
        </p>
        {error && <p className='mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger'>{error}</p>}
        <div className='mt-6 space-y-2.5'>
          <Button variant='dangerSolid' onClick={onCancel} loading={cancelling}>
            Yes, cancel order
          </Button>
          <Button variant='secondary' onClick={onKeepWaiting} disabled={cancelling}>
            Keep my order
          </Button>
        </div>
      </div>
    </div>
  )
}

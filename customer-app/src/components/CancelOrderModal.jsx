import Button from './Button'

export default function CancelOrderModal({
  orderId,
  onCancel,
  onKeepWaiting,
}) {
  return (
    <div className='fixed inset-0 z-100 bg-black/50 flex items-center justify-center px-5'>

      <div className='
        w-full
        max-w-90
        bg-white
        rounded-2xl
        px-4
        py-5
        text-center
        shadow-2xl
      '>

        <h2 className='text-[17px] font-bold text-grey-900'>
          Cancel this order?
        </h2>

        <p className='text-[9px] text-grey-500 mt-1'>
          You will lose your token and your place in the queue.
        </p>

        {/* Token */}
        <div className='
          mt-3
          bg-grey-50
          border
          border-grey-200
          rounded-xl
          px-3
          py-2.5
        '>
          <p className='text-[8px] text-primary font-bold uppercase'>
            Your Token
          </p>

          <p className='text-[22px] leading-tight font-bold text-grey-900'>
            #{orderId}
          </p>

          <p className='text-[8px] text-red-500 mt-1'>
            Token will be removed permanently.
          </p>
        </div>

        {/* Warning */}
        <div className='
          mt-2.5
          bg-[#FFF0F0]
          rounded-xl
          px-3
          py-2.5
          text-left
        '>
          <p className='text-[9px] text-red-500 font-bold'>
            Important
          </p>

          <p className='text-[9px] text-red-500 mt-0.5'>
            If you cancel now, you must place a new order.
          </p>
        </div>

        {/* Cancel */}
        <button
          onClick={onCancel}
          className='
            w-full
            h-10
            mt-3
            rounded-full
            bg-[#FF666B]
            text-white
            text-[10px]
            font-bold
            active:scale-[0.98]
            transition
          '
        >
          YES, CANCEL ORDER
        </button>

        {/* Keep waiting */}
        <button
          onClick={onKeepWaiting}
          className='
            w-full
            h-10
            mt-2
            rounded-full
            border
            border-grey-200
            bg-white
            text-grey-900
            text-[10px]
            font-bold
            active:scale-[0.98]
            transition
          '
        >
          NO, KEEP WAITING
        </button>

        <p className='text-[8px] text-grey-400 mt-3'>
          Only unpaid orders can be cancelled.
        </p>

      </div>
    </div>
  )
}
export default function CancelOrderModal({ orderId, onCancel, onKeepWaiting }) {
  return (
    <div className='fixed inset-0 z-100 flex items-center justify-center bg-black/40 px-5 backdrop-blur-[2px]' onClick={onKeepWaiting}>
      <div
        className='
          w-full
          max-w-90
          overflow-hidden
          rounded-2xl
          bg-white
          shadow-2xl
          animate-[modalIn_0.2s_ease-out]
        '
      >
        {/* Header */}
        <div className='px-5 pt-5 text-center'>
          <div
            className='
                mx-auto
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-full
                bg-red-50
                text-red-500
              '
          >
            <svg
              viewBox='0 0 24 24'
              fill='none'
              className='h-6 w-6'
              stroke='currentColor'
              strokeWidth='1.8'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <path d='M5 7h14' />
              <path d='M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7' />
              <path d='M7 7l.8 12.2a1.9 1.9 0 0 0 1.9 1.8h4.6a1.9 1.9 0 0 0 1.9-1.8L17 7' />
              <path d='M10 11v6' />
              <path d='M14 11v6' />
            </svg>
          </div>

          <h2 className='mt-3 text-base font-bold text-grey-900'>
            Cancel this order?
          </h2>

          <p className='mt-1 text-[11px] leading-relaxed text-grey-500'>
            Are you sure you want to cancel your order?
          </p>
        </div>

        {/* Token */}
        <div className='mx-5 mt-4 rounded-xl border border-grey-200 bg-grey-50 px-4 py-3 text-center'>
          <p className='text-[9px] font-semibold uppercase tracking-wide text-grey-500'>
            Your Token
          </p>

          <p className='mt-0.5 text-xl font-bold leading-tight text-grey-900'>
            #{orderId}
          </p>
        </div>

        {/* Warning */}
        <div className='mx-5 mt-3 rounded-xl bg-lightOrange px-3.5 py-3'>
          <p className='text-[10px] font-semibold text-primary'>Please note</p>

          <p className='mt-0.5 text-[10px] leading-relaxed text-grey-600'>
            Cancelling means you'll lose this token and need to place a new
            order.
          </p>
        </div>

        {/* Actions */}
        <div className='px-5 pb-5 pt-4'>
          <button
            type='button'
            onClick={onCancel}
            className='
              w-full
              rounded-full
              bg-red-500
              py-3
              text-[11px]
              font-bold
              text-white
              transition-all
              duration-200
              hover:bg-red-600
              active:scale-[0.98]
            '
          >
            YES, CANCEL ORDER
          </button>

          <button
            type='button'
            onClick={onKeepWaiting}
            className='
              mt-2
              w-full
              rounded-full
              border
              border-grey-200
              bg-white
              py-3
              text-[11px]
              font-bold
              text-grey-800
              transition-all
              duration-200
              hover:bg-grey-50
              active:scale-[0.98]
            '
          >
            KEEP MY ORDER
          </button>

          <p className='mt-3 text-center text-[9px] text-grey-400'>
            Only unpaid orders can be cancelled.
          </p>
        </div>
      </div>
    </div>
  )
}

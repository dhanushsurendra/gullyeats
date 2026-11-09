import { useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'

import { Button, Page } from '../components/ui'

export default function ThankYou() {
  const navigate = useNavigate()
  const { cartId } = useParams()
  const cartName = useSelector((state) => state.cart.details?.cartName)

  return (
    <Page className='bg-surface'>
      <main className='flex flex-1 flex-col justify-center px-5 py-10'>
        <section className='animate-fade-up rounded-card bg-linear-to-br from-night-deep via-night to-night-soft p-6 text-center text-white shadow-card'>
          <p className='animate-pop text-5xl' aria-hidden>
            🧡
          </p>
          <h1 className='mt-4 text-xl font-bold'>Thanks for your feedback!</h1>
          <p className='mt-2 text-sm text-white/75'>Hope to see you again at {cartName || 'this cart'}.</p>
          <div className='mt-6 space-y-3'>
            <Button onClick={() => navigate(`/c/${cartId}/menu`, { replace: true })}>Order again</Button>
            <button
              type='button'
              onClick={() => navigate('/confessions')}
              className='flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-white/10 text-[15px] font-semibold text-white ring-1 ring-white/15 transition active:scale-[0.98]'
            >
              🤫 Read GullyPulse confessions
            </button>
          </div>
        </section>
      </main>
      <p className='pb-safe text-center text-xs text-grey-400'>
        Powered by <span className='font-semibold text-primary'>GullyEats</span>
      </p>
    </Page>
  )
}

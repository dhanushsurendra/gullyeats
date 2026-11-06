import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiCheckLine } from 'react-icons/ri'

import { Button, Card, LoadingScreen, Page } from '../components/ui'
import { api } from '../constants/api'
import useOrder from '../hooks/useOrder'

const CHOICES = ['Tasty food 😋', 'Quick service ⚡', 'Good value 💰', 'Wait felt long ⏳', "I'll be back 🔁"]

export default function OrderServed() {
  const navigate = useNavigate()
  const { order, cartId, orderId } = useOrder({ page: '/served' })
  const [picked, setPicked] = useState([])
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const thankYou = () => navigate(`/c/${cartId}/order/${orderId}/thank-you`, { replace: true })
  const feedback = [...picked, note.trim()].filter(Boolean).join(' · ')

  const send = async () => {
    setSending(true)
    setError('')
    try {
      await api(`/orders/submit-feedback/${orderId}`, { method: 'PUT', body: { feedback } })
      thankYou()
    } catch (e) {
      setError(e.message)
      setSending(false)
    }
  }

  if (!order) {
    return (
      <Page>
        <LoadingScreen />
      </Page>
    )
  }

  return (
    <Page className='bg-white'>
      <main className='flex-1 px-5 pt-14'>
        <div className='text-center'>
          <div className='animate-pop mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-success text-white ring-8 ring-success-soft'>
            <RiCheckLine size={52} />
          </div>
          <h1 className='animate-fade-up mt-6 text-2xl font-bold'>Your food is ready!</h1>
          <p className='animate-fade-up mt-1 text-[15px] text-grey-500'>
            Token <b className='text-grey-900'>#{order.orderNumber}</b> has been served. Enjoy your meal!
          </p>
        </div>

        <Card tone='bg-grey-50 ring-1 ring-grey-200/70' className='animate-fade-up mt-10 [animation-delay:120ms]'>
          <h2 className='text-[15px] font-semibold'>How was it?</h2>
          <p className='text-sm text-grey-500'>Tap any that fit. The vendor sees this.</p>
          <div className='mt-4 flex flex-wrap gap-2'>
            {CHOICES.map((choice) => {
              const on = picked.includes(choice)
              return (
                <button
                  key={choice}
                  type='button'
                  aria-pressed={on}
                  onClick={() => setPicked((p) => (on ? p.filter((c) => c !== choice) : [...p, choice]))}
                  className={`rounded-full px-3.5 py-2 text-sm font-medium transition active:scale-95 ${
                    on ? 'bg-primary text-white' : 'bg-white text-grey-700 ring-1 ring-grey-200'
                  }`}
                >
                  {choice}
                </button>
              )
            })}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder='Anything else? (optional)'
            aria-label='Your feedback'
            className='mt-4 w-full resize-none rounded-xl bg-white px-4 py-3 text-[15px] outline-none ring-1 ring-grey-200 placeholder:text-grey-400 focus:ring-2 focus:ring-primary/40'
          />
          {error && <p className='mt-2 text-sm text-danger'>{error}</p>}
        </Card>
      </main>

      <div className='pb-safe space-y-1 px-5 pt-4'>
        <Button onClick={send} loading={sending} disabled={!feedback}>
          Send feedback
        </Button>
        <Button variant='ghost' onClick={thankYou}>
          Skip
        </Button>
      </div>
    </Page>
  )
}

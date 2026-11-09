import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiCheckLine, RiStarFill } from 'react-icons/ri'

import { Button, Card, LoadingScreen, Page } from '../components/ui'
import { api } from '../constants/api'
import useOrder from '../hooks/useOrder'

const STAR_LABELS = ['Bad', 'Not great', 'Okay', 'Good', 'Loved it']
const CHOICES = ['Tasty food 😋', 'Quick service ⚡', 'Good value 💰', 'Wait felt long ⏳', "I'll be back 🔁"]

export default function OrderServed() {
  const navigate = useNavigate()
  const { order, cartId, orderId } = useOrder({ page: '/served' })
  const [rating, setRating] = useState(0)
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
      await api(`/orders/submit-feedback/${orderId}`, {
        method: 'PUT',
        body: { feedback, ...(rating ? { rating } : {}) },
      })
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
    <Page className='bg-surface'>
      <main className='flex-1 px-5 pt-6'>
        {/* The happiest moment of the order: a night-purple celebration. */}
        <section className='animate-fade-up rounded-card bg-linear-to-br from-night-deep via-night to-night-soft px-5 pb-7 pt-8 text-center text-white shadow-card'>
          <div className='animate-pop mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary ring-8 ring-primary/25'>
            <RiCheckLine size={44} />
          </div>
          <p className='mt-5 text-xs font-bold uppercase tracking-wider text-lilac'>Token #{order.orderNumber}</p>
          <h1 className='mt-1 text-2xl font-bold'>Your food is ready!</h1>
          <p className='mt-1 text-[15px] text-white/75'>It’s been served. Enjoy your meal 🧡</p>
        </section>

        <Card tone='bg-grey-50 ring-1 ring-grey-200/70' className='animate-fade-up mt-6 [animation-delay:120ms]'>
          <h2 className='text-[15px] font-semibold'>How was it?</h2>
          <div className='mt-3 flex items-center gap-1' role='radiogroup' aria-label='Rating'>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type='button'
                role='radio'
                aria-checked={rating === star}
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
                onClick={() => setRating(star)}
                className={`p-1 transition active:scale-90 ${star <= rating ? 'text-amber-400' : 'text-grey-200'}`}
              >
                <RiStarFill size={36} />
              </button>
            ))}
            {rating > 0 && <span className='ml-2 text-sm font-medium text-grey-600'>{STAR_LABELS[rating - 1]}</span>}
          </div>
          <p className='mt-4 text-sm text-grey-500'>Tap any that fit. The vendor sees this.</p>
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
                    on ? 'bg-primary text-white' : 'bg-surface text-grey-700 ring-1 ring-grey-200'
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
            className='mt-4 w-full resize-none rounded-xl bg-surface px-4 py-3 text-[15px] outline-none ring-1 ring-grey-200 placeholder:text-grey-400 focus:ring-2 focus:ring-primary/40'
          />
          {error && <p className='mt-2 text-sm text-danger'>{error}</p>}
        </Card>
      </main>

      <div className='pb-safe space-y-1 px-5 pt-4'>
        <Button onClick={send} loading={sending} disabled={!feedback && !rating}>
          Send feedback
        </Button>
        <Button variant='ghost' onClick={thankYou}>
          Skip
        </Button>
      </div>
    </Page>
  )
}

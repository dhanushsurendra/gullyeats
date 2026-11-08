import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { RiShieldCheckLine, RiSpyLine } from 'react-icons/ri'

import { BottomBar, Button, LoadingScreen, Page, StatusScreen, TopBar } from '../components/ui'
import { pulse, usePulseKey } from '../utils/pulse'

const MAX = 500
const MIN = 10
const RULES = [
  'No names, phone numbers or details that point to a real person',
  'No abuse, hate, threats or sexual content',
  'Posts that break these rules are removed',
]

export default function ConfessionNew() {
  const navigate = useNavigate()
  // Where to go after posting: the page that opened this one (e.g. the token
  // page, so a waiting customer is back at their order), else the feed.
  const { state } = useLocation()
  const from = state?.from || '/confessions'
  const key = usePulseKey()
  // A starter line picked on the token page ("I secretly ").
  const [text, setText] = useState(state?.prefill || '')
  const [me, setMe] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null) // { message, blocked }
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!key) return undefined
    let live = true
    pulse(key, '/me')
      .then((d) => live && setMe(d))
      .catch((e) => live && setMe({ eligible: false, message: e.message }))
    return () => {
      live = false
    }
  }, [key])

  const back = () => navigate(from, { replace: true })
  const length = text.trim().length
  // Only the starter line, nothing added yet.
  const onlyPrompt = Boolean(state?.prefill) && text.trim() === state.prefill.trim()

  const submit = async () => {
    setSending(true)
    setError(null)
    try {
      const r = await pulse(key, '', { method: 'POST', body: { text } })
      if (r.status === 'published') {
        navigate(from, { replace: true, state: { toast: 'Posted anonymously 🎉' } })
      } else {
        setResult(r.status)
      }
    } catch (e) {
      setError({ message: e.message, blocked: e.code === 'BLOCKED' })
      setSending(false)
    }
  }

  if (!key || me?.eligible === false) {
    return (
      <Page className='bg-surface'>
        <TopBar title='New confession' onBack={back} />
        <StatusScreen
          icon='🧾'
          title='Order first, then confess'
          message={me?.message || 'Only people who’ve ordered from a GullyEats cart can post. Scan a cart’s QR code and place an order to join in.'}
        >
          <Button variant='secondary' onClick={() => navigate('/confessions', { replace: true })}>
            Read confessions
          </Button>
        </StatusScreen>
      </Page>
    )
  }

  if (!me) {
    return (
      <Page>
        <LoadingScreen />
      </Page>
    )
  }

  if (me.suspendedUntil) {
    return (
      <Page className='bg-surface'>
        <TopBar title='New confession' onBack={back} />
        <StatusScreen
          icon='⏸️'
          tone='grey'
          title='Posting is paused'
          message={`Your GullyPulse posting is suspended until ${new Date(me.suspendedUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} for breaking community guidelines.`}
        >
          <Button variant='secondary' onClick={back}>
            Go back
          </Button>
        </StatusScreen>
      </Page>
    )
  }

  if (result === 'in_review') {
    return (
      <Page className='bg-surface'>
        <StatusScreen
          icon='🕵️'
          title='Sent for a quick review'
          message='Something in your confession needs a human look before it goes live. You can check it under My posts.'
        >
          <Button onClick={back}>{from === '/confessions' ? 'Back to confessions' : 'Done'}</Button>
        </StatusScreen>
      </Page>
    )
  }

  return (
    <Page className='bg-surface'>
      <TopBar title='New confession' subtitle='Posted as Anonymous' onBack={back} />
      <main className='flex-1 px-4 pt-4'>
        <div className='flex items-center gap-3 rounded-2xl bg-grey-50 px-4 py-3 ring-1 ring-grey-200/70'>
          <span className='flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white'>
            <RiSpyLine size={20} />
          </span>
          <p className='text-sm leading-snug text-grey-600'>
            Your name, number and order are <b className='text-grey-900'>never shown</b> to anyone.
          </p>
        </div>

        <label htmlFor='confession' className='sr-only'>
          Your confession
        </label>
        <textarea
          id='confession'
          autoFocus
          // Put the cursor after a starter line, not before it.
          onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (error) setError(null)
          }}
          maxLength={MAX}
          rows={8}
          placeholder='Say the thing you’ve never told anyone…'
          className='mt-4 w-full resize-none rounded-2xl bg-surface px-4 py-3 text-[17px] leading-relaxed outline-none ring-1 ring-grey-200 placeholder:text-grey-400 focus:ring-2 focus:ring-primary/40'
        />
        <div className='mt-1 flex justify-between px-1 text-xs text-grey-400'>
          <span>{length > 0 && length < MIN ? `${MIN - length} more characters` : ' '}</span>
          <span className={`tabular-nums ${text.length > MAX - 30 ? 'text-primary' : ''}`}>
            {text.length}/{MAX}
          </span>
        </div>

        {error && (
          <div
            role='alert'
            className={`animate-fade-up mt-3 rounded-2xl px-4 py-3 text-sm ${error.blocked ? 'bg-danger-soft text-danger' : 'bg-amber-50 text-amber-800'}`}
          >
            <p className='font-semibold'>{error.blocked ? 'Can’t post this' : 'Couldn’t post'}</p>
            <p className='mt-0.5'>{error.message}</p>
          </div>
        )}

        <section className='mt-5 rounded-2xl bg-grey-50 p-4'>
          <h2 className='flex items-center gap-2 text-sm font-semibold'>
            <RiShieldCheckLine size={18} className='text-success' /> Community guidelines
          </h2>
          <ul className='mt-2 space-y-1.5 text-sm text-grey-600'>
            {RULES.map((r) => (
              <li key={r} className='flex gap-2'>
                <span aria-hidden className='text-grey-400'>•</span>
                {r}
              </li>
            ))}
          </ul>
        </section>
      </main>
      <BottomBar>
        <Button onClick={submit} loading={sending} disabled={length < MIN || onlyPrompt}>
          Post anonymously
        </Button>
      </BottomBar>
    </Page>
  )
}

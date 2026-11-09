import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { RiArrowRightSLine, RiCheckboxCircleFill, RiPhoneLine } from 'react-icons/ri'

import { setPhoneNumber } from '../store/cartSlice'
import { linkPhone } from '../utils/play'

/*
 * GullyPlay: offer to add a phone number to an order placed without one, so
 * the player keeps their leaderboard name and best scores across orders and
 * carts (backend gameController.linkPhone). Optional. `compact` starts as a
 * one-line link (the lobby); otherwise the form shows at once (results).
 */
export default function SavePlayer({ orderKey, compact = false, saved = false, onSaved }) {
  const dispatch = useDispatch()
  const [open, setOpen] = useState(!compact)
  const [phone, setPhone] = useState('')
  const [state, setState] = useState(saved ? 'saved' : 'idle') // idle | saving | saved
  const [error, setError] = useState('')
  const invalid = phone.length > 0 && !/^[6-9]\d{9}$/.test(phone)

  const save = async (e) => {
    e.preventDefault()
    if (!/^[6-9]\d{9}$/.test(phone)) return setError('Enter a valid 10-digit mobile number.')
    setState('saving')
    setError('')
    try {
      await linkPhone(orderKey, phone)
      dispatch(setPhoneNumber(phone)) // prefilled at the next checkout
      setState('saved')
      onSaved?.()
    } catch (err) {
      setState('idle')
      setError(err.message)
    }
  }

  if (state === 'saved') {
    return (
      <p role='status' className='mt-4 flex w-full items-center gap-2 rounded-2xl bg-[#22c55e]/15 px-4 py-3 text-left text-sm ring-1 ring-[#22c55e]/40'>
        <RiCheckboxCircleFill className='shrink-0 text-[#22c55e]' size={18} />
        Saved. Order with this number and you’re the same player, at any cart.
      </p>
    )
  }

  if (!open) {
    return (
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='mt-4 flex w-full items-center gap-3 rounded-2xl bg-[#7df9ff]/10 px-4 py-3 text-left ring-1 ring-[#7df9ff]/40 transition active:scale-[0.98]'
      >
        <RiPhoneLine size={20} className='shrink-0 text-[#7df9ff]' />
        <span className='min-w-0 flex-1'>
          <span className='block text-sm font-semibold'>Keep your rank across orders</span>
          <span className='block text-xs text-white/60'>Add your number (optional)</span>
        </span>
        <RiArrowRightSLine size={20} className='shrink-0 text-white/60' />
      </button>
    )
  }

  return (
    <form onSubmit={save} className='mt-4 w-full rounded-2xl bg-white/5 p-4 text-left ring-1 ring-white/10'>
      <label htmlFor='save-phone' className='text-sm font-semibold'>
        Keep your rank <span className='font-normal text-white/50'>(optional)</span>
      </label>
      <p className='mt-0.5 text-xs text-white/60'>
        Add your number to keep your leaderboard name and best scores on every order, at any cart. The cart can see it for this order.{' '}
        <a href='/terms.html#privacy' target='_blank' rel='noopener' className='underline underline-offset-2'>
          Privacy
        </a>
      </p>
      <div className='mt-3 flex gap-2'>
        <div
          className={`flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-white/10 px-3 ring-1 transition focus-within:ring-2 ${
            invalid || error ? 'ring-[#ff6b6b]/60' : 'ring-transparent focus-within:ring-[#7df9ff]/50'
          }`}
        >
          <span className='text-sm text-white/50'>+91</span>
          <input
            id='save-phone'
            type='tel'
            inputMode='numeric'
            autoComplete='tel-national'
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, '').slice(-10))
              setError('')
            }}
            placeholder='98765 43210'
            className='w-full min-w-0 bg-transparent text-sm tracking-wide outline-none placeholder:text-white/30'
          />
        </div>
        <button
          type='submit'
          disabled={state === 'saving' || phone.length !== 10}
          className='h-11 shrink-0 rounded-xl bg-[#7df9ff] px-4 text-sm font-bold text-[#1c0b33] transition active:scale-95 disabled:opacity-40'
        >
          {state === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && (
        <p role='alert' className='mt-2 text-xs text-[#ff6b6b]'>
          {error}
        </p>
      )}
    </form>
  )
}

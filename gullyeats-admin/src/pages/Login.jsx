import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Loader2, LockKeyhole, XCircle } from 'lucide-react'
import { login } from '../store/authSlice'

export default function Login() {
  const dispatch = useDispatch()
  const nav = useNavigate()

  const { loading, error } = useSelector((s) => s.auth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = async (e) => {
    e.preventDefault()

    try {
      await dispatch(
        login({
          email,
          password,
        }),
      ).unwrap()

      nav('/')
    } catch (err) {
      console.error('Login failed:', err)
    }
  }

  return (
    <div className='grid min-h-screen bg-canvas text-ink dark:bg-[#0c0a14] dark:text-[#ecebf2] lg:grid-cols-[1.05fr_.95fr]'>
      {/* Login Error Toast */}
      {error && (
        <div
          role='alert'
          className='fixed right-5 top-5 z-[100] flex max-w-sm items-center gap-3 rounded-2xl border border-red-200
          bg-white px-4 py-3 text-sm text-red-600 shadow-float dark:border-red-900 dark:bg-[#16131f] dark:text-red-400'
        >
          <XCircle size={18} className='shrink-0' />
          <span>{error}</span>
        </div>
      )}

      {/* Left Panel: night purple, the same as GullyPlay and the vendor sales card */}
      <div className='relative hidden flex-col overflow-hidden bg-gradient-to-br from-night-deep via-night to-night-soft p-12 text-white lg:flex'>
        <div className='pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand/30 blur-3xl' />
        <div className='pointer-events-none absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-lilac/20 blur-3xl' />
        {/* A faint grid, for depth */}
        <div className='pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:44px_44px]' />

        <div className='relative flex items-center gap-2.5'>
          <div className='text-xl font-extrabold tracking-tight'>
            <span className='text-brand'>Gully</span>Eats
          </div>
        </div>

        <div className='relative mt-auto max-w-xl pb-8'>
          <p className='mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[.18em] text-lilac ring-1 ring-white/15'>
            <i className='pulse-dot h-1.5 w-1.5 rounded-full bg-brand' /> Platform control center
          </p>
          <h1 className='text-[52px] font-extrabold leading-[1.02] tracking-[-.035em]'>
            Run every <span className='text-brand'>GullyEats</span> cart from one place.
          </h1>
          <p className='mt-5 max-w-md text-[15px] leading-7 text-white/65'>
            Owners, carts, orders, revenue, fees and GullyPulse moderation, live, in one focused workspace.
          </p>
          <div className='mt-8 flex flex-wrap gap-2.5'>
            {['Live cart map', 'Fee collections', 'Business insights', 'Moderation'].map((t) => (
              <span key={t} className='rounded-full bg-white/[0.07] px-3.5 py-1.5 text-[12px] font-semibold text-white/80 ring-1 ring-white/10'>
                {t}
              </span>
            ))}
          </div>
        </div>

        <small className='relative text-white/40'>Super Admin access</small>
      </div>

      {/* Right Panel */}
      <div className='flex min-h-screen items-center justify-center p-5'>
        <form
          onSubmit={submit}
          className='rise w-full max-w-[400px] rounded-3xl border border-line bg-white p-8 shadow-float
          dark:border-[#2a2538] dark:bg-[#16131f]'
        >
          <div className='mb-7'>
            <div className='mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-night to-night-soft text-white shadow-[0_8px_20px_-6px_rgba(26,15,69,.6)]'>
              <LockKeyhole size={20} />
            </div>
            <h2 className='text-[26px] font-extrabold tracking-tight'>Welcome back</h2>
            <p className='mt-1.5 text-sm text-neutral-500 dark:text-[#9b97ab]'>
              Sign in to the GullyEats Super Admin console.
            </p>
          </div>

          <label className='mb-4 block text-xs font-semibold'>
            Email
            <input
              type='email'
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='admin@gullyeats.com'
              autoComplete='username'
              className='mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-3
              text-ink outline-none transition placeholder:text-neutral-400
              focus:border-brand focus:ring-4 focus:ring-brand/15
              dark:border-[#2a2538] dark:bg-[#0c0a14] dark:text-[#ecebf2] dark:placeholder:text-[#6f6a80]'
            />
          </label>

          <label className='mb-5 block text-xs font-semibold'>
            Password
            <input
              type='password'
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder='Enter password'
              autoComplete='current-password'
              className='mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-3
              text-ink outline-none transition placeholder:text-neutral-400
              focus:border-brand focus:ring-4 focus:ring-brand/15
              dark:border-[#2a2538] dark:bg-[#0c0a14] dark:text-[#ecebf2] dark:placeholder:text-[#6f6a80]'
            />
          </label>

          <button
            type='submit'
            disabled={loading}
            className='flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold
            text-white shadow-glow transition hover:bg-brand-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60'
          >
            {loading && <Loader2 size={15} className='animate-spin' />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className='mt-5 text-center text-[11px] text-neutral-400'>Super Admin access only</p>
        </form>
      </div>
    </div>
  )
}

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
    <div
      className='grid min-h-screen bg-[#f6f6f5] text-[#1f2023]
      dark:bg-[#121214] dark:text-[#ececee]
      lg:grid-cols-[1.05fr_.95fr]'
    >
      {/* Login Error Toast */}
      {error && (
        <div
          role='alert'
          className='fixed right-5 top-5 z-[100]
          flex max-w-sm items-center gap-3
          rounded-xl border border-[#fecaca]
          bg-white px-4 py-3
          text-sm text-[#dc2626]
          shadow-[0_10px_35px_rgba(0,0,0,.12)]
          dark:border-[#7f1d1d]
          dark:bg-[#1b1b1e]
          dark:text-[#f87171]'
        >
          <XCircle
            size={18}
            className='shrink-0'
          />

          <span>{error}</span>
        </div>
      )}

      {/* Left Panel */}
      <div
        className='relative hidden flex-col overflow-hidden
        bg-[#171719] p-10 text-white
        dark:bg-[#0d0d0f]
        lg:flex'
      >
        <div className='text-xl font-bold'>
          <span className='text-[#f97316]'>Gully</span>Eats
        </div>

        <div className='mt-auto max-w-xl pb-10'>
          <p
            className='mb-3 text-xs font-semibold uppercase
            tracking-[.18em] text-[#f97316]'
          >
            Platform control center
          </p>

          <h1
            className='text-5xl font-semibold leading-[1.05]
            tracking-[-.04em]'
          >
            Run the entire GullyEats network from one place.
          </h1>

          <p className='mt-5 text-sm leading-6 text-white/55'>
            Monitor owners, restaurants, orders, revenue, payments and
            platform health in one focused workspace.
          </p>
        </div>

        <small className='text-white/40'>
          Super Admin access
        </small>
      </div>

      {/* Right Panel */}
      <div
        className='flex min-h-screen items-center justify-center
        bg-[#f6f6f5] p-5 dark:bg-[#121214]'
      >
        <form
          onSubmit={submit}
          className='w-full max-w-97.5 rounded-2xl
          border border-[#e7e7e4]
          bg-white p-7
          shadow-[0_10px_40px_rgba(20,20,20,.06)]
          dark:border-[#2c2c31]
          dark:bg-[#1b1b1e]
          dark:shadow-[0_10px_40px_rgba(0,0,0,.25)]'
        >
          {/* Header */}
          <div className='mb-7'>
            <div
              className='mb-4 grid h-10 w-10 place-items-center
              rounded-xl bg-[#fff1e6] text-[#f97316]
              dark:bg-[rgba(249,115,22,0.16)]'
            >
              <LockKeyhole size={18} />
            </div>

            <h2
              className='text-2xl font-semibold
              text-[#1f2023] dark:text-[#ececee]'
            >
              Welcome back
            </h2>

            <p
              className='mt-1.5 text-sm
              text-[#6b6e76] dark:text-[#9a9da6]'
            >
              Sign in to the GullyEats Super Admin console.
            </p>
          </div>

          {/* Email */}
          <label
            className='mb-4 block text-xs font-medium
            text-[#1f2023] dark:text-[#ececee]'
          >
            Email

            <input
              type='email'
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='Enter admin email'
              autoComplete='username'
              className='mt-1.5 w-full rounded-lg
              border border-[#e7e7e4]
              bg-white px-3 py-2.5
              text-[#1f2023]
              outline-none
              placeholder:text-[#9a9da6]
              focus:border-[#f97316]
              focus:ring-1 focus:ring-[#f97316]/20
              dark:border-[#2c2c31]
              dark:bg-[#121214]
              dark:text-[#ececee]
              dark:placeholder:text-[#6f727b]'
            />
          </label>

          {/* Password */}
          <label
            className='mb-4 block text-xs font-medium
            text-[#1f2023] dark:text-[#ececee]'
          >
            Password

            <input
              type='password'
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder='Enter password'
              autoComplete='current-password'
              className='mt-1.5 w-full rounded-lg
              border border-[#e7e7e4]
              bg-white px-3 py-2.5
              text-[#1f2023]
              outline-none
              placeholder:text-[#9a9da6]
              focus:border-[#f97316]
              focus:ring-1 focus:ring-[#f97316]/20
              dark:border-[#2c2c31]
              dark:bg-[#121214]
              dark:text-[#ececee]
              dark:placeholder:text-[#6f727b]'
            />
          </label>

          {/* Submit */}
          <button
            type='submit'
            disabled={loading}
            className='flex w-full items-center justify-center gap-2
            rounded-lg bg-[#f97316] px-4 py-2.5 text-sm
            font-semibold text-white transition
            hover:brightness-95
            disabled:cursor-not-allowed
            disabled:opacity-60'
          >
            {loading && (
              <Loader2
                size={15}
                className='animate-spin'
              />
            )}

            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <p
            className='mt-5 text-center text-[11px]
            text-[#9a9da6] dark:text-[#6f727b]'
          >
            Super Admin access only
          </p>
        </form>
      </div>
    </div>
  )
}
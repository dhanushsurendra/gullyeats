import { RiArrowLeftSLine, RiMoonLine, RiSunLine } from 'react-icons/ri'
import { useTheme } from '../utils/theme'

/* The shared building blocks every page is made of. */

// Phone-width column, centred on bigger screens.
export function Page({ children, className = '' }) {
  return (
    <div className={`mx-auto flex min-h-dvh w-full max-w-md flex-col bg-grey-50 ${className}`}>
      {children}
    </div>
  )
}

// Sun/moon button that switches between the light and dark theme.
export function ThemeToggle({ className = '' }) {
  const [theme, toggle] = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type='button'
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-90 ${className || 'text-grey-600 hover:bg-grey-100'}`}
    >
      {dark ? <RiSunLine size={20} /> : <RiMoonLine size={20} />}
    </button>
  )
}

export function TopBar({ title, subtitle, onBack, right }) {
  return (
    <header className='sticky top-0 z-30 border-b border-grey-200/70 bg-surface/90 backdrop-blur-md'>
      <div className='flex h-16 items-center gap-3 px-4'>
        {onBack && (
          <button
            type='button'
            onClick={onBack}
            aria-label='Back'
            className='-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-grey-800 transition hover:bg-grey-100 active:scale-90'
          >
            <RiArrowLeftSLine size={26} />
          </button>
        )}
        <div className='min-w-0 flex-1'>
          <h1 className='truncate text-base font-semibold leading-tight'>{title}</h1>
          {subtitle && <p className='truncate text-xs text-grey-500'>{subtitle}</p>}
        </div>
        {right}
        <ThemeToggle className='-mr-2 text-grey-600 hover:bg-grey-100' />
      </div>
    </header>
  )
}

const VARIANTS = {
  primary:
    'bg-primary text-white shadow-[0_6px_20px_-6px_rgb(254_82_0/0.6)] hover:bg-primary-dark disabled:bg-grey-300 disabled:shadow-none',
  secondary: 'bg-surface text-grey-900 ring-1 ring-grey-200 hover:bg-grey-50',
  danger: 'bg-surface text-danger ring-1 ring-danger/25 hover:bg-danger-soft',
  dangerSolid: 'bg-danger text-white hover:bg-red-700',
  ghost: 'text-grey-600 hover:bg-grey-100',
}

export function Button({ children, variant = 'primary', loading = false, className = '', ...props }) {
  return (
    <button
      type='button'
      {...props}
      disabled={props.disabled || loading}
      className={`flex h-13 w-full items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition active:scale-[0.98] disabled:active:scale-100 ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  )
}

// Footer pinned to the bottom of the screen, for a page's main action.
export function BottomBar({ children }) {
  return (
    <>
      <div className='h-36' aria-hidden />
      <div className='fixed inset-x-0 bottom-0 z-30'>
        <div className='pb-safe mx-auto w-full max-w-md border-t border-grey-200/70 bg-surface/95 px-4 pt-3 backdrop-blur-md'>
          {children}
        </div>
      </div>
    </>
  )
}

// Full-screen message: loading, errors, empty states and end screens.
export function StatusScreen({ icon, tone = 'primary', title, message, children }) {
  const tones = {
    primary: 'bg-primary-soft text-primary',
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
    grey: 'bg-grey-100 text-grey-500',
  }
  return (
    <div className='flex flex-1 flex-col items-center justify-center px-8 py-16 text-center'>
      {icon && (
        <div className={`animate-pop flex h-20 w-20 items-center justify-center rounded-full text-4xl ${tones[tone]}`}>
          {icon}
        </div>
      )}
      <h2 className='animate-fade-up mt-6 text-xl font-semibold'>{title}</h2>
      {message && (
        <p className='animate-fade-up mt-2 max-w-xs text-sm leading-relaxed text-grey-500'>{message}</p>
      )}
      {children && <div className='animate-fade-up mt-8 w-full max-w-xs space-y-3'>{children}</div>}
    </div>
  )
}

export function LoadingScreen({ label = 'Loading…' }) {
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-3 text-primary'>
      <Spinner className='h-8 w-8 border-[3px]' />
      <p className='text-sm text-grey-500'>{label}</p>
    </div>
  )
}

// White card. Pass `tone` for another background (a class like 'bg-ink'),
// since two bg- classes in one className don't reliably override each other.
export function Card({ children, className = '', tone = 'bg-surface shadow-card' }) {
  return <section className={`rounded-card p-4 ${tone} ${className}`}>{children}</section>
}

// Indian food-label mark: a dot in a square, green for veg, red for non-veg.
export function VegMark({ isVeg }) {
  return (
    <span
      role='img'
      aria-label={isVeg ? 'Veg' : 'Non-veg'}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] ${
        isVeg ? 'border-veg' : 'border-nonveg'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${isVeg ? 'bg-veg' : 'bg-nonveg'}`} />
    </span>
  )
}

export function Stepper({ quantity, onAdd, onRemove, name, canAdd = true }) {
  if (!quantity) {
    return (
      <button
        type='button'
        onClick={onAdd}
        aria-label={`Add ${name}`}
        className='h-9 min-w-21 rounded-xl bg-surface px-4 text-sm font-bold text-primary shadow-card ring-1 ring-primary/30 transition hover:bg-primary-soft active:scale-95'
      >
        ADD
      </button>
    )
  }
  const btn =
    'flex h-9 w-8 items-center justify-center text-lg font-semibold transition active:scale-75'
  return (
    <div className='animate-pop flex h-9 min-w-21 items-center justify-between rounded-xl bg-primary text-white shadow-card'>
      <button type='button' onClick={onRemove} aria-label={`Remove one ${name}`} className={btn}>
        −
      </button>
      <span className='text-sm font-bold tabular-nums' aria-live='polite'>
        {quantity}
      </span>
      <button
        type='button'
        onClick={onAdd}
        disabled={!canAdd}
        aria-label={`Add one more ${name}`}
        className={`${btn} disabled:opacity-40`}
      >
        +
      </button>
    </div>
  )
}

export function Row({ label, value, strong = false, className = '' }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${strong ? 'text-base font-semibold' : 'text-sm text-grey-600'} ${className}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${strong ? '' : 'text-grey-900'}`}>{value}</span>
    </div>
  )
}

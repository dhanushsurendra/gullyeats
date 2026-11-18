import { useState } from 'react'
import { AlertCircle, Download } from 'lucide-react'

export const Card = ({ className = '', children }) => (
  <div
    className={`rise rounded-2xl border border-line/80 bg-white shadow-card ${className}`}
  >
    {children}
  </div>
)

export const CardHeader = ({ title, subtitle, right }) => (
  <div className='flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4'>
    <div>
      <h3 className='text-[14px] font-bold tracking-tight'>{title}</h3>
      {subtitle && <p className='mt-0.5 text-[12px] text-neutral-500'>{subtitle}</p>}
    </div>
    {right}
  </div>
)

// Loading placeholder, never a spinner: shimmering lines for a list or
// table, or one block of `block` size classes for a chart or map.
export const Skeleton = ({ rows = 5, block }) => (
  <div role='status' aria-label='Loading' className='space-y-3 p-5'>
    {block ? (
      <div className={`skeleton ${block}`} />
    ) : (
      Array.from({ length: rows }, (_, i) => (
        <div key={i} className='skeleton h-4' style={{ width: `${100 - (i % 3) * 15}%` }} />
      ))
    )}
  </div>
)

export const ErrorNote = ({ message }) => (
  <div className='m-4 flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-[12.5px]
   text-red-700'>
    <AlertCircle size={15} className='mt-0.5 shrink-0' /> {message}
  </div>
)

// Wraps content with loading / error handling. `skeleton` replaces the
// default placeholder with one shaped like the content.
export const State = ({ loading, error, children, skeleton }) =>
  loading ? skeleton || <Skeleton /> : error ? <ErrorNote message={error} /> : children

export function Table({
  columns,
  rows = [],
  onRow,
  empty = 'Nothing to show yet.',
}) {
  return (
    <div className='overflow-x-auto'>
      <table className='w-full min-w-[640px] text-[13px]'>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className='whitespace-nowrap border-b border-line bg-neutral-50/70
                 px-5 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-neutral-500'
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr
                key={r.id || i}
                onClick={onRow ? () => onRow(r) : undefined}
                className={`border-b border-line transition-colors last:border-0 hover:bg-brand-50/50
                  ${onRow ? 'cursor-pointer' : ''}`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`whitespace-nowrap px-5 py-3 ${c.className || ''}`}
                  >
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className='px-4 py-10 text-center text-neutral-500'
              >
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export const Btn = ({ primary, className = '', ...p }) => (
  <button
    {...p}
    className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-all active:scale-[0.97] ${
      primary
        ? 'border-brand bg-brand text-white shadow-glow hover:bg-brand-600'
        : 'border-line bg-white hover:border-brand hover:text-brand'
    } ${className}`}
  />
)

export const Select = ({ children, ...p }) => (
  <select
    {...p}
    className='rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] font-medium
    outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15'
  >
    {children}
  </select>
)

export const Seg = ({ options, value, onChange }) => (
  // Scrolls inside itself when the screen is narrower than the options.
  <div className='inline-flex max-w-full overflow-x-auto rounded-full border border-line bg-white p-1'>
    {options.map(([k, label]) => (
      <button
        key={k}
        type='button'
        onClick={() => onChange(k)}
        className={`whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-semibold transition-all
           ${value === k ? 'bg-night text-white shadow-[0_4px_12px_-4px_rgba(26,15,69,.6)] dark:bg-[#3b2a7a]' : 'text-neutral-500 hover:text-ink'}`}
      >
        {label}
      </button>
    ))}
  </div>
)

// Bottom of a scroll-paged list: the trigger while more can load, a retry
// after a failed load, then an end note. Pass usePaged/useReveal's fields.
export const ScrollFooter = ({ sentinel, hasMore, loading, error, retry, count, noun = 'items' }) =>
  hasMore ? (
    <div ref={sentinel} className='py-6 text-center text-sm text-neutral-500'>
      {loading && count ? <Skeleton rows={2} /> : ''}
    </div>
  ) : error ? (
    <div className='py-6 text-center text-sm'>
      <button onClick={retry} className='font-medium text-brand hover:underline'>
        {count ? "Couldn't load more. Retry" : 'Retry'}
      </button>
    </div>
  ) : count ? (
    <div className='py-6 text-center text-sm text-neutral-500'>You've reached the end.</div>
  ) : null

// "Export CSV" button with a busy state; run() does the fetching and download.
export function ExportButton({ run, label = 'Export CSV', disabled = false }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const click = async () => {
    setBusy(true)
    setNote('')
    try {
      setNote((await run()) || '')
    } catch (e) {
      setNote(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <span className='inline-flex items-center gap-2'>
      {note && <span className='text-[11.5px] text-neutral-500'>{note}</span>}
      <Btn onClick={click} disabled={busy || disabled} className='inline-flex items-center gap-1 disabled:opacity-50'>
        <Download size={12} /> {busy ? 'Preparing…' : label}
      </Btn>
    </span>
  )
}

// In-app replacement for window.confirm / prompt / alert. Mount <DialogHost />
// once; ask() resolves to null on cancel, the typed text when `input` is set,
// else true.
let openDialog = () => Promise.resolve(null)
export const ask = (opts) => openDialog(opts)

export function DialogHost() {
  const [d, setD] = useState(null)
  const [text, setText] = useState('')
  openDialog = (opts) =>
    new Promise((resolve) => {
      setText('')
      setD({ ...opts, resolve })
    })
  if (!d) return null
  const close = (v) => {
    d.resolve(v)
    setD(null)
  }
  const ok = (e) => {
    e.preventDefault()
    close(d.input ? text.trim() : true)
  }
  return (
    <div
      className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm'
      onMouseDown={(e) => e.target === e.currentTarget && close(null)}
      onKeyDown={(e) => e.key === 'Escape' && close(null)}
    >
      <form
        onSubmit={ok}
        role='dialog'
        aria-modal='true'
        aria-labelledby='dlg-title'
        className='rise w-full max-w-md rounded-2xl border border-line/80 bg-white p-5 shadow-card'
      >
        <h3 id='dlg-title' className='text-[15px] font-bold tracking-tight'>{d.title}</h3>
        {d.message && (
          <p className='mt-1.5 whitespace-pre-line text-[13px] text-neutral-500'>{d.message}</p>
        )}
        {d.input && (
          <label className='mt-4 flex flex-col gap-1 text-[12px] font-medium text-neutral-500'>
            {d.input}
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              className='rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none
               transition focus:border-brand focus:ring-2 focus:ring-brand/15'
            />
          </label>
        )}
        <div className='mt-5 flex justify-end gap-2'>
          {!d.alert && (
            <Btn type='button' onClick={() => close(null)}>Cancel</Btn>
          )}
          <Btn
            primary
            autoFocus={!d.input}
            className={d.danger ? '!border-red-600 !bg-red-600 hover:!bg-red-700' : ''}
          >
            {d.confirm || 'OK'}
          </Btn>
        </div>
      </form>
    </div>
  )
}

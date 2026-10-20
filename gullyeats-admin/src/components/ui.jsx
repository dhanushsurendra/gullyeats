import { Loader2, AlertCircle } from 'lucide-react'

export const Card = ({ className = '', children }) => (
  <div
    className={`rounded-[10px] border border-line b
      g-white shadow-[0_1px_2px_rgba(20,20,20,.05)] ${className}`}
  >
    {children}
  </div>
)

export const CardHeader = ({ title, subtitle, right }) => (
  <div className='flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3'>
    <div>
      <h3 className='text-[13px] font-semibold'>{title}</h3>
      {subtitle && <p className='text-[11.5px] text-neutral-500'>{subtitle}</p>}
    </div>
    {right}
  </div>
)

export const Spinner = () => (
  <div className='flex items-center justify-center gap-2 py-10 text-neutral-500'>
    <Loader2 size={15} className='animate-spin' /> Loading…
  </div>
)

export const ErrorNote = ({ message }) => (
  <div className='m-4 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-[12.5px]
   text-red-700'>
    <AlertCircle size={15} className='mt-0.5 shrink-0' /> {message}
  </div>
)

// Wraps content with loading / error handling
export const State = ({ loading, error, children }) =>
  loading ? <Spinner /> : error ? <ErrorNote message={error} /> : children

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
                className='whitespace-nowrap border-b border-line bg-neutral-50
                 px-4 py-2 text-left text-[11.5px] font-medium text-neutral-500'
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
                className={`border-b border-line last:border-0 hover:bg-neutral-50 
                  ${onRow ? 'cursor-pointer' : ''}`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`whitespace-nowrap px-4 py-2.5 ${c.className || ''}`}
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
    className={`rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors ${
      primary
        ? 'border-brand bg-brand text-white hover:bg-brand-600'
        : 'border-line bg-white hover:border-brand hover:text-brand'
    } ${className}`}
  />
)

export const Select = ({ children, ...p }) => (
  <select
    {...p}
    className='rounded-md border border-line bg-white px-2 py-1 text-[12px] 
    outline-none focus:border-brand'
  >
    {children}
  </select>
)

export const Seg = ({ options, value, onChange }) => (
  <div className='inline-flex rounded-md border border-line bg-white p-0.5'>
    {options.map(([k, label]) => (
      <button
        key={k}
        onClick={() => onChange(k)}
        className={`rounded px-2.5 py-1 text-[12px] font-medium transition-colors
           ${value === k ? 'bg-brand text-white' : 'text-neutral-500 hover:text-ink'}`}
      >
        {label}
      </button>
    ))}
  </div>
)

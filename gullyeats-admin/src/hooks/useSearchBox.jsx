import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import useUrlState from './useUrlState'

/*
 * A table's search box, kept in the URL as ?q=. Returns [search, box]:
 * `search` updates 300ms after typing stops, so a server search isn't sent
 * per letter.
 */
export default function useSearchBox(placeholder) {
  const [q, setQ] = useUrlState('q')
  const [text, setText] = useState(q)
  useEffect(() => setText(q), [q])
  useEffect(() => {
    if (text === q) return undefined
    const id = setTimeout(() => setQ(text.trim()), 300)
    return () => clearTimeout(id)
  }, [text])

  const box = (
    <label className='flex w-full items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-neutral-500 shadow-sm transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 sm:w-56'>
      <Search size={14} />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className='w-full bg-transparent text-[13px] text-ink outline-none'
      />
    </label>
  )
  return [q, box]
}

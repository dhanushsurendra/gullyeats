import { useCallback, useEffect, useRef, useState } from 'react'

// Calls cb when the returned ref's element scrolls near the viewport.
// cb changing re-observes, which fires again if the element is still visible,
// so a short page keeps loading until the screen is full.
export function useInView(cb, active) {
  const [node, setNode] = useState(null)
  useEffect(() => {
    if (!node || !active) return undefined
    const io = new IntersectionObserver(([e]) => e.isIntersecting && cb(), {
      rootMargin: '300px',
    })
    io.observe(node)
    return () => io.disconnect()
  }, [node, cb, active])
  return setNode
}

// Server paging: fetchPage(cursor) resolves to { items, pagination: { hasMore, nextCursor }, ... }.
// The list starts over whenever resetKey changes (a filter or search); a page
// still loading for the old filters is dropped.
export default function usePaged(fetchPage, resetKey = '') {
  const [rows, setRows] = useState([])
  const [first, setFirst] = useState(null)
  const [page, setPage] = useState({ hasMore: true, nextCursor: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const busy = useRef(false)
  const gen = useRef(0)
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage

  useEffect(() => {
    gen.current += 1
    busy.current = false
    setRows([])
    setFirst(null)
    setError(null)
    setLoading(false)
    setPage({ hasMore: true, nextCursor: null })
  }, [resetKey])

  const loadMore = useCallback(async () => {
    if (busy.current || !page.hasMore) return
    const g = gen.current
    busy.current = true
    setLoading(true)
    setError(null)
    try {
      const d = await fetchRef.current(page.nextCursor)
      if (g !== gen.current) return
      setRows((prev) => [...prev, ...d.items])
      setFirst((f) => f || d)
      setPage(d.pagination)
    } catch (e) {
      if (g !== gen.current) return
      setError(e.message)
      setPage((p) => ({ ...p, hasMore: false })) // stop retrying on every scroll
    } finally {
      if (g === gen.current) {
        busy.current = false
        setLoading(false)
      }
    }
  }, [page])

  return {
    rows,
    first, // the first page's response, for totals sent alongside it
    loading,
    error,
    hasMore: page.hasMore,
    sentinel: useInView(loadMore, page.hasMore),
    retry: () => setPage((p) => ({ ...p, hasMore: true })),
  }
}

// Client paging for lists already in memory: shows `step` more rows each
// time the end is reached, and starts over when resetKey changes.
export function useReveal(rows, resetKey, step = 30) {
  const [shown, setShown] = useState(step)
  useEffect(() => setShown(step), [resetKey, step])
  const more = useCallback(() => setShown(shown + step), [shown, step])
  const hasMore = shown < rows.length
  return { visible: rows.slice(0, shown), hasMore, sentinel: useInView(more, hasMore) }
}

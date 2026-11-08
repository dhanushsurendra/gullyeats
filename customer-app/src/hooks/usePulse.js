import { useCallback, useEffect, useRef, useState } from 'react'
import { pulse } from '../utils/pulse'

// Likes a confession straight away on screen, then tells the server; puts it
// back if the server refuses. update(id, fn) changes one confession in state.
export function useLike(key, update, onError) {
  return useCallback(
    async (c, on) => {
      if (!key) return onError('Place an order at any GullyEats cart to like confessions.')
      if (c.liked === on) return
      update(c.id, (x) => ({ ...x, liked: on, likes: Math.max(0, x.likes + (on ? 1 : -1)) }))
      try {
        const r = await pulse(key, `/${c.id}/like`, { method: on ? 'POST' : 'DELETE' })
        update(c.id, (x) => ({ ...x, liked: r.liked, likes: r.likes }))
      } catch (e) {
        update(c.id, (x) => ({ ...x, liked: !on, likes: Math.max(0, x.likes + (on ? -1 : 1)) }))
        onError(e.message)
      }
    },
    [key, update, onError],
  )
}

// Cursor paging: load(cursor) resolves to { items, nextCursor }.
export function usePaged(load) {
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState(undefined) // undefined: first page not loaded
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)

  const more = useCallback(async () => {
    if (busy.current || cursor === null) return
    busy.current = true
    setLoading(true)
    setError('')
    try {
      const page = await load(cursor)
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id))
        return [...prev, ...page.items.filter((x) => !seen.has(x.id))]
      })
      setCursor(page.nextCursor)
    } catch (e) {
      setError(e.message)
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [cursor, load])

  const reset = useCallback(() => {
    setItems([])
    setCursor(undefined)
  }, [])

  return { items, setItems, more, reset, loading, error, done: cursor === null, started: cursor !== undefined }
}

// Calls cb when the returned ref's element comes near the screen.
export function useNearScreen(cb, active) {
  const [node, setNode] = useState(null)
  useEffect(() => {
    if (!node || !active) return undefined
    const io = new IntersectionObserver(([e]) => e.isIntersecting && cb(), { rootMargin: '400px' })
    io.observe(node)
    return () => io.disconnect()
  }, [node, cb, active])
  return setNode
}

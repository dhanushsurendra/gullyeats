import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { T } from '../store/adminSlice'

// Fetches a resource into Redux on mount / arg change, optionally polling for "live" data.
// Polling pauses while the tab is hidden and catches up as soon as it's shown again.
// Data fetched with a different arg (another page's date range) isn't shown: the
// page shows its loading state until its own data arrives.
export default function useResource(key, arg, pollMs) {
  const dispatch = useDispatch()
  const dep = JSON.stringify(arg ?? null)
  const fresh = useSelector((s) => s.admin.argOf[key] === dep)
  const data = useSelector((s) => (fresh ? s.admin.data[key] : undefined))
  const busy = useSelector((s) => s.admin.loading[key])
  const error = useSelector((s) => s.admin.error[key])
  useEffect(() => {
    const run = () => dispatch(T[key](arg))
    run()
    if (!pollMs) return undefined
    let last = Date.now()
    const tick = () => {
      if (document.hidden) return
      last = Date.now()
      run()
    }
    const id = setInterval(tick, pollMs)
    // Back on the tab after a poll was skipped: refresh now, not at the next tick.
    const onShow = () => !document.hidden && Date.now() - last >= pollMs && tick()
    document.addEventListener('visibilitychange', onShow)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [key, dep, pollMs])
  return { data, error, loading: !data && (!!busy || !error) }
}

import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { T } from '../store/adminSlice'

// Fetches a resource into Redux on mount / arg change, optionally polling for "live" data.
export default function useResource(key, arg, pollMs) {
  const dispatch = useDispatch()
  const data = useSelector((s) => s.admin.data[key])
  const busy = useSelector((s) => s.admin.loading[key])
  const error = useSelector((s) => s.admin.error[key])
  const dep = JSON.stringify(arg ?? null)
  useEffect(() => {
    const run = () => dispatch(T[key](arg))
    run()
    if (!pollMs) return undefined
    const id = setInterval(run, pollMs)
    return () => clearInterval(id)
  }, [key, dep, pollMs])
  return { data, error, loading: !!busy && !data }
}

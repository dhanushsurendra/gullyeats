import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { Bell, X } from 'lucide-react'
import { api, SOCKET_URL } from '../services/api'
import { loaded, arrived, read, hideToast } from '../store/notifySlice'

// Opens a notification's page and marks it read.
export function useOpenNotification() {
  const dispatch = useDispatch()
  const nav = useNavigate()
  return (n) => {
    if (!n.read) {
      dispatch(read([n.id]))
      api.readNotifications({ ids: [n.id] }).catch(() => {})
    }
    nav(n.to)
  }
}

/*
 * Loads the notifications and keeps them live: the backend pushes each new
 * one to the `admins` room. Every (re)connect reloads the list, so nothing
 * sent while offline is missed. A new one shows as a toast for 8 seconds,
 * and the tab title carries the unread count.
 */
export default function NotificationsLive() {
  const dispatch = useDispatch()
  const { unread, toast } = useSelector((s) => s.notify)
  const open = useOpenNotification()

  useEffect(() => {
    const load = () =>
      api
        .notifications()
        .then((d) => dispatch(loaded(d)))
        .catch(() => {})
    load()
    const socket = io(SOCKET_URL, {
      // A fresh one-minute token on every (re)connect; the login cookie stays on the dashboard's site.
      auth: (cb) =>
        api
          .socketToken()
          .then(({ token }) => cb({ adminToken: token }))
          .catch(() => cb({})),
    })
    socket.on('connect', () => socket.emit('join_admin', (ok) => ok && load()))
    socket.on('admin_notification', (n) => dispatch(arrived(n)))
    return () => socket.disconnect()
  }, [dispatch])

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, '')
    document.title = unread ? `(${unread}) ${base}` : base
  }, [unread])

  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(() => dispatch(hideToast()), 8000)
    return () => clearTimeout(id)
  }, [toast, dispatch])

  if (!toast) return null
  return (
    <div role='status' className='fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-32px))] rise'>
      <div className='flex items-start gap-3 rounded-2xl border border-line bg-white p-3.5 shadow-float'>
        <button
          onClick={() => {
            dispatch(hideToast())
            open(toast)
          }}
          className='flex min-w-0 flex-1 items-start gap-3 text-left'
        >
          <span className='grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand'>
            <Bell size={15} />
          </span>
          <span className='min-w-0'>
            <b className='block text-[13px] font-semibold'>{toast.title}</b>
            {toast.text && <span className='block text-[12px] text-neutral-500'>{toast.text}</span>}
          </span>
        </button>
        <button
          onClick={() => dispatch(hideToast())}
          aria-label='Dismiss'
          className='rounded-md p-1 text-neutral-400 hover:text-ink'
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

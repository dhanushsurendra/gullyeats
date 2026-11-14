import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import { DialogHost } from '../components/ui'
import NotificationsLive from '../components/NotificationsLive'

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <main className="min-w-0 lg:ml-[232px]">
        <Topbar onMenu={() => setOpen(true)} />
        <div className="mx-auto max-w-[1500px] px-3 py-5 sm:px-6"><Outlet /></div>
      </main>
      <DialogHost />
      <NotificationsLive />
    </div>
  )
}

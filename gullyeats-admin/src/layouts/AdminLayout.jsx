import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <main className="min-w-0 lg:ml-[212px]">
        <Topbar onMenu={() => setOpen(true)} />
        <div className="mx-auto max-w-[1500px] px-3 py-4 sm:px-5"><Outlet /></div>
      </main>
    </div>
  )
}

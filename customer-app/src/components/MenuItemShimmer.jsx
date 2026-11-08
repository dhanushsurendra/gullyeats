export default function MenuItemShimmer() {
  return (
    <div className='flex gap-4 rounded-card bg-surface p-3 shadow-card' aria-hidden>
      <div className='flex-1 space-y-2.5 py-1'>
        <div className='skeleton h-4 w-4 rounded' />
        <div className='skeleton h-4 w-3/4' />
        <div className='skeleton h-4 w-16' />
      </div>
      <div className='skeleton h-24 w-28 rounded-2xl' />
    </div>
  )
}

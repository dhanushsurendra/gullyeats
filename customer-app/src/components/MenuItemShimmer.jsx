export default function MenuItemShimmer() {
  return (
    <div className="flex items-center justify-between border border-grey-200 rounded-xl p-4 bg-white animate-pulse">

      {/* Item details */}
      <div className="flex-1">

        {/* Veg / Non-veg indicator + name */}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-grey-200 rounded" />

          <div className="h-4 w-32 bg-grey-200 rounded" />
        </div>

        {/* Price */}
        <div className="h-3 w-16 bg-grey-200 rounded mt-3" />

      </div>

      {/* Add button */}
      <div className="h-10 w-16 bg-grey-200 rounded-pill" />

    </div>
  )
}
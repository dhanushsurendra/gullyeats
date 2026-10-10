export default function InfoCard({ name, location, isOpen }) {
  return (
    <div
      className="
        flex items-center justify-between
        border border-grey-300
        rounded-xl
        p-4
        bg-white
      "
    >
      <div>
        <p className="font-semibold text-black">{name}</p>

        <p className="text-body text-grey-500">
          {location}
        </p>

        <p className="text-caption text-grey-400 mt-1">
          ⚡ Powered by GullyEats
        </p>
      </div>

      <div
        className="
          flex items-center gap-2
          border border-primary
          text-primary
          text-xs
          px-3 py-2
          rounded-full
          font-semibold
        "
      >
        {/* Live indicator */}
        {isOpen && 
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
        {isOpen ? "LIVE CART" : "CLOSED"}
      </div>
    </div>
  )
}
export default function InfoCard({ name, location, onLiveCart }) {
  return (
    <div className="
      flex items-center justify-between
      border border-grey-300
      rounded-xl
      p-4
      bg-white
    ">
      <div>
        <p className="font-semibold text-black">{name}</p>
        <p className="text-body text-grey-500">{location}</p>
        <p className="text-caption text-grey-400 mt-1">
          ⚡ Powered by GullyEats
        </p>
      </div>

      <button
        onClick={onLiveCart}
        className="
          border border-primary
          text-primary
          text-[12px]
          px-3 py-1
          rounded-full
          font-semibold
        "
      >
        LIVE CART
      </button>
    </div>
  );
}
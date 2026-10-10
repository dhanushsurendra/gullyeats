export default function Button({ children, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="
        w-full
        bg-primary text-white
        font-semibold text-[16px]
        py-3
        rounded-pill
        active:scale-[0.98]
        transition
        disabled:opacity-50
        disabled:cursor-not-allowed
        disabled:active:scale-100
      "
    >
      {children}
    </button>
  )
}
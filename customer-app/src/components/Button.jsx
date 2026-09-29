export default function Button({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="
        w-full
        bg-primary text-white
        font-semibold text-[16px]
        py-3
        rounded-pill
        active:scale-[0.98]
        transition
      "
    >
      {children}
    </button>
  );
}
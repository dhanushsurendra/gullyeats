export default function Card({ children, className = "" }) {
  return (
    <div
      className={`
        bg-grey-100
        rounded-xl
        p-4
        ${className}
      `}
    >
      {children}
    </div>
  );
}
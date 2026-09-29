import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col items-center justify-center">
      <h1 className="text-h1">404</h1>
      <p className="text-body text-grey-500 mt-2">
        Page not found
      </p>

      <button
        onClick={() => navigate("/")}
        className="mt-4 text-primary font-semibold"
      >
        Go Home
      </button>
    </div>
  );
}
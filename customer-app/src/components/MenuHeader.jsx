import { RiArrowLeftSLine } from "react-icons/ri";
import { FiTrash2 } from "react-icons/fi";

export default function MenuHeader({
  title,
  subtitle,
  showLive = false,
  onBack,
  showIcon = false, 
  iconOnPress
}) {
  return (
    <header className="sticky top-0 z-50 bg-white px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 bg-gray-100 rounded-xl active:scale-95 transition"
        >
          <RiArrowLeftSLine size={20} className="text-black" />
        </button>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-black leading-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-caption text-gray-500">
              {subtitle}
            </p>
          )}
        </div>

        {/* RIGHT SIDE */}
        <div className="min-w-48px flex justify-end items-center gap-2">
          
          {showIcon && (
            <button
              onClick={iconOnPress}
              className="p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition"
            >
              <FiTrash2 size={18} className="text-red-500" />
            </button>
          )}

          {showLive && (
            <div className="flex items-center gap-1 px-2 py-1 border border-primary rounded-pill">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-primary">
                Live
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
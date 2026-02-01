// Reusable empty/loading/error state for tab panels

interface TabEmptyStateProps {
  icon: string;
  title: string;
  description: string;
  variant?: "empty" | "loading" | "error";
}

export default function TabEmptyState({ icon, title, description, variant = "empty" }: TabEmptyStateProps) {
  const iconColor = variant === "error" ? "text-red-400" : variant === "loading" ? "text-gray-500" : "text-gray-400";
  const bgGradient = variant === "error"
    ? "from-red-500/15 to-red-500/5"
    : variant === "loading"
      ? "from-gray-500/10 to-gray-500/5"
      : "from-emerald-500/15 to-blue-500/10";
  const borderColor = variant === "error"
    ? "border-red-500/10"
    : "border-white/[0.06]";

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="relative mb-5">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${bgGradient} flex items-center justify-center border ${borderColor}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={iconColor}>
            <path d={icon} />
          </svg>
        </div>
        {variant === "loading" && (
          <div className="absolute inset-0 rounded-2xl bg-gray-500/5 blur-xl -z-10 animate-subtle-pulse" />
        )}
        {variant !== "loading" && (
          <div className="absolute inset-0 rounded-2xl bg-emerald-500/5 blur-xl -z-10" />
        )}
      </div>
      <h3 className="text-base font-semibold text-gray-200 mb-1.5 tracking-tight">{title}</h3>
      <p className="text-sm text-gray-500 max-w-xs leading-relaxed">{description}</p>
    </div>
  );
}

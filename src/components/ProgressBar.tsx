export function ProgressBar({
  done,
  total,
  size = "md",
  invert = false,
  className = "",
}: {
  done: number;
  total: number;
  size?: "md" | "sm";
  invert?: boolean;
  className?: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const barHeight = size === "sm" ? "h-1.5" : "h-2";
  const textSize = size === "sm" ? "text-[10px]" : "text-sm";
  const trackClass = invert ? "bg-white/25" : "bg-black/10 dark:bg-white/10";
  const fillClass = invert ? "bg-white" : "bg-emerald-500";
  const textClass = invert ? "text-white/80" : "text-black/50 dark:text-white/50";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`${barHeight} min-w-0 flex-1 overflow-hidden rounded-full ${trackClass}`}>
        <div className={`h-full rounded-full transition-[width] ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`flex-shrink-0 whitespace-nowrap ${textSize} ${textClass}`}>
        {pct}% ({done}/{total})
      </span>
    </div>
  );
}

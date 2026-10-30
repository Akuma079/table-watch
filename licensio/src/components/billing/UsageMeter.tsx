import { cn } from "@/lib/cn";

export function UsageMeter({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const full = max !== null && used >= max;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-neutral-600">{label}</span>
        <span className={cn("tabular-nums", full ? "font-medium text-red-700" : "text-neutral-900")}>
          {used} / {max ?? "illimité"}
        </span>
      </div>
      {max !== null && (
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100"
          role="progressbar"
          aria-label={label}
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={max}
        >
          <div className={cn("h-full", full ? "bg-red-600" : pct >= 80 ? "bg-amber-500" : "bg-neutral-900")} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

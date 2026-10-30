import type { ComplianceStatus } from "@prisma/client";
import { cn } from "@/lib/cn";

const TONES: Record<ComplianceStatus, { ring: string; bg: string; fg: string }> = {
  COMPLIANT: { ring: "ring-green-600/20", bg: "bg-green-600", fg: "text-green-700" },
  WARNING: { ring: "ring-amber-500/25", bg: "bg-amber-500", fg: "text-amber-700" },
  NON_COMPLIANT: { ring: "ring-red-600/20", bg: "bg-red-600", fg: "text-red-700" },
  PENDING: { ring: "ring-neutral-400/30", bg: "bg-neutral-400", fg: "text-neutral-600" },
};

function Icon({ status }: { status: ComplianceStatus }) {
  if (status === "COMPLIANT") return <path d="M7.5 12.5l3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />;
  if (status === "NON_COMPLIANT") return <path d="M9 9l6 6m0-6l-6 6" strokeLinecap="round" />;
  return <path d="M12 7.5v5.5m0 3.2v.1" strokeLinecap="round" />;
}

// Sceau du passeport : bouclier coloré selon le verdict.
export function VerdictSeal({ status, title }: { status: ComplianceStatus; title: string }) {
  const t = TONES[status];
  return (
    <div className="flex items-center gap-4">
      <span className={cn("grid h-16 w-16 shrink-0 place-items-center rounded-full ring-8", t.bg, t.ring)}>
        <svg viewBox="0 0 24 24" className="h-9 w-9 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
          <path d="M12 2.8l7.5 3v5.6c0 4.6-3.1 8.6-7.5 9.8-4.4-1.2-7.5-5.2-7.5-9.8V5.8z" strokeLinejoin="round" />
          <Icon status={status} />
        </svg>
      </span>
      <p className={cn("text-xl font-bold uppercase tracking-wide sm:text-2xl", t.fg)}>{title}</p>
    </div>
  );
}

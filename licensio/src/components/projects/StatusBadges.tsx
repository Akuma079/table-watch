import type { ComplianceStatus, FindingSeverity } from "@prisma/client";
import { cn } from "@/lib/cn";
import { COMPLIANCE_LABELS } from "@/lib/labels";

const STATUS: Record<ComplianceStatus, { dot: string; pill: string; emoji: string }> = {
  COMPLIANT: { dot: "bg-compliant", pill: "bg-compliant-soft text-green-800 ring-green-200", emoji: "🟢" },
  WARNING: { dot: "bg-warning", pill: "bg-warning-soft text-amber-900 ring-amber-200", emoji: "🟡" },
  NON_COMPLIANT: { dot: "bg-risk", pill: "bg-risk-soft text-red-800 ring-red-200", emoji: "🔴" },
  PENDING: { dot: "bg-neutral-400", pill: "bg-neutral-100 text-neutral-700 ring-neutral-200", emoji: "⚪" },
};

export function ComplianceBadge({ status, size = "sm" }: { status: ComplianceStatus; size?: "sm" | "lg" }) {
  const s = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset",
        size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs",
        s.pill,
      )}
    >
      <span aria-hidden className={cn("rounded-full", size === "lg" ? "h-2.5 w-2.5" : "h-2 w-2", s.dot)} />
      {COMPLIANCE_LABELS[status]}
    </span>
  );
}

export const SEVERITY_STATUS: Record<FindingSeverity, ComplianceStatus> = {
  OK: "COMPLIANT",
  WARNING: "WARNING",
  ERROR: "NON_COMPLIANT",
};

export function statusDotClass(status: ComplianceStatus) {
  return STATUS[status].dot;
}

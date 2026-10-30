import type { LicenseType } from "@prisma/client";
import { cn } from "@/lib/cn";
import { dayFormat, LICENSE_TYPE_LABELS } from "@/lib/labels";

const TYPE_STYLES: Record<LicenseType, string> = {
  COMMERCIAL: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  EXTENDED: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  PERSONAL: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  RESTRICTED: "bg-amber-50 text-amber-800 ring-amber-200",
};

export function LicenseTypeBadge({ type }: { type: LicenseType }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TYPE_STYLES[type])}>
      {LICENSE_TYPE_LABELS[type]}
    </span>
  );
}

const SOON_MS = 30 * 24 * 60 * 60 * 1000;

export function ExpiryBadge({ expiresAt, revokedAt }: { expiresAt: Date | null; revokedAt: Date | null }) {
  if (revokedAt) return <span className="text-xs font-medium text-red-600">Révoquée</span>;
  if (!expiresAt) return <span className="text-xs text-neutral-500">Perpétuelle</span>;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const label = dayFormat.format(expiresAt);
  if (expiresAt < today) return <span className="text-xs font-medium text-red-600">Expirée le {label}</span>;
  if (expiresAt.getTime() - today.getTime() <= SOON_MS) {
    return <span className="text-xs font-medium text-amber-700">Expire le {label}</span>;
  }
  return <span className="text-xs text-neutral-500">Jusqu&apos;au {label}</span>;
}

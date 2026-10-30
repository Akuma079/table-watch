import { cn } from "@/lib/cn";

const tones = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-green-200 bg-green-50 text-green-800",
  info: "border-neutral-200 bg-neutral-50 text-neutral-700",
};

export function Alert({ tone, children }: { tone: keyof typeof tones; children: React.ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-lg border px-3 py-2.5 text-sm", tones[tone])}>
      {children}
    </div>
  );
}

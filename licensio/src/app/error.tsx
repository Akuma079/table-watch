"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="px-4">
      <ErrorState digest={error.digest} reset={reset} />
    </div>
  );
}

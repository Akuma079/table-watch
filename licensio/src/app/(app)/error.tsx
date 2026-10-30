"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState digest={error.digest} reset={reset} />;
}

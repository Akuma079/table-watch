"use client";

import "./globals.css";
import { ErrorState } from "@/components/ui/ErrorState";

// Erreur dans la mise en page racine elle-même : cette page remplace tout le document.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body className="px-4">
        <ErrorState digest={error.digest} reset={reset} />
      </body>
    </html>
  );
}

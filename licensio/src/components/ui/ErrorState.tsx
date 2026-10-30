"use client";

import Link from "next/link";
import { buttonClass } from "./button-styles";

// Contenu commun des pages d'erreur. En production, Next masque le message d'origine :
// on affiche un texte générique et la référence (digest) à transmettre au support.
export function ErrorState({ digest, reset }: { digest?: string; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-sm font-medium text-red-600">Erreur</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Cette page n&apos;a pas pu s&apos;afficher</h1>
      <p className="mt-3 text-sm text-neutral-500">
        Réessayez dans un instant. Si le problème persiste, vérifiez que vous avez bien accès à cet espace de travail.
      </p>
      {digest && <p className="mt-2 font-mono text-xs text-neutral-400">Réf. {digest}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className={buttonClass("primary")}>
          Réessayer
        </button>
        <Link href="/dashboard" className={buttonClass("secondary")}>
          Tableau de bord
        </Link>
      </div>
    </div>
  );
}

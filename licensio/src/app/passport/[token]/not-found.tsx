import { Logo } from "@/components/app/Logo";

export default function PassportNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <div>
        <h1 className="text-xl font-semibold">Passeport introuvable</h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-500">
          Ce lien n&apos;existe pas ou a été désactivé. Demandez un nouveau lien à l&apos;agence qui vous l&apos;a transmis.
        </p>
      </div>
    </div>
  );
}

import type { PassportBrand } from "@/server/passport/data";
import { Logo } from "@/components/app/Logo";

// En-tête du passeport : la marque de l'agence (marque blanche) ou celle de Licensio.
export function BrandMark({ brand }: { brand: PassportBrand }) {
  if (!brand.whiteLabel) return <Logo />;
  return (
    <span className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
      <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg text-sm text-white" style={{ backgroundColor: brand.color }}>
        {brand.name.trim().charAt(0).toUpperCase()}
      </span>
      {brand.name}
    </span>
  );
}

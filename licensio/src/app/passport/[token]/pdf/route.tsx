import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { loadPassport, passportFileName } from "@/server/passport/data";
import { PassportDocument } from "@/server/passport/PassportDocument";

// Export PDF du Passeport de Droits, public comme la page (même jeton).
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const passport = await loadPassport((await params).token);
  if (!passport) return new Response("Passeport introuvable", { status: 404 });

  const qrDataUrl = await QRCode.toDataURL(passport.url, { margin: 0, width: 240, errorCorrectionLevel: "M" });
  const pdf = await renderToBuffer(<PassportDocument passport={passport} qrDataUrl={qrDataUrl} generatedAt={new Date()} />);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${passportFileName(passport.projectName)}"`,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}

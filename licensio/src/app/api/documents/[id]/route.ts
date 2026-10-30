import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/server/auth";
import { createDocumentReadUrl } from "@/server/storage";

// Aperçu (par défaut) ou téléchargement (?download=1) d'une preuve de licence.
// Vérifie que l'utilisateur est membre de l'espace propriétaire, puis redirige vers une
// URL signée valable 60 secondes : le bucket reste privé.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });

  const { id } = await params;
  const document = await prisma.licenseDocument.findFirst({
    where: { id, license: { workspace: { members: { some: { userId: user.id } } } } },
    select: { storagePath: true, fileName: true },
  });
  if (!document) return new NextResponse("Document introuvable", { status: 404 });

  const download = request.nextUrl.searchParams.get("download") === "1";
  const url = await createDocumentReadUrl(document.storagePath, download ? document.fileName : undefined);
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}

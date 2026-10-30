import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

// Point d'arrivée des liens envoyés par Supabase : confirmation d'inscription,
// réinitialisation du mot de passe, connexion OAuth.
// - flux PKCE (par défaut avec @supabase/ssr) : ?code=…
// - modèles d'email personnalisés : ?token_hash=…&type=…
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  if (!ok) return NextResponse.redirect(`${origin}/login?error=link_invalid`);
  return NextResponse.redirect(`${origin}${next}`);
}

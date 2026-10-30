import { createBrowserClient } from "@supabase/ssr";

// Client navigateur : auth uniquement (connexion, déconnexion).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

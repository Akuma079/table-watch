// N'accepte qu'un chemin interne ("/vault?x=1"), jamais une URL externe ou "//evil.com" :
// le paramètre ?next= vient de l'URL et ne doit pas permettre une redirection ouverte.
export function safeNextPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}

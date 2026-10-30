// Forme canonique d'un nom de ressource, pour rapprocher « Épique Rise (Remix) »
// et « epique rise remix ». Sert à la correspondance licences ↔ ressources d'un projet.
export function normalizeAssetName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Lien comparable : sans protocole, « www. », paramètres, ancre ni « / » final.
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

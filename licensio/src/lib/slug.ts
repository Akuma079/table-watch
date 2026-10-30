import { randomBytes } from "node:crypto";

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Suffixe aléatoire : deux agences peuvent porter le même nom.
export function uniqueSlug(name: string): string {
  return `${slugify(name) || "espace"}-${randomBytes(3).toString("hex")}`;
}

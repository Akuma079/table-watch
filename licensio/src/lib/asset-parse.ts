// Analyse d'une liste collée (une ressource par ligne) : titres libres ou liens vers les
// banques de médias. Utilisé côté navigateur pour pré-remplir le tableau des ressources.
import type { AssetType, Platform } from "@prisma/client";

export const MAX_ASSETS_PER_PROJECT = 200;

export type ParsedAsset = {
  assetName: string;
  author: string;
  platform: Platform | "";
  assetType: AssetType;
  sourceUrl: string;
};

const HOSTS: { test: RegExp; platform: Platform }[] = [
  { test: /(^|\.)artlist\.io$/, platform: "ARTLIST" },
  { test: /(^|\.)artgrid\.io$/, platform: "ARTGRID" },
  { test: /(^|\.)envato\.com$/, platform: "ENVATO_ELEMENTS" },
  { test: /(^|\.)epidemicsound\.com$/, platform: "EPIDEMIC_SOUND" },
  { test: /(^|\.)musicbed\.com$/, platform: "MUSICBED" },
  { test: /(^|\.)soundstripe\.com$/, platform: "SOUNDSTRIPE" },
  { test: /(^|\.)storyblocks\.com$/, platform: "STORYBLOCKS" },
  { test: /(^|\.)shutterstock\.com$/, platform: "SHUTTERSTOCK" },
  { test: /^stock\.adobe\.com$/, platform: "ADOBE_STOCK" },
  { test: /(^|\.)pond5\.com$/, platform: "POND5" },
];

function typeFromPath(path: string, platform: Platform | ""): AssetType {
  if (/(sound-?effect|sfx)/.test(path)) return "SFX";
  if (/(music|song|track|audio)/.test(path)) return "MUSIC";
  if (/(video|footage|clip|stock-footage)/.test(path) || platform === "ARTGRID") return "STOCK_VIDEO";
  if (/(photo|image|graphic|illustration)/.test(path)) return "IMAGE";
  if (/font/.test(path)) return "FONT";
  return "MUSIC";
}

// Titre déduit du dernier segment lisible de l'URL : « …/song/golden-hour/12345 » → « Golden Hour ».
function titleFromPath(path: string): string {
  const segments = path
    .split("/")
    .map((s) => decodeURIComponent(s))
    .filter((s) => s && !/^\d+$/.test(s) && !/^[A-Z0-9]{6,}$/.test(s));
  const slug = (segments.at(-1) ?? "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/-[A-Z0-9]{6,}$/, "") // identifiant Envato en fin de slug
    .replace(/-\d+$/, "");
  const words = slug.split(/[-_+]+/).filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function parseAssetLine(line: string): ParsedAsset | null {
  const text = line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
  if (!text) return null;

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      const platform = HOSTS.find((h) => h.test.test(host))?.platform ?? "";
      const path = url.pathname.toLowerCase();
      return {
        assetName: titleFromPath(url.pathname) || host,
        author: "",
        platform,
        assetType: typeFromPath(path, platform),
        sourceUrl: url.toString(),
      };
    } catch {
      // ligne mal formée : traitée comme un titre
    }
  }

  // « Titre — Artiste » ou « Titre | Artiste » (le tiret simple est trop fréquent dans les titres).
  const [title, author = ""] = text.split(/\s+[—–|]\s+/, 2);
  return { assetName: title.trim(), author: author.trim(), platform: "", assetType: "MUSIC", sourceUrl: "" };
}

export function parseAssetList(text: string): ParsedAsset[] {
  return text
    .split(/\r?\n/)
    .map(parseAssetLine)
    .filter((a): a is ParsedAsset => a !== null);
}

"use client";

import type { AssetType, Platform } from "@prisma/client";
import { useEffect, useState } from "react";
import { MAX_ASSETS_PER_PROJECT, parseAssetList, type ParsedAsset } from "@/lib/asset-parse";
import { ASSET_TYPE_LABELS, PLATFORM_LABELS } from "@/lib/labels";
import { buttonClass } from "@/components/ui/button-styles";
import { inputClass } from "@/components/ui/Field";

type Row = ParsedAsset & { key: string };

const empty = (): Row => ({
  key: crypto.randomUUID(),
  assetName: "",
  author: "",
  platform: "",
  assetType: "MUSIC",
  sourceUrl: "",
});

const cell = "rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm focus:border-neutral-900 focus:outline-none";

// Liste éditable des ressources utilisées dans un montage. Publie la liste (lignes non
// vides) via `onChange` ; le formulaire parent l'envoie en JSON.
export function AssetEditor({ onChange, startWithRow = true }: { onChange: (assets: ParsedAsset[]) => void; startWithRow?: boolean }) {
  const [rows, setRows] = useState<Row[]>(() => (startWithRow ? [empty()] : []));
  const [paste, setPaste] = useState("");
  const [pasteInfo, setPasteInfo] = useState<string | null>(null);

  useEffect(() => {
    onChange(
      rows
        .filter((r) => r.assetName.trim())
        .map((r) => ({ assetName: r.assetName, author: r.author, platform: r.platform, assetType: r.assetType, sourceUrl: r.sourceUrl })),
    );
  }, [rows, onChange]);

  const set = (key: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function importPaste() {
    const parsed = parseAssetList(paste);
    if (parsed.length === 0) return setPasteInfo("Aucune ligne exploitable.");
    setRows((prev) => {
      const kept = prev.filter((r) => r.assetName.trim());
      return [...kept, ...parsed.map((a) => ({ ...a, key: crypto.randomUUID() }))].slice(0, MAX_ASSETS_PER_PROJECT);
    });
    const recognized = parsed.filter((a) => a.platform).length;
    setPasteInfo(
      `${parsed.length} ressource${parsed.length > 1 ? "s ajoutées" : " ajoutée"}` +
        (recognized ? `, dont ${recognized} avec plateforme reconnue depuis le lien` : "") +
        ". Vérifiez les titres ci-dessous.",
    );
    setPaste("");
  }

  return (
    <div className="space-y-4">
      <details className="rounded-xl border border-neutral-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium">Coller une liste de titres ou de liens</summary>
        <p className="mt-2 text-xs text-neutral-500">
          Une ressource par ligne : un titre (« Golden Hour — Ikson ») ou un lien Artlist, Envato, Epidemic Sound,
          Artgrid, Storyblocks… La plateforme et le titre sont déduits du lien.
        </p>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={5}
          aria-label="Liste de ressources à importer"
          placeholder={"https://artlist.io/royalty-free-music/song/golden-hour/12345\nMidnight Drive — Ikson\nhttps://elements.envato.com/aerial-city-sunset-ABC123XYZ"}
          className={`${inputClass} mt-3 font-mono text-xs`}
        />
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={importPaste} disabled={!paste.trim()} className={buttonClass("secondary")}>
            Ajouter à la liste
          </button>
          {pasteInfo && <p className="text-xs text-neutral-500" role="status">{pasteInfo}</p>}
        </div>
      </details>

      {rows.length > 0 && (
        <div className="relative overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Titre de la ressource</th>
                <th className="px-3 py-2 font-medium">Auteur / artiste</th>
                <th className="px-3 py-2 font-medium">Plateforme</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="w-10 px-3 py-2"><span className="sr-only">Retirer</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r, i) => (
                <tr key={r.key}>
                  <td className="px-3 py-2">
                    <input
                      value={r.assetName}
                      onChange={(e) => set(r.key, { assetName: e.target.value })}
                      aria-label={`Titre de la ressource ${i + 1}`}
                      placeholder="Ex. Golden Hour"
                      className={`${cell} w-full`}
                    />
                    {r.sourceUrl && <p className="mt-1 truncate text-[11px] text-neutral-400" title={r.sourceUrl}>{r.sourceUrl}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={r.author}
                      onChange={(e) => set(r.key, { author: e.target.value })}
                      aria-label={`Auteur de la ressource ${i + 1}`}
                      className={`${cell} w-full`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={r.platform}
                      onChange={(e) => set(r.key, { platform: e.target.value as Platform | "" })}
                      aria-label={`Plateforme de la ressource ${i + 1}`}
                      className={cell}
                    >
                      <option value="">Inconnue</option>
                      {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={r.assetType}
                      onChange={(e) => set(r.key, { assetType: e.target.value as AssetType })}
                      aria-label={`Type de la ressource ${i + 1}`}
                      className={cell}
                    >
                      {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                      aria-label={`Retirer la ressource ${i + 1}`}
                      className="rounded-md px-2 py-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, empty()])}
        disabled={rows.length >= MAX_ASSETS_PER_PROJECT}
        className={buttonClass("ghost", "px-2")}
      >
        + Ajouter une ressource
      </button>
    </div>
  );
}

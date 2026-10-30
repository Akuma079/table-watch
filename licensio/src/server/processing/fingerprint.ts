import { createHash } from "node:crypto";

// PLACEHOLDER — empreinte audio.
// Le vrai traitement extraira la piste audio (ffmpeg) puis calculera une empreinte
// acoustique (Chromaprint / AcoustID, ou un service tiers type ACRCloud) pour reconnaître
// les musiques utilisées. Ici, on simule : délai + hash déterministe de l'identifiant.
export async function computeAudioFingerprint(input: {
  mediaFileId: string;
  storagePath?: string | null;
  externalUrl?: string | null;
}): Promise<{ fingerprint: string; detectedTracks: { name: string; startSec: number; endSec: number }[] }> {
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  const source = input.storagePath ?? input.externalUrl ?? input.mediaFileId;
  return {
    fingerprint: `sim:${createHash("sha256").update(source).digest("hex").slice(0, 32)}`,
    detectedTracks: [], // la détection réelle remplira cette liste
  };
}

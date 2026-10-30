// PLACEHOLDER — OCR des licences et factures.
// Le vrai traitement passera le PDF à un moteur OCR (Tesseract, AWS Textract, Google
// Document AI…) puis extraira les champs utiles. Ici, on simule une extraction vide.
export type OcrResult = {
  text: string;
  fields: { licenseKey?: string; purchaseDate?: string; platform?: string; assetName?: string };
};

export async function extractLicenseFields(input: {
  documentId: string;
  storagePath: string;
  mimeType: string;
}): Promise<OcrResult> {
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  return { text: `[OCR simulé pour ${input.storagePath}]`, fields: {} };
}

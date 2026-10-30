import { test } from "node:test";
import assert from "node:assert/strict";
import { auditProject, evaluateAsset, type AuditAsset, type AuditLicense } from "./compliance-rules";
import { normalizeAssetName } from "./normalize";
import { parseAssetLine } from "@/lib/asset-parse";

const NOW = new Date("2026-10-30T10:00:00Z");
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

function license(over: Partial<AuditLicense> = {}): AuditLicense {
  const assetName = over.assetName ?? "Golden Hour";
  return {
    id: "lic1",
    assetName,
    normalizedName: normalizeAssetName(assetName),
    author: "Ikson",
    platform: "ARTLIST",
    platformOther: null,
    sourceUrl: null,
    licenseType: "COMMERCIAL",
    licenseKey: "ART-1",
    expiresAt: null,
    revokedAt: null,
    documentCount: 1,
    ...over,
  };
}

function asset(name: string, over: Partial<AuditAsset> = {}): AuditAsset {
  return { id: "a1", normalizedName: normalizeAssetName(name), platform: null, sourceUrl: null, licenseId: null, matchMethod: null, ...over };
}

const commercial = { usage: "COMMERCIAL" as const, publishedAt: null };

test("licence commerciale valide → vert", () => {
  const r = auditProject(commercial, [asset("golden hour")], [license()], NOW);
  assert.equal(r.status, "COMPLIANT");
  assert.equal(r.score, 100);
  assert.equal(r.assets[0].findings[0].code, "LICENSED");
});

test("aucune licence → rouge, manquante", () => {
  const r = auditProject(commercial, [asset("Inconnu")], [license()], NOW);
  assert.equal(r.status, "NON_COMPLIANT");
  assert.equal(r.assets[0].findings[0].code, "MISSING_LICENSE");
  assert.equal(r.score, 0);
});

test("licence personnelle sur projet commercial → rouge avec le message attendu", () => {
  const r = evaluateAsset(asset("Golden Hour"), [license({ licenseType: "PERSONAL" })], commercial, NOW);
  assert.equal(r.severity, "ERROR");
  assert.equal(r.findings[0].code, "LICENSE_TYPE_INSUFFICIENT");
  assert.match(r.findings[0].message, /strictement personnelle/);
});

test("licence personnelle sur projet personnel → vert", () => {
  const r = evaluateAsset(asset("Golden Hour"), [license({ licenseType: "PERSONAL" })], { usage: "PERSONAL", publishedAt: null }, NOW);
  assert.equal(r.severity, "OK");
});

test("diffusion TV : commerciale insuffisante, étendue acceptée", () => {
  const broadcast = { usage: "BROADCAST" as const, publishedAt: null };
  assert.equal(evaluateAsset(asset("Golden Hour"), [license()], broadcast, NOW).severity, "ERROR");
  assert.equal(evaluateAsset(asset("Golden Hour"), [license({ licenseType: "EXTENDED" })], broadcast, NOW).severity, "OK");
});

test("expire dans moins de 30 jours → orange", () => {
  const r = auditProject(commercial, [asset("Golden Hour")], [license({ expiresAt: d("2026-11-15") })], NOW);
  assert.equal(r.status, "WARNING");
  assert.equal(r.assets[0].findings[0].code, "LICENSE_EXPIRING_SOON");
  assert.match(r.assets[0].findings[0].message, /dans 16 jours/);
  assert.equal(r.score, 50);
});

test("expirée → rouge ; mais valable à la date de diffusion passée → vert", () => {
  const expired = license({ expiresAt: d("2026-09-01") });
  assert.equal(evaluateAsset(asset("Golden Hour"), [expired], commercial, NOW).findings[0].code, "LICENSE_EXPIRED");
  const published = { usage: "COMMERCIAL" as const, publishedAt: d("2026-08-15") };
  assert.equal(evaluateAsset(asset("Golden Hour"), [expired], published, NOW).severity, "OK");
});

test("diffusion prévue après l'expiration → rouge", () => {
  const future = { usage: "COMMERCIAL" as const, publishedAt: d("2027-01-10") };
  const r = evaluateAsset(asset("Golden Hour"), [license({ expiresAt: d("2026-12-31") })], future, NOW);
  assert.equal(r.findings[0].code, "LICENSE_EXPIRED");
  assert.match(r.findings[0].message, /avant la diffusion/);
});

test("sans preuve ou utilité restreinte → orange", () => {
  assert.equal(evaluateAsset(asset("Golden Hour"), [license({ documentCount: 0 })], commercial, NOW).findings[0].code, "MISSING_PROOF");
  assert.equal(evaluateAsset(asset("Golden Hour"), [license({ licenseType: "RESTRICTED" })], commercial, NOW).findings[0].code, "LICENSE_RESTRICTED");
});

test("révoquée → rouge", () => {
  assert.equal(evaluateAsset(asset("Golden Hour"), [license({ revokedAt: d("2026-10-01") })], commercial, NOW).severity, "ERROR");
});

test("correspondance « titre artiste » et par lien de la ressource", () => {
  assert.equal(evaluateAsset(asset("Golden Hour - Ikson"), [license()], commercial, NOW).licenseId, "lic1");
  const byUrl = license({ assetName: "Autre titre", sourceUrl: "https://artlist.io/song/golden-hour/123" });
  const r = evaluateAsset(asset("xyz", { sourceUrl: "http://www.artlist.io/song/golden-hour/123/?ref=x" }), [byUrl], commercial, NOW);
  assert.equal(r.licenseId, "lic1");
});

test("plusieurs licences : la meilleure est retenue", () => {
  const personal = license({ id: "perso", licenseType: "PERSONAL" });
  const pro = license({ id: "pro", licenseType: "COMMERCIAL" });
  assert.equal(evaluateAsset(asset("Golden Hour"), [personal, pro], commercial, NOW).licenseId, "pro");
});

test("plateforme différente → orange, licence quand même retenue", () => {
  const r = evaluateAsset(asset("Golden Hour", { platform: "EPIDEMIC_SOUND" }), [license()], commercial, NOW);
  assert.equal(r.severity, "WARNING");
  assert.equal(r.findings[0].code, "PLATFORM_MISMATCH");
  assert.ok(!r.findings.some((f) => f.code === "LICENSED"));
});

test("licence associée à la main prioritaire sur la correspondance par nom", () => {
  const manual = license({ id: "manuelle", assetName: "Nom différent" });
  const r = evaluateAsset(asset("Golden Hour", { licenseId: "manuelle", matchMethod: "MANUAL" }), [license(), manual], commercial, NOW);
  assert.equal(r.licenseId, "manuelle");
  assert.equal(r.matchMethod, "MANUAL");
});

test("projet sans ressource → en attente", () => {
  const r = auditProject(commercial, [], [license()], NOW);
  assert.equal(r.status, "PENDING");
  assert.equal(r.score, null);
});

test("analyse d'une liste collée", () => {
  const a = parseAssetLine("https://artlist.io/royalty-free-music/song/golden-hour/12345")!;
  assert.deepEqual([a.assetName, a.platform, a.assetType], ["Golden Hour", "ARTLIST", "MUSIC"]);
  const e = parseAssetLine("https://elements.envato.com/aerial-city-sunset-ABC123XYZ")!;
  assert.deepEqual([e.assetName, e.platform], ["Aerial City Sunset", "ENVATO_ELEMENTS"]);
  const t = parseAssetLine("- Midnight Drive — Ikson")!;
  assert.deepEqual([t.assetName, t.author], ["Midnight Drive", "Ikson"]);
  assert.equal(parseAssetLine("   "), null);
});

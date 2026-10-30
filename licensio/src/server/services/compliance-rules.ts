// Règles d'audit de conformité — fonctions pures, sans accès à la base.
// `compliance.ts` charge les données, appelle `auditProject`, puis enregistre le résultat.
import type {
  ComplianceStatus,
  FindingCode,
  FindingSeverity,
  LicenseType,
  MatchMethod,
  Platform,
  ProjectUsage,
} from "@prisma/client";
import { dayFormat, LICENSE_TYPE_LABELS, PLATFORM_LABELS } from "@/lib/labels";
import { normalizeAssetName, normalizeUrl } from "./normalize";

export const EXPIRY_WARNING_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AuditLicense = {
  id: string;
  assetName: string;
  normalizedName: string;
  author: string | null;
  platform: Platform;
  platformOther: string | null;
  sourceUrl: string | null;
  licenseType: LicenseType;
  licenseKey: string | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  documentCount: number;
};

export type AuditAsset = {
  id: string;
  normalizedName: string;
  platform: Platform | null;
  sourceUrl: string | null;
  licenseId: string | null;
  matchMethod: MatchMethod | null;
};

export type AuditProject = { usage: ProjectUsage; publishedAt: Date | null };

export type Finding = { severity: FindingSeverity; code: FindingCode; message: string };

export type AssetResult = {
  assetId: string;
  licenseId: string | null;
  matchMethod: MatchMethod | null;
  severity: FindingSeverity;
  findings: Finding[];
};

export type ProjectResult = {
  status: ComplianceStatus;
  score: number | null;
  errorCount: number;
  warningCount: number;
  assets: AssetResult[];
};

// Types de licence acceptés pour chaque usage du projet.
export const ACCEPTED_LICENSES: Record<ProjectUsage, LicenseType[]> = {
  PERSONAL: ["PERSONAL", "COMMERCIAL", "EXTENDED", "RESTRICTED"],
  COMMERCIAL: ["COMMERCIAL", "EXTENDED", "RESTRICTED"],
  BROADCAST: ["EXTENDED", "RESTRICTED"],
};

const SEVERITY_RANK: Record<FindingSeverity, number> = { OK: 0, WARNING: 1, ERROR: 2 };

function worst(findings: Finding[]): FindingSeverity {
  return findings.reduce<FindingSeverity>(
    (acc, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[acc] ? f.severity : acc),
    "OK",
  );
}

export function startOfUtcDay(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function platformName(license: AuditLicense) {
  return license.platform === "OTHER" ? license.platformOther || "Autre" : PLATFORM_LABELS[license.platform];
}

// Clés sous lesquelles une licence peut être retrouvée : son titre seul, ou combiné à
// l'auteur (« Golden Hour Ikson », « Ikson Golden Hour ») pour les listes collées telles quelles.
function licenseKeys(license: AuditLicense): Set<string> {
  const keys = new Set([license.normalizedName]);
  if (license.author) {
    keys.add(normalizeAssetName(`${license.assetName} ${license.author}`));
    keys.add(normalizeAssetName(`${license.author} ${license.assetName}`));
  }
  return keys;
}

function sameSource(asset: AuditAsset, license: AuditLicense) {
  return Boolean(asset.sourceUrl && license.sourceUrl && normalizeUrl(asset.sourceUrl) === normalizeUrl(license.sourceUrl));
}

// Vérifie une licence donnée pour une ressource et un projet.
export function evaluateLicense(license: AuditLicense, project: AuditProject, now: Date): Finding[] {
  const today = startOfUtcDay(now);
  const findings: Finding[] = [];
  const label = `${LICENSE_TYPE_LABELS[license.licenseType].toLowerCase()} ${platformName(license)}`;

  if (license.revokedAt) {
    findings.push({ severity: "ERROR", code: "LICENSE_REVOKED", message: `La licence ${label} a été révoquée.` });
  }

  // Date de référence : la diffusion si elle est connue (une licence valable au moment de
  // la publication couvre en général la vidéo), sinon aujourd'hui.
  const reference = project.publishedAt ? startOfUtcDay(project.publishedAt) : today;
  const alreadyPublished = reference < today;
  if (license.expiresAt && license.expiresAt < reference) {
    findings.push({
      severity: "ERROR",
      code: "LICENSE_EXPIRED",
      message: project.publishedAt
        ? `La licence expire le ${dayFormat.format(license.expiresAt)}, avant la diffusion du ${dayFormat.format(reference)}.`
        : `La licence a expiré le ${dayFormat.format(license.expiresAt)}.`,
    });
  } else if (license.expiresAt && !alreadyPublished) {
    const days = Math.round((license.expiresAt.getTime() - today.getTime()) / DAY_MS);
    if (days <= EXPIRY_WARNING_DAYS) {
      findings.push({
        severity: "WARNING",
        code: "LICENSE_EXPIRING_SOON",
        message: `La licence expire le ${dayFormat.format(license.expiresAt)} (${days === 0 ? "aujourd'hui" : `dans ${days} jour${days > 1 ? "s" : ""}`}).`,
      });
    }
  }

  if (!ACCEPTED_LICENSES[project.usage].includes(license.licenseType)) {
    findings.push({
      severity: "ERROR",
      code: "LICENSE_TYPE_INSUFFICIENT",
      message:
        license.licenseType === "PERSONAL"
          ? "Utilisation commerciale détectée mais la licence est strictement personnelle."
          : "Diffusion TV, cinéma ou publicité payante : une licence étendue est requise.",
    });
  } else if (license.licenseType === "RESTRICTED" && project.usage !== "PERSONAL") {
    findings.push({
      severity: "WARNING",
      code: "LICENSE_RESTRICTED",
      message: "Licence à utilité restreinte : vérifiez que ses conditions couvrent ce projet.",
    });
  }

  if (license.documentCount === 0) {
    findings.push({
      severity: "WARNING",
      code: "MISSING_PROOF",
      message: "Aucune preuve (certificat ou facture) n'est jointe à cette licence.",
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: "OK",
      code: "LICENSED",
      message: `Couverte par la licence ${label}${license.licenseKey ? ` n° ${license.licenseKey}` : ""}.`,
    });
  }
  return findings;
}

type Candidate = { license: AuditLicense; findings: Finding[]; matchMethod: MatchMethod };

// La meilleure licence : la moins grave, puis celle qui expire le plus tard.
function better(a: Candidate, b: Candidate) {
  const diff = SEVERITY_RANK[worst(a.findings)] - SEVERITY_RANK[worst(b.findings)];
  if (diff !== 0) return diff < 0;
  const ea = a.license.expiresAt?.getTime() ?? Infinity;
  const eb = b.license.expiresAt?.getTime() ?? Infinity;
  return ea > eb;
}

export function evaluateAsset(
  asset: AuditAsset,
  licenses: AuditLicense[],
  project: AuditProject,
  now: Date,
): AssetResult {
  // 1. Licence associée à la main : elle prime, si elle existe toujours.
  if (asset.matchMethod === "MANUAL" && asset.licenseId) {
    const license = licenses.find((l) => l.id === asset.licenseId);
    if (license) {
      const findings = evaluateLicense(license, project, now);
      return { assetId: asset.id, licenseId: license.id, matchMethod: "MANUAL", severity: worst(findings), findings };
    }
  }

  // 2. Correspondance automatique par lien de la ressource ou par nom normalisé.
  const matches = licenses.filter((l) => sameSource(asset, l) || licenseKeys(l).has(asset.normalizedName));
  const samePlatform = asset.platform ? matches.filter((l) => l.platform === asset.platform) : matches;
  const pool = samePlatform.length > 0 ? samePlatform : matches;

  let best: Candidate | null = null;
  for (const license of pool) {
    const findings = evaluateLicense(license, project, now);
    if (asset.platform && license.platform !== asset.platform) {
      findings.unshift({
        severity: "WARNING",
        code: "PLATFORM_MISMATCH",
        message: `Ressource déclarée sur ${PLATFORM_LABELS[asset.platform]}, mais la licence trouvée vient de ${platformName(license)}.`,
      });
      const okIndex = findings.findIndex((f) => f.code === "LICENSED");
      if (okIndex >= 0) findings.splice(okIndex, 1);
    }
    const candidate: Candidate = { license, findings, matchMethod: "NAME" };
    if (!best || better(candidate, best)) best = candidate;
  }

  if (!best) {
    const findings: Finding[] = [
      { severity: "ERROR", code: "MISSING_LICENSE", message: "Aucune licence correspondante dans le coffre-fort." },
    ];
    return { assetId: asset.id, licenseId: null, matchMethod: null, severity: "ERROR", findings };
  }
  return {
    assetId: asset.id,
    licenseId: best.license.id,
    matchMethod: best.matchMethod,
    severity: worst(best.findings),
    findings: best.findings,
  };
}

export function auditProject(
  project: AuditProject,
  assets: AuditAsset[],
  licenses: AuditLicense[],
  now = new Date(),
): ProjectResult {
  const results = assets.map((a) => evaluateAsset(a, licenses, project, now));
  const errorCount = results.filter((r) => r.severity === "ERROR").length;
  const warningCount = results.filter((r) => r.severity === "WARNING").length;
  const okCount = results.length - errorCount - warningCount;

  const status: ComplianceStatus =
    results.length === 0 ? "PENDING" : errorCount > 0 ? "NON_COMPLIANT" : warningCount > 0 ? "WARNING" : "COMPLIANT";
  const score = results.length === 0 ? null : Math.round((100 * (okCount + warningCount / 2)) / results.length);

  return { status, score, errorCount, warningCount, assets: results };
}

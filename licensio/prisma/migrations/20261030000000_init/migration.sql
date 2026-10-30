-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('ENVATO_ELEMENTS', 'ARTLIST', 'EPIDEMIC_SOUND', 'ARTGRID', 'MUSICBED', 'SOUNDSTRIPE', 'SHUTTERSTOCK', 'ADOBE_STOCK', 'POND5', 'STORYBLOCKS', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('MUSIC', 'SFX', 'STOCK_VIDEO', 'IMAGE', 'FONT', 'OTHER');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('PERSONAL', 'COMMERCIAL', 'EXTENDED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('LICENSE_CERTIFICATE', 'INVOICE', 'RECEIPT', 'OTHER');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('NOT_REQUESTED', 'QUEUED', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ProjectUsage" AS ENUM ('PERSONAL', 'COMMERCIAL', 'BROADCAST');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('PENDING', 'COMPLIANT', 'NON_COMPLIANT');

-- CreateEnum
CREATE TYPE "MediaSource" AS ENUM ('UPLOAD', 'YOUTUBE', 'GOOGLE_DRIVE', 'OTHER_URL');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "AssetOrigin" AS ENUM ('DECLARED', 'DETECTED');

-- CreateEnum
CREATE TYPE "MatchMethod" AS ENUM ('MANUAL', 'NAME', 'FINGERPRINT');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('OK', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "FindingCode" AS ENUM ('LICENSED', 'MISSING_LICENSE', 'LICENSE_EXPIRED', 'LICENSE_REVOKED', 'LICENSE_TYPE_INSUFFICIENT', 'PLATFORM_MISMATCH', 'MISSING_PROOF');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isPersonal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "tokenHash" TEXT NOT NULL,
    "invitedById" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" UUID,
    "assetName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL DEFAULT 'MUSIC',
    "platform" "Platform" NOT NULL,
    "platformOther" TEXT,
    "sourceUrl" TEXT,
    "licenseType" "LicenseType" NOT NULL,
    "licenseKey" TEXT,
    "purchaseDate" DATE NOT NULL,
    "expiresAt" DATE,
    "revokedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_documents" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "uploadedById" UUID,
    "kind" "DocumentKind" NOT NULL DEFAULT 'LICENSE_CERTIFICATE',
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "ocrStatus" "OcrStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "ocrText" TEXT,
    "ocrFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" UUID,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "description" TEXT,
    "usage" "ProjectUsage" NOT NULL DEFAULT 'COMMERCIAL',
    "publishedAt" DATE,
    "complianceStatus" "ComplianceStatus" NOT NULL DEFAULT 'PENDING',
    "lastAuditAt" TIMESTAMP(3),
    "passportToken" TEXT,
    "passportEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_files" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "source" "MediaSource" NOT NULL,
    "fileName" TEXT,
    "storagePath" TEXT,
    "externalUrl" TEXT,
    "mimeType" TEXT,
    "sizeBytes" BIGINT,
    "durationSec" INTEGER,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processingJobId" TEXT,
    "processingError" TEXT,
    "fingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_assets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mediaFileId" TEXT,
    "origin" "AssetOrigin" NOT NULL DEFAULT 'DECLARED',
    "assetName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL DEFAULT 'MUSIC',
    "platform" "Platform",
    "startSec" INTEGER,
    "endSec" INTEGER,
    "licenseId" TEXT,
    "matchMethod" "MatchMethod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "AuditStatus" NOT NULL DEFAULT 'RUNNING',
    "result" "ComplianceStatus",
    "assetCount" INTEGER NOT NULL DEFAULT 0,
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "audit_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_findings" (
    "id" TEXT NOT NULL,
    "auditRunId" TEXT NOT NULL,
    "projectAssetId" TEXT NOT NULL,
    "licenseId" TEXT,
    "severity" "FindingSeverity" NOT NULL,
    "code" "FindingCode" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "memberships_workspaceId_idx" ON "memberships"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_workspaceId_key" ON "memberships"("userId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "invitations_workspaceId_email_idx" ON "invitations"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "licenses_workspaceId_normalizedName_idx" ON "licenses"("workspaceId", "normalizedName");

-- CreateIndex
CREATE INDEX "licenses_workspaceId_platform_idx" ON "licenses"("workspaceId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "license_documents_storagePath_key" ON "license_documents"("storagePath");

-- CreateIndex
CREATE INDEX "license_documents_licenseId_idx" ON "license_documents"("licenseId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_passportToken_key" ON "projects"("passportToken");

-- CreateIndex
CREATE INDEX "projects_workspaceId_complianceStatus_idx" ON "projects"("workspaceId", "complianceStatus");

-- CreateIndex
CREATE UNIQUE INDEX "media_files_storagePath_key" ON "media_files"("storagePath");

-- CreateIndex
CREATE INDEX "media_files_projectId_idx" ON "media_files"("projectId");

-- CreateIndex
CREATE INDEX "project_assets_projectId_idx" ON "project_assets"("projectId");

-- CreateIndex
CREATE INDEX "project_assets_licenseId_idx" ON "project_assets"("licenseId");

-- CreateIndex
CREATE INDEX "audit_runs_projectId_startedAt_idx" ON "audit_runs"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "audit_findings_auditRunId_idx" ON "audit_findings"("auditRunId");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_documents" ADD CONSTRAINT "license_documents_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_documents" ADD CONSTRAINT "license_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_mediaFileId_fkey" FOREIGN KEY ("mediaFileId") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_auditRunId_fkey" FOREIGN KEY ("auditRunId") REFERENCES "audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_projectAssetId_fkey" FOREIGN KEY ("projectAssetId") REFERENCES "project_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Supabase expose le schéma public via son API REST (clé anon publique).
-- Licensio accède aux données uniquement par Prisma côté serveur (rôle postgres,
-- qui contourne la RLS) : on active la RLS sans politique pour tout bloquer via l'API.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "licenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "license_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "media_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_findings" ENABLE ROW LEVEL SECURITY;

-- AlterEnum
ALTER TYPE "ComplianceStatus" ADD VALUE 'WARNING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FindingCode" ADD VALUE 'LICENSE_EXPIRING_SOON';
ALTER TYPE "FindingCode" ADD VALUE 'LICENSE_RESTRICTED';

-- AlterTable
ALTER TABLE "project_assets" ADD COLUMN     "author" TEXT,
ADD COLUMN     "sourceUrl" TEXT;

-- AlterTable
ALTER TABLE "audit_runs" DROP COLUMN "issueCount",
ADD COLUMN     "errorCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "score" INTEGER,
ADD COLUMN     "warningCount" INTEGER NOT NULL DEFAULT 0;


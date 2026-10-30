-- AlterEnum
ALTER TYPE "LicenseType" ADD VALUE 'RESTRICTED';

-- AlterTable
ALTER TABLE "licenses" ADD COLUMN     "author" TEXT;


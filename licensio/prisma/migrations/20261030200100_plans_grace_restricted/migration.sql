-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "passportGraceUntil" TIMESTAMP(3),
ALTER COLUMN "plan" SET DEFAULT 'FREE';

-- L'ancien plan Creator était gratuit : les espaces sans abonnement passent au plan
-- Gratuit (Creator devient le forfait à 19 €/mois).
UPDATE "workspaces" SET "plan" = 'FREE' WHERE "plan" = 'CREATOR' AND "stripeSubscriptionId" IS NULL;

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "emailSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "licenses" ADD COLUMN     "mustStayActive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "project_assets" ADD COLUMN     "restrictedApprovedAt" TIMESTAMP(3),
ADD COLUMN     "restrictedApprovedById" UUID,
ADD COLUMN     "restrictedApprovedLicenseId" TEXT;

-- AddForeignKey
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_restrictedApprovedById_fkey" FOREIGN KEY ("restrictedApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

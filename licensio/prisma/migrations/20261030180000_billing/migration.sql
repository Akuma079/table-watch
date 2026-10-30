-- CreateEnum
CREATE TYPE "WorkspacePlan" AS ENUM ('CREATOR', 'AGENCY');

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "brandColor" TEXT,
ADD COLUMN     "brandName" TEXT,
ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "plan" "WorkspacePlan" NOT NULL DEFAULT 'CREATOR',
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "subscriptionStatus" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_stripeCustomerId_key" ON "workspaces"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_stripeSubscriptionId_key" ON "workspaces"("stripeSubscriptionId");


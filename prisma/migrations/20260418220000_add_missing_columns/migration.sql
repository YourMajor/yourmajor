-- CreateEnum
CREATE TYPE "PlayerPowerupStatus" AS ENUM ('AVAILABLE', 'ACTIVE', 'USED');

-- CreateEnum
CREATE TYPE "DistributionMode" AS ENUM ('DRAFT', 'RANDOM');

-- CreateEnum
CREATE TYPE "TournamentType" AS ENUM ('PUBLIC', 'OPEN', 'INVITE');

-- AlterEnum
ALTER TYPE "HandicapSystem" ADD VALUE 'NONE';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'POWERUP_USED';
ALTER TYPE "NotificationType" ADD VALUE 'DRAFT_STARTED';
ALTER TYPE "NotificationType" ADD VALUE 'DRAFT_COMPLETED';

-- AlterEnum
BEGIN;
CREATE TYPE "TournamentStatus_new" AS ENUM ('REGISTRATION', 'ACTIVE', 'COMPLETED');
ALTER TABLE "public"."Tournament" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Tournament" ALTER COLUMN "status" TYPE "TournamentStatus_new" USING ("status"::text::"TournamentStatus_new");
ALTER TYPE "TournamentStatus" RENAME TO "TournamentStatus_old";
ALTER TYPE "TournamentStatus_new" RENAME TO "TournamentStatus";
DROP TYPE "public"."TournamentStatus_old";
ALTER TABLE "Tournament" ALTER COLUMN "status" SET DEFAULT 'REGISTRATION';
COMMIT;

-- AlterTable
ALTER TABLE "Draft" ADD COLUMN     "currentPick" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "draftOrder" JSONB;

-- AlterTable
ALTER TABLE "PlayerPowerup" ADD COLUMN     "holeNumber" INTEGER,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "roundId" TEXT,
ADD COLUMN     "scoreModifier" INTEGER,
ADD COLUMN     "status" "PlayerPowerupStatus" NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable
ALTER TABLE "Powerup" ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "championName" TEXT,
ADD COLUMN     "championUserId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "distributionMode" "DistributionMode" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "headerImage" TEXT,
ADD COLUMN     "joinCode" TEXT,
ADD COLUMN     "maxAttacksPerPlayer" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "parentTournamentId" TEXT,
ADD COLUMN     "tournamentType" "TournamentType" NOT NULL DEFAULT 'OPEN',
ALTER COLUMN "status" SET DEFAULT 'REGISTRATION';

-- AlterTable
ALTER TABLE "TournamentMessage" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "DraftPick_draftId_idx" ON "DraftPick"("draftId");

-- CreateIndex
CREATE INDEX "Notification_tournamentPlayerId_idx" ON "Notification"("tournamentPlayerId");

-- CreateIndex
CREATE INDEX "PlayerPowerup_tournamentPlayerId_idx" ON "PlayerPowerup"("tournamentPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "Powerup_slug_key" ON "Powerup"("slug");

-- CreateIndex
CREATE INDEX "Score_tournamentPlayerId_roundId_idx" ON "Score"("tournamentPlayerId", "roundId");

-- CreateIndex
CREATE INDEX "Score_roundId_idx" ON "Score"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_joinCode_key" ON "Tournament"("joinCode");

-- CreateIndex
CREATE INDEX "TournamentMessage_tournamentId_idx" ON "TournamentMessage"("tournamentId");

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_parentTournamentId_fkey" FOREIGN KEY ("parentTournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerPowerup" ADD CONSTRAINT "PlayerPowerup_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "TournamentRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

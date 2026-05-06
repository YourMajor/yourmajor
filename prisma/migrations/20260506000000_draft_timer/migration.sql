-- Draft pick timer + auto-pick + uniqueness guard.
-- - turnSeconds/turnStartedAt power the per-turn countdown and auto-pick
-- - (draftId, pickNumber) unique blocks duplicate picks from racing requests
-- - DRAFT_AUTO_PICK is the notification type used when the system picks for a player

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DRAFT_AUTO_PICK';

-- AlterTable
ALTER TABLE "Draft" ADD COLUMN     "turnSeconds" INTEGER,
                    ADD COLUMN     "turnStartedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Draft_status_turnStartedAt_idx" ON "Draft"("status", "turnStartedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DraftPick_draftId_pickNumber_key" ON "DraftPick"("draftId", "pickNumber");

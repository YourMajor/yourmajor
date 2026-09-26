-- Per-round powerup drafts.
--
-- A tournament keeps its single Draft row. Draft.currentRound says which
-- tournament round that row is currently drafting for, and each DraftPick is
-- tagged with the round it was made in, so round 2's draft can restart at
-- pick 1 without colliding with round 1's picks. Existing drafts and picks all
-- belong to round 1, which the defaults express.

-- AlterTable
ALTER TABLE "Draft" ADD COLUMN "currentRound" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "DraftPick" ADD COLUMN "tournamentRound" INTEGER NOT NULL DEFAULT 1;

-- DropIndex
DROP INDEX "DraftPick_draftId_pickNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "DraftPick_draftId_tournamentRound_pickNumber_key" ON "DraftPick"("draftId", "tournamentRound", "pickNumber");

-- AlterTable
ALTER TABLE "PlayerPowerup" ADD COLUMN "draftPickId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PlayerPowerup_draftPickId_key" ON "PlayerPowerup"("draftPickId");

-- AddForeignKey
ALTER TABLE "PlayerPowerup" ADD CONSTRAINT "PlayerPowerup_draftPickId_fkey" FOREIGN KEY ("draftPickId") REFERENCES "DraftPick"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: link every existing pick to the card it created. Until now a
-- powerup could be drafted at most once per tournament, so (player, powerup)
-- identifies the card. The two DISTINCT ON passes keep the link one-to-one in
-- both directions even if a stray duplicate row exists; anything left
-- unmatched stays NULL, and the app falls back to the old (player, powerup)
-- lookup for those.
UPDATE "PlayerPowerup" pp
   SET "draftPickId" = m."pickId"
  FROM (
    SELECT DISTINCT ON (per_pick."playerPowerupId")
           per_pick."pickId",
           per_pick."playerPowerupId"
      FROM (
        SELECT DISTINCT ON (dp."id")
               dp."id"  AS "pickId",
               pp2."id" AS "playerPowerupId"
          FROM "DraftPick" dp
          JOIN "PlayerPowerup" pp2
            ON pp2."tournamentPlayerId" = dp."tournamentPlayerId"
           AND pp2."powerupId"          = dp."powerupId"
         ORDER BY dp."id", pp2."id"
      ) per_pick
     ORDER BY per_pick."playerPowerupId", per_pick."pickId"
  ) m
 WHERE pp."id" = m."playerPowerupId";

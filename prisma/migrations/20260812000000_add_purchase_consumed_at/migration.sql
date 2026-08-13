-- Pro credit consumption needs a record that survives the tournament.
--
-- A Pro credit was "unused" iff Purchase.tournamentId was NULL. But the
-- tournament FK is ON DELETE SET NULL, so deleting the tournament nulled the
-- column and the spent credit became spendable again — one $29 credit could
-- run an unlimited number of events by deleting each one when it finished.
--
-- consumedAt records the spend on the Purchase row itself, where no tournament
-- delete can reach it.

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "consumedAt" TIMESTAMP(3);

-- Backfill: every purchase currently attached to a tournament was paid for and
-- spent, whether it was a credit redeemed later or a Pro checkout bought
-- directly against that tournament. Mark them consumed so a later delete of the
-- tournament cannot refund them. updatedAt is the closest record we have of
-- when the attachment happened.
--
-- Purchases with tournamentId IS NULL are left NULL: those are genuinely unused
-- credits and stay spendable.
UPDATE "Purchase"
   SET "consumedAt" = "updatedAt"
 WHERE "tournamentId" IS NOT NULL
   AND "consumedAt" IS NULL;

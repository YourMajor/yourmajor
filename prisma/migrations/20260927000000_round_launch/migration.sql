-- Rounds after the first open for scoring when an admin launches them
-- (openedAt) or automatically 3 hours before the first tee time. The
-- tournament's time zone turns wall-clock tee times into instants.

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "timeZone" TEXT;

-- AlterTable
ALTER TABLE "TournamentRound" ADD COLUMN "openedAt" TIMESTAMP(3);

-- Section B: Season Management — tiebreakers, drop-lowest-N, attendance bonus, manual adjustments.

-- AlterTable: extend Tournament with season-config columns.
ALTER TABLE "Tournament" ADD COLUMN "seasonDropLowest"      INTEGER;
ALTER TABLE "Tournament" ADD COLUMN "seasonTiebreakers"     JSONB;
ALTER TABLE "Tournament" ADD COLUMN "seasonAttendanceBonus" JSONB;

-- CreateTable: SeasonAdjustment — admin-applied point/stroke deltas for a root league season.
CREATE TABLE "SeasonAdjustment" (
    "id"               TEXT NOT NULL,
    "rootTournamentId" TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "delta"            INTEGER NOT NULL,
    "reason"           TEXT NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy"        TEXT NOT NULL,

    CONSTRAINT "SeasonAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SeasonAdjustment_rootTournamentId_idx" ON "SeasonAdjustment"("rootTournamentId");

ALTER TABLE "SeasonAdjustment"
    ADD CONSTRAINT "SeasonAdjustment_rootTournamentId_fkey"
    FOREIGN KEY ("rootTournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

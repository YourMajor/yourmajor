-- AlterEnum: extend TournamentFormat with the parity-with-GolfGenius format set.
-- New values are appended; existing rows with STROKE_PLAY/SCRAMBLE/BEST_BALL/SKINS keep working.
ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'STABLEFORD';
ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'MODIFIED_STABLEFORD';
ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'BEST_BALL_2';
ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'BEST_BALL_4';
ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'SHAMBLE';
ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'MATCH_PLAY';
ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'RYDER_CUP';
ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'SKINS_GROSS';
ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'SKINS_NET';
ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'QUOTA';
ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'CHAPMAN';
ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'PINEHURST';
ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'LOW_GROSS_LOW_NET';

-- AlterTable: per-format options + team toggle.
ALTER TABLE "Tournament" ADD COLUMN "formatConfig" JSONB;
ALTER TABLE "Tournament" ADD COLUMN "teamsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: TournamentTeam
CREATE TABLE "TournamentTeam" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentTeam_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TournamentTeam_tournamentId_idx" ON "TournamentTeam"("tournamentId");

ALTER TABLE "TournamentTeam"
    ADD CONSTRAINT "TournamentTeam_tournamentId_fkey"
    FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: TournamentTeamMember
CREATE TABLE "TournamentTeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "tournamentPlayerId" TEXT NOT NULL,

    CONSTRAINT "TournamentTeamMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentTeamMember_tournamentPlayerId_key" ON "TournamentTeamMember"("tournamentPlayerId");
CREATE INDEX "TournamentTeamMember_teamId_idx" ON "TournamentTeamMember"("teamId");

ALTER TABLE "TournamentTeamMember"
    ADD CONSTRAINT "TournamentTeamMember_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "TournamentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TournamentTeamMember"
    ADD CONSTRAINT "TournamentTeamMember_tournamentPlayerId_fkey"
    FOREIGN KEY ("tournamentPlayerId") REFERENCES "TournamentPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

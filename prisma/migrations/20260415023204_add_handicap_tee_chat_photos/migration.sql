-- CreateEnum
CREATE TYPE "HandicapSystem" AS ENUM ('WHS', 'STABLEFORD', 'CALLAWAY', 'PEORIA');

-- CreateEnum
CREATE TYPE "TeeMode" AS ENUM ('UNIFORM', 'CUSTOM');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "isCustom" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "StandaloneRound" ADD COLUMN     "selectedTeeOptionId" TEXT;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "handicapSystem" "HandicapSystem" NOT NULL DEFAULT 'WHS',
ADD COLUMN     "powerupsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "powerupsPerPlayer" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "TournamentRound" ADD COLUMN     "teeMode" "TeeMode" NOT NULL DEFAULT 'UNIFORM';

-- CreateTable
CREATE TABLE "RoundPlayerTee" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "tournamentPlayerId" TEXT NOT NULL,
    "teeOptionId" TEXT NOT NULL,

    CONSTRAINT "RoundPlayerTee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundHoleTee" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "holeNumber" INTEGER NOT NULL,
    "teeOptionId" TEXT NOT NULL,

    CONSTRAINT "RoundHoleTee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentMessage" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentPhoto" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoundPlayerTee_roundId_tournamentPlayerId_key" ON "RoundPlayerTee"("roundId", "tournamentPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "RoundHoleTee_roundId_holeNumber_key" ON "RoundHoleTee"("roundId", "holeNumber");

-- AddForeignKey
ALTER TABLE "RoundPlayerTee" ADD CONSTRAINT "RoundPlayerTee_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "TournamentRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundPlayerTee" ADD CONSTRAINT "RoundPlayerTee_tournamentPlayerId_fkey" FOREIGN KEY ("tournamentPlayerId") REFERENCES "TournamentPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundPlayerTee" ADD CONSTRAINT "RoundPlayerTee_teeOptionId_fkey" FOREIGN KEY ("teeOptionId") REFERENCES "TeeOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundHoleTee" ADD CONSTRAINT "RoundHoleTee_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "TournamentRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundHoleTee" ADD CONSTRAINT "RoundHoleTee_teeOptionId_fkey" FOREIGN KEY ("teeOptionId") REFERENCES "TeeOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMessage" ADD CONSTRAINT "TournamentMessage_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMessage" ADD CONSTRAINT "TournamentMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPhoto" ADD CONSTRAINT "TournamentPhoto_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPhoto" ADD CONSTRAINT "TournamentPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandaloneRound" ADD CONSTRAINT "StandaloneRound_selectedTeeOptionId_fkey" FOREIGN KEY ("selectedTeeOptionId") REFERENCES "TeeOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

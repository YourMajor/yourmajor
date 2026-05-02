-- Records when a player with an assigned tee-time slot unregisters from a
-- tournament. Surfaced to admins as a banner + sidebar badge until dismissed.

-- CreateTable
CREATE TABLE "GroupVacancy" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "groupId" TEXT,
    "groupName" TEXT NOT NULL,
    "teeTime" TIMESTAMP(3),
    "startingHole" INTEGER,
    "playerName" TEXT NOT NULL,
    "unregisteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "GroupVacancy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupVacancy_tournamentId_dismissedAt_idx" ON "GroupVacancy"("tournamentId", "dismissedAt");

-- AddForeignKey
ALTER TABLE "GroupVacancy" ADD CONSTRAINT "GroupVacancy_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupVacancy" ADD CONSTRAINT "GroupVacancy_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TournamentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

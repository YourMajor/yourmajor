-- AlterTable: Add soft-delete fields to TournamentMessage
ALTER TABLE "TournamentMessage" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "TournamentMessage" ADD COLUMN "deletedBy" TEXT;

-- CreateTable: ChatBan
CREATE TABLE "ChatBan" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "ChatBan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatBan_tournamentId_idx" ON "ChatBan"("tournamentId");
CREATE UNIQUE INDEX "ChatBan_tournamentId_userId_key" ON "ChatBan"("tournamentId", "userId");

-- AddForeignKey
ALTER TABLE "ChatBan" ADD CONSTRAINT "ChatBan_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatBan" ADD CONSTRAINT "ChatBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

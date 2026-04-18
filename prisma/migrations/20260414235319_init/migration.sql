-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PLAYER');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PowerupType" AS ENUM ('BOOST', 'ATTACK');

-- CreateEnum
CREATE TYPE "DraftFormat" AS ENUM ('LINEAR', 'SNAKE');

-- CreateEnum
CREATE TYPE "DraftTiming" AS ENUM ('PRE_TOURNAMENT', 'PRE_ROUND');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ATTACK_RECEIVED', 'DRAFT_YOUR_TURN', 'ROUND_STARTED', 'TOURNAMENT_INVITE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PLAYER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "PlayerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "avatar" TEXT,
    "handicap" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#006747',
    "accentColor" TEXT NOT NULL DEFAULT '#C9A84C',
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "isOpenRegistration" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentRound" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3),
    "courseId" TEXT NOT NULL,

    CONSTRAINT "TournamentRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "par" INTEGER NOT NULL DEFAULT 72,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hole" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "par" INTEGER NOT NULL,
    "handicap" INTEGER,

    CONSTRAINT "Hole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeeOption" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,

    CONSTRAINT "TeeOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoleYardage" (
    "id" TEXT NOT NULL,
    "holeId" TEXT NOT NULL,
    "teeOptionId" TEXT NOT NULL,
    "yards" INTEGER NOT NULL,

    CONSTRAINT "HoleYardage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentPlayer" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tee" TEXT,
    "handicap" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "tournamentPlayerId" TEXT NOT NULL,
    "holeId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "strokes" INTEGER NOT NULL,
    "fairwayHit" BOOLEAN,
    "gir" BOOLEAN,
    "putts" INTEGER,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Powerup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PowerupType" NOT NULL,
    "description" TEXT NOT NULL,
    "effect" JSONB NOT NULL,

    CONSTRAINT "Powerup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentPowerup" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "powerupId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TournamentPowerup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerPowerup" (
    "id" TEXT NOT NULL,
    "tournamentPlayerId" TEXT NOT NULL,
    "powerupId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "targetPlayerId" TEXT,

    CONSTRAINT "PlayerPowerup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "format" "DraftFormat" NOT NULL DEFAULT 'SNAKE',
    "timing" "DraftTiming" NOT NULL DEFAULT 'PRE_TOURNAMENT',
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftPick" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "tournamentPlayerId" TEXT NOT NULL,
    "powerupId" TEXT NOT NULL,
    "pickNumber" INTEGER NOT NULL,
    "roundNumber" INTEGER,

    CONSTRAINT "DraftPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tournamentPlayerId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandaloneRound" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "StandaloneRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandaloneScore" (
    "id" TEXT NOT NULL,
    "standaloneRoundId" TEXT NOT NULL,
    "holeNumber" INTEGER NOT NULL,
    "holeId" TEXT,
    "par" INTEGER NOT NULL DEFAULT 4,
    "strokes" INTEGER NOT NULL,
    "fairwayHit" BOOLEAN,
    "gir" BOOLEAN,
    "putts" INTEGER,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandaloneScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerProfile_userId_key" ON "PlayerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_slug_key" ON "Tournament"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRound_tournamentId_roundNumber_key" ON "TournamentRound"("tournamentId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Course_externalId_key" ON "Course"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Hole_courseId_number_key" ON "Hole"("courseId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "HoleYardage_holeId_teeOptionId_key" ON "HoleYardage"("holeId", "teeOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentPlayer_tournamentId_userId_key" ON "TournamentPlayer"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Score_tournamentPlayerId_holeId_roundId_key" ON "Score"("tournamentPlayerId", "holeId", "roundId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentPowerup_tournamentId_powerupId_key" ON "TournamentPowerup"("tournamentId", "powerupId");

-- CreateIndex
CREATE UNIQUE INDEX "Draft_tournamentId_key" ON "Draft"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "StandaloneScore_standaloneRoundId_holeNumber_key" ON "StandaloneScore"("standaloneRoundId", "holeNumber");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerProfile" ADD CONSTRAINT "PlayerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRound" ADD CONSTRAINT "TournamentRound_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRound" ADD CONSTRAINT "TournamentRound_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hole" ADD CONSTRAINT "Hole_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeeOption" ADD CONSTRAINT "TeeOption_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoleYardage" ADD CONSTRAINT "HoleYardage_holeId_fkey" FOREIGN KEY ("holeId") REFERENCES "Hole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoleYardage" ADD CONSTRAINT "HoleYardage_teeOptionId_fkey" FOREIGN KEY ("teeOptionId") REFERENCES "TeeOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPlayer" ADD CONSTRAINT "TournamentPlayer_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPlayer" ADD CONSTRAINT "TournamentPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_tournamentPlayerId_fkey" FOREIGN KEY ("tournamentPlayerId") REFERENCES "TournamentPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_holeId_fkey" FOREIGN KEY ("holeId") REFERENCES "Hole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "TournamentRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPowerup" ADD CONSTRAINT "TournamentPowerup_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPowerup" ADD CONSTRAINT "TournamentPowerup_powerupId_fkey" FOREIGN KEY ("powerupId") REFERENCES "Powerup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerPowerup" ADD CONSTRAINT "PlayerPowerup_tournamentPlayerId_fkey" FOREIGN KEY ("tournamentPlayerId") REFERENCES "TournamentPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerPowerup" ADD CONSTRAINT "PlayerPowerup_powerupId_fkey" FOREIGN KEY ("powerupId") REFERENCES "Powerup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_tournamentPlayerId_fkey" FOREIGN KEY ("tournamentPlayerId") REFERENCES "TournamentPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_powerupId_fkey" FOREIGN KEY ("powerupId") REFERENCES "Powerup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tournamentPlayerId_fkey" FOREIGN KEY ("tournamentPlayerId") REFERENCES "TournamentPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandaloneRound" ADD CONSTRAINT "StandaloneRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandaloneRound" ADD CONSTRAINT "StandaloneRound_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandaloneScore" ADD CONSTRAINT "StandaloneScore_standaloneRoundId_fkey" FOREIGN KEY ("standaloneRoundId") REFERENCES "StandaloneRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandaloneScore" ADD CONSTRAINT "StandaloneScore_holeId_fkey" FOREIGN KEY ("holeId") REFERENCES "Hole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

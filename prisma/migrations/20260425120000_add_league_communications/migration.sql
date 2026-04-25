-- Add league communications: blast announcements + per-recipient delivery tracking.
-- Reminder rules (auto-trigger N hours before each event) deferred to a follow-up.

-- LeagueAnnouncement — one row per blast (subject/body + audience snapshot).
CREATE TABLE "LeagueAnnouncement" (
    "id" TEXT NOT NULL,
    "rootTournamentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channels" TEXT[],
    "audienceFilter" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sentByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeagueAnnouncement_rootTournamentId_idx" ON "LeagueAnnouncement"("rootTournamentId");

ALTER TABLE "LeagueAnnouncement" ADD CONSTRAINT "LeagueAnnouncement_rootTournamentId_fkey"
    FOREIGN KEY ("rootTournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeagueAnnouncement" ADD CONSTRAINT "LeagueAnnouncement_sentByUserId_fkey"
    FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;


-- LeagueAnnouncementDelivery — fanout row per (announcement, user, channel).
-- Status transitions: PENDING → SENT | FAILED | SKIPPED. failureReason captured on FAILED.
CREATE TABLE "LeagueAnnouncementDelivery" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "LeagueAnnouncementDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeagueAnnouncementDelivery_announcementId_idx" ON "LeagueAnnouncementDelivery"("announcementId");
CREATE INDEX "LeagueAnnouncementDelivery_userId_idx" ON "LeagueAnnouncementDelivery"("userId");

ALTER TABLE "LeagueAnnouncementDelivery" ADD CONSTRAINT "LeagueAnnouncementDelivery_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "LeagueAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeagueAnnouncementDelivery" ADD CONSTRAINT "LeagueAnnouncementDelivery_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add scheduled-send and message-kind support to LeagueAnnouncement.
-- BLAST is the existing admin-composed announcement; TEE_TIME is the new system
-- audit row written when tee-time notifications go out (see Communications page).
--
-- NOTE per app_dev privileges: this SQL must be run by a Supabase Studio user
-- with ALTER privilege. After running, mark the migration as applied with
-- `npx prisma migrate resolve --applied 20260426120000_add_announcement_scheduling_and_kind`.

-- Status lifecycle: PENDING (scheduled, not yet sent) → SENT | CANCELED | FAILED.
-- Existing rows default to SENT so historical data stays correct.
CREATE TYPE "AnnouncementStatus" AS ENUM ('PENDING', 'SENT', 'CANCELED', 'FAILED');

-- Provenance of the announcement row.
CREATE TYPE "AnnouncementKind" AS ENUM ('BLAST', 'TEE_TIME', 'GROUP_CHANGE');

ALTER TABLE "LeagueAnnouncement"
  ADD COLUMN "status" "AnnouncementStatus" NOT NULL DEFAULT 'SENT',
  ADD COLUMN "scheduledFor" TIMESTAMP(3),
  ADD COLUMN "kind" "AnnouncementKind" NOT NULL DEFAULT 'BLAST';

-- Cron processor lookup: SELECT WHERE status = 'PENDING' AND scheduledFor <= now().
CREATE INDEX "LeagueAnnouncement_status_scheduledFor_idx"
  ON "LeagueAnnouncement"("status", "scheduledFor");

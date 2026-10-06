-- Dispatch claim for scheduled league announcements.
--
-- dispatchPendingAnnouncement read a PENDING row, checked it, then sent. Two
-- overlapping cron runs both passed that check and both dispatched, so every
-- recipient got the announcement twice and the SMS was billed twice.
--
-- AnnouncementStatus has no non-terminal value to claim into, so the claim is a
-- compare-and-swap on this column from NULL (or from a stale timestamp, so a
-- run that dies mid-dispatch does not strand the row forever).
ALTER TABLE "LeagueAnnouncement" ADD COLUMN "dispatchStartedAt" TIMESTAMP(3);

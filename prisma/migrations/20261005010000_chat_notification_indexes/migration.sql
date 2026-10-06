-- Composite indexes for the two hot read paths that filter and sort beyond the
-- column they were indexed on.
--
-- Chat GET filters { tournamentId, deletedAt: null } and orders by createdAt
-- desc; the notification poll filters { tournamentPlayerId, readAt: null } and
-- orders by createdAt desc. With only the leading column indexed, Postgres had
-- to sort the whole tournament's (or player's) set on every poll.
--
-- No DESC on createdAt: a btree scans backwards just as cheaply.
--
-- The old single-column indexes are left-prefixes of these, so keeping them
-- would only cost writes.
CREATE INDEX IF NOT EXISTS "TournamentMessage_tournamentId_deletedAt_createdAt_idx"
  ON "TournamentMessage"("tournamentId", "deletedAt", "createdAt");
DROP INDEX IF EXISTS "TournamentMessage_tournamentId_idx";

CREATE INDEX IF NOT EXISTS "Notification_tournamentPlayerId_readAt_createdAt_idx"
  ON "Notification"("tournamentPlayerId", "readAt", "createdAt");
DROP INDEX IF EXISTS "Notification_tournamentPlayerId_idx";

-- ─── 1. Schema changes ───────────────────────────────────────────────────────
-- Five hot-path columns with no usable index today. Index-only additions —
-- no data change, safe to re-run.
--
-- TournamentGroupMember.groupId and Invitation.tournamentId had no index at
-- all despite being join/filter columns on every groups + invites read.
--
-- TournamentPlayer.userId: the @@unique([tournamentId, userId]) index leads
-- with tournamentId, so it can't serve /dashboard, /profile and /tournaments,
-- which all filter on userId alone.
--
-- PlayerPowerup(targetPlayerId, status): scoring.ts loads inbound attacks
-- with a top-level `targetPlayerId IN (...) AND status = 'USED'` that isn't
-- scoped by tournamentPlayerId, so the existing index doesn't apply.
--
-- Purchase(userId, type, status): every stripe.ts entitlement check filters
-- all three together; only userId is indexed today.

CREATE INDEX IF NOT EXISTS "TournamentGroupMember_groupId_idx"
  ON "TournamentGroupMember"("groupId");

CREATE INDEX IF NOT EXISTS "Invitation_tournamentId_idx"
  ON "Invitation"("tournamentId");

CREATE INDEX IF NOT EXISTS "TournamentPlayer_userId_idx"
  ON "TournamentPlayer"("userId");

CREATE INDEX IF NOT EXISTS "PlayerPowerup_targetPlayerId_status_idx"
  ON "PlayerPowerup"("targetPlayerId", "status");

CREATE INDEX IF NOT EXISTS "Purchase_userId_type_status_idx"
  ON "Purchase"("userId", "type", "status");

-- ─── 2. Footer: record the migration in _prisma_migrations ───────────────────
INSERT INTO _prisma_migrations
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  'manual-resolve',
  now(),
  '20260803000000_add_missing_indexes',
  NULL,
  NULL,
  now(),
  1
)
ON CONFLICT DO NOTHING;

UPDATE _prisma_migrations
SET finished_at = COALESCE(finished_at, now()),
    rolled_back_at = NULL,
    logs = NULL,
    applied_steps_count = GREATEST(applied_steps_count, 1)
WHERE migration_name = '20260803000000_add_missing_indexes';

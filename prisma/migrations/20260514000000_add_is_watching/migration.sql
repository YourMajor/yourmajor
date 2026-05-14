-- ─── 1. Schema changes ───────────────────────────────────────────────────────
-- "Watching" flag on TournamentPlayer. Lets a logged-in user look up a public
-- tournament by join code and have it appear on /tournaments under a Watching
-- section without registering as a participant. Defaults to false so existing
-- rows are unaffected.
ALTER TABLE "TournamentPlayer"
  ADD COLUMN IF NOT EXISTS "isWatching" BOOLEAN NOT NULL DEFAULT false;

-- ─── 2. Footer: record the migration in _prisma_migrations ───────────────────
INSERT INTO _prisma_migrations
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  'manual-resolve',
  now(),
  '20260514000000_add_is_watching',
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
WHERE migration_name = '20260514000000_add_is_watching';

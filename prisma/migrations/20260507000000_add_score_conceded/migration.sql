-- ─── 1. Schema changes ───────────────────────────────────────────────────────
-- Match-play concession marker. When true, the conceding player loses the hole
-- regardless of strokes. Match-play scoring ignores `strokes` when conceded;
-- other formats also skip the row.
ALTER TABLE "Score" ADD COLUMN "conceded" BOOLEAN NOT NULL DEFAULT false;

-- ─── 2. Footer: record the migration in _prisma_migrations ───────────────────
INSERT INTO _prisma_migrations
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  'manual-resolve',
  now(),
  '20260507000000_add_score_conceded',
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
WHERE migration_name = '20260507000000_add_score_conceded';

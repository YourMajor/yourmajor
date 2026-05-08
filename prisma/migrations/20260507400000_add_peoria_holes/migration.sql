-- ─── 1. Schema changes ───────────────────────────────────────────────────────
-- Six secret holes for Peoria format, stored per round so multi-round / multi-course
-- tournaments can draw a fresh set for each round. Empty array for non-Peoria. The
-- scoring engine reads this column when handicapSystem = 'PEORIA' and only reveals
-- the hole numbers on the leaderboard once every participant has scored all 18
-- holes for the round.
DO $$ BEGIN
    ALTER TABLE "TournamentRound"
        ADD COLUMN "peoriaHoles" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ─── 2. Footer: record the migration in _prisma_migrations ───────────────────
INSERT INTO _prisma_migrations
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  'manual-resolve',
  now(),
  '20260507400000_add_peoria_holes',
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
WHERE migration_name = '20260507400000_add_peoria_holes';

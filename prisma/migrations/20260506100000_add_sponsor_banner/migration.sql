-- ─── 1. Schema changes ───────────────────────────────────────────────────────
ALTER TABLE "Tournament" ADD COLUMN "sponsorBannerUrl" TEXT;

-- ─── 2. Footer: record the migration in _prisma_migrations ───────────────────
INSERT INTO _prisma_migrations
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  'manual-resolve',
  now(),
  '20260506100000_add_sponsor_banner',
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
WHERE migration_name = '20260506100000_add_sponsor_banner';

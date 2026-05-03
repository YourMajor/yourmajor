-- ─── Manual migration template ───────────────────────────────────────────────
-- The app_dev role used at runtime lacks ALTER, so schema changes ship as
-- manual SQL applied via Supabase Studio (postgres superuser). This template
-- shows the shape: schema changes first, then a footer that records the
-- migration in _prisma_migrations so `prisma migrate deploy` accepts the DB
-- as up-to-date in the same Studio session.
--
-- Workflow:
--   1. Edit prisma/schema.prisma.
--   2. npx prisma migrate dev --create-only --name <descriptive_name>
--      → generates prisma/migrations/<timestamp>_<name>/migration.sql.
--   3. Append the footer at the bottom of that file (with the migration name
--      filled in). Then paste the entire file into Supabase Studio (dev DB).
--   4. Repeat the paste against prod's Supabase Studio.
--   5. npx prisma generate (locally) to update the Prisma client.
--
-- Skip the helper script. The footer marks _prisma_migrations from inside the
-- same Studio transaction, so no DIRECT_URL credentials are needed locally.
-- The helper at scripts/migrate-resolve.mjs is a fallback for one-offs.

-- ─── 1. Schema changes ───────────────────────────────────────────────────────
-- Replace this section with whatever Prisma generated. Examples:
--
--   ALTER TABLE "Foo" ADD COLUMN "bar" TEXT;
--
--   CREATE TABLE "Baz" (
--       "id" TEXT NOT NULL,
--       ...
--       CONSTRAINT "Baz_pkey" PRIMARY KEY ("id")
--   );
--
-- If matching an existing project pattern, also enable RLS on new tables:
--   ALTER TABLE "Baz" ENABLE ROW LEVEL SECURITY;

-- ─── 2. Footer: record the migration in _prisma_migrations ───────────────────
-- Replace <MIGRATION_NAME_HERE> with the folder name (e.g.
-- 20260503000000_add_push_notifications). ON CONFLICT DO NOTHING makes this
-- safe to re-run and safe in environments where `prisma migrate deploy` may
-- have already created a (possibly failed) row for the same migration.

INSERT INTO _prisma_migrations
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  'manual-resolve',
  now(),
  '<MIGRATION_NAME_HERE>',
  NULL,
  NULL,
  now(),
  1
)
ON CONFLICT DO NOTHING;

-- If a row already exists in a failed state (P3009/P3018 from a prior deploy
-- attempt), the INSERT no-ops and you also need this UPDATE to clear the
-- failure flags. Safe to leave in by default.
UPDATE _prisma_migrations
SET finished_at = COALESCE(finished_at, now()),
    rolled_back_at = NULL,
    logs = NULL,
    applied_steps_count = GREATEST(applied_steps_count, 1)
WHERE migration_name = '<MIGRATION_NAME_HERE>';

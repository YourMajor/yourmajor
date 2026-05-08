-- ─── 1. Schema changes ───────────────────────────────────────────────────────
-- Per-user "favourite" marker for powerups. Lets players star preferred cards
-- before the draft starts (so they're easy to spot when their pick comes up)
-- and filter the draft grid to favourites only. Composite PK keeps it simple
-- and dedupes by (userId, powerupId).
CREATE TABLE IF NOT EXISTS "PowerupFavorite" (
    "userId" TEXT NOT NULL,
    "powerupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PowerupFavorite_pkey" PRIMARY KEY ("userId","powerupId")
);

CREATE INDEX IF NOT EXISTS "PowerupFavorite_userId_idx" ON "PowerupFavorite"("userId");

-- FKs guarded with DO blocks so re-running on a partially-applied DB is safe.
DO $$ BEGIN
    ALTER TABLE "PowerupFavorite" ADD CONSTRAINT "PowerupFavorite_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "PowerupFavorite" ADD CONSTRAINT "PowerupFavorite_powerupId_fkey"
        FOREIGN KEY ("powerupId") REFERENCES "Powerup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. Footer: record the migration in _prisma_migrations ───────────────────
INSERT INTO _prisma_migrations
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  'manual-resolve',
  now(),
  '20260507300000_add_powerup_favorites',
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
WHERE migration_name = '20260507300000_add_powerup_favorites';

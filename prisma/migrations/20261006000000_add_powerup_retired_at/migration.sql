-- Retire near-duplicate powerup cards without deleting them.
--
-- Several cards were mechanically identical to a sibling (Drop Zone and Brush
-- It Off were the same sentence; The Dropdown is a strict superset of Skipping
-- Stones). Deleting the duplicates is not an option: PlayerPowerup, DraftPick
-- and PowerupFavorite all reference Powerup by foreign key, so a delete would
-- erase cards from the history of tournaments that already played them.
--
-- `retiredAt` is a soft marker instead. A retired card is filtered out of NEW
-- tournament pools and the browse grid; events that already hold it keep
-- playing it exactly as before. Nullable with no default, so this is a
-- metadata-only change that rewrites no rows.
--
-- Authored by hand rather than via `prisma migrate dev`: Supabase's app role
-- has no CREATEDB, so Prisma cannot build a shadow database (P3014). Apply
-- with `prisma migrate deploy`, which needs no shadow DB.
ALTER TABLE "Powerup" ADD COLUMN IF NOT EXISTS "retiredAt" TIMESTAMP(3);

-- Partial-free plain index: the common query is `WHERE retiredAt IS NULL`
-- when building a pool, and Postgres uses a plain btree for IS NULL fine.
CREATE INDEX IF NOT EXISTS "Powerup_retiredAt_idx" ON "Powerup"("retiredAt");

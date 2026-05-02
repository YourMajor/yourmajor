-- ──────────────────────────────────────────────────────────────────────────────
-- DEFERRED migration: denormalize rootTournamentId on Tournament
--
-- Status: Prepared but NOT applied. The matching schema field + application
-- code that reads/writes this column have been removed from the working tree
-- to avoid `P2022 ColumnNotFound` errors. Re-introduce them in a single
-- coordinated change once this SQL has been run via Supabase Studio (the
-- app_dev role lacks ALTER).
--
-- Why this denormalization: getLeagueRootId() currently walks
-- parentTournamentId one query at a time (up to 100 hops). A column on
-- Tournament resolves it in a single read.
--
-- To re-enable after running this SQL:
--   1. In prisma/schema.prisma, add `rootTournamentId String?` to Tournament
--      (between childTournaments and championUserId) and an
--      @@index([rootTournamentId]) at the bottom.
--   2. Restore the fast-path branch in getLeagueRootId
--      (src/lib/league-events.ts) — see git history of that file.
--   3. In scheduleLeagueEvent (src/lib/league-event-actions.ts) and
--      createTournamentFromWizard (src/app/(main)/tournaments/new/actions.ts),
--      stamp rootTournamentId on tournament create.
--   4. In deleteLeagueEvent, recompute rootTournamentId for re-linked children.
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Add the column (nullable so the backfill can run before any writes).
ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "rootTournamentId" TEXT;

-- 2. Index for the rare reverse lookup (all events under a root).
CREATE INDEX IF NOT EXISTS "Tournament_rootTournamentId_idx"
  ON "Tournament" ("rootTournamentId");

-- 3. Backfill via recursive CTE: walk up parentTournamentId chains and set
--    rootTournamentId on every non-root row to the chain's terminal ancestor.
WITH RECURSIVE chain (id, root_id) AS (
  SELECT id, id AS root_id
    FROM "Tournament"
   WHERE "parentTournamentId" IS NULL

  UNION ALL

  SELECT t.id, c.root_id
    FROM "Tournament" t
    JOIN chain c ON t."parentTournamentId" = c.id
)
UPDATE "Tournament" t
   SET "rootTournamentId" = c.root_id
  FROM chain c
 WHERE t.id = c.id
   AND t.id <> c.root_id;
-- Roots stay NULL.

-- 4. (Optional) FK back to Tournament — Prisma doesn't model this relation,
--    so the FK is omitted to match the schema. Add it manually if desired:
-- ALTER TABLE "Tournament"
--   ADD CONSTRAINT "Tournament_rootTournamentId_fkey"
--   FOREIGN KEY ("rootTournamentId") REFERENCES "Tournament"(id)
--   ON DELETE SET NULL;

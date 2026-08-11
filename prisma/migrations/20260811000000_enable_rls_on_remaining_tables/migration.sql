-- Enable Row Level Security on every public table that still lacks it.
--
-- Why this is a loop and not a list of ALTER statements:
-- 20260423100000_enable_rls_all_tables named its 34 tables by hand. Every model
-- added since — GroupVacancy, LeagueAnnouncement, LeagueAnnouncementDelivery,
-- PowerupFavorite, RateLimit, SeasonAdjustment, TournamentTeam,
-- TournamentTeamMember — was therefore left with RLS off, because nothing makes
-- adding a model prompt you to add it to that list. A hand-maintained list is
-- the defect. This form cannot drift: any table that exists without RLS gets it.
--
-- Measured before writing this (2026-08-11), against production over PostgREST
-- with the public anon key: "PowerupFavorite" returned 53 rows and "RateLimit"
-- returned its contents to an unauthenticated caller, and both accepted DELETE
-- and PATCH (204, zero rows touched by the probe's impossible filter). An
-- anon-writable RateLimit defeats the rate limiting added the day before — the
-- limiter's own counters could simply be deleted. The other six read as empty
-- only because they hold no rows yet, not because anything protects them.
--
-- Safe to run against a database where RLS is already on: ENABLE ROW LEVEL
-- SECURITY is a no-op there, and the WHERE clause skips those tables anyway.
--
-- No realtime risk. Realtime covers exactly Notification, TournamentMessage,
-- Score, Draft and DraftPick (see scripts/enable-realtime-and-policies.sql);
-- all five already have RLS plus their authenticated-role SELECT policies, so
-- this migration does not touch them.

DO $$
DECLARE
  target regclass;
BEGIN
  FOR target IN
    SELECT c.oid::regclass
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
      -- Prisma's own bookkeeping table, not application data.
      AND c.relname <> '_prisma_migrations'
    ORDER BY c.relname
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target);
      RAISE NOTICE 'RLS enabled on %', target;
    EXCEPTION WHEN insufficient_privilege THEN
      -- Only the table owner may ALTER it. Warn rather than abort: this runs in
      -- the Vercel build via `prisma migrate deploy`, and failing the migration
      -- would block the whole deployment over one table we do not own.
      RAISE WARNING 'could not enable RLS on % (not owner) - fix by hand', target;
    END;
  END LOOP;
END $$;

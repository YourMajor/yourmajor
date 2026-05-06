-- Run this in Supabase Dashboard → SQL Editor (every environment: dev, staging, prod).
-- Idempotent: safe to re-run.
--
-- Fixes in-app live updates (powerup attacks, chat messages, draft "your turn",
-- live leaderboard, draft picks). Two fixes in one script:
--   1. Adds the affected tables to the supabase_realtime publication so Postgres
--      streams INSERT/UPDATE events to subscribed clients.
--   2. Adds RLS SELECT policies for the `authenticated` role. Realtime evaluates
--      RLS as the connecting user; without these policies, RLS-enabled tables
--      drop every event before it reaches the browser. Prisma writes use the
--      postgres role and bypass RLS, so server code is unaffected.
--
-- Auth → Prisma User mapping: this app links Supabase Auth users to Prisma User
-- rows by email (see src/lib/auth.ts). Helper function below resolves the
-- current Prisma User.id from the JWT email.

------------------------------------------------------------------------
-- 1. Publication
------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Notification','TournamentMessage','Score','Draft','DraftPick']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

------------------------------------------------------------------------
-- 2. Helper functions (SECURITY DEFINER to bypass RLS on User lookups)
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM "User" WHERE email = (auth.jwt() ->> 'email') LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_tournament_player(tournament_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "TournamentPlayer" tp
    WHERE tp."tournamentId" = tournament_id
      AND tp."userId" = public.current_app_user_id()
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_tournament_player(text) TO authenticated;

------------------------------------------------------------------------
-- 3. RLS SELECT policies for `authenticated`
--    Drop-then-create so the script stays idempotent.
------------------------------------------------------------------------

-- Notification: only the target player can read their own notifications.
DROP POLICY IF EXISTS "realtime_select_notifications" ON "Notification";
CREATE POLICY "realtime_select_notifications" ON "Notification"
  FOR SELECT TO authenticated
  USING (
    "tournamentPlayerId" IN (
      SELECT id FROM "TournamentPlayer"
      WHERE "userId" = public.current_app_user_id()
    )
  );

-- TournamentMessage: any participant of the tournament can read.
DROP POLICY IF EXISTS "realtime_select_tournament_messages" ON "TournamentMessage";
CREATE POLICY "realtime_select_tournament_messages" ON "TournamentMessage"
  FOR SELECT TO authenticated
  USING (public.is_tournament_player("tournamentId"));

-- Score: any participant of the score's tournament can read (live leaderboard).
DROP POLICY IF EXISTS "realtime_select_scores" ON "Score";
CREATE POLICY "realtime_select_scores" ON "Score"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "TournamentPlayer" tp
      WHERE tp.id = "Score"."tournamentPlayerId"
        AND public.is_tournament_player(tp."tournamentId")
    )
  );

-- Draft: any participant of the draft's tournament can read.
DROP POLICY IF EXISTS "realtime_select_drafts" ON "Draft";
CREATE POLICY "realtime_select_drafts" ON "Draft"
  FOR SELECT TO authenticated
  USING (public.is_tournament_player("tournamentId"));

-- DraftPick: any participant of the draft's tournament can read.
DROP POLICY IF EXISTS "realtime_select_draft_picks" ON "DraftPick";
CREATE POLICY "realtime_select_draft_picks" ON "DraftPick"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "Draft" d
      WHERE d.id = "DraftPick"."draftId"
        AND public.is_tournament_player(d."tournamentId")
    )
  );

------------------------------------------------------------------------
-- 4. Verification (run these manually after executing the script)
------------------------------------------------------------------------
-- Expected: five rows.
-- SELECT tablename FROM pg_publication_tables
--  WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
--  ORDER BY tablename;
--
-- Expected: five rows, one per realtime_select_* policy.
-- SELECT polname, polrelid::regclass
--   FROM pg_policy
--  WHERE polname LIKE 'realtime_select_%'
--  ORDER BY polname;

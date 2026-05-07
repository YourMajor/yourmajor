-- ─── 1. Schema changes ───────────────────────────────────────────────────────
-- Captain badge for team-format leaderboard rows. Informational only — any
-- member of a team may still submit scores in team-mode entry.
ALTER TABLE "TournamentTeamMember" ADD COLUMN "isCaptain" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: the first-created member of each existing team becomes captain so
-- pre-migration teams have a non-empty captain assignment. Uses a CTE to pick
-- the row with the smallest (id) per teamId — TournamentTeamMember.id is a
-- cuid so lexical order matches insertion order closely enough for this seed.
WITH first_member AS (
  SELECT DISTINCT ON ("teamId") "id"
  FROM "TournamentTeamMember"
  ORDER BY "teamId", "id"
)
UPDATE "TournamentTeamMember" m
SET "isCaptain" = true
FROM first_member f
WHERE m."id" = f."id";

-- ─── 2. Footer: record the migration in _prisma_migrations ───────────────────
INSERT INTO _prisma_migrations
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  'manual-resolve',
  now(),
  '20260507100000_add_team_member_captain',
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
WHERE migration_name = '20260507100000_add_team_member_captain';

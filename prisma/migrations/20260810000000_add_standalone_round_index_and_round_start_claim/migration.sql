-- ─── 1. StandaloneRound.userId index ─────────────────────────────────────────
-- StandaloneRound had no index at all, despite userId being the filter column
-- for /dashboard (count of a user's rounds) and /profile (list + count). Same
-- gap TournamentPlayer had before 20260803000000_add_missing_indexes.
-- Index-only addition, no data change, safe to re-run.

CREATE INDEX IF NOT EXISTS "StandaloneRound_userId_idx"
  ON "StandaloneRound"("userId");

-- ─── 2. TournamentRound.roundStartAnnouncedAt ────────────────────────────────
-- Claimed by whichever score submission is first to post the "Round has begun"
-- chat message, replacing a `SELECT count(*) FROM "Score" WHERE roundId = ?`
-- gate that ran on every new score and raced: two players submitting their
-- first score simultaneously both saw a count of 2, so neither posted.
--
-- Deliberately no backfill. Rounds already under way keep a NULL claim, and
-- api/scores/route.ts still runs its existing duplicate-message check after
-- claiming, so an in-flight round cannot re-announce itself after deploy.

ALTER TABLE "TournamentRound" ADD COLUMN IF NOT EXISTS "roundStartAnnouncedAt" TIMESTAMP(3);

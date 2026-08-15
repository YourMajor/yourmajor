-- Backfill the handicap snapshot onto TournamentPlayer rows that never got one.
--
-- TournamentPlayer.handicap is meant to be a snapshot taken at registration,
-- but scoring read it as `p.handicap || profile.handicap || 0`. The column is
-- Float @default(0), and `||` is a falsy check, so every row storing 0 — a
-- creator row, a watcher, an admin later added as a player, anyone who
-- registered before their profile had a handicap — silently resolved to the
-- player's *live* profile handicap instead. Scoring now reads the stored value
-- alone, so those rows must carry the value the fallback was supplying or they
-- would all become scratch and every standing they appear in would move.
--
-- Copy the profile handicap onto exactly those rows.
UPDATE "TournamentPlayer" tp
   SET "handicap" = pp."handicap"
  FROM "PlayerProfile" pp
 WHERE pp."userId" = tp."userId"
   AND tp."handicap" = 0
   AND pp."handicap" <> 0;

-- Idempotent: every row it touches ends up non-zero, so `tp."handicap" = 0` no
-- longer matches it and a re-run selects nothing. Rows whose profile handicap
-- is 0 or absent are left alone — they resolved to 0 under the fallback and
-- resolve to 0 from the stored column, same value.
--
-- Standings-preserving, and therefore safe in either deploy order. Under the
-- OLD code a targeted row read 0 and fell through to pp."handicap"; after this
-- runs it reads pp."handicap" directly and the `||` yields the same number, so
-- running the migration first changes no leaderboard. Under the NEW code the
-- row reads pp."handicap" with no fallback, which is what the old code
-- computed, so running the code first and this after restores it. The only
-- window is code-before-migration, where an affected row scores as scratch
-- until this runs.
--
-- Rows in COMPLETED events are included deliberately: they are precisely the
-- rows whose finished results were being computed from the live profile
-- handicap, and skipping them would rewrite that history.

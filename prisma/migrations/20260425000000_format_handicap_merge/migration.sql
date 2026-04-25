-- Merge handicap step into format step. Add three new format enum values:
--   STROKE_PLAY_NET — stroke play with WHS handicap allowance
--   CALLAWAY        — Callaway one-time-event handicap calculation
--   PEORIA          — Peoria secret-hole handicap calculation
-- Existing rows are unaffected; the wizard now drives handicapSystem
-- from the chosen format's impliedHandicap and hides the standalone
-- Handicap step.

ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'STROKE_PLAY_NET';
ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'CALLAWAY';
ALTER TYPE "TournamentFormat" ADD VALUE IF NOT EXISTS 'PEORIA';

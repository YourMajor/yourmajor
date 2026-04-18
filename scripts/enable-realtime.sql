-- Run this in Supabase Dashboard → SQL Editor
-- Enables Realtime for live leaderboard, draft, and notifications

ALTER PUBLICATION supabase_realtime ADD TABLE "Score", "Draft", "DraftPick", "Notification";

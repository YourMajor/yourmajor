-- Adds targetHoleNumber to PlayerPowerup. Required because attacks now apply
-- to a hole on the recipient's scorecard, decoupled from the attacker's
-- activation hole. The existing `holeNumber` column keeps its meaning
-- (attacker's current hole at activation, used for chat log + analytics).
--
-- Run via Supabase Studio SQL editor; app_dev cannot ALTER.

ALTER TABLE "PlayerPowerup"
  ADD COLUMN IF NOT EXISTS "targetHoleNumber" INTEGER;

-- Verify:
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'PlayerPowerup'
--    AND column_name = 'targetHoleNumber';

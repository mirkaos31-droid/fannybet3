-- Migration: add winners list and animation flags to matchdays
ALTER TABLE matchdays
  ADD COLUMN IF NOT EXISTS winners JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS winner_animation BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS leaderboard_animation BOOLEAN DEFAULT FALSE;

-- Backfill winners for past archived matchdays as empty arrays (idempotent)
UPDATE matchdays SET winners = '[]'::jsonb WHERE winners IS NULL;
UPDATE matchdays SET winner_animation = FALSE WHERE winner_animation IS NULL;
UPDATE matchdays SET leaderboard_animation = FALSE WHERE leaderboard_animation IS NULL;

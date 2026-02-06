-- Migration: Add winner_animation flag to duels
ALTER TABLE duels
  ADD COLUMN IF NOT EXISTS winner_animation BOOLEAN DEFAULT FALSE;

UPDATE duels SET winner_animation = FALSE WHERE winner_animation IS NULL;

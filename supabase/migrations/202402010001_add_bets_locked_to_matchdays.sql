-- Migration: add bets_locked flag to matchdays
ALTER TABLE public.matchdays
ADD COLUMN IF NOT EXISTS bets_locked BOOLEAN DEFAULT FALSE;

-- Ensure default is false for existing rows
UPDATE public.matchdays SET bets_locked = FALSE WHERE bets_locked IS NULL;
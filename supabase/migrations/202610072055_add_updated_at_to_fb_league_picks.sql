-- Migration: Add updated_at column to fb_league_picks
-- Description: Fixes error "column updated_at of relation fb_league_picks does not exist" when submitting picks.

ALTER TABLE public.fb_league_picks 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

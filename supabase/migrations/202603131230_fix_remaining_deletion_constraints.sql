-- Migration: Fix Remaining Deletion Constraints
-- Description: Adds ON DELETE CASCADE to foreign keys that were blocking user deletion.

-- 1. FB Leagues: Cascade deletion if the admin user is deleted
ALTER TABLE public.fb_leagues
DROP CONSTRAINT IF EXISTS fb_leagues_admin_id_fkey,
ADD CONSTRAINT fb_leagues_admin_id_fkey 
FOREIGN KEY (admin_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Survival Picks: Cascade deletion if the player record is deleted
-- (Since survival_players already has ON DELETE CASCADE with profiles, this completes the chain)
ALTER TABLE public.survival_picks
DROP CONSTRAINT IF EXISTS survival_picks_player_id_fkey,
ADD CONSTRAINT survival_picks_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES public.survival_players(id) ON DELETE CASCADE;

-- 3. Survival Players: Season reference cleanup (optional but good for structural integrity)
ALTER TABLE public.survival_players
DROP CONSTRAINT IF EXISTS survival_players_season_id_fkey,
ADD CONSTRAINT survival_players_season_id_fkey 
FOREIGN KEY (season_id) REFERENCES public.survival_seasons(id) ON DELETE CASCADE;

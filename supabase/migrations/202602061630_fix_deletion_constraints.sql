-- Migration: Fix Deletion Constraints to allow proper user cleanup
-- This migration updates foreign keys to use ON DELETE CASCADE

-- 1. Profiles Table
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey,
ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Bets Table
ALTER TABLE public.bets
DROP CONSTRAINT IF EXISTS bets_user_id_fkey,
ADD CONSTRAINT bets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Survival Players Table
ALTER TABLE public.survival_players
DROP CONSTRAINT IF EXISTS survival_players_user_id_fkey,
ADD CONSTRAINT survival_players_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Duels Table
ALTER TABLE public.duels
DROP CONSTRAINT IF EXISTS duels_challenger_id_fkey,
ADD CONSTRAINT duels_challenger_id_fkey FOREIGN KEY (challenger_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.duels
DROP CONSTRAINT IF EXISTS duels_opponent_id_fkey,
ADD CONSTRAINT duels_opponent_id_fkey FOREIGN KEY (opponent_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.duels
DROP CONSTRAINT IF EXISTS duels_winner_id_fkey,
ADD CONSTRAINT duels_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

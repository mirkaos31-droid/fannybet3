-- Migration: Fix Relationships for Joins
-- Description: Adds explicit foreign keys from tables referencing auth.users to public.profiles to enable PostgREST joins.

-- Fix survival_players -> profiles
ALTER TABLE public.survival_players
DROP CONSTRAINT IF EXISTS survival_players_user_id_fkey;

ALTER TABLE public.survival_players
ADD CONSTRAINT survival_players_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Fix bets -> profiles
ALTER TABLE public.bets
DROP CONSTRAINT IF EXISTS bets_user_id_fkey;

ALTER TABLE public.bets
ADD CONSTRAINT bets_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Also ensure RLS allows reading profiles from any authenticated user
-- (Already in 0003 but let's be double sure if there's any confusion)
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.survival_players TO authenticated;
GRANT SELECT ON public.survival_seasons TO authenticated;

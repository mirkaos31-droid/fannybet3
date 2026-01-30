-- Migration: Add total_points to profiles
-- Date: 2026-01-30

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;

-- Update the reset function to include total_points
CREATE OR REPLACE FUNCTION public.reset_fanny_system()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Security Check: Only admins can call this
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'ADMIN' THEN
    RAISE EXCEPTION 'Solo un amministratore può resettare il sistema.';
  END IF;

  -- 2. Delete all transaction/game data
  DELETE FROM public.bets;
  DELETE FROM public.duels;
  DELETE FROM public.survival_picks;
  DELETE FROM public.survival_players;
  DELETE FROM public.survival_seasons;
  DELETE FROM public.matchdays;

  -- 3. Reset all user statistics and tokens
  UPDATE public.profiles
  SET 
    tokens = 10,
    wins_1x2 = 0,
    wins_survival = 0,
    total_points = 0, -- Added this
    level = 1,
    prediction_accuracy = 0,
    bets_placed = 0,
    total_tokens_won = 0;
END;
$$;

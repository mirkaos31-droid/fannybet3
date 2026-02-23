-- Migration to fix the system reset function by adding WHERE clauses and FB Lega tables
CREATE OR REPLACE FUNCTION public.reset_fanny_system()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Security Check: Only admins can call this
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'ADMIN' THEN
    RAISE EXCEPTION 'Solo un amministratore può resettare il sistema.';
  END IF;

  -- 2. Delete all transaction/game data with WHERE true to satisfy PostgREST safe-delete requirements
  -- We use WHERE true to ensure the database executes the delete even without specific filters.
  
  -- FB Lega
  DELETE FROM public.fb_league_picks WHERE true;
  DELETE FROM public.fb_league_participants WHERE true;
  DELETE FROM public.fb_leagues WHERE true;

  -- Survival
  DELETE FROM public.survival_picks WHERE true;
  DELETE FROM public.survival_players WHERE true;
  DELETE FROM public.survival_seasons WHERE true;

  -- 1x2 Betting
  DELETE FROM public.bets WHERE true;
  DELETE FROM public.matchdays WHERE true;

  -- 3. Reset all user statistics and tokens to starting values
  UPDATE public.profiles
  SET 
    tokens = 10,
    wins_1x2 = 0,
    wins_survival = 0,
    level = 1,
    prediction_accuracy = 0,
    bets_placed = 0,
    total_tokens_won = 0,
    total_points = 0
  WHERE true;
END;
$$;

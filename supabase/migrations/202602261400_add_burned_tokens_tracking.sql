-- Migration: Add Burned Tokens Tracking
-- Description: Creates a system_stats table to track persistent game counts and updates betting/reset RPCs.

-- 1. Create system_stats table
CREATE TABLE IF NOT EXISTS public.system_stats (
    key TEXT PRIMARY KEY,
    value NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Initialize burned_tokens
INSERT INTO public.system_stats (key, value)
VALUES ('burned_tokens', 0)
ON CONFLICT (key) DO NOTHING;

-- 3. Update submit_1x2_bet to increment burned_tokens
CREATE OR REPLACE FUNCTION public.submit_1x2_bet(p_predictions TEXT[], p_include_super_jackpot BOOLEAN)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_cost INTEGER;
    v_matchday RECORD;
    v_current_tokens NUMERIC;
    v_bet_id BIGINT;
BEGIN
    -- 1. Check Auth
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Not logged in');
    END IF;

    -- 2. Get Active Matchday
    SELECT * INTO v_matchday FROM public.matchdays WHERE deadline > now() ORDER BY deadline ASC LIMIT 1;
    IF v_matchday IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Scommesse chiuse per la giornata (deadline raggiunta).');
    END IF;

    -- 3. Calculate Cost (Always 1 for base bet + 1 if superjackpot)
    v_cost := CASE WHEN p_include_super_jackpot THEN 2 ELSE 1 END;

    -- 4. Check & Deduct Tokens
    SELECT tokens INTO v_current_tokens FROM public.profiles WHERE id = v_user_id FOR UPDATE;
    IF v_current_tokens < v_cost THEN
        RETURN json_build_object('success', false, 'message', 'Token insufficienti');
    END IF;

    UPDATE public.profiles 
    SET tokens = tokens - v_cost,
        bets_placed = COALESCE(bets_placed, 0) + 1
    WHERE id = v_user_id;

    -- 5. Track Burned Tokens (only if SuperJackpot was included)
    IF p_include_super_jackpot THEN
        INSERT INTO public.system_stats (key, value)
        VALUES ('burned_tokens', 1)
        ON CONFLICT (key) DO UPDATE
        SET value = public.system_stats.value + 1,
            updated_at = now();
    END IF;

    -- 6. Insert Bet
    INSERT INTO public.bets (user_id, matchday_id, predictions, include_super_jackpot, amount)
    VALUES (v_user_id, v_matchday.id, p_predictions, p_include_super_jackpot, v_cost)
    RETURNING id INTO v_bet_id;

    RETURN json_build_object('success', true, 'message', 'Scommessa piazzata con successo!', 'bet_id', v_bet_id);
END;
$$;

-- 4. Update reset_fanny_system to reset the counter
CREATE OR REPLACE FUNCTION public.reset_fanny_system()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Security Check: Only admins can call this
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'ADMIN' THEN
    RAISE EXCEPTION 'Solo un amministratore può resettare il sistema.';
  END IF;

  -- 2. Delete all transaction/game data
  DELETE FROM public.fb_league_picks WHERE true;
  DELETE FROM public.fb_league_participants WHERE true;
  DELETE FROM public.fb_leagues WHERE true;
  DELETE FROM public.survival_picks WHERE true;
  DELETE FROM public.survival_players WHERE true;
  DELETE FROM public.survival_seasons WHERE true;
  DELETE FROM public.bets WHERE true;
  DELETE FROM public.matchdays WHERE true;

  -- 3. Reset User Stats
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

  -- 4. Reset Burned Tokens Counter
  UPDATE public.system_stats 
  SET value = 0, 
      updated_at = now() 
  WHERE key = 'burned_tokens';
END;
$$;

-- Migration: Harmonize Survival Prize Types
-- Description: Updates close_survival_season to use NUMERIC for prize calculations, matching the table schema.

CREATE OR REPLACE FUNCTION public.close_survival_season(p_season_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_winner_id UUID;
  v_winner_username TEXT;
  v_prize_pool NUMERIC; -- Changed from INTEGER to NUMERIC
  v_entry_fee INTEGER;
  v_prize_to_award NUMERIC; -- Changed from INTEGER to NUMERIC
  v_alive_count INTEGER;
BEGIN
  -- Admin check
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  ) THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- Get season info
  SELECT prize_pool, entry_fee INTO v_prize_pool, v_entry_fee
  FROM public.survival_seasons 
  WHERE id = p_season_id;

  IF v_prize_pool IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Stagione non trovata');
  END IF;

  -- Count alive players
  SELECT COUNT(*) INTO v_alive_count
  FROM public.survival_players
  WHERE season_id = p_season_id AND status = 'ALIVE';

  -- Must have exactly 1 survivor to close
  IF v_alive_count = 0 THEN
    RETURN json_build_object('success', false, 'message', 'Nessun sopravvissuto! Impossibile chiudere.');
  END IF;

  IF v_alive_count > 1 THEN
    RETURN json_build_object('success', false, 'message', 'Ci sono ancora ' || v_alive_count || ' sopravvissuti. Continua il torneo!');
  END IF;

  -- Get the winner
  SELECT user_id INTO v_winner_id
  FROM public.survival_players
  WHERE season_id = p_season_id AND status = 'ALIVE'
  LIMIT 1;

  -- Get winner username
  SELECT username INTO v_winner_username
  FROM public.profiles
  WHERE id = v_winner_id;

  -- Calculate prize (Net profit = total pool - winner's own entry fee)
  v_prize_to_award := GREATEST(0, v_prize_pool - COALESCE(v_entry_fee, 2));

  -- Transfer prize to winner's wallet
  UPDATE public.profiles
  SET tokens = tokens + v_prize_to_award,
      wins_survival = COALESCE(wins_survival, 0) + 1,
      total_tokens_won = COALESCE(total_tokens_won, 0) + v_prize_to_award
  WHERE id = v_winner_id;

  -- Set winner status
  UPDATE public.survival_players
  SET status = 'WINNER'
  WHERE season_id = p_season_id AND user_id = v_winner_id;

  -- Close the season and set finished_at
  UPDATE public.survival_seasons 
  SET status = 'COMPLETED', finished_at = NOW()
  WHERE id = p_season_id;

  RETURN json_build_object(
    'success', true, 
    'message', '🏆 VITTORIA! ' || v_winner_username || ' ha vinto ' || v_prize_to_award || ' FTK!',
    'winner', v_winner_username,
    'prize', v_prize_to_award
  );
END;
$$;

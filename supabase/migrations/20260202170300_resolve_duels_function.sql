-- Function to resolve duels for a matchday and transfer tokens
CREATE OR REPLACE FUNCTION resolve_matchday_duels(p_matchday_id INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_duel RECORD;
  v_challenger_score JSONB;
  v_opponent_score JSONB;
  v_c_goals INTEGER;
  v_o_goals INTEGER;
  v_winner_id UUID;
  v_wager INTEGER;
  v_loser_id UUID;
  v_updates_count INTEGER := 0;
BEGIN
  -- Iterate all ACCEPTED duels for this matchday
  FOR v_duel IN 
    SELECT * FROM public.duels 
    WHERE matchday_id = p_matchday_id 
    AND status = 'ACCEPTED'
  LOOP
    -- Calculate scores using existing logic
    v_challenger_score := calculate_user_matchday_score(v_duel.challenger_id, p_matchday_id);
    v_opponent_score := calculate_user_matchday_score(v_duel.opponent_id, p_matchday_id);
    
    v_c_goals := (v_challenger_score->>'score')::INTEGER;
    v_o_goals := (v_opponent_score->>'score')::INTEGER;
    
    -- Determine Winner
    IF v_c_goals > v_o_goals THEN
      v_winner_id := v_duel.challenger_id;
      v_loser_id := v_duel.opponent_id;
    ELSIF v_o_goals > v_c_goals THEN
      v_winner_id := v_duel.opponent_id;
      v_loser_id := v_duel.challenger_id;
    ELSE
      v_winner_id := NULL; -- Draw
      v_loser_id := NULL;
    END IF;
    
    -- Update Duel
    UPDATE public.duels
    SET 
      status = 'COMPLETED',
      winner_id = v_winner_id,
      scores = jsonb_build_object(
        'challenger_score', v_c_goals,
        'opponent_score', v_o_goals
      )
    WHERE id = v_duel.id;
    
    -- Handle Token Transfer
    v_wager := COALESCE(v_duel.wager_amount, 0);
    
    IF v_winner_id IS NOT NULL AND v_wager > 0 THEN
      -- Deduct from Loser (allow negative? yes, assuming debt is part of the game risk)
      UPDATE public.profiles 
      SET tokens = tokens - v_wager
      WHERE id = v_loser_id;
      
      -- Add to Winner
      UPDATE public.profiles 
      SET tokens = tokens + v_wager
      WHERE id = v_winner_id;
    END IF;
    -- If Draw, no tokens change hands (they keep their own, wager wasn't deducted upfront usually, or if it was? 
    -- Logic implies "Winner TAKES from Loser". So it wasn't deducted upfront. 
    -- If it WAS deducted upfront (escrow), we would refund on draw and give 2x to winner.
    -- Current logic: "takes the tokens... from their balance". Implies transfer at the end.
    
    v_updates_count := v_updates_count + 1;
    
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'resolved_count', v_updates_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

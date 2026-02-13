-- Migration: Fix text array operators in calculate_user_matchday_score
-- Reason: predictions column is TEXT[], so it must use array indexing [i+1] instead of ->>

CREATE OR REPLACE FUNCTION public.calculate_user_matchday_score(p_user_id UUID, p_matchday_id BIGINT)
RETURNS JSONB AS $$
DECLARE
  v_bet_predictions JSONB;
  v_match_results JSONB;
  v_total_bets INTEGER;
  v_matches_count INTEGER;
  
  v_total_goals INTEGER := 0;
  v_details JSONB := '[]'::JSONB; 
  
  i INTEGER;
  v_user_pick TEXT;
  v_actual_result TEXT;
  v_pick_count INTEGER;
  v_pick_pct NUMERIC;
  v_goals_awarded INTEGER;
BEGIN
  -- A. Get User's Predictions
  SELECT to_jsonb(predictions) INTO v_bet_predictions FROM public.bets 
  WHERE user_id = p_user_id AND matchday_id = p_matchday_id;
  
  IF v_bet_predictions IS NULL THEN
    RETURN jsonb_build_object('score', 0, 'details', '[]');
  END IF;

  -- B. Get Matchday Results
  SELECT to_jsonb(results) INTO v_match_results FROM public.matchdays WHERE id = p_matchday_id;
  
  -- C. Calculate Community Stats
  SELECT COUNT(*) INTO v_total_bets FROM public.bets WHERE matchday_id = p_matchday_id;
  
  v_matches_count := jsonb_array_length(v_bet_predictions);
  
  FOR i IN 0..v_matches_count-1 LOOP
    -- v_bet_predictions and v_match_results are JSONB here due to to_jsonb(), so ->> is OK.
    v_user_pick := v_bet_predictions->>i;
    v_actual_result := v_match_results->>i;
    
    IF v_actual_result IS NOT NULL AND v_user_pick = v_actual_result THEN
        
        -- D. Count how many people made this exact pick
        -- CRITICAL: predictions is TEXT[], so we MUST use array indexing [i+1]
        SELECT COUNT(*) INTO v_pick_count 
        FROM public.bets 
        WHERE matchday_id = p_matchday_id 
        AND predictions[i+1] = v_user_pick;
        
        IF v_total_bets > 0 THEN
            v_pick_pct := (v_pick_count::NUMERIC / v_total_bets::NUMERIC) * 100;
        ELSE
            v_pick_pct := 100;
        END IF;
        
        IF v_pick_pct >= 50 THEN
            v_goals_awarded := 1; 
        ELSIF v_pick_pct >= 20 THEN
            v_goals_awarded := 2; 
        ELSE
            v_goals_awarded := 3; 
        END IF;

        v_total_goals := v_total_goals + v_goals_awarded;
        
        v_details := v_details || jsonb_build_object(
            'match_idx', i,
            'pick', v_user_pick,
            'goals', v_goals_awarded,
            'popularity_pct', round(v_pick_pct, 1)
        );
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'score', v_total_goals,
    'details', v_details
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

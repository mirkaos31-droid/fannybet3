-- Migration: Fix function signatures and table schema for BIGINT compatibility
-- Reason: Standard Supabase IDs are BIGINT, but many duel-related functions and columns were defined with INTEGER.

-- 1. Update duels table schema (Handling RLS dependencies)
DROP POLICY IF EXISTS "Everyone can view current matchday duels" ON public.duels;

ALTER TABLE public.duels ALTER COLUMN matchday_id TYPE BIGINT;

CREATE POLICY "Everyone can view current matchday duels" 
  ON public.duels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matchdays m 
      WHERE m.id = public.duels.matchday_id 
      AND m.status = 'OPEN'
    )
  );

-- 2. Drop and recreate resolve_matchday_duels with BIGINT
DROP FUNCTION IF EXISTS public.resolve_matchday_duels(INTEGER);
CREATE OR REPLACE FUNCTION public.resolve_matchday_duels(p_matchday_id BIGINT)
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
    -- Calculate scores
    v_challenger_score := public.calculate_user_matchday_score(v_duel.challenger_id, p_matchday_id);
    v_opponent_score := public.calculate_user_matchday_score(v_duel.opponent_id, p_matchday_id);
    
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
      -- Deduct from Loser
      UPDATE public.profiles 
      SET tokens = tokens - v_wager
      WHERE id = v_loser_id;
      
      -- Add to Winner
      UPDATE public.profiles 
      SET tokens = tokens + v_wager
      WHERE id = v_winner_id;
    END IF;
    
    v_updates_count := v_updates_count + 1;
    
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'resolved_count', v_updates_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Drop and recreate get_challengeable_users with BIGINT
DROP FUNCTION IF EXISTS public.get_challengeable_users(INTEGER);
CREATE OR REPLACE FUNCTION public.get_challengeable_users(p_matchday_id BIGINT)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.username, p.avatar_url
  FROM public.bets b
  JOIN public.profiles p ON b.user_id = p.id
  WHERE b.matchday_id = p_matchday_id
  AND b.user_id != auth.uid(); -- Exclude self
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Drop and recreate calculate_user_matchday_score with BIGINT
DROP FUNCTION IF EXISTS public.calculate_user_matchday_score(UUID, INTEGER);
CREATE OR REPLACE FUNCTION public.calculate_user_matchday_score(p_user_id UUID, p_matchday_id BIGINT)
RETURNS JSONB AS $$
DECLARE
  v_bet_predictions JSONB;
  v_match_results JSONB;
  v_total_bets INTEGER;
  v_community_stats JSONB; 
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
    v_user_pick := v_bet_predictions->>i;
    v_actual_result := v_match_results->>i;
    
    IF v_actual_result IS NOT NULL AND v_user_pick = v_actual_result THEN
        
        SELECT COUNT(*) INTO v_pick_count 
        FROM public.bets 
        WHERE matchday_id = p_matchday_id 
        AND predictions->>i = v_user_pick;
        
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

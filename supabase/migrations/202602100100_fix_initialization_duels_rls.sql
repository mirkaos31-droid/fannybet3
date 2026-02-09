-- Migration: Fix initialization issues
-- 1. Ensure resolve_matchday_duels is defined (idempotent)
CREATE OR REPLACE FUNCTION public.resolve_matchday_duels(p_matchday_id INTEGER)
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

-- 2. Ensure matchdays has proper RLS policies
ALTER TABLE public.matchdays ENABLE ROW LEVEL SECURITY;

-- Allow public read access to matchdays (so users can see the active matchday)
DROP POLICY IF EXISTS "Public read access" ON public.matchdays;
CREATE POLICY "Public read access" ON public.matchdays FOR SELECT USING (true);

-- Allow admins to insert/update (optional if using service role/RPC, but good for direct access)
-- Assuming auth.uid() checks or similar. For now, rely on RPCs being SECURITY DEFINER.

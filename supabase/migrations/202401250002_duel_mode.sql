-- 1. Create Duels Table
CREATE TYPE duel_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED');

CREATE TABLE IF NOT EXISTS public.duels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  matchday_id INTEGER REFERENCES public.matchdays(id),
  challenger_id UUID REFERENCES public.profiles(id),
  opponent_id UUID REFERENCES public.profiles(id),
  status duel_status DEFAULT 'PENDING',
  winner_id UUID REFERENCES public.profiles(id),
  scores JSONB, -- Stores snapshot: { challenger_score: 5, opponent_score: 3, details: [...] }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view duels they are part of" 
  ON public.duels FOR SELECT 
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

CREATE POLICY "Users can create duels" 
  ON public.duels FOR INSERT 
  WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Users can update duels they are part of" 
  ON public.duels FOR UPDATE 
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- 2. Function to find challengeable opponents (Only those who have saved bets for this matchday)
-- Excludes self and people already validly challenged? For simplicity, just list all valid bettors.
CREATE OR REPLACE FUNCTION get_challengeable_users(p_matchday_id INTEGER)
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


-- 3. CORE LOGIC: Calculate Duel Scores (Goal System)
-- This function calculates the score for a specific user in a specific matchday based on community popularity.
CREATE OR REPLACE FUNCTION calculate_user_matchday_score(p_user_id UUID, p_matchday_id INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_bet_predictions JSONB;
  v_match_results JSONB;
  v_total_bets INTEGER;
  v_community_stats JSONB; -- { "0": { "1": 50, "X": 30, "2": 20 }, ... }
  v_matches_count INTEGER;
  
  v_total_goals INTEGER := 0;
  v_details JSONB := '[]'::JSONB; -- Array of { match_idx: 0, pick: '1', result: '1', goals: 2, popularity_pct: 30 }
  
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
  
  -- C. Calculate Community Stats (How many people picked what?)
  SELECT COUNT(*) INTO v_total_bets FROM public.bets WHERE matchday_id = p_matchday_id;
  
  -- We'll assume 12 matches (standard). Or verify array length.
  v_matches_count := jsonb_array_length(v_bet_predictions);
  
  FOR i IN 0..v_matches_count-1 LOOP
    v_user_pick := v_bet_predictions->>i;
    v_actual_result := v_match_results->>i;
    
    -- Only score if there is a result and the user picked correctly
    IF v_actual_result IS NOT NULL AND v_user_pick = v_actual_result THEN
        
        -- C1. Count how many people made this exact pick
        SELECT COUNT(*) INTO v_pick_count 
        FROM public.bets 
        WHERE matchday_id = p_matchday_id 
        AND predictions->>i = v_user_pick;
        
        -- C2. Calculate Percentage
        IF v_total_bets > 0 THEN
            v_pick_pct := (v_pick_count::NUMERIC / v_total_bets::NUMERIC) * 100;
        ELSE
            v_pick_pct := 100; -- Should not happen if at least this user bet
        END IF;
        
        -- C3. Assign Goals based on Popularity Tiers
        IF v_pick_pct >= 50 THEN
            v_goals_awarded := 1; -- Popular (>50%)
        ELSIF v_pick_pct >= 20 THEN
            v_goals_awarded := 2; -- Balanced (20-50%)
        ELSE
            v_goals_awarded := 3; -- Risky (<20%)
        END IF;

        v_total_goals := v_total_goals + v_goals_awarded;
        
        -- Track detail
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

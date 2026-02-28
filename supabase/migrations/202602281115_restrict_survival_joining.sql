-- Update join_survival to restrict inscriptions after the first matchday deadline
CREATE OR REPLACE FUNCTION public.join_survival(p_season_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_season_with_deadline RECORD;
  v_user_tokens INTEGER;
  v_cost INTEGER;
  v_player_id BIGINT;
BEGIN
  -- 1. Get Season Info and Matchday Deadline
  SELECT s.*, m.deadline 
  INTO v_season_with_deadline 
  FROM survival_seasons s
  LEFT JOIN matchdays m ON s.start_matchday_id = m.id
  WHERE s.id = p_season_id;
  
  IF v_season_with_deadline.id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Campionato non trovato.');
  END IF;

  -- 2. Check Status
  IF v_season_with_deadline.status != 'OPEN' THEN
    RETURN json_build_object('success', false, 'message', 'Iscrizioni chiuse per questo campionato.');
  END IF;

  -- 3. Check Deadline
  IF v_season_with_deadline.deadline IS NOT NULL AND NOW() > v_season_with_deadline.deadline THEN
    RETURN json_build_object('success', false, 'message', 'Iscrizioni chiuse: il primo match è già iniziato.');
  END IF;

  -- 4. Check if already joined
  IF EXISTS (SELECT 1 FROM survival_players WHERE season_id = p_season_id AND user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'message', 'Sei già iscritto.');
  END IF;

  -- 5. Check Tokens
  SELECT tokens INTO v_user_tokens FROM profiles WHERE id = v_user_id;
  v_cost := COALESCE(v_season_with_deadline.entry_fee, 2); 

  IF v_user_tokens < v_cost THEN
    RETURN json_build_object('success', false, 'message', 'Token insufficienti (Richiesti: ' || v_cost || ')');
  END IF;

  -- 6. Deduct Tokens & Add to Pool
  UPDATE profiles SET tokens = tokens - v_cost WHERE id = v_user_id;
  UPDATE survival_seasons SET prize_pool = COALESCE(prize_pool, 0) + v_cost WHERE id = p_season_id;

  -- 7. Register Player
  INSERT INTO survival_players (season_id, user_id, status, used_teams)
  VALUES (p_season_id, v_user_id, 'ALIVE', '{}')
  RETURNING id INTO v_player_id;

  RETURN json_build_object('success', true, 'message', 'Iscrizione confermata (-' || v_cost || ' token)');
END;
$$;

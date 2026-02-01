-- Functions (RPC) for Survival mode
-- join_survival: registers a user for a survival season
CREATE OR REPLACE FUNCTION public.join_survival(p_season_id BIGINT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO survival_players (user_id, season_id)
  SELECT auth.uid(), p_season_id
  ON CONFLICT DO NOTHING;
END;
$$;

-- submit_survival_pick: records a pick for a player
CREATE OR REPLACE FUNCTION public.submit_survival_pick(p_season_id BIGINT, p_team TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  player_id BIGINT;
BEGIN
  SELECT id INTO player_id FROM survival_players WHERE user_id = auth.uid() AND season_id = p_season_id;
  IF player_id IS NOT NULL THEN
    INSERT INTO survival_picks (player_id, matchday_id, team)
    SELECT player_id, (SELECT id FROM matchdays ORDER BY deadline DESC LIMIT 1), p_team;
  END IF;
END;
$$;

-- process_survival_round: placeholder for round processing
CREATE OR REPLACE FUNCTION public.process_survival_round(p_matchday_id BIGINT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Implement round logic here
  RAISE NOTICE 'Processing survival round %', p_matchday_id;
END;
$$;

-- close_survival_season: marks a season as inactive
CREATE OR REPLACE FUNCTION public.close_survival_season(p_season_id BIGINT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE survival_seasons SET is_active = false WHERE id = p_season_id;
END;
$$;

-- start_new_survival_season: creates a new season
CREATE OR REPLACE FUNCTION public.start_new_survival_season()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO survival_seasons (prize_pool, is_active) VALUES (0, true);
END;
$$;

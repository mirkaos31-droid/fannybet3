-- Migration: Enforce Deadline for Survival Picks
-- Description: Updates submit_survival_pick to ensure picks are only allowed before the matchday deadline.

CREATE OR REPLACE FUNCTION public.submit_survival_pick(p_season_id BIGINT, p_team TEXT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_player_id BIGINT;
  v_used_teams TEXT[];
  v_matchday RECORD;
BEGIN
  -- 1. Get active matchday and its deadline
  -- We look for the latest OPEN matchday
  SELECT * INTO v_matchday 
  FROM public.matchdays 
  WHERE status = 'OPEN' 
  ORDER BY deadline DESC 
  LIMIT 1;
  
  IF v_matchday.id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Nessuna giornata aperta.');
  END IF;

  -- 2. ENFORCE DEADLINE
  IF v_matchday.deadline IS NOT NULL AND NOW() > v_matchday.deadline THEN
    RETURN json_build_object('success', false, 'message', 'Tempo scaduto per questo turno!');
  END IF;

  -- 3. ENFORCE BETS_LOCKED
  IF v_matchday.bets_locked = true THEN
    RETURN json_build_object('success', false, 'message', 'Le giocate per questo turno sono state bloccate.');
  END IF;

  -- 4. Get player info
  SELECT id, used_teams INTO v_player_id, v_used_teams 
  FROM public.survival_players 
  WHERE user_id = auth.uid() AND season_id = p_season_id AND status = 'ALIVE';

  IF v_player_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Non sei in gioco o sei eliminato.');
  END IF;

  -- 5. Check if team already used
  IF p_team = ANY(v_used_teams) THEN
    RETURN json_build_object('success', false, 'message', 'Hai già usato questa squadra!');
  END IF;

  -- 6. Upsert pick
  INSERT INTO public.survival_picks (player_id, matchday_id, team)
  VALUES (v_player_id, v_matchday.id, p_team)
  ON CONFLICT (player_id, matchday_id) 
  DO UPDATE SET team = EXCLUDED.team, created_at = now();

  RETURN json_build_object('success', true, 'message', 'Scelta salvata: ' || p_team);
END;
$$;

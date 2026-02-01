-- Migration: Admin Permissions & Survival Fixes
-- Date: 2026-01-15
-- Description: Fixes RLS for admins, updates Survival schema, and fixes RPC return types.

-- 1. UTILITY: Check if user is Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
END;
$$;

-- 2. RLS: Allow Admins to manage everything
-- Matchdays
DROP POLICY IF EXISTS "Admins can do everything on matchdays" ON public.matchdays;
CREATE POLICY "Admins can do everything on matchdays"
ON public.matchdays FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Survival Seasons
DROP POLICY IF EXISTS "Admins can do everything on survival_seasons" ON public.survival_seasons;
CREATE POLICY "Admins can do everything on survival_seasons"
ON public.survival_seasons FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Survival Players
DROP POLICY IF EXISTS "Admins can do everything on survival_players" ON public.survival_players;
CREATE POLICY "Admins can do everything on survival_players"
ON public.survival_players FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 3. SCHEMA: Update Survival Tables
ALTER TABLE public.survival_seasons
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OPEN', -- OPEN, ACTIVE, COMPLETED
ADD COLUMN IF NOT EXISTS start_matchday_id BIGINT REFERENCES public.matchdays(id);

ALTER TABLE public.survival_players
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ALIVE', -- ALIVE, ELIMINATED, WINNER
ADD COLUMN IF NOT EXISTS used_teams TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS eliminated_at_matchday BIGINT;

ALTER TABLE public.survival_picks
ADD COLUMN IF NOT EXISTS result TEXT; -- WIN, LOSS, DRAW, POSTPONED
-- Unique constraint to prevent multiple picks per matchday per player
ALTER TABLE public.survival_picks DROP CONSTRAINT IF EXISTS survival_picks_player_matchday_unique;
ALTER TABLE public.survival_picks
ADD CONSTRAINT survival_picks_player_matchday_unique UNIQUE (player_id, matchday_id);


-- 4. RPCs: Fix return types (JSON) and logic

-- START NEW SEASON
DROP FUNCTION IF EXISTS public.start_new_survival_season();
CREATE OR REPLACE FUNCTION public.start_new_survival_season()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_id BIGINT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- Close any existing open/active seasons
  UPDATE public.survival_seasons SET status = 'COMPLETED', is_active = false 
  WHERE is_active = true OR status IN ('OPEN', 'ACTIVE');

  INSERT INTO public.survival_seasons (prize_pool, is_active, status)
  VALUES (0, true, 'OPEN')
  RETURNING id INTO new_id;

  RETURN json_build_object('success', true, 'message', 'Nuova stagione creata!', 'id', new_id);
END;
$$;

-- JOIN SURVIVAL
DROP FUNCTION IF EXISTS public.join_survival(BIGINT);
CREATE OR REPLACE FUNCTION public.join_survival(p_season_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tokens NUMERIC;
BEGIN
  -- Check if season is OPEN
  IF NOT EXISTS (SELECT 1 FROM survival_seasons WHERE id = p_season_id AND status = 'OPEN') THEN
    RETURN json_build_object('success', false, 'message', 'Stagione non aperta alle iscrizioni');
  END IF;

  -- Check tokens (Cost 2)
  SELECT tokens INTO v_tokens FROM profiles WHERE id = auth.uid();
  IF v_tokens < 2 THEN
    RETURN json_build_object('success', false, 'message', 'Token insufficienti (Richiesti: 2)');
  END IF;

  -- Check already joined
  IF EXISTS (SELECT 1 FROM survival_players WHERE user_id = auth.uid() AND season_id = p_season_id) THEN
    RETURN json_build_object('success', false, 'message', 'Sei già iscritto');
  END IF;

  -- Deduct tokens
  UPDATE profiles SET tokens = tokens - 2 WHERE id = auth.uid();

  -- Add to prize pool
  UPDATE survival_seasons SET prize_pool = COALESCE(prize_pool, 0) + 2 WHERE id = p_season_id;

  -- Insert player
  INSERT INTO survival_players (user_id, season_id, status, used_teams)
  VALUES (auth.uid(), p_season_id, 'ALIVE', '{}');

  RETURN json_build_object('success', true, 'message', 'Iscrizione effettuata!');
END;
$$;

-- SUBMIT PICK
DROP FUNCTION IF EXISTS public.submit_survival_pick(BIGINT, TEXT);
CREATE OR REPLACE FUNCTION public.submit_survival_pick(p_season_id BIGINT, p_team TEXT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_player_id BIGINT;
  v_used_teams TEXT[];
  v_matchday_id BIGINT;
BEGIN
  -- Get active matchday (Deadline check should be handled by app or here)
  -- Simplified: Get latest OPEN matchday
  SELECT id INTO v_matchday_id FROM matchdays WHERE status = 'OPEN' ORDER BY deadline DESC LIMIT 1;
  
  IF v_matchday_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Nessuna giornata aperta');
  END IF;

  -- Get player info
  SELECT id, used_teams INTO v_player_id, v_used_teams 
  FROM survival_players 
  WHERE user_id = auth.uid() AND season_id = p_season_id AND status = 'ALIVE';

  IF v_player_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Non sei in gioco o sei eliminato');
  END IF;

  -- Check if team already used
  IF p_team = ANY(v_used_teams) THEN
    RETURN json_build_object('success', false, 'message', 'Hai già usato questa squadra!');
  END IF;

  -- Upsert pick
  INSERT INTO survival_picks (player_id, matchday_id, team)
  VALUES (v_player_id, v_matchday_id, p_team)
  ON CONFLICT (player_id, matchday_id) 
  DO UPDATE SET team = EXCLUDED.team, created_at = now();

  RETURN json_build_object('success', true, 'message', 'Scelta salvata: ' || p_team);
END;
$$;

-- CLOSE SEASON
DROP FUNCTION IF EXISTS public.close_survival_season(BIGINT);
CREATE OR REPLACE FUNCTION public.close_survival_season(p_season_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_winner_id UUID;
  v_winner_username TEXT;
  v_prize_pool NUMERIC;
  v_alive_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- Get season prize pool
  SELECT prize_pool INTO v_prize_pool 
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

  -- Get the winner (the only ALIVE player)
  SELECT user_id INTO v_winner_id
  FROM public.survival_players
  WHERE season_id = p_season_id AND status = 'ALIVE'
  LIMIT 1;

  -- Get winner username
  SELECT username INTO v_winner_username
  FROM public.profiles
  WHERE id = v_winner_id;

  -- Transfer prize to winner's wallet
  UPDATE public.profiles
  SET tokens = tokens + v_prize_pool,
      wins_survival = wins_survival + 1,
      total_tokens_won = total_tokens_won + v_prize_pool
  WHERE id = v_winner_id;

  -- Set winner status
  UPDATE public.survival_players
  SET status = 'WINNER'
  WHERE season_id = p_season_id AND user_id = v_winner_id;

  -- Close the season
  UPDATE public.survival_seasons 
  SET is_active = false, status = 'COMPLETED' 
  WHERE id = p_season_id;

  RETURN json_build_object(
    'success', true, 
    'message', '🏆 VITTORIA! ' || v_winner_username || ' ha vinto ' || v_prize_pool || ' FTK!',
    'winner', v_winner_username,
    'prize', v_prize_pool
  );
END;
$$;

-- ELIMINATE PLAYERS (Admin Tool)
CREATE OR REPLACE FUNCTION public.eliminate_survival_players(p_player_ids BIGINT[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE survival_players
  SET status = 'ELIMINATED'
  WHERE id = ANY(p_player_ids);
END;
$$;

-- UPDATE SURVIVORS TEAMS (System Tool)
-- Appends the picked team to used_teams for all ALIVE players in a matchday
CREATE OR REPLACE FUNCTION public.update_survivors_teams(p_matchday_id BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Must be admin to trigger round processing updates essentially
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE survival_players sp
  SET used_teams = array_append(sp.used_teams, pk.team)
  FROM survival_picks pk
  WHERE sp.id = pk.player_id
  AND pk.matchday_id = p_matchday_id
  AND sp.status = 'ALIVE'; -- Only update if they survived (not eliminated)
END;
$$;

-- CREATE MATCHDAY (Admin RPC)
-- Replaces client-side insertion to ensure permissions and logic
CREATE OR REPLACE FUNCTION public.admin_create_matchday()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_id BIGINT;
  v_rollover NUMERIC := 0;
  v_deadline TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized: Admin only');
  END IF;

  -- 1. Check if OPEN matchday exists
  IF EXISTS (SELECT 1 FROM matchdays WHERE status = 'OPEN') THEN
      RETURN json_build_object('success', false, 'message', 'Esiste già una giornata aperta!');
  END IF;

  -- 2. Get rollover from last ARCHIVED matchday (if any)
  SELECT rollover_pot INTO v_rollover 
  FROM matchdays 
  WHERE status = 'ARCHIVED' 
  ORDER BY id DESC LIMIT 1;

  v_rollover := COALESCE(v_rollover, 0);

  -- 3. Set deadline (Default tomorrow)
  v_deadline := now() + interval '1 day';

  -- 4. Create Matchday with DEFAULT empty matches
  INSERT INTO matchdays (
      matches, 
      results, 
      status, 
      current_pot, 
      rollover_pot, 
      deadline,
      super_jackpot
  ) VALUES (
      (SELECT jsonb_agg(jsonb_build_object(
          'id', i, 
          'home', '', 
          'away', '', 
          'league', CASE WHEN i <= 10 THEN 'SERIE A' ELSE 'CUSTOM' END
       )) FROM generate_series(1, 12) i),
      ARRAY(SELECT NULL::text FROM generate_series(1, 12)),
      'OPEN',
      v_rollover,
      0,
      v_deadline,
      0
  ) RETURNING id INTO new_id;

  RETURN json_build_object('success', true, 'message', 'Nuova giornata creata!', 'id', new_id);
END;
$$;

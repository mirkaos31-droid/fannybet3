-- Consolidated Fix for Survival Mode Initialization
-- This script ensures all columns and functions for Survival mode are correctly defined.

-- 1. Ensure survival_seasons has all required columns
ALTER TABLE public.survival_seasons 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OPEN',
ADD COLUMN IF NOT EXISTS start_matchday_id BIGINT REFERENCES public.matchdays(id),
ADD COLUMN IF NOT EXISTS entry_fee INTEGER DEFAULT 2;

-- 2. Ensure survival_players has required columns
ALTER TABLE public.survival_players
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ALIVE',
ADD COLUMN IF NOT EXISTS used_teams TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS eliminated_at_matchday BIGINT;

-- 3. Ensure survival_picks has result column
ALTER TABLE public.survival_picks
ADD COLUMN IF NOT EXISTS result TEXT;

-- 4. Clean up old function signatures to avoid ambiguity
DROP FUNCTION IF EXISTS public.start_new_survival_season();
DROP FUNCTION IF EXISTS public.start_new_survival_season(INTEGER);

-- 5. Create/Update start_new_survival_season with entry_fee parameter
CREATE OR REPLACE FUNCTION public.start_new_survival_season(p_entry_fee INTEGER DEFAULT 2)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_id BIGINT;
  v_next_matchday_id BIGINT;
BEGIN
  -- Security Check
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  ) THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized: Admin only');
  END IF;

  -- Check if there is already an active/open season
  IF EXISTS (SELECT 1 FROM survival_seasons WHERE status IN ('OPEN', 'ACTIVE')) THEN
    RETURN json_build_object('success', false, 'message', 'Esiste già un campionato attivo o aperto.');
  END IF;

  -- Get next OPEN matchday id if any
  SELECT id INTO v_next_matchday_id FROM matchdays WHERE status = 'OPEN' ORDER BY id ASC LIMIT 1;

  INSERT INTO survival_seasons (status, prize_pool, start_matchday_id, entry_fee)
  VALUES ('OPEN', 0, v_next_matchday_id, p_entry_fee)
  RETURNING id INTO new_id;

  RETURN json_build_object('success', true, 'message', 'Nuovo campionato Survival creato!', 'id', new_id);
END;
$$;

-- 6. Ensure join_survival is up to date
DROP FUNCTION IF EXISTS public.join_survival(BIGINT);
CREATE OR REPLACE FUNCTION public.join_survival(p_season_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_season RECORD;
  v_user_tokens INTEGER;
  v_cost INTEGER;
  v_player_id BIGINT;
BEGIN
  -- 1. Get Season Info
  SELECT * INTO v_season FROM survival_seasons WHERE id = p_season_id;
  
  IF v_season IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Campionato non trovato.');
  END IF;

  IF v_season.status != 'OPEN' THEN
    RETURN json_build_object('success', false, 'message', 'Iscrizioni chiuse per questo campionato.');
  END IF;

  -- 2. Check if already joined
  IF EXISTS (SELECT 1 FROM survival_players WHERE season_id = p_season_id AND user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'message', 'Sei già iscritto.');
  END IF;

  -- 3. Check Tokens
  SELECT tokens INTO v_user_tokens FROM profiles WHERE id = v_user_id;
  v_cost := COALESCE(v_season.entry_fee, 2); 

  IF v_user_tokens < v_cost THEN
    RETURN json_build_object('success', false, 'message', 'Token insufficienti (Richiesti: ' || v_cost || ')');
  END IF;

  -- 4. Deduct Tokens & Add to Pool
  UPDATE profiles SET tokens = tokens - v_cost WHERE id = v_user_id;
  UPDATE survival_seasons SET prize_pool = COALESCE(prize_pool, 0) + v_cost WHERE id = p_season_id;

  -- 5. Register Player
  INSERT INTO survival_players (season_id, user_id, status, used_teams)
  VALUES (p_season_id, v_user_id, 'ALIVE', '{}')
  RETURNING id INTO v_player_id;

  RETURN json_build_object('success', true, 'message', 'Iscrizione confermata (-' || v_cost || ' token)');
END;
$$;

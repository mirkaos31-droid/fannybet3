-- Migration: Fix FB Lega Errors
-- Description: Fixes all identified DB-side issues in the FB Lega module.

-- ============================================================
-- 1. FIX admin_create_matchday: Remove duel references (dropped)
-- ============================================================
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

  -- 2. Get rollover from last archived matchday
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

-- ============================================================
-- 2. FIX RLS Policies on fb_leagues: separate by operation
-- ============================================================
DROP POLICY IF EXISTS "Admins can manage leagues" ON public.fb_leagues;

CREATE POLICY "Admins can insert leagues" ON public.fb_leagues FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update leagues" ON public.fb_leagues FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete leagues" ON public.fb_leagues FOR DELETE USING (public.is_admin());

-- ============================================================
-- 3. FIX jolly_match_index default: NULL = nessun Jolly
-- ============================================================
ALTER TABLE public.matchdays ALTER COLUMN jolly_match_index SET DEFAULT NULL;

-- ============================================================
-- 4. FIX submit_fb_league_picks: add league status guard
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_fb_league_picks(p_league_id BIGINT, p_matchday_id BIGINT, p_predictions TEXT[])
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_league_status TEXT;
BEGIN
    -- Check league status (must be OPEN or ACTIVE)
    SELECT status INTO v_league_status FROM public.fb_leagues WHERE id = p_league_id;

    IF v_league_status IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Lega non trovata');
    END IF;

    IF v_league_status = 'COMPLETED' THEN
        RETURN json_build_object('success', false, 'message', 'Questa lega è già conclusa');
    END IF;

    -- Must be a participant
    IF NOT EXISTS (SELECT 1 FROM public.fb_league_participants WHERE league_id = p_league_id AND user_id = auth.uid()) THEN
        RETURN json_build_object('success', false, 'message', 'Non sei iscritto a questa lega');
    END IF;

    -- Deadline check
    IF EXISTS (SELECT 1 FROM public.matchdays WHERE id = p_matchday_id AND deadline < now()) THEN
        RETURN json_build_object('success', false, 'message', 'Tempo scaduto per inserire i pronostici');
    END IF;

    -- Upsert picks
    INSERT INTO public.fb_league_picks (league_id, user_id, matchday_id, predictions)
    VALUES (p_league_id, auth.uid(), p_matchday_id, p_predictions)
    ON CONFLICT (league_id, user_id, matchday_id)
    DO UPDATE SET predictions = EXCLUDED.predictions, created_at = now();

    RETURN json_build_object('success', true, 'message', 'Pronostici salvati!');
END;
$$;

-- ============================================================
-- 5. FIX resolve_fb_league_round: auto-transition OPEN→ACTIVE on first resolve
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_fb_league_round(p_league_id BIGINT, p_matchday_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_results TEXT[];
    v_jolly_idx INTEGER;
    v_league_status TEXT;
    v_pick RECORD;
    v_score INTEGER;
    v_consecutive INTEGER;
    v_max_consecutive INTEGER;
    v_correct_count INTEGER;
    v_resolved_count INTEGER := 0;
BEGIN
    -- Admin check
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'Azione riservata agli amministratori');
    END IF;

    -- Check league status
    SELECT status INTO v_league_status FROM public.fb_leagues WHERE id = p_league_id;
    IF v_league_status = 'COMPLETED' THEN
        RETURN json_build_object('success', false, 'message', 'Questa lega è già conclusa');
    END IF;

    -- Auto-transition OPEN → ACTIVE on first resolve
    IF v_league_status = 'OPEN' THEN
        UPDATE public.fb_leagues SET status = 'ACTIVE' WHERE id = p_league_id;
    END IF;

    -- Get results and jolly index for the matchday (must be CLOSED to resolve)
    SELECT results, jolly_match_index INTO v_results, v_jolly_idx
    FROM public.matchdays
    WHERE id = p_matchday_id AND status = 'CLOSED';

    IF v_results IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Matchday results not found or matchday not closed');
    END IF;

    -- Iterate through all picks for this league and matchday
    FOR v_pick IN 
        SELECT id, user_id, predictions 
        FROM public.fb_league_picks 
        WHERE league_id = p_league_id AND matchday_id = p_matchday_id AND points_earned IS NULL
    LOOP
        v_score := 0;
        v_consecutive := 0;
        v_max_consecutive := 0;
        v_correct_count := 0;

        FOR i IN 1..10 LOOP
            IF v_pick.predictions[i] = v_results[i] THEN
                v_correct_count := v_correct_count + 1;
                v_consecutive := v_consecutive + 1;
                
                -- Base scoring: X = 2pts, others = 1pt
                IF v_results[i] = 'X' THEN
                    v_score := v_score + 2;
                ELSE
                    v_score := v_score + 1;
                END IF;

                -- Jolly Match Bonus: +2 pts (only if jolly is set, i.e. NOT NULL)
                IF v_jolly_idx IS NOT NULL AND (i - 1) = v_jolly_idx THEN
                    v_score := v_score + 2;
                END IF;

                IF v_consecutive > v_max_consecutive THEN
                    v_max_consecutive := v_consecutive;
                END IF;
            ELSE
                v_consecutive := 0;
            END IF;
        END LOOP;

        -- Strike Bonus: +3 for 3+ consecutive correct
        IF v_max_consecutive >= 3 THEN
            v_score := v_score + 3;
        END IF;

        -- En Plein: +10 for all 10 correct
        IF v_correct_count = 10 THEN
            v_score := v_score + 10;
        END IF;

        -- Update pick with earned points
        UPDATE public.fb_league_picks 
        SET points_earned = v_score 
        WHERE id = v_pick.id;

        -- Update participant total points
        UPDATE public.fb_league_participants
        SET total_points = total_points + v_score
        WHERE league_id = p_league_id AND user_id = v_pick.user_id;

        v_resolved_count := v_resolved_count + 1;
    END LOOP;

    -- Update league round counter
    UPDATE public.fb_leagues
    SET current_round = current_round + 1
    WHERE id = p_league_id;

    RETURN json_build_object(
        'success', true, 
        'message', 'Round risolto!', 
        'resolved_count', v_resolved_count
    );
END;
$$;

-- ============================================================
-- 6. FIX distribute_fb_league_prizes: accept ACTIVE or OPEN
-- ============================================================
CREATE OR REPLACE FUNCTION public.distribute_fb_league_prizes(p_league_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_prize_pool NUMERIC;
    v_distribution JSONB;
    v_winners RECORD;
    v_prize_amount NUMERIC;
    v_winner_list JSONB := '[]'::JSONB;
    i INTEGER := 1;
BEGIN
    -- Admin check
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Get league info (accept ACTIVE or OPEN, single-league mode)
    SELECT prize_pool, prize_distribution INTO v_prize_pool, v_distribution 
    FROM public.fb_leagues WHERE id = p_league_id AND status IN ('ACTIVE', 'OPEN');

    IF v_prize_pool IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Lega non attiva o non trovata');
    END IF;

    -- Determine winners (Top N based on distribution array length)
    FOR v_winners IN 
        SELECT user_id, total_points, p.username
        FROM public.fb_league_participants lp
        JOIN public.profiles p ON lp.user_id = p.id
        WHERE league_id = p_league_id
        ORDER BY total_points DESC
        LIMIT jsonb_array_length(v_distribution)
    LOOP
        v_prize_amount := v_prize_pool * (v_distribution->>(i-1))::NUMERIC;
        
        IF v_prize_amount > 0 THEN
            UPDATE public.profiles 
            SET tokens = tokens + v_prize_amount,
                total_tokens_won = total_tokens_won + v_prize_amount
            WHERE id = v_winners.user_id;

            v_winner_list := v_winner_list || jsonb_build_object(
                'rank', i,
                'username', v_winners.username,
                'points', v_winners.total_points,
                'prize', v_prize_amount
            );
        END IF;
        
        i := i + 1;
    END LOOP;

    -- Close league
    UPDATE public.fb_leagues SET status = 'COMPLETED' WHERE id = p_league_id;

    RETURN json_build_object('success', true, 'message', 'Premi distribuiti e lega chiusa!', 'winners', v_winner_list);
END;
$$;

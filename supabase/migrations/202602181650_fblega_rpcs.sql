-- Migration: FB Lega Core RPC Functions
-- Description: Adds functions for joining, picking, and resolving championship rounds.

-- 1. JOIN FB LEAGUE
CREATE OR REPLACE FUNCTION public.join_fb_league(p_league_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_entry_fee INTEGER;
    v_user_tokens NUMERIC;
    v_league_status TEXT;
BEGIN
    -- Check if league exists and is OPEN
    SELECT entry_fee, status INTO v_entry_fee, v_league_status 
    FROM public.fb_leagues WHERE id = p_league_id;

    IF v_league_status IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Lega non trovata');
    END IF;

    IF v_league_status != 'OPEN' THEN
        RETURN json_build_object('success', false, 'message', 'Iscrizioni chiuse per questa lega');
    END IF;

    -- Check if already joined
    IF EXISTS (SELECT 1 FROM public.fb_league_participants WHERE league_id = p_league_id AND user_id = auth.uid()) THEN
        RETURN json_build_object('success', false, 'message', 'Sei già iscritto a questa lega');
    END IF;

    -- Check tokens
    SELECT tokens INTO v_user_tokens FROM public.profiles WHERE id = auth.uid();
    IF v_user_tokens < v_entry_fee THEN
        RETURN json_build_object('success', false, 'message', 'Token insufficienti');
    END IF;

    -- Deduct tokens
    UPDATE public.profiles SET tokens = tokens - v_entry_fee WHERE id = auth.uid();

    -- Add to prize pool
    UPDATE public.fb_leagues SET prize_pool = prize_pool + v_entry_fee WHERE id = p_league_id;

    -- Add participant
    INSERT INTO public.fb_league_participants (league_id, user_id)
    VALUES (p_league_id, auth.uid());

    RETURN json_build_object('success', true, 'message', 'Iscrizione effettuata con successo!');
END;
$$;

-- 2. SUBMIT FB LEAGUE PICKS
CREATE OR REPLACE FUNCTION public.submit_fb_league_picks(p_league_id BIGINT, p_matchday_id BIGINT, p_predictions TEXT[])
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Consistency check: must be a participant
    IF NOT EXISTS (SELECT 1 FROM public.fb_league_participants WHERE league_id = p_league_id AND user_id = auth.uid()) THEN
        RETURN json_build_object('success', false, 'message', 'Non sei iscritto a questa lega');
    END IF;

    -- Deadline check (Matchday deadline)
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

-- 3. RESOLVE FB LEAGUE ROUND
CREATE OR REPLACE FUNCTION public.resolve_fb_league_round(p_league_id BIGINT, p_matchday_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_league_rules JSONB;
    v_match_results TEXT[];
    v_pick RECORD;
    v_points INTEGER;
    i INTEGER;
    v_sign TEXT;
    v_total_resolved INTEGER := 0;
BEGIN
    -- Admin check
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'Azione riservata agli amministratori');
    END IF;

    -- Get league rules
    SELECT scoring_rules INTO v_league_rules FROM public.fb_leagues WHERE id = p_league_id;
    
    -- Get matchday results (assume results are stored as text array in matchdays)
    -- Important: FB Lega only uses the first 10 matches (Serie A)
    SELECT results INTO v_match_results FROM public.matchdays WHERE id = p_matchday_id;

    IF v_match_results IS NULL OR array_length(v_match_results, 1) < 10 THEN
        RETURN json_build_object('success', false, 'message', 'Risultati della giornata non ancora completi per la Lega (minimo 10 match)');
    END IF;

    -- Calculate points for each pick
    FOR v_pick IN 
        SELECT * FROM public.fb_league_picks 
        WHERE league_id = p_league_id AND matchday_id = p_matchday_id AND points_earned IS NULL
    LOOP
        v_points := 0;
        FOR i IN 1..10 LOOP
            v_sign := v_pick.predictions[i];
            IF v_sign = v_match_results[i] THEN
                -- Add points based on custom rules (default 1)
                v_points := v_points + COALESCE((v_league_rules->>v_sign)::INTEGER, 1);
            END IF;
        END LOOP;

        -- Update pick
        UPDATE public.fb_league_picks SET points_earned = v_points WHERE id = v_pick.id;

        -- Update participant cumulative score
        UPDATE public.fb_league_participants 
        SET total_points = total_points + v_points 
        WHERE league_id = p_league_id AND user_id = v_pick.user_id;

        v_total_resolved := v_total_resolved + 1;
    END LOOP;

    -- Increment round counter for the league
    UPDATE public.fb_leagues SET current_round = current_round + 1 WHERE id = p_league_id;

    RETURN json_build_object('success', true, 'message', 'Round risolto!', 'resolved_count', v_total_resolved);
END;
$$;

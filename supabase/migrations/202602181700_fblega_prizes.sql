-- Migration: FB Lega Prize Distribution & Management
-- Description: Functions to close leagues and reward winners.

-- 1. DISTRIBUTE FB LEAGUE PRIZES
CREATE OR REPLACE FUNCTION public.distribute_fb_league_prizes(p_league_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_prize_pool NUMERIC;
    v_distribution JSONB;
    v_winners RECORD;
    v_participant_count INTEGER;
    v_prize_amount NUMERIC;
    v_winner_list JSONB := '[]'::JSONB;
    i INTEGER := 1;
BEGIN
    -- Admin check
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Get league info
    SELECT prize_pool, prize_distribution INTO v_prize_pool, v_distribution 
    FROM public.fb_leagues WHERE id = p_league_id AND status = 'ACTIVE';

    IF v_prize_pool IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Lega non attiva o non trovata');
    END IF;

    -- Get participant count
    SELECT COUNT(*) INTO v_participant_count FROM public.fb_league_participants WHERE league_id = p_league_id;

    -- Determine winners (Top N based on distribution array length)
    FOR v_winners IN 
        SELECT user_id, total_points, p.username
        FROM public.fb_league_participants lp
        JOIN public.profiles p ON lp.user_id = p.id
        WHERE league_id = p_league_id
        ORDER BY total_points DESC
        LIMIT jsonb_array_length(v_distribution)
    LOOP
        -- Calculate prize from percentage in distribution array
        v_prize_amount := v_prize_pool * (v_distribution->>(i-1))::NUMERIC;
        
        IF v_prize_amount > 0 THEN
            -- Update profile
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

-- 2. CREATE FB LEAGUE SECURE
CREATE OR REPLACE FUNCTION public.create_fb_league(
    p_name TEXT, 
    p_entry_fee INTEGER, 
    p_duration INTEGER, 
    p_scoring_rules JSONB, 
    p_prize_dist JSONB
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_matchday_id BIGINT;
    v_league_id BIGINT;
BEGIN
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Get the next OPEN matchday to start the league
    SELECT id INTO v_matchday_id FROM public.matchdays WHERE status = 'OPEN' ORDER BY deadline ASC LIMIT 1;
    
    IF v_matchday_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Nessuna giornata aperta per iniziare la lega');
    END IF;

    INSERT INTO public.fb_leagues (
        name, admin_id, entry_fee, duration_matchdays, start_matchday_id, scoring_rules, prize_distribution, status
    ) VALUES (
        p_name, auth.uid(), p_entry_fee, p_duration, v_matchday_id, p_scoring_rules, p_prize_dist, 'OPEN'
    ) RETURNING id INTO v_league_id;

    RETURN json_build_object('success', true, 'message', 'Lega creata!', 'id', v_league_id);
END;
$$;

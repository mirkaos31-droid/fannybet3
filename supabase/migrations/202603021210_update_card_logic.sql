-- Migration: Update Card Logic for Horto muso and Hat-trick

-- 1. Update distribute_fb_league_prizes to award "Horto muso"
CREATE OR REPLACE FUNCTION public.distribute_fb_league_prizes(p_league_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_prize_pool NUMERIC;
    v_distribution JSONB;
    v_winners RECORD;
    v_participant_count INTEGER;
    v_prize_amount NUMERIC;
    v_winner_list JSONB := '[]'::JSONB;
    v_max_points INTEGER;
    v_min_points INTEGER;
    v_second_max_points INTEGER;
    v_card_ultimo_id UUID;
    v_card_quasi_id UUID;
    v_card_horto_id UUID;
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

    -- Identify Min, Max and Second Max points for card awarding
    SELECT MAX(total_points), MIN(total_points) INTO v_max_points, v_min_points 
    FROM public.fb_league_participants WHERE league_id = p_league_id;

    -- Find the highest score strictly lower than v_max_points
    SELECT MAX(total_points) INTO v_second_max_points 
    FROM public.fb_league_participants 
    WHERE league_id = p_league_id AND total_points < v_max_points;

    -- Get Card IDs
    SELECT id INTO v_card_ultimo_id FROM public.collectible_cards WHERE title = 'Ultimo Posto' OR title = 'Il Maestro del 5-5-5';
    SELECT id INTO v_card_quasi_id FROM public.collectible_cards WHERE title = 'C''eri quasi!';
    SELECT id INTO v_card_horto_id FROM public.collectible_cards WHERE title = 'Horto muso';

    -- 1. Award Winners (Tokens + Rank)
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
            UPDATE public.profiles SET tokens = tokens + v_prize_amount, total_tokens_won = total_tokens_won + v_prize_amount WHERE id = v_winners.user_id;
            v_winner_list := v_winner_list || jsonb_build_object('rank', i, 'username', v_winners.username, 'points', v_winners.total_points, 'prize', v_prize_amount);
        END IF;
        i := i + 1;
    END LOOP;

    -- 2. Automated Card Awarding
    -- Last Place (Ultimo Posto)
    IF v_card_ultimo_id IS NOT NULL THEN
        INSERT INTO public.user_cards (user_id, card_id)
        SELECT user_id, v_card_ultimo_id FROM public.fb_league_participants 
        WHERE league_id = p_league_id AND total_points = v_min_points
        ON CONFLICT DO NOTHING;
    END IF;

    -- 1pt Loss (C'eri quasi!) - awarded to those with exactly winner_points - 1
    IF v_card_quasi_id IS NOT NULL AND v_max_points > v_min_points THEN
        INSERT INTO public.user_cards (user_id, card_id)
        SELECT user_id, v_card_quasi_id FROM public.fb_league_participants 
        WHERE league_id = p_league_id AND total_points = (v_max_points - 1)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Horto muso (Victory by exactly 1 point over second distinct score level)
    IF v_card_horto_id IS NOT NULL AND v_second_max_points IS NOT NULL AND (v_max_points - v_second_max_points) = 1 THEN
        INSERT INTO public.user_cards (user_id, card_id)
        SELECT user_id, v_card_horto_id FROM public.fb_league_participants 
        WHERE league_id = p_league_id AND total_points = v_max_points
        ON CONFLICT DO NOTHING;
    END IF;

    -- Close league
    UPDATE public.fb_leagues SET status = 'COMPLETED' WHERE id = p_league_id;

    RETURN json_build_object('success', true, 'message', 'Premi distribuiti e Card sbloccate!', 'winners', v_winner_list);
END;
$$;


-- 2. Update resolve_fb_league_round to award "Hat-trick"
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
    v_consecutive_correct INTEGER;
    v_max_consecutive INTEGER;
    v_card_hattrick_id UUID;
BEGIN
    -- Admin check
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'Azione riservata agli amministratori');
    END IF;

    -- Get league rules
    SELECT scoring_rules INTO v_league_rules FROM public.fb_leagues WHERE id = p_league_id;
    
    -- Get matchday results
    SELECT results INTO v_match_results FROM public.matchdays WHERE id = p_matchday_id;

    IF v_match_results IS NULL OR array_length(v_match_results, 1) < 10 THEN
        RETURN json_build_object('success', false, 'message', 'Risultati della giornata non ancora completi per la Lega (minimo 10 match)');
    END IF;

    -- Get Hat-trick Card ID
    SELECT id INTO v_card_hattrick_id FROM public.collectible_cards WHERE title = 'Hat-trick';

    -- Calculate points for each pick
    FOR v_pick IN 
        SELECT * FROM public.fb_league_picks 
        WHERE league_id = p_league_id AND matchday_id = p_matchday_id AND points_earned IS NULL
    LOOP
        v_points := 0;
        v_consecutive_correct := 0;
        v_max_consecutive := 0;

        FOR i IN 1..10 LOOP
            v_sign := v_pick.predictions[i];
            IF v_sign = v_match_results[i] THEN
                -- Add points
                v_points := v_points + COALESCE((v_league_rules->>v_sign)::INTEGER, 1);
                
                -- Track consecutive
                v_consecutive_correct := v_consecutive_correct + 1;
                IF v_consecutive_correct > v_max_consecutive THEN
                    v_max_consecutive := v_consecutive_correct;
                END IF;
            ELSE
                v_consecutive_correct := 0;
            END IF;
        END LOOP;

        -- Update pick
        UPDATE public.fb_league_picks SET points_earned = v_points WHERE id = v_pick.id;

        -- Update participant cumulative score
        UPDATE public.fb_league_participants 
        SET total_points = total_points + v_points 
        WHERE league_id = p_league_id AND user_id = v_pick.user_id;

        -- Award Hat-trick if 3 or more consecutive
        IF v_card_hattrick_id IS NOT NULL AND v_max_consecutive >= 3 THEN
            INSERT INTO public.user_cards (user_id, card_id)
            VALUES (v_pick.user_id, v_card_hattrick_id)
            ON CONFLICT DO NOTHING;
        END IF;

        v_total_resolved := v_total_resolved + 1;
    END LOOP;

    -- Increment round counter for the league
    UPDATE public.fb_leagues SET current_round = current_round + 1 WHERE id = p_league_id;

    RETURN json_build_object('success', true, 'message', 'Round risolto e Card sbloccate!', 'resolved_count', v_total_resolved);
END;
$$;

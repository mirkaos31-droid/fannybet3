-- Migration: Fix FB League Prize Distribution Ambiguity
-- Description: Solves column reference ambiguity for total_points when joining participants with profiles.

CREATE OR REPLACE FUNCTION public.distribute_fb_league_prizes(p_league_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_prize_pool NUMERIC;
    v_distribution JSONB;
    v_winners RECORD;
    v_prize_amount NUMERIC;
    v_winner_list JSONB := '[]'::JSONB;
    v_max_points INTEGER;
    v_min_points INTEGER;
    v_last_place_count INTEGER;
    v_total_participants INTEGER;
    v_second_max_points INTEGER;
    v_sum_dist NUMERIC := 0;
    j INTEGER;
    -- Card IDs
    v_card_ultimo_id UUID;
    v_card_quasi_id UUID;
    v_card_horto_id UUID;
    v_card_vincitore_id UUID;
    v_card_maestro_id UUID;
    i INTEGER := 1;
BEGIN
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    SELECT prize_pool, prize_distribution INTO v_prize_pool, v_distribution 
    FROM public.fb_leagues WHERE id = p_league_id AND status != 'COMPLETED';

    IF v_prize_pool IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Lega non trovata o già completata');
    END IF;

    SELECT MAX(total_points), MIN(total_points), COUNT(*) 
    INTO v_max_points, v_min_points, v_total_participants
    FROM public.fb_league_participants WHERE league_id = p_league_id;

    SELECT MAX(total_points) INTO v_second_max_points 
    FROM public.fb_league_participants 
    WHERE league_id = p_league_id AND total_points < v_max_points;

    SELECT COUNT(*) INTO v_last_place_count 
    FROM public.fb_league_participants 
    WHERE league_id = p_league_id AND total_points = v_min_points;

    SELECT id INTO v_card_ultimo_id FROM public.collectible_cards WHERE title = 'Ultimo Posto';
    SELECT id INTO v_card_quasi_id FROM public.collectible_cards WHERE title = 'C''eri quasi!';
    SELECT id INTO v_card_horto_id FROM public.collectible_cards WHERE title = 'Horto muso';
    SELECT id INTO v_card_vincitore_id FROM public.collectible_cards WHERE title = 'Vincitore Lega';
    SELECT id INTO v_card_maestro_id FROM public.collectible_cards WHERE title = 'Il Maestro del 5-5-5';

    -- Calculate the sum of the distribution elements
    v_sum_dist := 0;
    FOR j IN 0..(jsonb_array_length(v_distribution)-1) LOOP
        v_sum_dist := v_sum_dist + (v_distribution->>j)::NUMERIC;
    END LOOP;

    FOR v_winners IN 
        SELECT lp.user_id, lp.total_points, p.username
        FROM public.fb_league_participants lp
        JOIN public.profiles p ON lp.user_id = p.id
        WHERE lp.league_id = p_league_id
        ORDER BY lp.total_points DESC
        LIMIT jsonb_array_length(v_distribution)
    LOOP
        -- If the distribution sum is greater than 1.0, treat values as absolute token amounts
        IF v_sum_dist > 1.0 THEN
            v_prize_amount := (v_distribution->>(i-1))::NUMERIC;
        ELSE
            v_prize_amount := v_prize_pool * (v_distribution->>(i-1))::NUMERIC;
        END IF;

        IF v_prize_amount > 0 THEN
            UPDATE public.profiles SET tokens = tokens + v_prize_amount, total_tokens_won = total_tokens_won + v_prize_amount WHERE id = v_winners.user_id;
            PERFORM public.update_user_level(v_winners.user_id);
            v_winner_list := v_winner_list || jsonb_build_object('rank', i, 'username', v_winners.username, 'points', v_winners.total_points, 'prize', v_prize_amount);
        END IF;
        i := i + 1;
    END LOOP;

    IF v_card_vincitore_id IS NOT NULL THEN
        INSERT INTO public.user_cards (user_id, card_id)
        SELECT user_id, v_card_vincitore_id FROM public.fb_league_participants 
        WHERE league_id = p_league_id AND total_points = v_max_points
        ON CONFLICT DO NOTHING;
    END IF;

    IF v_card_horto_id IS NOT NULL AND v_second_max_points IS NOT NULL AND (v_max_points - v_second_max_points) = 1 THEN
        INSERT INTO public.user_cards (user_id, card_id)
        SELECT user_id, v_card_horto_id FROM public.fb_league_participants 
        WHERE league_id = p_league_id AND total_points = v_max_points
        ON CONFLICT DO NOTHING;
    END IF;

    IF v_card_quasi_id IS NOT NULL AND v_max_points > v_min_points THEN
        INSERT INTO public.user_cards (user_id, card_id)
        SELECT user_id, v_card_quasi_id FROM public.fb_league_participants 
        WHERE league_id = p_league_id AND total_points = (v_max_points - 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF v_card_ultimo_id IS NOT NULL THEN
        INSERT INTO public.user_cards (user_id, card_id)
        SELECT user_id, v_card_ultimo_id FROM public.fb_league_participants 
        WHERE league_id = p_league_id AND total_points = v_min_points
        ON CONFLICT DO NOTHING;
    END IF;

    IF v_card_maestro_id IS NOT NULL AND v_last_place_count = 1 AND v_total_participants >= 5 THEN
        INSERT INTO public.user_cards (user_id, card_id)
        SELECT user_id, v_card_maestro_id FROM public.fb_league_participants 
        WHERE league_id = p_league_id AND total_points = v_min_points
        ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.fb_leagues SET status = 'COMPLETED' WHERE id = p_league_id;

    RETURN json_build_object('success', true, 'message', 'Lega archiviata con successo.', 'winners', v_winner_list);
END;
$$;

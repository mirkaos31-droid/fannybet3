-- Migration: Auto-award Underdog Card
-- Description: Updates resolve_fb_league_round to award the UNDERDOG card when the bonus is triggered.

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
    v_card_underdog_id UUID;
    v_total_picks INTEGER;
    v_match_counts JSONB := '{}'::JSONB;
    v_pop_val INTEGER;
    v_underdog_triggered BOOLEAN;
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

    -- Get Card IDs
    SELECT id INTO v_card_hattrick_id FROM public.collectible_cards WHERE title = 'Hat-trick';
    SELECT id INTO v_card_underdog_id FROM public.collectible_cards WHERE title = 'UNDERDOG';

    -- Prepare Underdog counts if enabled
    IF (v_league_rules->>'underdog_enabled')::BOOLEAN THEN
        SELECT COUNT(*) INTO v_total_picks FROM public.fb_league_picks WHERE league_id = p_league_id AND matchday_id = p_matchday_id;
        FOR i IN 1..10 LOOP
            v_match_counts := v_match_counts || jsonb_build_object(i::TEXT, 
                (SELECT jsonb_object_agg(res, cnt) FROM (
                    SELECT predictions[i] as res, COUNT(*) as cnt FROM public.fb_league_picks 
                    WHERE league_id = p_league_id AND matchday_id = p_matchday_id GROUP BY predictions[i]
                ) s)
            );
        END LOOP;
    END IF;

    -- Calculate points for each pick
    FOR v_pick IN 
        SELECT * FROM public.fb_league_picks 
        WHERE league_id = p_league_id AND matchday_id = p_matchday_id AND points_earned IS NULL
    LOOP
        v_points := 0;
        v_consecutive_correct := 0;
        v_max_consecutive := 0;
        v_underdog_triggered := false;

        FOR i IN 1..10 LOOP
            v_sign := v_pick.predictions[i];
            IF v_sign = v_match_results[i] THEN
                -- Add points
                v_points := v_points + COALESCE((v_league_rules->>v_sign)::INTEGER, 1);
                
                -- Underdog Bonus Check
                IF (v_league_rules->>'underdog_enabled')::BOOLEAN AND v_total_picks > 3 THEN
                    v_pop_val := (v_match_counts->i::TEXT->>v_sign)::INTEGER;
                    IF (v_pop_val::FLOAT / v_total_picks::FLOAT) < 0.15 THEN 
                        v_points := v_points + 2; 
                        v_underdog_triggered := true; -- Mark for card awarding
                    END IF;
                END IF;

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

        -- Award Hat-trick
        IF v_card_hattrick_id IS NOT NULL AND v_max_consecutive >= 3 THEN
            INSERT INTO public.user_cards (user_id, card_id)
            VALUES (v_pick.user_id, v_card_hattrick_id)
            ON CONFLICT DO NOTHING;
        END IF;

        -- Award Underdog
        IF v_card_underdog_id IS NOT NULL AND v_underdog_triggered THEN
            INSERT INTO public.user_cards (user_id, card_id)
            VALUES (v_pick.user_id, v_card_underdog_id)
            ON CONFLICT DO NOTHING;
        END IF;

        v_total_resolved := v_total_resolved + 1;
    END LOOP;

    -- Increment round counter for the league
    UPDATE public.fb_leagues SET current_round = current_round + 1 WHERE id = p_league_id;

    RETURN json_build_object('success', true, 'message', 'Round risolto e Card sbloccate!', 'resolved_count', v_total_resolved);
END;
$$;

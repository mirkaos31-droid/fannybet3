-- Migration: FB Lega Configurable Bonuses (Underdog & Monthly Comeback)
-- Description: Updates round resolution and adds monthly comeback logic.

-- 1. Helper function to get matchday IDs for a league in order
CREATE OR REPLACE FUNCTION public.get_fb_league_matchdays(p_league_id BIGINT)
RETURNS TABLE (matchday_id BIGINT, round_number INTEGER) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH start_md AS (
        SELECT start_matchday_id, duration_matchdays FROM public.fb_leagues WHERE id = p_league_id
    ),
    ordered_mds AS (
        SELECT m.id, (ROW_NUMBER() OVER (ORDER BY m.deadline ASC))::INTEGER as rn
        FROM public.matchdays m, start_md s
        WHERE m.deadline >= (SELECT m2.deadline FROM public.matchdays m2 WHERE m2.id = s.start_matchday_id)
        ORDER BY m.deadline ASC
        LIMIT s.duration_matchdays
    )
    SELECT id, rn FROM ordered_mds;
END;
$$;

-- 2. Function to apply monthly comeback bonus
CREATE OR REPLACE FUNCTION public.apply_fb_league_monthly_comeback(p_league_id BIGINT, p_current_round INTEGER)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_prev_round INTEGER;
    v_winner_user_id UUID;
    v_max_climb INTEGER := -999;
    v_climb INTEGER;
    v_user_id UUID;
    v_rank_now INTEGER;
    v_rank_prev INTEGER;
    v_md_ids_now BIGINT[];
    v_md_ids_prev BIGINT[];
BEGIN
    -- Only every 4 rounds (starting round is 0, so after round 4 resolved, p_current_round is 4)
    IF p_current_round < 4 OR p_current_round % 4 != 0 THEN
        RETURN json_build_object('applied', false, 'message', 'Not a monthly round');
    END IF;

    v_prev_round := p_current_round - 4;

    -- Get matchday IDs for now and then
    SELECT array_agg(matchday_id) INTO v_md_ids_now FROM public.get_fb_league_matchdays(p_league_id) WHERE round_number <= p_current_round;
    SELECT array_agg(matchday_id) INTO v_md_ids_prev FROM public.get_fb_league_matchdays(p_league_id) WHERE round_number <= v_prev_round;

    -- Calculate climb for each participant
    FOR v_user_id IN SELECT user_id FROM public.fb_league_participants WHERE league_id = p_league_id LOOP
        -- Rank Now
        WITH ranks AS (
            SELECT user_id, RANK() OVER (ORDER BY SUM(points_earned) DESC) as r
            FROM public.fb_league_picks 
            WHERE league_id = p_league_id AND matchday_id = ANY(v_md_ids_now)
            GROUP BY user_id
        ) SELECT r INTO v_rank_now FROM ranks WHERE user_id = v_user_id;

        -- Rank Prev
        IF v_prev_round = 0 THEN
            -- Base rank on registration/joined order if no rounds played
            WITH ranks AS (
                SELECT user_id, ROW_NUMBER() OVER (ORDER BY joined_at ASC) as r
                FROM public.fb_league_participants WHERE league_id = p_league_id
            ) SELECT r INTO v_rank_prev FROM ranks WHERE user_id = v_user_id;
        ELSE
            WITH ranks AS (
                SELECT user_id, RANK() OVER (ORDER BY SUM(points_earned) DESC) as r
                FROM public.fb_league_picks 
                WHERE league_id = p_league_id AND matchday_id = ANY(v_md_ids_prev)
                GROUP BY user_id
            ) SELECT r INTO v_rank_prev FROM ranks WHERE user_id = v_user_id;
        END IF;

        IF v_rank_now IS NOT NULL AND v_rank_prev IS NOT NULL THEN
            v_climb := v_rank_prev - v_rank_now;
            IF v_climb > v_max_climb THEN
                v_max_climb := v_climb;
                v_winner_user_id := v_user_id;
            END IF;
        END IF;
    END LOOP;

    IF v_winner_user_id IS NOT NULL AND v_max_climb > 0 THEN
        UPDATE public.fb_league_participants 
        SET total_points = total_points + 10 
        WHERE league_id = p_league_id AND user_id = v_winner_user_id;

        RETURN json_build_object('applied', true, 'winner_id', v_winner_user_id, 'climb', v_max_climb, 'bonus', 10);
    END IF;

    RETURN json_build_object('applied', false, 'message', 'No one climbed');
END;
$$;

-- 3. Update resolve_fb_league_round
CREATE OR REPLACE FUNCTION public.resolve_fb_league_round(p_league_id BIGINT, p_matchday_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_results TEXT[];
    v_jolly_idx INTEGER;
    v_rules JSONB;
    v_pick RECORD;
    v_score INTEGER;
    v_consecutive INTEGER;
    v_max_consecutive INTEGER;
    v_correct_count INTEGER;
    v_resolved_count INTEGER := 0;
    v_current_round INTEGER;
    v_total_picks INTEGER;
    v_match_counts JSONB := '{}'::JSONB;
    v_pop_val INTEGER;
BEGIN
    SELECT scoring_rules, current_round INTO v_rules, v_current_round FROM public.fb_leagues WHERE id = p_league_id;
    SELECT results, jolly_match_index INTO v_results, v_jolly_idx FROM public.matchdays WHERE id = p_matchday_id AND status = 'CLOSED';

    IF v_results IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Matchday results not found or matchday not closed');
    END IF;

    IF (v_rules->>'underdog_enabled')::BOOLEAN THEN
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

    FOR v_pick IN SELECT id, user_id, predictions FROM public.fb_league_picks WHERE league_id = p_league_id AND matchday_id = p_matchday_id AND points_earned IS NULL LOOP
        v_score := 0;
        v_consecutive := 0;
        v_max_consecutive := 0;
        v_correct_count := 0;

        FOR i IN 1..10 LOOP
            IF v_pick.predictions[i] = v_results[i] THEN
                v_correct_count := v_correct_count + 1;
                v_consecutive := v_consecutive + 1;
                v_score := v_score + COALESCE((v_rules->>v_results[i])::INTEGER, 1);
                IF (i - 1) = v_jolly_idx THEN v_score := v_score + 2; END IF;

                IF (v_rules->>'underdog_enabled')::BOOLEAN AND v_total_picks > 3 THEN
                    v_pop_val := (v_match_counts->i::TEXT->>v_results[i])::INTEGER;
                    IF (v_pop_val::FLOAT / v_total_picks::FLOAT) < 0.15 THEN v_score := v_score + 2; END IF;
                END IF;

                IF v_consecutive > v_max_consecutive THEN v_max_consecutive := v_consecutive; END IF;
            ELSE
                v_consecutive := 0;
            END IF;
        END LOOP;

        IF v_max_consecutive >= 3 THEN v_score := v_score + 3; END IF;
        IF v_correct_count = 10 THEN v_score := v_score + 10; END IF;

        UPDATE public.fb_league_picks SET points_earned = v_score WHERE id = v_pick.id;
        UPDATE public.fb_league_participants SET total_points = total_points + v_score WHERE league_id = p_league_id AND user_id = v_pick.user_id;
        v_resolved_count := v_resolved_count + 1;
    END LOOP;

    UPDATE public.fb_leagues SET current_round = current_round + 1 WHERE id = p_league_id;
    IF (v_rules->>'monthly_comeback_enabled')::BOOLEAN THEN
        PERFORM public.apply_fb_league_monthly_comeback(p_league_id, v_current_round + 1);
    END IF;

    RETURN json_build_object('success', true, 'message', 'Round resolved successfully', 'resolved_count', v_resolved_count);
END;
$$;

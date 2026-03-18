-- Migration: Update FB League Round Resolution with Archival Logic (Refined)
-- Description: Updates resolve_fb_league_round to populate fb_league_matchday_results with accurate snapshots.

CREATE OR REPLACE FUNCTION public.resolve_fb_league_round(p_league_id BIGINT, p_matchday_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_results TEXT[];
    v_jolly_idx INTEGER;
    v_rules JSONB;
    v_total_picks INTEGER;
    v_match_counts JSONB := '{}'::JSONB;
    v_card_hattrick_id UUID;
    v_card_underdog_id UUID;
    v_resolved_count INTEGER := 0;
    v_rec RECORD;
BEGIN
    -- 1. Admin & Status Check
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    SELECT scoring_rules, current_round INTO v_rules, v_resolved_count FROM public.fb_leagues WHERE id = p_league_id;
    SELECT results, jolly_match_index INTO v_results, v_jolly_idx FROM public.matchdays WHERE id = p_matchday_id AND status = 'CLOSED';

    IF v_results IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Matchday results not found or matchday not closed');
    END IF;

    -- 2. Card IDs
    SELECT id INTO v_card_hattrick_id FROM public.collectible_cards WHERE title = 'Hat-trick';
    SELECT id INTO v_card_underdog_id FROM public.collectible_cards WHERE title = 'UNDERDOG';

    -- 3. Pre-calculate Underdog Popularity
    IF (v_rules->>'underdog_enabled')::BOOLEAN THEN
        SELECT COUNT(*)::INTEGER INTO v_total_picks FROM public.fb_league_picks WHERE league_id = p_league_id AND matchday_id = p_matchday_id;
        IF v_total_picks > 0 THEN
            SELECT jsonb_object_agg(m_idx, counts) INTO v_match_counts
            FROM (
                SELECT i::TEXT as m_idx, jsonb_object_agg(pred, cnt) as counts
                FROM (
                    SELECT s.i, lp.predictions[s.i] as pred, COUNT(*)::INTEGER as cnt
                    FROM public.fb_league_picks lp
                    CROSS JOIN generate_series(1, 10) AS s(i)
                    WHERE lp.league_id = p_league_id AND lp.matchday_id = p_matchday_id AND lp.predictions[s.i] IS NOT NULL
                    GROUP BY s.i, lp.predictions[s.i]
                ) inner_s GROUP BY i
            ) t;
        END IF;
    END IF;

    -- 4. Calculate Scores and Ranks
    CREATE TEMP TABLE round_calculation ON COMMIT DROP AS
    WITH raw_picks AS (
        SELECT 
            lp.user_id,
            pk.id as pick_id,
            pk.predictions,
            lp.total_points as accumulated_points
        FROM public.fb_league_participants lp
        JOIN public.fb_league_picks pk ON pk.league_id = lp.league_id AND pk.user_id = lp.user_id AND pk.matchday_id = p_matchday_id
        WHERE lp.league_id = p_league_id AND pk.points_earned IS NULL
    ),
    calculated AS (
        SELECT 
            rp.user_id,
            rp.pick_id,
            rp.accumulated_points,
            (
                SELECT COALESCE(SUM(
                    CASE 
                        WHEN rp.predictions[s.i] = v_results[s.i] THEN 
                            COALESCE((v_rules->>v_results[s.i])::INTEGER, 1) +
                            (CASE WHEN v_jolly_idx IS NOT NULL AND (s.i - 1) = v_jolly_idx THEN 2 ELSE 0 END) +
                            (CASE 
                                WHEN (v_rules->>'underdog_enabled')::BOOLEAN 
                                  AND v_total_picks > 3 
                                  AND rp.predictions[s.i] IS NOT NULL
                                  AND ((v_match_counts->s.i::TEXT->>rp.predictions[s.i])::INTEGER::FLOAT / v_total_picks::FLOAT) < 0.15 
                                THEN 2 ELSE 0 END)
                        ELSE 0 
                    END
                ), 0)::INTEGER FROM generate_series(1, 10) AS s(i)
            ) as round_match_points,
            (
                SELECT COUNT(*) FROM generate_series(1,10) s(i) WHERE rp.predictions[s.i] = v_results[s.i]
            )::INTEGER as correct_count,
            (
                SELECT COALESCE(MAX(consecutive), 0) FROM (
                    SELECT COUNT(*) OVER (PARTITION BY grp) as consecutive
                    FROM (
                        SELECT s.i, 
                        s.i - ROW_NUMBER() OVER (ORDER BY s.i) as grp
                        FROM generate_series(1, 10) s(i)
                        WHERE rp.predictions[s.i] = v_results[s.i]
                    ) groups
                ) final_consecutive
            )::INTEGER as max_consecutive
        FROM raw_picks rp
    ),
    final_scores AS (
        SELECT 
            c.*,
            (c.round_match_points + (CASE WHEN c.max_consecutive >= 3 THEN 3 ELSE 0 END) + (CASE WHEN c.correct_count = 10 THEN 10 ELSE 0 END))::INTEGER as round_total_points
        FROM calculated c
    ),
    ranked_results AS (
        SELECT 
            fs.*,
            RANK() OVER (ORDER BY (fs.accumulated_points + fs.round_total_points) DESC) as final_rank,
            (
                -- Re-generate bonuses for archival
                SELECT jsonb_agg(bonus) FROM (
                    SELECT 'jolly' as bonus WHERE v_jolly_idx IS NOT NULL AND (SELECT rp.predictions[v_jolly_idx + 1] FROM raw_picks rp WHERE rp.user_id = fs.user_id) = v_results[v_jolly_idx + 1]
                    UNION ALL SELECT 'strike' WHERE fs.max_consecutive >= 3
                    UNION ALL SELECT 'en_plein' WHERE fs.correct_count = 10
                    UNION ALL SELECT 'underdog' WHERE EXISTS (
                        SELECT 1 FROM generate_series(1, 10) AS s(i) 
                        JOIN raw_picks rp2 ON rp2.user_id = fs.user_id
                        WHERE rp2.predictions[s.i] = v_results[s.i] 
                        AND (v_rules->>'underdog_enabled')::BOOLEAN 
                        AND v_total_picks > 3 
                        AND ((v_match_counts->s.i::TEXT->>rp2.predictions[s.i])::INTEGER::FLOAT / v_total_picks::FLOAT) < 0.15
                    )
                ) b
            ) as bonuses
        FROM final_scores fs
    )
    SELECT * FROM ranked_results;

    -- 5. Commit Changes
    v_resolved_count := 0;
    FOR v_rec IN SELECT * FROM round_calculation LOOP
        -- Update pick
        UPDATE public.fb_league_picks SET points_earned = v_rec.round_total_points WHERE id = v_rec.pick_id;
        
        -- Update participant
        UPDATE public.fb_league_participants SET total_points = total_points + v_rec.round_total_points WHERE league_id = p_league_id AND user_id = v_rec.user_id;
        
        -- Archive Result
        INSERT INTO public.fb_league_matchday_results (league_id, matchday_id, user_id, points_matchday, points_total, rank, active_bonuses)
        VALUES (p_league_id, p_matchday_id, v_rec.user_id, v_rec.round_total_points, v_rec.accumulated_points + v_rec.round_total_points, v_rec.final_rank, COALESCE(v_rec.bonuses, '[]'::JSONB));

        -- Award Card: Hat-trick
        IF v_card_hattrick_id IS NOT NULL AND v_rec.max_consecutive >= 3 THEN
            INSERT INTO public.user_cards (user_id, card_id) VALUES (v_rec.user_id, v_card_hattrick_id) ON CONFLICT DO NOTHING;
        END IF;

        -- Award Card: Underdog
        IF v_card_underdog_id IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_rec.bonuses) WHERE value = 'underdog') THEN
            INSERT INTO public.user_cards (user_id, card_id) VALUES (v_rec.user_id, v_card_underdog_id) ON CONFLICT DO NOTHING;
        END IF;

        v_resolved_count := v_resolved_count + 1;
    END LOOP;

    -- 6. Incremement League Round
    UPDATE public.fb_leagues SET current_round = current_round + 1 WHERE id = p_league_id;

    -- 7. Apply Monthly Comeback if enabled
    IF (v_rules->>'monthly_comeback_enabled')::BOOLEAN THEN
        PERFORM public.apply_fb_league_monthly_comeback(p_league_id, (SELECT current_round FROM public.fb_leagues WHERE id = p_league_id));
    END IF;

    RETURN json_build_object('success', true, 'message', 'Round risolto e archiviato con successo', 'resolved_count', v_resolved_count);
END;
$$;

-- Migration: Update FB League Live Leaderboard to use Global Active Matchday
-- Description: Modifies get_fb_league_live_leaderboard to calculate live points based on the global active matchday (status OPEN or CLOSED) instead of strictly current_round + 1.

CREATE OR REPLACE FUNCTION public.get_fb_league_live_leaderboard(p_league_id BIGINT)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    total_points INTEGER,
    live_points INTEGER,
    grand_total INTEGER,
    active_bonuses JSONB
) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_current_matchday_id BIGINT;
    v_results TEXT[];
    v_jolly_idx INTEGER;
    v_current_round INTEGER;
    v_league_rules JSONB;
    v_total_picks INTEGER;
    v_match_counts JSONB := '{}'::JSONB;
BEGIN
    -- 1. Get league data
    SELECT current_round, scoring_rules INTO v_current_round, v_league_rules 
    FROM public.fb_leagues WHERE id = p_league_id;
    
    -- 2. Get the global active matchday ID (OPEN or CLOSED)
    SELECT id INTO v_current_matchday_id 
    FROM public.matchdays 
    WHERE status IN ('OPEN', 'CLOSED') 
    ORDER BY deadline ASC 
    LIMIT 1;

    -- Fallback to league round mapping if no global active matchday is found
    IF v_current_matchday_id IS NULL THEN
        SELECT matchday_id INTO v_current_matchday_id 
        FROM public.get_fb_league_matchdays(p_league_id) 
        WHERE round_number = v_current_round + 1;
    END IF;

    IF v_current_matchday_id IS NOT NULL THEN
        -- 3. Get results and jolly index
        SELECT results, jolly_match_index INTO v_results, v_jolly_idx
        FROM public.matchdays WHERE id = v_current_matchday_id;

        -- 4. Optimized match popularity calculation
        IF (v_league_rules->>'underdog_enabled')::BOOLEAN THEN
            SELECT COUNT(*)::INTEGER INTO v_total_picks 
            FROM public.fb_league_picks 
            WHERE league_id = p_league_id AND matchday_id = v_current_matchday_id;

            IF v_total_picks > 0 THEN
                SELECT jsonb_object_agg(m_idx, counts) INTO v_match_counts
                FROM (
                    SELECT i::TEXT as m_idx, jsonb_object_agg(pred, cnt) as counts
                    FROM (
                        SELECT s.i, lp.predictions[s.i] as pred, COUNT(*)::INTEGER as cnt
                        FROM public.fb_league_picks lp
                        CROSS JOIN generate_series(1, 10) AS s(i)
                        WHERE lp.league_id = p_league_id 
                          AND lp.matchday_id = v_current_matchday_id
                          AND lp.predictions[s.i] IS NOT NULL
                        GROUP BY s.i, lp.predictions[s.i]
                    ) inner_s GROUP BY i
                ) t;
            END IF;
        END IF;
    END IF;

    RETURN QUERY
    WITH participant_picks AS (
        SELECT 
            lp.user_id, p.username, lp.total_points as accumulated_points, pk.predictions
        FROM public.fb_league_participants lp
        JOIN public.profiles p ON lp.user_id = p.id
        LEFT JOIN public.fb_league_picks pk ON pk.league_id = lp.league_id 
            AND pk.user_id = lp.user_id 
            AND pk.matchday_id = v_current_matchday_id
        WHERE lp.league_id = p_league_id
    ),
    calculated_results AS (
        SELECT 
            pp.user_id, pp.username, pp.accumulated_points,
            (SELECT COUNT(*) FROM generate_series(1,10) s(i) WHERE pp.predictions[s.i] = v_results[s.i])::INTEGER as correct_count,
            (
                CASE WHEN pp.predictions IS NULL OR v_results IS NULL THEN 0
                ELSE
                    (
                        SELECT COALESCE(SUM(
                            CASE 
                                WHEN pp.predictions[s.i] = v_results[s.i] THEN 
                                    COALESCE((v_league_rules->>v_results[s.i])::INTEGER, 1) +
                                    (CASE WHEN v_jolly_idx IS NOT NULL AND (s.i - 1) = v_jolly_idx THEN 2 ELSE 0 END) +
                                    (CASE 
                                        WHEN (v_league_rules->>'underdog_enabled')::BOOLEAN 
                                          AND v_total_picks > 3 
                                          AND pp.predictions[s.i] IS NOT NULL
                                          AND ((v_match_counts->s.i::TEXT->>pp.predictions[s.i])::INTEGER::FLOAT / v_total_picks::FLOAT) < 0.15 
                                        THEN 2 ELSE 0 END)
                                ELSE 0 
                            END
                        ), 0)::INTEGER FROM generate_series(1, 10) AS s(i)
                    )
                END
            ) as match_points,
            (
                CASE WHEN pp.predictions IS NULL OR v_results IS NULL THEN false
                ELSE EXISTS (
                    SELECT 1 FROM (
                        SELECT s.i, COUNT(*) FILTER (WHERE pp.predictions[s.i] = v_results[s.i]) OVER (ORDER BY s.i ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as consecutive
                        FROM generate_series(1, 10) AS s(i)
                    ) consecutive_check WHERE consecutive = 3
                )
                END
            ) as has_strike
        FROM participant_picks pp
    )
    SELECT 
        cr.user_id, cr.username, cr.accumulated_points as total_points,
        (cr.match_points + (CASE WHEN cr.has_strike THEN 3 ELSE 0 END) + (CASE WHEN cr.correct_count = 10 THEN 10 ELSE 0 END))::INTEGER as live_points,
        (cr.accumulated_points + cr.match_points + (CASE WHEN cr.has_strike THEN 3 ELSE 0 END) + (CASE WHEN cr.correct_count = 10 THEN 10 ELSE 0 END))::INTEGER as grand_total,
        (
            SELECT COALESCE(jsonb_agg(b), '[]'::JSONB) FROM (
                SELECT 'jolly' as b WHERE v_jolly_idx IS NOT NULL AND participant_picks.predictions[v_jolly_idx + 1] = v_results[v_jolly_idx + 1]
                UNION ALL
                SELECT 'strike' WHERE cr.has_strike
                UNION ALL
                SELECT 'en_plein' WHERE cr.correct_count = 10
                UNION ALL
                SELECT 'underdog' WHERE EXISTS (
                    SELECT 1 FROM generate_series(1, 10) AS s(i) 
                    WHERE participant_picks.predictions[s.i] = v_results[s.i] 
                    AND (v_league_rules->>'underdog_enabled')::BOOLEAN 
                    AND v_total_picks > 3 
                    AND participant_picks.predictions[s.i] IS NOT NULL
                    AND ((v_match_counts->s.i::TEXT->>participant_picks.predictions[s.i])::INTEGER::FLOAT / v_total_picks::FLOAT) < 0.15
                )
            ) bonus_subquery
        ) as active_bonuses
    FROM calculated_results cr
    JOIN participant_picks ON participant_picks.user_id = cr.user_id
    ORDER BY grand_total DESC, cr.username ASC;
END;
$$;

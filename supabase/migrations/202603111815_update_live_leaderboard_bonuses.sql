-- Migration: Update FB Lega Live Leaderboard with Bonus Tags
-- Description: Updates the live leaderboard RPC to calculate and return active bonuses for the current round.

CREATE OR REPLACE FUNCTION public.get_fb_league_live_leaderboard(p_league_id BIGINT)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    total_points INTEGER, -- Points from completed rounds
    live_points INTEGER,  -- Points from current "live" round
    grand_total INTEGER,  -- Combined total
    active_bonuses JSONB  -- Array of bonus keys ['en_plein', 'strike', 'jolly', 'underdog']
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
    
    -- 2. Get the matchday ID for the current round
    SELECT matchday_id INTO v_current_matchday_id 
    FROM public.get_fb_league_matchdays(p_league_id) 
    WHERE round_number = v_current_round + 1;

    -- 3. Get results and jolly index
    IF v_current_matchday_id IS NOT NULL THEN
        SELECT results, jolly_match_index INTO v_results, v_jolly_idx
        FROM public.matchdays
        WHERE id = v_current_matchday_id;

        -- 4. Calculate pick popularity for Underdog bonus
        IF (v_league_rules->>'underdog_enabled')::BOOLEAN THEN
            SELECT COUNT(*)::INTEGER INTO v_total_picks 
            FROM public.fb_league_picks 
            WHERE league_id = p_league_id AND matchday_id = v_current_matchday_id;

            IF v_total_picks > 0 THEN
                FOR i IN 1..10 LOOP
                    v_match_counts := v_match_counts || jsonb_build_object(i::TEXT, 
                        (SELECT jsonb_object_agg(res, cnt) FROM (
                            SELECT predictions[i] as res, COUNT(*)::INTEGER as cnt 
                            FROM public.fb_league_picks 
                            WHERE league_id = p_league_id AND matchday_id = v_current_matchday_id 
                            GROUP BY predictions[i]
                        ) s)
                    );
                END LOOP;
            END IF;
        END IF;
    END IF;

    RETURN QUERY
    WITH participant_picks AS (
        SELECT 
            lp.user_id,
            p.username,
            lp.total_points as accumulated_points,
            pk.predictions
        FROM public.fb_league_participants lp
        JOIN public.profiles p ON lp.user_id = p.id
        LEFT JOIN public.fb_league_picks pk ON pk.league_id = lp.league_id 
            AND pk.user_id = lp.user_id 
            AND pk.matchday_id = v_current_matchday_id
        WHERE lp.league_id = p_league_id
    ),
    calculated_data AS (
        SELECT 
            pp.user_id,
            pp.username,
            pp.accumulated_points,
            (
                CASE WHEN pp.predictions IS NULL OR v_results IS NULL THEN 0
                ELSE
                    (
                        -- Scoring logic mirror
                        SELECT COALESCE(SUM(
                            CASE 
                                WHEN pp.predictions[i] = v_results[i] THEN 
                                    (CASE WHEN v_results[i] = 'X' THEN 2 ELSE 1 END) +
                                    (CASE WHEN v_jolly_idx IS NOT NULL AND (i - 1) = v_jolly_idx THEN 2 ELSE 0 END) +
                                    -- Underdog points
                                    (CASE 
                                        WHEN (v_league_rules->>'underdog_enabled')::BOOLEAN 
                                             AND v_total_picks > 3 
                                             AND ((v_match_counts->i::TEXT->>pp.predictions[i])::INTEGER::FLOAT / v_total_picks::FLOAT) < 0.15 
                                        THEN 2 ELSE 0 
                                    END)
                                ELSE 0 
                            END
                        ), 0)::INTEGER
                        FROM generate_series(1, 10) i
                    ) + 
                    -- Strike Bonus
                    CASE WHEN (
                        SELECT 1 FROM (
                            SELECT i, COUNT(*) FILTER (WHERE pp.predictions[i] = v_results[i]) OVER (ORDER BY i ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as consecutive
                            FROM generate_series(1, 10) i
                        ) s WHERE consecutive = 3 LIMIT 1
                    ) IS NOT NULL THEN 3 ELSE 0 END +
                    -- En Plein Bonus
                    CASE WHEN (SELECT COUNT(*) FROM generate_series(1, 10) i WHERE pp.predictions[i] = v_results[i]) = 10 THEN 10 ELSE 0 END
                END
            ) as live_pts,
            (
                CASE WHEN pp.predictions IS NULL OR v_results IS NULL THEN '[]'::JSONB
                ELSE
                    (
                        SELECT jsonb_agg(bonus) FROM (
                            -- Jolly Bonus Tag
                            SELECT 'jolly' as bonus WHERE v_jolly_idx IS NOT NULL AND pp.predictions[v_jolly_idx + 1] = v_results[v_jolly_idx + 1]
                            UNION ALL
                            -- Strike Bonus Tag
                            SELECT 'strike' WHERE (
                                SELECT 1 FROM (
                                    SELECT i, COUNT(*) FILTER (WHERE pp.predictions[i] = v_results[i]) OVER (ORDER BY i ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as consecutive
                                    FROM generate_series(1, 10) i
                                ) s WHERE consecutive = 3 LIMIT 1
                            ) IS NOT NULL
                            UNION ALL
                            -- En Plein Bonus Tag
                            SELECT 'en_plein' WHERE (SELECT COUNT(*) FROM generate_series(1, 10) i WHERE pp.predictions[i] = v_results[i]) = 10
                            UNION ALL
                            -- Underdog Bonus Tag
                            SELECT 'underdog' WHERE EXISTS (
                                SELECT 1 FROM generate_series(1, 10) i 
                                WHERE pp.predictions[i] = v_results[i] 
                                AND (v_league_rules->>'underdog_enabled')::BOOLEAN 
                                AND v_total_picks > 3 
                                AND ((v_match_counts->i::TEXT->>pp.predictions[i])::INTEGER::FLOAT / v_total_picks::FLOAT) < 0.15
                            )
                        ) b
                    )
                END
            ) as active_bonuses
        FROM participant_picks pp
    )
    SELECT 
        cd.user_id,
        cd.username,
        cd.accumulated_points as total_points,
        cd.live_pts as live_points,
        (cd.accumulated_points + cd.live_pts) as grand_total,
        COALESCE(cd.active_bonuses, '[]'::JSONB)
    FROM calculated_data cd
    ORDER BY grand_total DESC, cd.username ASC;
END;
$$;

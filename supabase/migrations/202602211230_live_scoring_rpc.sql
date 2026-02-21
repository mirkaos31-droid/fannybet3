-- Migration: FB Lega Live Scoring RPC
-- Description: Adds a function to calculate real-time leaderboard by adding current round points to accumulated points.

CREATE OR REPLACE FUNCTION public.get_fb_league_live_leaderboard(p_league_id BIGINT)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    total_points INTEGER, -- Points from completed rounds
    live_points INTEGER,  -- Points from current "live" round
    grand_total INTEGER   -- Combined total
) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_current_matchday_id BIGINT;
    v_results TEXT[];
    v_jolly_idx INTEGER;
BEGIN
    -- 1. Identify current matchday for the league (the one they are currently picking for)
    -- We assume the "live" matchday is the one that is currently OPEN or the latest one that is not yet resolved for this league.
    -- For simplicity, we use the currently active matchday in the system.
    SELECT id, results, jolly_match_index INTO v_current_matchday_id, v_results, v_jolly_idx
    FROM public.matchdays
    WHERE status IN ('OPEN', 'CLOSED') -- Can be currently picking or being resolved
    ORDER BY id DESC LIMIT 1;

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
    calculated_live AS (
        SELECT 
            pp.user_id,
            pp.username,
            pp.accumulated_points,
            (
                CASE WHEN pp.predictions IS NULL OR v_results IS NULL THEN 0
                ELSE
                    (
                        -- Scoring logic mirror (as in resolve_fb_league_round)
                        -- We use a subquery to iterate 1..10
                        SELECT COALESCE(SUM(
                            CASE 
                                -- Base score
                                WHEN pp.predictions[i] = v_results[i] THEN 
                                    (CASE WHEN v_results[i] = 'X' THEN 2 ELSE 1 END) +
                                    (CASE WHEN v_jolly_idx IS NOT NULL AND (i - 1) = v_jolly_idx THEN 2 ELSE 0 END)
                                ELSE 0 
                            END
                        ), 0)::INTEGER
                        FROM generate_series(1, 10) i
                    ) + 
                    (
                        -- Strike Bonus (+3)
                        CASE 
                            WHEN (
                                SELECT MAX(consecutive)
                                FROM (
                                    SELECT 
                                        i,
                                        COUNT(*) FILTER (WHERE pp.predictions[i] = v_results[i]) OVER (ORDER BY i ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as consecutive
                                    FROM generate_series(1, 10) i
                                ) s
                                WHERE consecutive = 3
                            ) IS NOT NULL THEN 3 ELSE 0
                        END
                    ) +
                    (
                        -- En Plein (+10)
                        CASE 
                            WHEN (SELECT COUNT(*) FROM generate_series(1, 10) i WHERE pp.predictions[i] = v_results[i]) = 10 THEN 10 ELSE 0
                        END
                    )
                END
            ) as live_pts
        FROM participant_picks pp
    )
    SELECT 
        cl.user_id,
        cl.username,
        cl.accumulated_points as total_points,
        cl.live_pts as live_points,
        (cl.accumulated_points + cl.live_pts) as grand_total
    FROM calculated_live cl
    ORDER BY grand_total DESC, cl.username ASC;
END;
$$;

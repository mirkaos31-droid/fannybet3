-- Migration: Fix Leaderboard Old Points
-- Description: Creates calculate_fb_league_matchday_points helper and updates get_fb_league_live_leaderboard to dynamically add unresolved but globally archived matchday points (like Matchday 25) to the participants' baseline total points.

-- 1. Helper function to calculate a user's points for a specific matchday
CREATE OR REPLACE FUNCTION public.calculate_fb_league_matchday_points(
    p_league_id BIGINT,
    p_matchday_id BIGINT,
    p_user_id UUID,
    p_league_rules JSONB
) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
    v_results TEXT[];
    v_jolly_idx INTEGER;
    v_predictions TEXT[];
    v_correct_count INTEGER := 0;
    v_match_points INTEGER := 0;
    v_total_picks INTEGER := 0;
    v_match_counts JSONB := '{}'::JSONB;
    v_has_strike BOOLEAN := false;
    v_current_streak INTEGER := 0;
BEGIN
    -- Get results and jolly index
    SELECT results, jolly_match_index INTO v_results, v_jolly_idx
    FROM public.matchdays WHERE id = p_matchday_id;

    IF v_results IS NULL THEN
        RETURN 0;
    END IF;

    -- Get predictions
    SELECT predictions INTO v_predictions
    FROM public.fb_league_picks
    WHERE league_id = p_league_id AND matchday_id = p_matchday_id AND user_id = p_user_id;

    IF v_predictions IS NULL THEN
        RETURN 0;
    END IF;

    -- Match counts for underdog
    IF (p_league_rules->>'underdog_enabled')::BOOLEAN THEN
        SELECT COUNT(*)::INTEGER INTO v_total_picks 
        FROM public.fb_league_picks 
        WHERE league_id = p_league_id AND matchday_id = p_matchday_id;

        IF v_total_picks > 0 THEN
            SELECT jsonb_object_agg(m_idx, counts) INTO v_match_counts
            FROM (
                SELECT i::TEXT as m_idx, jsonb_object_agg(pred, cnt) as counts
                FROM (
                    SELECT s.i, lp.predictions[s.i] as pred, COUNT(*)::INTEGER as cnt
                    FROM public.fb_league_picks lp
                    CROSS JOIN generate_series(1, 10) AS s(i)
                    WHERE lp.league_id = p_league_id 
                      AND lp.matchday_id = p_matchday_id
                      AND lp.predictions[s.i] IS NOT NULL
                    GROUP BY s.i, lp.predictions[s.i]
                ) inner_s GROUP BY i
            ) t;
        END IF;
    END IF;

    -- Calculate points
    FOR i IN 1..10 LOOP
        IF v_predictions[i] = v_results[i] THEN
            v_correct_count := v_correct_count + 1;
            v_current_streak := v_current_streak + 1;
            IF v_current_streak >= 3 THEN
                v_has_strike := true;
            END IF;

            -- Base points
            v_match_points := v_match_points + COALESCE((p_league_rules->>v_results[i])::INTEGER, 1);
            -- Jolly bonus
            IF v_jolly_idx IS NOT NULL AND (i - 1) = v_jolly_idx THEN
                v_match_points := v_match_points + 2;
            END IF;
            -- Underdog bonus
            IF (p_league_rules->>'underdog_enabled')::BOOLEAN AND v_total_picks > 3 THEN
                IF ((v_match_counts->i::TEXT->>v_predictions[i])::INTEGER::FLOAT / v_total_picks::FLOAT) < 0.15 THEN
                    v_match_points := v_match_points + 2;
                END IF;
            END IF;
        ELSE
            v_current_streak := 0;
        END IF;
    END LOOP;

    -- Add strike and en plein
    IF v_has_strike THEN
        v_match_points := v_match_points + 3;
    END IF;
    IF v_correct_count = 10 THEN
        v_match_points := v_match_points + 10;
    END IF;

    RETURN v_match_points;
END;
$$;

-- 2. Update live leaderboard function to dynamically add unresolved archived matchday points
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
    v_active_matchday_id BIGINT;
    v_results TEXT[];
    v_jolly_idx INTEGER;
    v_current_round INTEGER;
    v_league_rules JSONB;
BEGIN
    -- Get league details
    SELECT current_round, scoring_rules INTO v_current_round, v_league_rules 
    FROM public.fb_leagues WHERE id = p_league_id;
    
    -- Get the global active matchday ID (OPEN or CLOSED)
    SELECT id INTO v_active_matchday_id 
    FROM public.matchdays 
    WHERE status IN ('OPEN', 'CLOSED') 
    ORDER BY deadline ASC 
    LIMIT 1;

    IF v_active_matchday_id IS NOT NULL THEN
        -- Get active matchday results and jolly index
        SELECT results, jolly_match_index INTO v_results, v_jolly_idx
        FROM public.matchdays WHERE id = v_active_matchday_id;
    END IF;

    RETURN QUERY
    WITH participant_base AS (
        SELECT 
            lp.user_id,
            p.username,
            lp.total_points AS resolved_points,
            -- Sum of all unresolved archived matchdays
            (
                SELECT COALESCE(SUM(
                    public.calculate_fb_league_matchday_points(p_league_id, m.matchday_id, lp.user_id, v_league_rules)
                ), 0)::INTEGER
                FROM public.get_fb_league_matchdays(p_league_id) m
                JOIN public.matchdays md ON md.id = m.matchday_id
                WHERE m.round_number > v_current_round
                  AND md.status = 'ARCHIVED'
            ) AS unresolved_archived_points
        FROM public.fb_league_participants lp
        JOIN public.profiles p ON lp.user_id = p.id
        WHERE lp.league_id = p_league_id
    ),
    participant_live AS (
        SELECT 
            pb.user_id,
            pb.username,
            (pb.resolved_points + pb.unresolved_archived_points)::INTEGER AS total_points,
            CASE 
                WHEN v_active_matchday_id IS NULL THEN 0
                ELSE public.calculate_fb_league_matchday_points(p_league_id, v_active_matchday_id, pb.user_id, v_league_rules)
            END::INTEGER AS live_points
        FROM participant_base pb
    )
    SELECT 
        pl.user_id,
        pl.username,
        pl.total_points,
        pl.live_points,
        (pl.total_points + pl.live_points)::INTEGER AS grand_total,
        -- Get active bonuses for the live matchday
        (
            SELECT COALESCE(jsonb_agg(b), '[]'::JSONB) FROM (
                SELECT 'jolly' as b WHERE v_active_matchday_id IS NOT NULL AND v_jolly_idx IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.fb_league_picks pk
                    WHERE pk.league_id = p_league_id AND pk.matchday_id = v_active_matchday_id AND pk.user_id = pl.user_id
                      AND pk.predictions[v_jolly_idx + 1] = v_results[v_jolly_idx + 1]
                )
                UNION ALL
                SELECT 'strike' WHERE v_active_matchday_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM (
                        SELECT s.i, COUNT(*) FILTER (WHERE pk.predictions[s.i] = v_results[s.i]) OVER (ORDER BY s.i ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as consecutive
                        FROM generate_series(1, 10) AS s(i)
                        JOIN public.fb_league_picks pk ON pk.league_id = p_league_id AND pk.matchday_id = v_active_matchday_id AND pk.user_id = pl.user_id
                    ) consecutive_check WHERE consecutive = 3
                )
                UNION ALL
                SELECT 'en_plein' WHERE v_active_matchday_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.fb_league_picks pk
                    WHERE pk.league_id = p_league_id AND pk.matchday_id = v_active_matchday_id AND pk.user_id = pl.user_id
                      AND (SELECT COUNT(*) FROM generate_series(1,10) s(i) WHERE pk.predictions[s.i] = v_results[s.i]) = 10
                )
                UNION ALL
                SELECT 'underdog' WHERE v_active_matchday_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM generate_series(1, 10) AS s(i) 
                    JOIN public.fb_league_picks pk ON pk.league_id = p_league_id AND pk.matchday_id = v_active_matchday_id AND pk.user_id = pl.user_id
                    WHERE pk.predictions[s.i] = v_results[s.i] 
                    AND (v_league_rules->>'underdog_enabled')::BOOLEAN 
                    AND (SELECT COUNT(*) FROM public.fb_league_picks WHERE league_id = p_league_id AND matchday_id = v_active_matchday_id) > 3 
                    AND pk.predictions[s.i] IS NOT NULL
                    AND (
                        SELECT ((COUNT(*))::FLOAT / (SELECT COUNT(*) FROM public.fb_league_picks WHERE league_id = p_league_id AND matchday_id = v_active_matchday_id)::FLOAT) < 0.15
                        FROM public.fb_league_picks lp2
                        WHERE lp2.league_id = p_league_id 
                          AND lp2.matchday_id = v_active_matchday_id
                          AND lp2.predictions[s.i] = pk.predictions[s.i]
                    )
                )
            ) bonus_subquery
        ) as active_bonuses
    FROM participant_live pl
    ORDER BY grand_total DESC, pl.username ASC;
END;
$$;

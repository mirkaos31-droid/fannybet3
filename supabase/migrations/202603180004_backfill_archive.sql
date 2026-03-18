-- Migration: Backfill Historical Archive Data
-- Description: Populates fb_league_matchday_results for all previously completed rounds.

DO $$
DECLARE
    v_league_id BIGINT;
    v_matchday_record RECORD;
    v_results TEXT[];
    v_jolly_idx INTEGER;
    v_rules JSONB;
    v_total_picks INTEGER;
    v_match_counts JSONB;
BEGIN
    -- Iterate through all ACTIVE or COMPLETED leagues
    FOR v_league_id, v_rules IN SELECT id, scoring_rules FROM public.fb_leagues LOOP
        
        -- Iterate through all matchdays belonging to this league that are CLOSED or ARCHIVED
        -- and have NOT been archived in fb_league_matchday_results yet.
        FOR v_matchday_record IN 
            SELECT md.id as matchday_id, md.results, md.jolly_match_index, m.round_number
            FROM public.get_fb_league_matchdays(v_league_id) m
            JOIN public.matchdays md ON md.id = m.matchday_id
            WHERE md.status IN ('CLOSED', 'ARCHIVED') AND md.results IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM public.fb_league_matchday_results mr WHERE mr.league_id = v_league_id AND mr.matchday_id = md.id)
            ORDER BY m.round_number ASC
        LOOP
            v_results := v_matchday_record.results;
            v_jolly_idx := v_matchday_record.jolly_match_index;

            -- 1. Calculate Popularity for this specific matchday
            IF (v_rules->>'underdog_enabled')::BOOLEAN THEN
                SELECT COUNT(*)::INTEGER INTO v_total_picks FROM public.fb_league_picks WHERE league_id = v_league_id AND matchday_id = v_matchday_record.matchday_id;
                IF v_total_picks > 0 THEN
                    SELECT jsonb_object_agg(m_idx, counts) INTO v_match_counts
                    FROM (
                        SELECT i::TEXT as m_idx, jsonb_object_agg(pred, cnt) as counts
                        FROM (
                            SELECT s.i, lp.predictions[s.i] as pred, COUNT(*)::INTEGER as cnt
                            FROM public.fb_league_picks lp
                            CROSS JOIN generate_series(1, 10) AS s(i)
                            WHERE lp.league_id = v_league_id AND lp.matchday_id = v_matchday_record.matchday_id AND lp.predictions[s.i] IS NOT NULL
                            GROUP BY s.i, lp.predictions[s.i]
                        ) inner_s GROUP BY i
                    ) t;
                END IF;
            END IF;

            -- 2. Calculate scores for all participants for this specific round AND cumulative up to this round
            INSERT INTO public.fb_league_matchday_results (league_id, matchday_id, user_id, points_matchday, points_total, rank, active_bonuses)
            SELECT 
                v_league_id,
                v_matchday_record.matchday_id,
                user_id,
                round_total_points,
                accumulated_points_at_md,
                RANK() OVER (ORDER BY accumulated_points_at_md DESC),
                bonuses
            FROM (
                SELECT 
                    lp_outer.user_id,
                    (
                        -- Round Points Calculation
                        SELECT (match_pts + (CASE WHEN max_cons >= 3 THEN 3 ELSE 0 END) + (CASE WHEN corr_cnt = 10 THEN 10 ELSE 0 END))::INTEGER
                        FROM (
                            SELECT 
                                (SELECT COALESCE(SUM(
                                    CASE 
                                        WHEN pk.predictions[s.i] = v_results[s.i] THEN 
                                            COALESCE((v_rules->>v_results[s.i])::INTEGER, 1) +
                                            (CASE WHEN v_jolly_idx IS NOT NULL AND (s.i - 1) = v_jolly_idx THEN 2 ELSE 0 END) +
                                            (CASE 
                                                WHEN (v_rules->>'underdog_enabled')::BOOLEAN 
                                                  AND v_total_picks > 3 
                                                  AND pk.predictions[s.i] IS NOT NULL
                                                  AND ((v_match_counts->s.i::TEXT->>pk.predictions[s.i])::INTEGER::FLOAT / v_total_picks::FLOAT) < 0.15 
                                                THEN 2 ELSE 0 END)
                                        ELSE 0 
                                    END
                                ), 0)::INTEGER as match_pts,
                                (SELECT COUNT(*) FROM generate_series(1,10) s(i) WHERE pk.predictions[s.i] = v_results[s.i])::INTEGER as corr_cnt,
                                (SELECT COALESCE(MAX(consecutive), 0) FROM (
                                    SELECT COUNT(*) OVER (PARTITION BY grp) as consecutive
                                    FROM (
                                        SELECT s.i, s.i - ROW_NUMBER() OVER (ORDER BY s.i) as grp
                                        FROM generate_series(1, 10) s(i)
                                        WHERE pk.predictions[s.i] = v_results[s.i]
                                    ) groups
                                ) final_consecutive)::INTEGER as max_cons
                            FROM public.fb_league_picks pk 
                            WHERE pk.league_id = v_league_id AND pk.matchday_id = v_matchday_record.matchday_id AND pk.user_id = lp_outer.user_id
                        ) round_stats
                    ) as round_total_points,
                    (
                        -- Cumulative Points up to this matchday (sum of all resolved rounds <= current)
                        SELECT COALESCE(SUM(pk_past.points_earned), 0)
                        FROM public.fb_league_picks pk_past
                        JOIN public.get_fb_league_matchdays(v_league_id) gmd ON gmd.matchday_id = pk_past.matchday_id
                        WHERE pk_past.league_id = v_league_id AND pk_past.user_id = lp_outer.user_id
                        AND gmd.round_number <= v_matchday_record.round_number
                    ) as accumulated_points_at_md,
                    (
                        -- Bonuses for archival
                        SELECT COALESCE(jsonb_agg(bonus), '[]'::JSONB) FROM (
                            SELECT 'jolly' as bonus WHERE v_jolly_idx IS NOT NULL AND (SELECT pk.predictions[v_jolly_idx + 1] FROM public.fb_league_picks pk WHERE pk.league_id = v_league_id AND pk.matchday_id = v_matchday_record.matchday_id AND pk.user_id = lp_outer.user_id) = v_results[v_jolly_idx + 1]
                            UNION ALL SELECT 'strike' WHERE (SELECT COALESCE(MAX(consecutive), 0) FROM (SELECT COUNT(*) OVER (PARTITION BY grp) as consecutive FROM (SELECT s.i, s.i - ROW_NUMBER() OVER (ORDER BY s.i) as grp FROM generate_series(1, 10) s(i) WHERE (SELECT pk.predictions[s.i] FROM public.fb_league_picks pk WHERE pk.league_id = v_league_id AND pk.matchday_id = v_matchday_record.matchday_id AND pk.user_id = lp_outer.user_id) = v_results[s.i]) groups) fc) >= 3
                            UNION ALL SELECT 'en_plein' WHERE (SELECT COUNT(*) FROM generate_series(1,10) s(i) WHERE (SELECT pk.predictions[s.i] FROM public.fb_league_picks pk WHERE pk.league_id = v_league_id AND pk.matchday_id = v_matchday_record.matchday_id AND pk.user_id = lp_outer.user_id) = v_results[s.i]) = 10
                            UNION ALL SELECT 'underdog' WHERE EXISTS (
                                SELECT 1 FROM generate_series(1, 10) AS s(i) 
                                WHERE (SELECT pk.predictions[s.i] FROM public.fb_league_picks pk WHERE pk.league_id = v_league_id AND pk.matchday_id = v_matchday_record.matchday_id AND pk.user_id = lp_outer.user_id) = v_results[s.i] 
                                AND (v_rules->>'underdog_enabled')::BOOLEAN AND v_total_picks > 3 
                                AND ((v_match_counts->s.i::TEXT->>(SELECT pk.predictions[s.i] FROM public.fb_league_picks pk WHERE pk.league_id = v_league_id AND pk.matchday_id = v_matchday_record.matchday_id AND pk.user_id = lp_outer.user_id))::INTEGER::FLOAT / v_total_picks::FLOAT) < 0.15
                            )
                        ) b
                    ) as bonuses
                FROM public.fb_league_participants lp_outer
                WHERE lp_outer.league_id = v_league_id
            ) final_calc;
            
        END LOOP;
    END LOOP;
END;
$$;

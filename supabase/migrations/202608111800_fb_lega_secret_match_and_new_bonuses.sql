-- Migration: Add Secret Match (2X Points) and New FB Lega Bonuses
-- Description: Adds secret_match_index column to fb_league_picks, updates submit_fb_league_picks, calculate_fb_league_matchday_points, resolve_fb_league_round, and get_fb_league_live_leaderboard.

-- 1. Add secret_match_index column to fb_league_picks
ALTER TABLE public.fb_league_picks 
ADD COLUMN IF NOT EXISTS secret_match_index INTEGER DEFAULT NULL;

-- 2. Update submit_fb_league_picks RPC
CREATE OR REPLACE FUNCTION public.submit_fb_league_picks(
    p_league_id BIGINT,
    p_matchday_id BIGINT,
    p_predictions TEXT[],
    p_secret_match_index INTEGER DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_uid UUID;
    v_deadline TIMESTAMPTZ;
    v_locked BOOLEAN;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Non autenticato');
    END IF;

    -- Check membership
    IF NOT EXISTS (
        SELECT 1 FROM public.fb_league_participants 
        WHERE league_id = p_league_id AND user_id = v_uid
    ) THEN
        RETURN json_build_object('success', false, 'message', 'Non sei iscritto a questa lega');
    END IF;

    -- Check matchday deadline & lock
    SELECT deadline, COALESCE(bets_locked, false) INTO v_deadline, v_locked
    FROM public.matchdays WHERE id = p_matchday_id;

    IF v_locked OR (v_deadline IS NOT NULL AND v_deadline < now()) THEN
        RETURN json_build_object('success', false, 'message', 'Pronostici chiusi per questa giornata');
    END IF;

    -- Insert or Update pick
    INSERT INTO public.fb_league_picks (league_id, matchday_id, user_id, predictions, secret_match_index, updated_at)
    VALUES (p_league_id, p_matchday_id, v_uid, p_predictions, p_secret_match_index, now())
    ON CONFLICT (league_id, matchday_id, user_id) 
    DO UPDATE SET 
        predictions = EXCLUDED.predictions,
        secret_match_index = EXCLUDED.secret_match_index,
        updated_at = now();

    RETURN json_build_object('success', true, 'message', 'Pronostici e Match Segreto salvati con successo!');
END;
$$;

-- 3. Update calculate_fb_league_matchday_points helper function
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
    v_secret_idx INTEGER;
    v_correct_count INTEGER := 0;
    v_correct_draws INTEGER := 0;
    v_match_points INTEGER := 0;
    v_total_picks INTEGER := 0;
    v_match_counts JSONB := '{}'::JSONB;
    v_has_strike BOOLEAN := false;
    v_current_streak INTEGER := 0;
    v_base_pts INTEGER := 1;
BEGIN
    -- Get results and jolly index
    SELECT results, jolly_match_index INTO v_results, v_jolly_idx
    FROM public.matchdays WHERE id = p_matchday_id;

    IF v_results IS NULL THEN
        RETURN 0;
    END IF;

    -- Get predictions and secret match index
    SELECT predictions, secret_match_index INTO v_predictions, v_secret_idx
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

    -- Calculate points per match
    FOR i IN 1..10 LOOP
        IF v_predictions[i] = v_results[i] THEN
            v_correct_count := v_correct_count + 1;
            v_current_streak := v_current_streak + 1;
            IF v_current_streak >= 3 THEN
                v_has_strike := true;
            END IF;

            IF v_results[i] = 'X' THEN
                v_correct_draws := v_correct_draws + 1;
            END IF;

            -- Base match points
            v_base_pts := COALESCE((p_league_rules->>v_results[i])::INTEGER, 1);
            
            -- Secret match doubling (2x base points)
            IF v_secret_idx IS NOT NULL AND (i - 1) = v_secret_idx THEN
                v_match_points := v_match_points + (v_base_pts * 2);
            ELSE
                v_match_points := v_match_points + v_base_pts;
            END IF;

            -- Admin Jolly match bonus (+2 PT)
            IF v_jolly_idx IS NOT NULL AND (i - 1) = v_jolly_idx THEN
                v_match_points := v_match_points + 2;
            END IF;

            -- Underdog bonus (+2 PT)
            IF (p_league_rules->>'underdog_enabled')::BOOLEAN AND v_total_picks > 3 THEN
                IF ((v_match_counts->i::TEXT->>v_predictions[i])::INTEGER::FLOAT / v_total_picks::FLOAT) < 0.15 THEN
                    v_match_points := v_match_points + 2;
                END IF;
            END IF;
        ELSE
            v_current_streak := 0;
        END IF;
    END LOOP;

    -- Round Bonuses:
    -- 1. Strike (3+ in a row): +3 PT
    IF v_has_strike THEN
        v_match_points := v_match_points + 3;
    END IF;

    -- 2. En Plein (10/10): +10 PT
    IF v_correct_count = 10 THEN
        v_match_points := v_match_points + 10;
    -- 3. Cappotto (9/10): +5 PT
    ELSIF v_correct_count = 9 THEN
        v_match_points := v_match_points + 5;
    END IF;

    -- 4. Mago dei Pareggi (2+ X correct): +3 PT
    IF v_correct_draws >= 2 THEN
        v_match_points := v_match_points + 3;
    END IF;

    RETURN v_match_points;
END;
$$;

-- 4. Update resolve_fb_league_round RPC
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
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    SELECT scoring_rules, current_round INTO v_rules, v_resolved_count FROM public.fb_leagues WHERE id = p_league_id;
    
    SELECT results, jolly_match_index INTO v_results, v_jolly_idx 
    FROM public.matchdays 
    WHERE id = p_matchday_id AND status IN ('CLOSED', 'ARCHIVED');

    IF v_results IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Matchday results not found or matchday neither closed nor archived');
    END IF;

    SELECT id INTO v_card_hattrick_id FROM public.collectible_cards WHERE title = 'Hat-trick';
    SELECT id INTO v_card_underdog_id FROM public.collectible_cards WHERE title = 'UNDERDOG';

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

    CREATE TEMP TABLE round_calculation ON COMMIT DROP AS
    WITH raw_picks AS (
        SELECT 
            lp.user_id,
            pk.id as pick_id,
            pk.predictions,
            pk.secret_match_index,
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
            rp.secret_match_index,
            (
                SELECT COALESCE(SUM(
                    CASE 
                        WHEN rp.predictions[s.i] = v_results[s.i] THEN 
                            (COALESCE((v_rules->>v_results[s.i])::INTEGER, 1) * (CASE WHEN rp.secret_match_index IS NOT NULL AND (s.i - 1) = rp.secret_match_index THEN 2 ELSE 1 END)) +
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
                SELECT COUNT(*) FROM generate_series(1,10) s(i) WHERE rp.predictions[s.i] = v_results[s.i] AND v_results[s.i] = 'X'
            )::INTEGER as correct_draws,
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
            (
                c.round_match_points + 
                (CASE WHEN c.max_consecutive >= 3 THEN 3 ELSE 0 END) + 
                (CASE WHEN c.correct_count = 10 THEN 10 WHEN c.correct_count = 9 THEN 5 ELSE 0 END) +
                (CASE WHEN c.correct_draws >= 2 THEN 3 ELSE 0 END)
            )::INTEGER as round_total_points
        FROM calculated c
    ),
    ranked_results AS (
        SELECT 
            fs.*,
            RANK() OVER (ORDER BY (fs.accumulated_points + fs.round_total_points) DESC) as final_rank,
            COALESCE((
                SELECT jsonb_agg(bonus) FROM (
                    SELECT 'jolly' as bonus WHERE v_jolly_idx IS NOT NULL AND (SELECT rp.predictions[v_jolly_idx + 1] FROM raw_picks rp WHERE rp.user_id = fs.user_id) = v_results[v_jolly_idx + 1]
                    UNION ALL SELECT 'secret_match' WHERE fs.secret_match_index IS NOT NULL AND (SELECT rp.predictions[fs.secret_match_index + 1] FROM raw_picks rp WHERE rp.user_id = fs.user_id) = v_results[fs.secret_match_index + 1]
                    UNION ALL SELECT 'strike' WHERE fs.max_consecutive >= 3
                    UNION ALL SELECT 'en_plein' WHERE fs.correct_count = 10
                    UNION ALL SELECT 'cappotto' WHERE fs.correct_count = 9
                    UNION ALL SELECT 'mago_pareggi' WHERE fs.correct_draws >= 2
                    UNION ALL SELECT 'underdog' WHERE EXISTS (
                        SELECT 1 FROM generate_series(1, 10) AS s(i) 
                        JOIN raw_picks rp2 ON rp2.user_id = fs.user_id
                        WHERE rp2.predictions[s.i] = v_results[s.i] 
                        AND (v_rules->>'underdog_enabled')::BOOLEAN 
                        AND v_total_picks > 3 
                        AND ((v_match_counts->s.i::TEXT->>rp2.predictions[s.i])::INTEGER::FLOAT / v_total_picks::FLOAT) < 0.15
                    )
                ) b
            ), '[]'::JSONB) as bonuses
        FROM final_scores fs
    )
    SELECT * FROM ranked_results;

    v_resolved_count := 0;
    FOR v_rec IN SELECT * FROM round_calculation LOOP
        UPDATE public.fb_league_picks SET points_earned = v_rec.round_total_points WHERE id = v_rec.pick_id;
        
        UPDATE public.fb_league_participants SET total_points = total_points + v_rec.round_total_points WHERE league_id = p_league_id AND user_id = v_rec.user_id;
        
        INSERT INTO public.fb_league_matchday_results (league_id, matchday_id, user_id, points_matchday, points_total, rank, active_bonuses)
        VALUES (p_league_id, p_matchday_id, v_rec.user_id, v_rec.round_total_points, v_rec.accumulated_points + v_rec.round_total_points, v_rec.final_rank, COALESCE(v_rec.bonuses, '[]'::JSONB));

        IF v_card_hattrick_id IS NOT NULL AND v_rec.max_consecutive >= 3 THEN
            INSERT INTO public.user_cards (user_id, card_id) VALUES (v_rec.user_id, v_card_hattrick_id) ON CONFLICT DO NOTHING;
        END IF;

        IF v_card_underdog_id IS NOT NULL AND v_rec.bonuses IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_rec.bonuses) WHERE value = 'underdog') THEN
            INSERT INTO public.user_cards (user_id, card_id) VALUES (v_rec.user_id, v_card_underdog_id) ON CONFLICT DO NOTHING;
        END IF;

        v_resolved_count := v_resolved_count + 1;
    END LOOP;

    UPDATE public.fb_leagues SET current_round = current_round + 1 WHERE id = p_league_id;

    IF (v_rules->>'monthly_comeback_enabled')::BOOLEAN THEN
        PERFORM public.apply_fb_league_monthly_comeback(p_league_id, (SELECT current_round FROM public.fb_leagues WHERE id = p_league_id));
    END IF;

    RETURN json_build_object('success', true, 'message', 'Round risolto e archiviato con successo con nuovi bonus', 'resolved_count', v_resolved_count);
END;
$$;

-- 5. Update live leaderboard active_bonuses calculation
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
    SELECT current_round, scoring_rules INTO v_current_round, v_league_rules 
    FROM public.fb_leagues WHERE id = p_league_id;
    
    SELECT id INTO v_active_matchday_id 
    FROM public.matchdays 
    WHERE status IN ('OPEN', 'CLOSED') 
    ORDER BY deadline ASC 
    LIMIT 1;

    IF v_active_matchday_id IS NOT NULL THEN
        SELECT results, jolly_match_index INTO v_results, v_jolly_idx
        FROM public.matchdays WHERE id = v_active_matchday_id;
    END IF;

    RETURN QUERY
    WITH participant_base AS (
        SELECT 
            lp.user_id,
            p.username,
            lp.total_points AS resolved_points,
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
        (
            SELECT COALESCE(jsonb_agg(b), '[]'::JSONB) FROM (
                SELECT 'jolly' as b WHERE v_active_matchday_id IS NOT NULL AND v_jolly_idx IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.fb_league_picks pk
                    WHERE pk.league_id = p_league_id AND pk.matchday_id = v_active_matchday_id AND pk.user_id = pl.user_id
                      AND pk.predictions[v_jolly_idx + 1] = v_results[v_jolly_idx + 1]
                )
                UNION ALL
                SELECT 'secret_match' as b WHERE v_active_matchday_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.fb_league_picks pk
                    WHERE pk.league_id = p_league_id AND pk.matchday_id = v_active_matchday_id AND pk.user_id = pl.user_id
                      AND pk.secret_match_index IS NOT NULL
                      AND pk.predictions[pk.secret_match_index + 1] = v_results[pk.secret_match_index + 1]
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
                SELECT 'cappotto' WHERE v_active_matchday_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.fb_league_picks pk
                    WHERE pk.league_id = p_league_id AND pk.matchday_id = v_active_matchday_id AND pk.user_id = pl.user_id
                      AND (SELECT COUNT(*) FROM generate_series(1,10) s(i) WHERE pk.predictions[s.i] = v_results[s.i]) = 9
                )
                UNION ALL
                SELECT 'mago_pareggi' WHERE v_active_matchday_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.fb_league_picks pk
                    WHERE pk.league_id = p_league_id AND pk.matchday_id = v_active_matchday_id AND pk.user_id = pl.user_id
                      AND (SELECT COUNT(*) FROM generate_series(1,10) s(i) WHERE pk.predictions[s.i] = v_results[s.i] AND v_results[s.i] = 'X') >= 2
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

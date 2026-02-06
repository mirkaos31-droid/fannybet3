
-- 1. Create the sync function (Security Definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.sync_all_profile_stats()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    r RECORD;
    v_total_correct INTEGER;
    v_archived_bets_count INTEGER;
    v_total_bets_placed INTEGER;
    v_wins_1x2_count INTEGER;
    v_total_pts INTEGER;
    v_precision INTEGER;
    v_new_level INTEGER;
    v_total_wins INTEGER;
    v_total_tokens NUMERIC;
    v_count INTEGER := 0;
BEGIN
    FOR r IN SELECT id, username, wins_survival, total_tokens_won FROM public.profiles LOOP
        -- Initialize
        v_total_correct := 0;
        v_archived_bets_count := 0;
        v_wins_1x2_count := 0;
        v_total_pts := 0;

        -- Count total bets placed
        SELECT COUNT(*) INTO v_total_bets_placed FROM public.bets WHERE user_id = r.id;

        -- Calculate stats from archived matchdays
        WITH user_bets AS (
            SELECT b.predictions, m.results
            FROM public.bets b
            JOIN public.matchdays m ON b.matchday_id = m.id
            WHERE b.user_id = r.id AND m.status = 'ARCHIVED'
        ),
        scored_bets AS (
            SELECT 
                (
                    SELECT COUNT(*)
                    FROM unnest(predictions) WITH ORDINALITY p(val, idx)
                    JOIN unnest(results) WITH ORDINALITY res(val, idx) ON p.idx = res.idx
                    WHERE p.val = res.val AND p.val IS NOT NULL AND res.val IS NOT NULL
                ) as hits
            FROM user_bets
        )
        SELECT 
            COALESCE(SUM(hits), 0),
            COUNT(*),
            COUNT(*) FILTER (WHERE hits >= 7)
        INTO v_total_pts, v_archived_bets_count, v_wins_1x2_count
        FROM scored_bets;

        v_total_pts := COALESCE(v_total_pts, 0);
        v_archived_bets_count := COALESCE(v_archived_bets_count, 0);
        v_wins_1x2_count := COALESCE(v_wins_1x2_count, 0);
        v_total_correct := v_total_pts;

        -- Precision
        IF v_archived_bets_count > 0 THEN
            v_precision := ROUND((v_total_correct::FLOAT / (v_archived_bets_count * 12)) * 100);
        ELSE
            v_precision := 0;
        END IF;

        -- Total Wins
        v_total_wins := v_wins_1x2_count + COALESCE(r.wins_survival, 0);
        v_total_tokens := COALESCE(r.total_tokens_won, 0);

        -- Level
        v_new_level := 1;
        IF v_total_bets_placed >= 50 AND v_total_wins >= 15 AND v_total_tokens >= 5000 THEN v_new_level := 5;
        ELSIF v_total_bets_placed >= 30 AND v_total_wins >= 7 AND v_total_tokens >= 1500 THEN v_new_level := 4;
        ELSIF v_total_bets_placed >= 15 AND v_total_wins >= 3 AND v_total_tokens >= 500 THEN v_new_level := 3;
        ELSIF v_total_bets_placed >= 5 AND v_total_wins >= 1 AND v_total_tokens >= 100 THEN v_new_level := 2;
        END IF;

        -- Update Profile
        UPDATE public.profiles
        SET
            bets_placed = v_total_bets_placed,
            total_points = v_total_pts,
            wins_1x2 = v_wins_1x2_count,
            prediction_accuracy = v_precision,
            level = v_new_level,
            updated_at = now()
        WHERE id = r.id;
        
        v_count := v_count + 1;
    END LOOP;

    RETURN json_build_object('success', true, 'count', v_count);
END;
$$;

-- 2. Execute it immediately once to sync data
SELECT public.sync_all_profile_stats();

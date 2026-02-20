-- Migration: FB Lega Advanced Scoring & Jolly Match
-- Description: Adds jolly_match_index to matchdays and updates round resolution logic.

-- 1. ADD JOLLY MATCH TO MATCHDAYS
ALTER TABLE public.matchdays ADD COLUMN IF NOT EXISTS jolly_match_index INTEGER DEFAULT 0;

-- 2. UPDATE RESOLVE FB LEAGUE ROUND RPC
CREATE OR REPLACE FUNCTION public.resolve_fb_league_round(p_league_id BIGINT, p_matchday_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_results TEXT[];
    v_jolly_idx INTEGER;
    v_pick RECORD;
    v_score INTEGER;
    v_consecutive INTEGER;
    v_max_consecutive INTEGER;
    v_correct_count INTEGER;
    v_resolved_count INTEGER := 0;
BEGIN
    -- Get results and jolly index for the matchday
    SELECT results, jolly_match_index INTO v_results, v_jolly_idx
    FROM public.matchdays
    WHERE id = p_matchday_id AND status = 'CLOSED'; -- Should be closed/archived to resolve

    IF v_results IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Matchday results not found or matchday not closed');
    END IF;

    -- Iterate through all picks for this league and matchday
    FOR v_pick IN 
        SELECT id, user_id, predictions 
        FROM public.fb_league_picks 
        WHERE league_id = p_league_id AND matchday_id = p_matchday_id AND points_earned IS NULL
    LOOP
        v_score := 0;
        v_consecutive := 0;
        v_max_consecutive := 0;
        v_correct_count := 0;

        -- Calculate base points and check for 'X' bonus (2 pts)
        -- We only consider the FIRST 10 matches for FB Lega
        FOR i IN 1..10 LOOP
            IF v_pick.predictions[i] = v_results[i] THEN
                v_correct_count := v_correct_count + 1;
                v_consecutive := v_consecutive + 1;
                
                -- Base scoring: X = 2pts, others = 1pt
                IF v_results[i] = 'X' THEN
                    v_score := v_score + 2;
                ELSE
                    v_score := v_score + 1;
                END IF;

                -- Jolly Match Bonus: +2 pts (if this is the jolly match and it's correct)
                -- jolly_match_index is 0-indexed in DB, matches are 1-indexed in array? 
                -- Wait, predictions/results are TEXT[]. Usually 1-indexed in Postgres.
                -- Let's assume jolly_match_index is 0..9 corresponding to array indices 1..10.
                IF (i - 1) = v_jolly_idx THEN
                    v_score := v_score + 2;
                END IF;

                IF v_consecutive > v_max_consecutive THEN
                    v_max_consecutive := v_consecutive;
                END IF;
            ELSE
                v_consecutive := 0;
            END IF;
        END LOOP;

        -- Strike Bonus: +3 points for 3 results consecutive indovinati
        -- Using 'integer division' or just checking if max_consecutive >= 3?
        -- User said "+3 punti per tre risultati consecutivi indovinati". 
        -- Usually means at least one sequence of 3. Let's apply it once per round.
        IF v_max_consecutive >= 3 THEN
            v_score := v_score + 3;
        END IF;

        -- En Plein: +10 for all 10 correct
        IF v_correct_count = 10 THEN
            v_score := v_score + 10;
        END IF;

        -- Update pick with earned points
        UPDATE public.fb_league_picks 
        SET points_earned = v_score 
        WHERE id = v_pick.id;

        -- Update participant total points
        UPDATE public.fb_league_participants
        SET total_points = total_points + v_score
        WHERE league_id = p_league_id AND user_id = v_pick.user_id;

        v_resolved_count := v_resolved_count + 1;
    END LOOP;

    -- Update league round status
    UPDATE public.fb_leagues
    SET current_round = current_round + 1
    WHERE id = p_league_id;

    RETURN json_build_object(
        'success', true, 
        'message', 'Round resolved successfully', 
        'resolved_count', v_resolved_count
    );
END;
$$;

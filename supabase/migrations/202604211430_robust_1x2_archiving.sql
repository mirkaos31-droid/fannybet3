-- Migration: Robust 1x2 Archiving RPC
-- Description: Consolidates winner detection, prize calculation, profile updates, and card assignment into a single atomic transaction.

CREATE OR REPLACE FUNCTION public.admin_archive_1x2_matchday(p_matchday_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_matchday RECORD;
    v_bet RECORD;
    v_total_pot NUMERIC := 0;
    v_super_jackpot NUMERIC := 0;
    v_max_score INTEGER := 0;
    v_standard_winner_count INTEGER := 0;
    v_sj_winner_count INTEGER := 0;
    v_standard_share NUMERIC := 0;
    v_sj_share NUMERIC := 0;
    v_standard_winners_usernames TEXT[] := ARRAY[]::TEXT[];
    v_all_winners_ids UUID[] := ARRAY[]::UUID[];
    v_next_rollover NUMERIC := 0;
    v_burned_tokens NUMERIC := 0;
    v_winner_data RECORD;
    v_card_id_1x2 UUID;
    v_card_id_sj UUID;
    v_card_id_un_punto UUID;
    v_open_md_id BIGINT;
BEGIN
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized: Admin only');
    END IF;

    -- 2. Fetch Matchday Data
    SELECT * INTO v_matchday FROM public.matchdays WHERE id = p_matchday_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Giornata non trovata.');
    END IF;
    
    IF v_matchday.status = 'ARCHIVED' THEN
        RETURN json_build_object('success', false, 'message', 'Giornata già archiviata.');
    END IF;

    -- 3. Calculate REAL Pot from bets + rollover
    SELECT COALESCE(SUM(amount), 0) INTO v_total_pot FROM public.bets WHERE matchday_id = p_matchday_id;
    v_total_pot := v_total_pot + COALESCE(v_matchday.rollover_pot, 0);
    
    v_super_jackpot := COALESCE(v_matchday.super_jackpot, 0);

    -- 4. Find max score
    FOR v_bet IN SELECT * FROM public.bets WHERE matchday_id = p_matchday_id LOOP
        DECLARE
            v_score INTEGER := 0;
        BEGIN
            FOR i IN 1..12 LOOP
                IF v_matchday.results[i] IS NOT NULL AND v_matchday.results[i] = v_bet.predictions[i] THEN
                    v_score := v_score + 1;
                END IF;
            END LOOP;
            IF v_score > v_max_score THEN
                v_max_score := v_score;
            END IF;
        END;
    END LOOP;

    -- 5. Identify Winners & Shares (Standard Winners >= 8)
    IF v_max_score >= 8 THEN
        SELECT COUNT(*), array_agg(user_id) INTO v_standard_winner_count, v_all_winners_ids
        FROM (
            SELECT user_id, 
                   (SELECT count(*) FROM unnest(predictions, v_matchday.results) AS x(p, r) WHERE p = r) as score
            FROM public.bets 
            WHERE matchday_id = p_matchday_id
        ) s
        WHERE score = v_max_score;

        IF v_standard_winner_count > 0 THEN
            v_standard_share := floor(v_total_pot / v_standard_winner_count);
            v_burned_tokens := v_total_pot - (v_standard_share * v_standard_winner_count);
            
            SELECT array_agg(username) INTO v_standard_winners_usernames
            FROM public.profiles
            WHERE id = ANY(v_all_winners_ids);
            
            v_next_rollover := 0;
        ELSE
            v_next_rollover := v_total_pot;
        END IF;
    ELSE
        v_next_rollover := v_total_pot; -- Rollover if max score < 8
    END IF;

    -- Super Jackpot Winners
    SELECT COUNT(*), array_agg(user_id) INTO v_sj_winner_count, v_all_winners_ids
    FROM (
        SELECT user_id, 
               (SELECT count(*) FROM unnest(predictions, v_matchday.results) AS x(p, r) WHERE p = r) as score
        FROM public.bets 
        WHERE matchday_id = p_matchday_id AND include_super_jackpot = true
    ) s
    WHERE score >= 10;

    IF v_sj_winner_count > 0 AND v_super_jackpot > 0 THEN
        v_sj_share := floor(v_super_jackpot / v_sj_winner_count);
    END IF;

    -- 6. Collect Card IDs
    SELECT id INTO v_card_id_1x2 FROM public.collectible_cards WHERE title = '1x2 Winner' LIMIT 1;
    SELECT id INTO v_card_id_sj FROM public.collectible_cards WHERE title = 'SuperJ' LIMIT 1;
    SELECT id INTO v_card_id_un_punto FROM public.collectible_cards WHERE title = 'Un Punto' LIMIT 1;

    -- 7. Update Participants
    FOR v_bet IN SELECT * FROM public.bets WHERE matchday_id = p_matchday_id LOOP
        DECLARE
            v_score INTEGER := 0;
            v_to_add NUMERIC := 0;
            v_is_standard_winner BOOLEAN := false;
            v_is_sj_winner BOOLEAN := false;
        BEGIN
            FOR i IN 1..12 LOOP
                IF v_matchday.results[i] IS NOT NULL AND v_matchday.results[i] = v_bet.predictions[i] THEN
                    v_score := v_score + 1;
                END IF;
            END LOOP;

            IF v_max_score >= 8 AND v_score = v_max_score THEN
                v_is_standard_winner := true;
                v_to_add := v_to_add + v_standard_share;
            END IF;
            
            IF v_score >= 10 AND v_bet.include_super_jackpot = true THEN
                v_is_sj_winner := true;
                v_to_add := v_to_add + v_sj_share;
            END IF;

            UPDATE public.profiles
            SET tokens = tokens + v_to_add,
                wins_1x2 = wins_1x2 + (CASE WHEN v_is_standard_winner THEN 1 ELSE 0 END),
                total_tokens_won = total_tokens_won + v_to_add,
                total_points = total_points + v_score
            WHERE id = v_bet.user_id;

            -- Award Cards
            IF v_is_standard_winner AND v_card_id_1x2 IS NOT NULL THEN
                INSERT INTO public.user_cards (user_id, card_id) VALUES (v_bet.user_id, v_card_id_1x2) ON CONFLICT DO NOTHING;
            END IF;
            IF v_is_sj_winner AND v_card_id_sj IS NOT NULL THEN
                INSERT INTO public.user_cards (user_id, card_id) VALUES (v_bet.user_id, v_card_id_sj) ON CONFLICT DO NOTHING;
            END IF;
            IF v_score = 1 AND v_card_id_un_punto IS NOT NULL THEN
                INSERT INTO public.user_cards (user_id, card_id) VALUES (v_bet.user_id, v_card_id_un_punto) ON CONFLICT DO NOTHING;
            END IF;
        END;
    END LOOP;

    -- 8. Finalize Matchday
    UPDATE public.matchdays
    SET status = 'ARCHIVED',
        winners = to_jsonb(COALESCE(v_standard_winners_usernames, ARRAY[]::TEXT[])),
        winner_animation = (COALESCE(array_length(v_standard_winners_usernames, 1), 0) > 0),
        leaderboard_animation = (COALESCE(array_length(v_standard_winners_usernames, 1), 0) > 0),
        rollover_pot = v_next_rollover,
        current_pot = 0,
        super_jackpot = 0
    WHERE id = p_matchday_id;

    -- 9. Push Rollover
    IF v_next_rollover > 0 THEN
        SELECT id INTO v_open_md_id FROM public.matchdays WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1;
        IF v_open_md_id IS NOT NULL THEN
            UPDATE public.matchdays
            SET rollover_pot = rollover_pot + v_next_rollover,
                current_pot = current_pot + v_next_rollover
            WHERE id = v_open_md_id;
        END IF;
    END IF;

    -- 10. Track Burned Tokens
    IF v_burned_tokens > 0 THEN
        UPDATE public.system_stats SET value = (value::numeric + v_burned_tokens)::text WHERE key = 'burned_tokens';
    END IF;

    RETURN json_build_object(
        'success', true, 
        'message', 'Giornata archiviata con successo.', 
        'winners', v_standard_winners_usernames,
        'rollover', v_next_rollover
    );
END;
$$;

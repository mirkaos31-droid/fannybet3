DO $$
DECLARE
    v_winner_id UUID := '38e3164b-2c9a-4fe3-9a77-5057996b0e13'; 
    v_matchday_id BIGINT := 19;
    v_prize_pool NUMERIC := 3; 
    v_card_id UUID;
BEGIN
    UPDATE public.matchdays
    SET winners = jsonb_build_array('ZeroByte'),
        winner_animation = true,
        leaderboard_animation = true,
        current_pot = 0,
        rollover_pot = 0
    WHERE id = v_matchday_id;

    UPDATE public.profiles
    SET tokens = tokens + v_prize_pool,
        wins_1x2 = COALESCE(wins_1x2, 0) + 1,
        total_tokens_won = COALESCE(total_tokens_won, 0) + v_prize_pool,
        total_points = total_points + 8
    WHERE id = v_winner_id;

    SELECT id INTO v_card_id FROM public.collectible_cards WHERE title = '1x2 Winner' LIMIT 1;
    IF v_card_id IS NOT NULL THEN
        INSERT INTO public.user_cards (user_id, card_id)
        VALUES (v_winner_id, v_card_id)
        ON CONFLICT (user_id, card_id) DO NOTHING;
    END IF;

    RAISE NOTICE 'Matchday 19 fixed. ZeroByte awarded 3 FTK and win registered.';
END $$;

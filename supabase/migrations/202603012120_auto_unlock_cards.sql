-- Migration: Automated Card Unlocks & Seen Status
-- 1. Add 'seen_in_gallery' to user_cards to track animations
ALTER TABLE public.user_cards ADD COLUMN IF NOT EXISTS seen_in_gallery BOOLEAN DEFAULT false;

-- 2. Update prize distribution to award cards automatically
CREATE OR REPLACE FUNCTION public.distribute_fb_league_prizes(p_league_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_prize_pool NUMERIC;
    v_distribution JSONB;
    v_winners RECORD;
    v_participant_count INTEGER;
    v_prize_amount NUMERIC;
    v_winner_list JSONB := '[]'::JSONB;
    v_max_points INTEGER;
    v_min_points INTEGER;
    v_card_ultimo_id UUID;
    v_card_quasi_id UUID;
    i INTEGER := 1;
BEGIN
    -- Admin check
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Get league info
    SELECT prize_pool, prize_distribution INTO v_prize_pool, v_distribution 
    FROM public.fb_leagues WHERE id = p_league_id AND status = 'ACTIVE';

    IF v_prize_pool IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Lega non attiva o non trovata');
    END IF;

    -- Get participant count
    SELECT COUNT(*) INTO v_participant_count FROM public.fb_league_participants WHERE league_id = p_league_id;

    -- Identify Min and Max points for card awarding
    SELECT MAX(total_points), MIN(total_points) INTO v_max_points, v_min_points 
    FROM public.fb_league_participants WHERE league_id = p_league_id;

    -- Get Card IDs
    SELECT id INTO v_card_ultimo_id FROM public.collectible_cards WHERE title = 'Ultimo Posto';
    SELECT id INTO v_card_quasi_id FROM public.collectible_cards WHERE title = 'C''eri quasi!';

    -- 1. Award Winners (Tokens + Rank)
    FOR v_winners IN 
        SELECT user_id, total_points, p.username
        FROM public.fb_league_participants lp
        JOIN public.profiles p ON lp.user_id = p.id
        WHERE league_id = p_league_id
        ORDER BY total_points DESC
        LIMIT jsonb_array_length(v_distribution)
    LOOP
        v_prize_amount := v_prize_pool * (v_distribution->>(i-1))::NUMERIC;
        IF v_prize_amount > 0 THEN
            UPDATE public.profiles SET tokens = tokens + v_prize_amount, total_tokens_won = total_tokens_won + v_prize_amount WHERE id = v_winners.user_id;
            v_winner_list := v_winner_list || jsonb_build_object('rank', i, 'username', v_winners.username, 'points', v_winners.total_points, 'prize', v_prize_amount);
        END IF;
        i := i + 1;
    END LOOP;

    -- 2. Automated Card Awarding
    -- Last Place (Ultimo Posto)
    IF v_card_ultimo_id IS NOT NULL THEN
        INSERT INTO public.user_cards (user_id, card_id)
        SELECT user_id, v_card_ultimo_id FROM public.fb_league_participants 
        WHERE league_id = p_league_id AND total_points = v_min_points
        ON CONFLICT DO NOTHING;
    END IF;

    -- 1pt Loss (C'eri quasi!) - awarded to those with exactly winner_points - 1
    IF v_card_quasi_id IS NOT NULL AND v_max_points > v_min_points THEN
        INSERT INTO public.user_cards (user_id, card_id)
        SELECT user_id, v_card_quasi_id FROM public.fb_league_participants 
        WHERE league_id = p_league_id AND total_points = (v_max_points - 1)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Close league
    UPDATE public.fb_leagues SET status = 'COMPLETED' WHERE id = p_league_id;

    RETURN json_build_object('success', true, 'message', 'Premi distribuiti e Card sbloccate!', 'winners', v_winner_list);
END;
$$;

-- 3. Function to mark cards as seen
CREATE OR REPLACE FUNCTION public.mark_cards_as_seen()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.user_cards SET seen_in_gallery = true WHERE user_id = auth.uid() AND seen_in_gallery = false;
END;
$$;

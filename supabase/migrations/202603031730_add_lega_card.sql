-- Migration: Add Lega Card
-- Description: Adds the COMMON "Lega" card, awarded on the first ever fb_league subscription.

-- 1. Seed the card
INSERT INTO public.collectible_cards (title, description, rarity, category, image_url)
VALUES (
    'Lega',
    'Benvenuto nella competizione! Assegnata alla prima iscrizione a una lega.',
    'COMMON',
    'ACHIEVEMENT',
    'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/lega.png'
)
ON CONFLICT (title) DO UPDATE SET
    description = EXCLUDED.description,
    rarity      = EXCLUDED.rarity,
    image_url   = EXCLUDED.image_url;

-- 2. Update join_fb_league to award the card on first-ever league subscription
CREATE OR REPLACE FUNCTION public.join_fb_league(p_league_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_entry_fee      INTEGER;
    v_user_tokens    NUMERIC;
    v_league_status  TEXT;
    v_card_lega_id   UUID;
    v_is_first_league BOOLEAN;
BEGIN
    -- Check if league exists and is OPEN
    SELECT entry_fee, status INTO v_entry_fee, v_league_status
    FROM public.fb_leagues WHERE id = p_league_id;

    IF v_league_status IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Lega non trovata');
    END IF;

    IF v_league_status != 'OPEN' THEN
        RETURN json_build_object('success', false, 'message', 'Iscrizioni chiuse per questa lega');
    END IF;

    -- Check if already joined
    IF EXISTS (SELECT 1 FROM public.fb_league_participants WHERE league_id = p_league_id AND user_id = auth.uid()) THEN
        RETURN json_build_object('success', false, 'message', 'Sei già iscritto a questa lega');
    END IF;

    -- Check tokens
    SELECT tokens INTO v_user_tokens FROM public.profiles WHERE id = auth.uid();
    IF v_user_tokens < v_entry_fee THEN
        RETURN json_build_object('success', false, 'message', 'Token insufficienti');
    END IF;

    -- Check if this is the user's very first fb_league subscription (across all leagues)
    SELECT NOT EXISTS (
        SELECT 1 FROM public.fb_league_participants WHERE user_id = auth.uid()
    ) INTO v_is_first_league;

    -- Deduct tokens
    UPDATE public.profiles SET tokens = tokens - v_entry_fee WHERE id = auth.uid();

    -- Add to prize pool
    UPDATE public.fb_leagues SET prize_pool = prize_pool + v_entry_fee WHERE id = p_league_id;

    -- Add participant
    INSERT INTO public.fb_league_participants (league_id, user_id)
    VALUES (p_league_id, auth.uid());

    -- 🏆 Award "Lega" card on first ever subscription
    IF v_is_first_league THEN
        SELECT id INTO v_card_lega_id FROM public.collectible_cards WHERE title = 'Lega';
        IF v_card_lega_id IS NOT NULL THEN
            INSERT INTO public.user_cards (user_id, card_id)
            VALUES (auth.uid(), v_card_lega_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    RETURN json_build_object('success', true, 'message', 'Iscrizione effettuata con successo!');
END;
$$;

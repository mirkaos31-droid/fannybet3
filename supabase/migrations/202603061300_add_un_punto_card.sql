-- Migration: Add "Un Punto" Legendary Card
-- Description: Seeds the "Un Punto" card and adds logic to award it when scoring exactly 1 point in 1x2 mode.

-- 1. Seed the Card
INSERT INTO public.collectible_cards (title, description, rarity, category, image_url)
VALUES (
    'Un Punto', 
    'Sbloccata facendo un solo punto nell''intera schedina dell''1x2 mode.', 
    'LEGENDARY', 
    'ACHIEVEMENT',
    'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/un%20punto.png'
)
ON CONFLICT (title) DO UPDATE SET 
    description = EXCLUDED.description,
    rarity = EXCLUDED.rarity,
    image_url = EXCLUDED.image_url;

-- 2. Award Logic for 1x2 Mode
-- This block can be run manually to award cards for a specific matchday, 
-- or integrated into the matchday resolution process.
DO $$
DECLARE
    v_card_id UUID;
    v_matchday_id BIGINT;
    v_results TEXT[];
    v_bet RECORD;
    v_points INTEGER;
    i INTEGER;
BEGIN
    -- Get card ID
    SELECT id INTO v_card_id FROM public.collectible_cards WHERE title = 'Un Punto';
    
    -- Get the latest completed matchday that hasn't been processed for this card yet
    -- For safety, we'll target matchdays with results
    FOR v_matchday_id, v_results IN 
        SELECT id, results FROM public.matchdays WHERE results IS NOT NULL AND status = 'COMPLETED'
    LOOP
        -- Check each bet for this matchday
        FOR v_bet IN SELECT * FROM public.bets WHERE matchday_id = v_matchday_id LOOP
            v_points := 0;
            FOR i IN 1..array_length(v_results, 1) LOOP
                IF v_bet.predictions[i] = v_results[i] THEN
                    v_points := v_points + 1;
                END IF;
            END LOOP;

            -- If exactly 1 point, award the card
            IF v_points = 1 THEN
                INSERT INTO public.user_cards (user_id, card_id)
                VALUES (v_bet.user_id, v_card_id)
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

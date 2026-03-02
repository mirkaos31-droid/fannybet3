-- Migration: Assign 1x2 Winner Card to Matchday 16 Winners
-- This script ensures that the winners of Matchday 16 receive the '1x2 Winner' collectible card.

DO $$
DECLARE
    v_card_id UUID;
    v_winner_username TEXT;
    v_winner_id UUID;
BEGIN
    -- Get the card ID for the 1x2 Winner card
    SELECT id INTO v_card_id FROM public.collectible_cards WHERE title ILIKE '%1x2 Winner%' LIMIT 1;
    
    IF v_card_id IS NULL THEN
        RAISE NOTICE 'Card 1x2 Winner non trovata';
        RETURN;
    END IF;

    -- Loop through the winners of Matchday 16
    FOR v_winner_username IN 
        SELECT jsonb_array_elements_text(winners) FROM public.matchdays WHERE id = 16
    LOOP
        -- Get user ID
        SELECT id INTO v_winner_id FROM public.profiles WHERE username = v_winner_username;
        
        IF v_winner_id IS NOT NULL THEN
            -- Assign the card if they don't have it already
            INSERT INTO public.user_cards (user_id, card_id, unlocked_at)
            VALUES (v_winner_id, v_card_id, now())
            ON CONFLICT (user_id, card_id) DO NOTHING;
            
            RAISE NOTICE 'Assegnata card a %', v_winner_username;
        END IF;
    END LOOP;
END;
$$;
